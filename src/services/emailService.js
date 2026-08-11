const nodemailer = require('nodemailer');
const crearNotificacionCita = require('./emailTemplates/notificacionCita');
const crearNotificacionAlta = require('./emailTemplates/notificacionAlta');
const crearNotificacionObservacion = require('./emailTemplates/notificacionObservacion');
const crearBienvenidaUsuario = require('./emailTemplates/bienvenidaUsuario');
const crearRecordatorioCitasUsuario = require('./emailTemplates/recordatorioCitasUsuario');
const crearCambioContrasena = require('./emailTemplates/cambioContrasena');

class EmailService {
    
    static transporter = null;
    
    static async inicializar() {
        try {
            this.transporter = nodemailer.createTransport({
                host: process.env.SMTP_HOST,
                port: process.env.SMTP_PORT,
                secure: process.env.SMTP_SECURE === 'true',
                auth: {
                    user: process.env.SMTP_USER,
                    pass: process.env.SMTP_PASS
                }
            });
            
            // Verificar conexión
            await this.transporter.verify();
            console.log('✅ Servicio de email configurado correctamente');
            
        } catch (error) {
            console.error('❌ Error al configurar servicio de email:', error);
            this.transporter = null;
        }
    }
    
    static async enviarEmail(destinatario, asunto, contenido, adjuntos = []) {
        if (!this.transporter) {
            console.warn('Servicio de email no configurado');
            return false;
        }
        
        try {
            const mailOptions = {
                from: `"Sistema de Gestión Psicológica" <${process.env.SMTP_FROM || process.env.SMTP_USER}>`,
                to: destinatario,
                subject: asunto,
                html: contenido,
                attachments: adjuntos
            };
            
            const info = await this.transporter.sendMail(mailOptions);
            console.log(`📧 Email enviado a ${destinatario}: ${info.messageId}`);
            
            return true;
            
        } catch (error) {
            console.error('❌ Error al enviar email:', error);
            return false;
        }
    }
    
    static async enviarNotificacionCita(datosCita) {
        const { paciente, fecha } = datosCita;
        
        const asunto = `Recordatorio de Cita - ${fecha}`;
        const contenido = crearNotificacionCita(datosCita);
        
        return await this.enviarEmail(paciente.email, asunto, contenido);
    }
    
    static async enviarNotificacionAlta(datosAlta) {
        const { paciente } = datosAlta;
        
        const asunto = `Proceso de Alta - ${paciente.nombre} ${paciente.apellido}`;
        const contenido = crearNotificacionAlta({
            ...datosAlta,
            obtenerDescripcionAlta: this.obtenerDescripcionAlta.bind(this)
        });
        
        return await this.enviarEmail(paciente.email, asunto, contenido);
    }
    
    static async enviarNotificacionObservacion(datosObservacion) {
        const { becario, fecha } = datosObservacion;
        
        const asunto = `Nueva Observación - ${fecha}`;
        const contenido = crearNotificacionObservacion(datosObservacion);
        
        return await this.enviarEmail(becario.email, asunto, contenido);
    }
    
    static async enviarBienvenidaUsuario(datosUsuario) {
        const { nombre, apellido, email, rol } = datosUsuario;
        
        const nombreCompleto = `${nombre} ${apellido}`;
        const rolTexto = {
            'psicologo': 'Psicólogo/a',
            'psicopedagogico': 'Psicopedagógico/a',
            'terapeuta': 'Terapeuta',
            'coterapeuta': 'Coterapeuta',
            'becario': 'Practicante/Becario',
            'coordinador': 'Coordinador/a'
        }[rol] || rol;
        
        const asunto = `Bienvenido al Sistema de Gestión Psicológica - ${nombreCompleto}`;
        const contenido = crearBienvenidaUsuario({
            ...datosUsuario,
            rolTexto
        });
        
        return await this.enviarEmail(email, asunto, contenido);
    }
    
    static async enviarReporteAdjunto(destinatario, asunto, contenido, archivoBuffer, nombreArchivo) {
        const adjuntos = [{
            filename: nombreArchivo,
            content: archivoBuffer,
            contentType: this.obtenerContentType(nombreArchivo)
        }];
        
        return await this.enviarEmail(destinatario, asunto, contenido, adjuntos);
    }
    
    static async enviarRecordatoriosCitas() {
        try {
            // Esta función se llamaría desde un job/cron
            // Obtener citas para mañana
            const fechaManana = new Date();
            fechaManana.setDate(fechaManana.getDate() + 1);
            const fechaStr = fechaManana.toISOString().split('T')[0];
            
            // En una implementación real, se obtendrían las citas de la BD
            const citasRecordatorio = []; // Obtener de BD
            
            for (const cita of citasRecordatorio) {
                if (cita.paciente.email) {
                    await this.enviarNotificacionCita(cita);
                }
            }
            
            return true;
            
        } catch (error) {
            console.error('Error al enviar recordatorios:', error);
            return false;
        }
    }

    static async enviarRecordatorioCitasUsuario({ usuario, citas, rangoDias }) {
        const asunto = `Recordatorio de citas programadas (${rangoDias} días)`;
        const contenido = crearRecordatorioCitasUsuario({ usuario, citas, rangoDias });

        return await this.enviarEmail(usuario.email, asunto, contenido);
    }
    
    // Métodos auxiliares
    static obtenerDescripcionAlta(tipo_alta) {
        const descripciones = {
            'terapeutica': 'Alta Terapéutica (Objetivos cumplidos)',
            'abandono': 'Abandono del Tratamiento',
            'traslado': 'Traslado a otro centro',
            'graduacion': 'Graduación del Programa',
            'no_continua': 'No Continúa el Tratamiento',
            'otro': 'Otro motivo'
        };
        return descripciones[tipo_alta] || tipo_alta;
    }
    
    static obtenerContentType(nombreArchivo) {
        const extension = nombreArchivo.split('.').pop().toLowerCase();
        
        const tipos = {
            'pdf': 'application/pdf',
            'xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'xls': 'application/vnd.ms-excel',
            'csv': 'text/csv',
            'docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'doc': 'application/msword'
        };
        
        return tipos[extension] || 'application/octet-stream';
    }

    static async enviarCambioContrasena(datosUsuario) {
        const { email } = datosUsuario;
        
        const asunto = `Cambio de Contraseña - Sistema de Gestión Psicológica`;
        const contenido = crearCambioContrasena(datosUsuario);
        
        return await this.enviarEmail(email, asunto, contenido);
    }
}

// Inicializar al cargar el módulo
EmailService.inicializar().catch(console.error);

module.exports = EmailService;