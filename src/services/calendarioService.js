const { google } = require('googleapis');
const { OAuth2 } = google.auth;
const { QueryTypes } = require('sequelize');
const sequelize = require('../config/db');

class CalendarioService {
    
    static oAuth2Client = null;
    static calendar = null;
    
    static async inicializar() {
        try {
            if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET || !process.env.GOOGLE_REDIRECT_URI) {
                console.warn('Credenciales de Google Calendar no configuradas');
                return false;
            }
            
            this.oAuth2Client = new OAuth2(
                process.env.GOOGLE_CLIENT_ID,
                process.env.GOOGLE_CLIENT_SECRET,
                process.env.GOOGLE_REDIRECT_URI
            );
            
            // Configurar tokens si existen
            if (process.env.GOOGLE_ACCESS_TOKEN && process.env.GOOGLE_REFRESH_TOKEN) {
                this.oAuth2Client.setCredentials({
                    access_token: process.env.GOOGLE_ACCESS_TOKEN,
                    refresh_token: process.env.GOOGLE_REFRESH_TOKEN
                });
            }
            
            this.calendar = google.calendar({ version: 'v3', auth: this.oAuth2Client });
            
            console.log('✅ Servicio de Google Calendar inicializado');
            return true;
            
        } catch (error) {
            console.error('❌ Error al inicializar Google Calendar:', error);
            return false;
        }
    }
    
    static async sincronizarCitaConGoogleCalendar(citaId) {
        try {
            if (!this.calendar) {
                console.warn('Google Calendar no está inicializado');
                return false;
            }
            
            // Obtener datos de la cita
            const [cita] = await sequelize.query(`
                SELECT 
                    c.*,
                    CONCAT(p.nombre, ' ', p.apellido) as paciente_nombre,
                    p.email as paciente_email,
                    CONCAT(u_psi.nombre, ' ', u_psi.apellido) as psicologo_nombre,
                    u_psi.email as psicologo_email,
                    CONCAT(u_bec.nombre, ' ', u_bec.apellido) as becario_nombre,
                    u_bec.email as becario_email
                FROM citas c
                JOIN pacientes p ON c.paciente_id = p.id
                JOIN users u_psi ON c.psicologo_id = u_psi.id
                LEFT JOIN users u_bec ON c.becario_id = u_bec.id
                WHERE c.id = ?
            `, {
                replacements: [citaId],
                type: QueryTypes.SELECT
            });
            
            if (!cita) {
                throw new Error('Cita no encontrada');
            }
            
            // Crear evento en Google Calendar
            const evento = {
                summary: `Sesión psicológica - ${cita.paciente_nombre}`,
                description: this.generarDescripcionEvento(cita),
                start: {
                    dateTime: `${cita.fecha}T${cita.hora}:00`,
                    timeZone: 'America/Mexico_City'
                },
                end: {
                    dateTime: this.calcularHoraFin(cita.fecha, cita.hora, cita.duracion_minutos || 50),
                    timeZone: 'America/Mexico_City'
                },
                attendees: this.obtenerAsistentes(cita),
                reminders: {
                    useDefault: false,
                    overrides: [
                        { method: 'email', minutes: 24 * 60 }, // 1 día antes
                        { method: 'popup', minutes: 30 } // 30 minutos antes
                    ]
                },
                colorId: cita.tipo_consulta === 'virtual' ? '5' : '2' // Color diferente para virtual
            };
            
            const response = await this.calendar.events.insert({
                calendarId: 'primary',
                resource: evento,
                sendUpdates: 'all'
            });
            
            // Guardar ID del evento en la cita
            await sequelize.query(
                'UPDATE citas SET google_calendar_event_id = ? WHERE id = ?',
                { replacements: [response.data.id, citaId] }
            );
            
            console.log(`✅ Cita ${citaId} sincronizada con Google Calendar: ${response.data.htmlLink}`);
            return response.data;
            
        } catch (error) {
            console.error('❌ Error al sincronizar cita con Google Calendar:', error);
            throw error;
        }
    }
    
    static async actualizarEventoGoogleCalendar(citaId) {
        try {
            if (!this.calendar) {
                console.warn('Google Calendar no está inicializado');
                return false;
            }
            
            // Obtener cita con ID del evento
            const [cita] = await sequelize.query(
                'SELECT google_calendar_event_id FROM citas WHERE id = ?',
                { replacements: [citaId], type: QueryTypes.SELECT }
            );
            
            if (!cita || !cita.google_calendar_event_id) {
                // Si no tiene evento, crear uno nuevo
                return await this.sincronizarCitaConGoogleCalendar(citaId);
            }
            
            // Obtener datos actualizados de la cita
            const [citaActualizada] = await sequelize.query(`
                SELECT 
                    c.*,
                    CONCAT(p.nombre, ' ', p.apellido) as paciente_nombre,
                    p.email as paciente_email,
                    CONCAT(u_psi.nombre, ' ', u_psi.apellido) as psicologo_nombre,
                    u_psi.email as psicologo_email,
                    CONCAT(u_bec.nombre, ' ', u_bec.apellido) as becario_nombre,
                    u_bec.email as becario_email
                FROM citas c
                JOIN pacientes p ON c.paciente_id = p.id
                JOIN users u_psi ON c.psicologo_id = u_psi.id
                LEFT JOIN users u_bec ON c.becario_id = u_bec.id
                WHERE c.id = ?
            `, {
                replacements: [citaId],
                type: QueryTypes.SELECT
            });
            
            // Actualizar evento
            const evento = {
                summary: `Sesión psicológica - ${citaActualizada.paciente_nombre}`,
                description: this.generarDescripcionEvento(citaActualizada),
                start: {
                    dateTime: `${citaActualizada.fecha}T${citaActualizada.hora}:00`,
                    timeZone: 'America/Mexico_City'
                },
                end: {
                    dateTime: this.calcularHoraFin(citaActualizada.fecha, citaActualizada.hora, citaActualizada.duracion_minutos || 50),
                    timeZone: 'America/Mexico_City'
                },
                attendees: this.obtenerAsistentes(citaActualizada),
                colorId: citaActualizada.tipo_consulta === 'virtual' ? '5' : '2'
            };
            
            const response = await this.calendar.events.update({
                calendarId: 'primary',
                eventId: cita.google_calendar_event_id,
                resource: evento,
                sendUpdates: 'all'
            });
            
            console.log(`✅ Evento de cita ${citaId} actualizado en Google Calendar`);
            return response.data;
            
        } catch (error) {
            console.error('❌ Error al actualizar evento en Google Calendar:', error);
            throw error;
        }
    }
    
    static async eliminarEventoGoogleCalendar(citaId) {
        try {
            if (!this.calendar) {
                console.warn('Google Calendar no está inicializado');
                return false;
            }
            
            // Obtener ID del evento
            const [cita] = await sequelize.query(
                'SELECT google_calendar_event_id FROM citas WHERE id = ?',
                { replacements: [citaId], type: QueryTypes.SELECT }
            );
            
            if (!cita || !cita.google_calendar_event_id) {
                return true; // No hay evento que eliminar
            }
            
            // Eliminar evento
            await this.calendar.events.delete({
                calendarId: 'primary',
                eventId: cita.google_calendar_event_id,
                sendUpdates: 'all'
            });
            
            // Limpiar ID del evento en la cita
            await sequelize.query(
                'UPDATE citas SET google_calendar_event_id = NULL WHERE id = ?',
                { replacements: [citaId] }
            );
            
            console.log(`✅ Evento de cita ${citaId} eliminado de Google Calendar`);
            return true;
            
        } catch (error) {
            console.error('❌ Error al eliminar evento de Google Calendar:', error);
            throw error;
        }
    }
    
    static async obtenerDisponibilidadProfesional(usuarioId, fecha) {
        try {
            if (!this.calendar) {
                console.warn('Google Calendar no está inicializado');
                return null;
            }
            
            // Obtener email del profesional
            const [profesional] = await sequelize.query(
                'SELECT email FROM users WHERE id = ?',
                { replacements: [usuarioId], type: QueryTypes.SELECT }
            );
            
            if (!profesional || !profesional.email) {
                throw new Error('Profesional no encontrado o sin email');
            }
            
            // Obtener eventos del profesional para la fecha
            const inicio = new Date(`${fecha}T00:00:00`);
            const fin = new Date(`${fecha}T23:59:59`);
            
            const response = await this.calendar.events.list({
                calendarId: profesional.email,
                timeMin: inicio.toISOString(),
                timeMax: fin.toISOString(),
                singleEvents: true,
                orderBy: 'startTime'
            });
            
            return response.data.items.map(evento => ({
                inicio: evento.start.dateTime || evento.start.date,
                fin: evento.end.dateTime || evento.end.date,
                titulo: evento.summary,
                descripcion: evento.description
            }));
            
        } catch (error) {
            console.error('❌ Error al obtener disponibilidad de Google Calendar:', error);
            throw error;
        }
    }
    
    static async sincronizarAgendaCompleta(psicologoId, fechaInicio, fechaFin) {
        try {
            if (!this.calendar) {
                console.warn('Google Calendar no está inicializado');
                return false;
            }
            
            // Obtener citas del psicólogo en el rango de fechas
            const citas = await sequelize.query(`
                SELECT 
                    c.id,
                    c.fecha,
                    c.hora,
                    c.duracion_minutos,
                    c.tipo_consulta,
                    c.estado,
                    CONCAT(p.nombre, ' ', p.apellido) as paciente_nombre,
                    c.google_calendar_event_id
                FROM citas c
                JOIN pacientes p ON c.paciente_id = p.id
                WHERE c.psicologo_id = ?
                AND c.fecha BETWEEN ? AND ?
                AND c.estado IN ('programada', 'confirmada')
                ORDER BY c.fecha, c.hora
            `, {
                replacements: [psicologoId, fechaInicio, fechaFin],
                type: QueryTypes.SELECT
            });
            
            const resultados = {
                creados: 0,
                actualizados: 0,
                errores: 0
            };
            
            // Sincronizar cada cita
            for (const cita of citas) {
                try {
                    if (cita.google_calendar_event_id) {
                        await this.actualizarEventoGoogleCalendar(cita.id);
                        resultados.actualizados++;
                    } else {
                        await this.sincronizarCitaConGoogleCalendar(cita.id);
                        resultados.creados++;
                    }
                } catch (error) {
                    console.error(`❌ Error al sincronizar cita ${cita.id}:`, error.message);
                    resultados.errores++;
                }
            }
            
            console.log(`✅ Agenda sincronizada: ${resultados.creados} creados, ${resultados.actualizados} actualizados, ${resultados.errores} errores`);
            return resultados;
            
        } catch (error) {
            console.error('❌ Error al sincronizar agenda completa:', error);
            throw error;
        }
    }
    
    // Métodos auxiliares
    static generarDescripcionEvento(cita) {
        let descripcion = `Sesión psicológica con ${cita.paciente_nombre}\n`;
        descripcion += `Tipo: ${cita.tipo_consulta === 'virtual' ? 'Virtual' : 'Presencial'}\n`;
        descripcion += `Estado: ${cita.estado}\n`;
        descripcion += `Psicólogo: ${cita.psicologo_nombre}\n`;
        
        if (cita.becario_nombre) {
            descripcion += `Becario: ${cita.becario_nombre}\n`;
        }
        
        if (cita.notas) {
            descripcion += `\nNotas: ${cita.notas}\n`;
        }
        
        descripcion += `\nID de cita: ${cita.id}`;
        return descripcion;
    }
    
    static calcularHoraFin(fecha, hora, duracionMinutos) {
        const [horas, minutos] = hora.split(':').map(Number);
        const fechaHora = new Date(`${fecha}T${hora.padStart(5, '0')}:00`);
        fechaHora.setMinutes(fechaHora.getMinutes() + duracionMinutos);
        
        return fechaHora.toISOString();
    }
    
    static obtenerAsistentes(cita) {
        const asistentes = [];
        
        // Paciente
        if (cita.paciente_email) {
            asistentes.push({ email: cita.paciente_email, displayName: cita.paciente_nombre });
        }
        
        // Psicólogo
        if (cita.psicologo_email) {
            asistentes.push({ email: cita.psicologo_email, displayName: cita.psicologo_nombre });
        }
        
        // Becario
        if (cita.becario_email) {
            asistentes.push({ email: cita.becario_email, displayName: cita.becario_nombre });
        }
        
        return asistentes;
    }
    
    static async obtenerUrlAutorizacion() {
        if (!this.oAuth2Client) {
            throw new Error('OAuth2 no inicializado');
        }
        
        const url = this.oAuth2Client.generateAuthUrl({
            access_type: 'offline',
            scope: [
                'https://www.googleapis.com/auth/calendar',
                'https://www.googleapis.com/auth/calendar.events'
            ]
        });
        
        return url;
    }
    
    static async intercambiarCodigoPorToken(codigo) {
        if (!this.oAuth2Client) {
            throw new Error('OAuth2 no inicializado');
        }
        
        const { tokens } = await this.oAuth2Client.getToken(codigo);
        this.oAuth2Client.setCredentials(tokens);
        
        return tokens;
    }
}

// Inicializar al cargar el módulo
CalendarioService.inicializar().catch(console.error);

module.exports = CalendarioService;