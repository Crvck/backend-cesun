const { Op } = require('sequelize');
const Disponibilidad = require('../models/disponibilidadModel');
const User = require('../models/userModel');
const Cita = require('../models/citaModel');
const Asignacion = require('../models/asignacionModel');
const LogSistema = require('../models/logSistemaModel');

class DisponibilidadController {
    
    static async crearDisponibilidad(req, res) {
        try {
            const { dia_semana, hora_inicio, hora_fin, tipo_disponibilidad, 
                    notas, max_citas_dia, intervalo_citas, fecha_fin_vigencia } = req.body;
            const usuarioId = req.user.id;
            
            // Validar que el usuario existe y es profesional (psicologo o becario)
            const usuario = await User.findByPk(usuarioId);
            if (!['psicologo', 'becario'].includes(usuario.rol)) {
                return res.status(403).json({
                    success: false,
                    message: 'Solo psicólogos y becarios pueden configurar disponibilidad'
                });
            }
            
            // Validar formato de hora
            if (!this.validarHora(hora_inicio) || !this.validarHora(hora_fin)) {
                return res.status(400).json({
                    success: false,
                    message: 'Formato de hora inválido. Use HH:MM'
                });
            }
            
            // Validar que hora_fin sea mayor que hora_inicio
            if (this.compararHoras(hora_fin, hora_inicio) <= 0) {
                return res.status(400).json({
                    success: false,
                    message: 'La hora de fin debe ser mayor que la hora de inicio'
                });
            }
            
            // Verificar que no se solape con otra disponibilidad en el mismo día
            const solapamiento = await Disponibilidad.findOne({
                where: {
                    usuario_id: usuarioId,
                    dia_semana,
                    activo: true,
                    [Op.or]: [
                        {
                            hora_inicio: { [Op.between]: [hora_inicio, hora_fin] }
                        },
                        {
                            hora_fin: { [Op.between]: [hora_inicio, hora_fin] }
                        },
                        {
                            [Op.and]: [
                                { hora_inicio: { [Op.lte]: hora_inicio } },
                                { hora_fin: { [Op.gte]: hora_fin } }
                            ]
                        }
                    ]
                }
            });
            
            if (solapamiento) {
                return res.status(400).json({
                    success: false,
                    message: 'La disponibilidad se solapa con otro horario configurado para este día'
                });
            }
            
            // Crear disponibilidad
            const disponibilidad = await Disponibilidad.create({
                usuario_id: usuarioId,
                dia_semana,
                hora_inicio,
                hora_fin,
                tipo_disponibilidad: tipo_disponibilidad || 'regular',
                notas,
                max_citas_dia: max_citas_dia || 8,
                intervalo_citas: intervalo_citas || 50,
                fecha_inicio_vigencia: new Date().toISOString().split('T')[0],
                fecha_fin_vigencia: fecha_fin_vigencia || null,
                activo: true
            });
            
            // Log
            await LogSistema.create({
                usuario_id: usuarioId,
                tipo_log: 'creacion',
                modulo: 'disponibilidad',
                accion: 'Crear disponibilidad',
                descripcion: `Disponibilidad creada: ${dia_semana} ${hora_inicio}-${hora_fin}`
            });
            
            res.json({
                success: true,
                message: 'Disponibilidad creada exitosamente',
                data: disponibilidad
            });
            
        } catch (error) {
            console.error('Error en crearDisponibilidad:', error);
            res.status(500).json({
                success: false,
                message: 'Error al crear disponibilidad',
                error: error.message
            });
        }
    }
    
    static async obtenerMiDisponibilidad(req, res) {
        try {
            const usuarioId = req.user.id;
            
            const disponibilidad = await Disponibilidad.findAll({
                where: {
                    usuario_id: usuarioId,
                    activo: true,
                    [Op.or]: [
                        { fecha_fin_vigencia: null },
                        { fecha_fin_vigencia: { [Op.gte]: new Date().toISOString().split('T')[0] } }
                    ]
                },
                order: [
                    ['dia_semana', 'ASC'],
                    ['hora_inicio', 'ASC']
                ]
            });
            
            // Obtener citas programadas para los próximos 7 días
            const hoy = new Date();
            const fechaInicio = hoy.toISOString().split('T')[0];
            const fechaFinObj = new Date(hoy);
            fechaFinObj.setDate(fechaFinObj.getDate() + 7);
            const fechaFin = fechaFinObj.toISOString().split('T')[0];

            const citasProgramadasList = await Cita.findAll({
                where: {
                    [Op.or]: [{ psicologo_id: usuarioId }, { becario_id: usuarioId }],
                    fecha: { [Op.between]: [fechaInicio, fechaFin] },
                    estado: { [Op.in]: ['programada', 'confirmada'] }
                },
                attributes: ['fecha']
            });

            const citasMap = citasProgramadasList.reduce((acc, cita) => {
                const fecha = cita.fecha instanceof Date
                    ? cita.fecha.toISOString().split('T')[0]
                    : cita.fecha;
                acc[fecha] = (acc[fecha] || 0) + 1;
                return acc;
            }, {});

            const citasProgramadas = Object.entries(citasMap)
                .map(([fecha, citas_count]) => ({ fecha, citas_count }))
                .sort((a, b) => a.fecha.localeCompare(b.fecha));
            
            res.json({
                success: true,
                data: {
                    disponibilidad,
                    proximas_citas: citasProgramadas || []
                }
            });
            
        } catch (error) {
            console.error('Error en obtenerMiDisponibilidad:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener disponibilidad'
            });
        }
    }
    
    static async obtenerDisponibilidadUsuario(req, res) {
        try {
            const { usuario_id } = req.params;
            const solicitanteId = req.user.id;
            const solicitanteRol = req.user.rol;
            
            // Verificar permisos (coordinador o psicólogo supervisor)
            const puedeVer = await this.verificarPermisoVerDisponibilidad(solicitanteId, solicitanteRol, usuario_id);
            
            if (!puedeVer) {
                return res.status(403).json({
                    success: false,
                    message: 'No tiene permisos para ver la disponibilidad de este usuario'
                });
            }
            
            const disponibilidad = await Disponibilidad.findAll({
                where: {
                    usuario_id,
                    activo: true
                },
                order: [
                    ['dia_semana', 'ASC'],
                    ['hora_inicio', 'ASC']
                ]
            });
            
            // Obtener información del usuario
            const usuario = await User.findByPk(usuario_id, {
                attributes: ['id', 'nombre', 'apellido', 'rol', 'especialidad']
            });
            
            res.json({
                success: true,
                data: {
                    usuario,
                    disponibilidad
                }
            });
            
        } catch (error) {
            console.error('Error en obtenerDisponibilidadUsuario:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener disponibilidad del usuario'
            });
        }
    }
    
    static async actualizarDisponibilidad(req, res) {
        try {
            const { id } = req.params;
            const updates = req.body;
            const usuarioId = req.user.id;
            
            const disponibilidad = await Disponibilidad.findByPk(id);
            
            if (!disponibilidad) {
                return res.status(404).json({
                    success: false,
                    message: 'Disponibilidad no encontrada'
                });
            }
            
            // Verificar que el usuario es el dueño de la disponibilidad
            if (disponibilidad.usuario_id !== usuarioId && req.user.rol !== 'coordinador') {
                return res.status(403).json({
                    success: false,
                    message: 'No tiene permisos para actualizar esta disponibilidad'
                });
            }
            
            // Validar horas si se están actualizando
            if (updates.hora_inicio || updates.hora_fin) {
                const hora_inicio = updates.hora_inicio || disponibilidad.hora_inicio;
                const hora_fin = updates.hora_fin || disponibilidad.hora_fin;
                
                if (this.compararHoras(hora_fin, hora_inicio) <= 0) {
                    return res.status(400).json({
                        success: false,
                        message: 'La hora de fin debe ser mayor que la hora de inicio'
                    });
                }
                
                // Verificar solapamiento excluyendo el registro actual
                const solapamiento = await Disponibilidad.findOne({
                    where: {
                        usuario_id: disponibilidad.usuario_id,
                        dia_semana: updates.dia_semana || disponibilidad.dia_semana,
                        id: { [Op.ne]: id },
                        activo: true,
                        [Op.or]: [
                            {
                                hora_inicio: { [Op.between]: [hora_inicio, hora_fin] }
                            },
                            {
                                hora_fin: { [Op.between]: [hora_inicio, hora_fin] }
                            },
                            {
                                [Op.and]: [
                                    { hora_inicio: { [Op.lte]: hora_inicio } },
                                    { hora_fin: { [Op.gte]: hora_fin } }
                                ]
                            }
                        ]
                    }
                });
                
                if (solapamiento) {
                    return res.status(400).json({
                        success: false,
                        message: 'La disponibilidad se solapa con otro horario configurado'
                    });
                }
            }
            
            // Obtener datos antes para log
            const datosAntes = { ...disponibilidad.toJSON() };
            
            await disponibilidad.update(updates);
            
            // Log
            await LogSistema.create({
                usuario_id: usuarioId,
                tipo_log: 'modificacion',
                modulo: 'disponibilidad',
                accion: 'Actualizar disponibilidad',
                descripcion: `Disponibilidad actualizada ID: ${id}`,
                datos_antes: datosAntes,
                datos_despues: disponibilidad.toJSON()
            });
            
            res.json({
                success: true,
                message: 'Disponibilidad actualizada exitosamente',
                data: disponibilidad
            });
            
        } catch (error) {
            console.error('Error en actualizarDisponibilidad:', error);
            res.status(500).json({
                success: false,
                message: 'Error al actualizar disponibilidad'
            });
        }
    }
    
    static async desactivarDisponibilidad(req, res) {
        try {
            const { id } = req.params;
            const usuarioId = req.user.id;
            
            const disponibilidad = await Disponibilidad.findByPk(id);
            
            if (!disponibilidad) {
                return res.status(404).json({
                    success: false,
                    message: 'Disponibilidad no encontrada'
                });
            }
            
            // Verificar que el usuario es el dueño de la disponibilidad
            if (disponibilidad.usuario_id !== usuarioId && req.user.rol !== 'coordinador') {
                return res.status(403).json({
                    success: false,
                    message: 'No tiene permisos para desactivar esta disponibilidad'
                });
            }
            
            // Verificar que no haya citas futuras en este horario
            const hoy = new Date();
            const fechaHoy = hoy.toISOString().split('T')[0];
            const citasFuturasList = await Cita.findAll({
                where: {
                    [Op.or]: [{ psicologo_id: disponibilidad.usuario_id }, { becario_id: disponibilidad.usuario_id }],
                    fecha: { [Op.gt]: fechaHoy },
                    estado: { [Op.in]: ['programada', 'confirmada'] }
                },
                attributes: ['fecha', 'hora']
            });

            const citasFuturasCount = citasFuturasList.filter(cita => {
                const fecha = cita.fecha instanceof Date ? cita.fecha : new Date(cita.fecha);
                const diaSemana = this.numeroADiaSemana(fecha.getDay());
                if (diaSemana !== disponibilidad.dia_semana) return false;
                const hora = String(cita.hora).substring(0, 5);
                return this.compararHoras(hora, disponibilidad.hora_inicio) >= 0
                    && this.compararHoras(hora, disponibilidad.hora_fin) <= 0;
            }).length;
            
            if (citasFuturasCount > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No se puede desactivar la disponibilidad porque hay citas programadas en este horario'
                });
            }
            
            await disponibilidad.update({ activo: false });
            
            // Log
            await LogSistema.create({
                usuario_id: usuarioId,
                tipo_log: 'modificacion',
                modulo: 'disponibilidad',
                accion: 'Desactivar disponibilidad',
                descripcion: `Disponibilidad desactivada ID: ${id}`
            });
            
            res.json({
                success: true,
                message: 'Disponibilidad desactivada exitosamente'
            });
            
        } catch (error) {
            console.error('Error en desactivarDisponibilidad:', error);
            res.status(500).json({
                success: false,
                message: 'Error al desactivar disponibilidad'
            });
        }
    }
    
    static async obtenerHorariosDisponibles(req, res) {
        try {
            const { usuario_id, fecha } = req.query;
            
            if (!usuario_id || !fecha) {
                return res.status(400).json({
                    success: false,
                    message: 'Los parámetros usuario_id y fecha son requeridos'
                });
            }
            
            // Obtener día de la semana de la fecha
            const fechaObj = new Date(fecha);
            const diaSemana = this.numeroADiaSemana(fechaObj.getDay());
            
            // Obtener disponibilidad del usuario para ese día
            const disponibilidad = await Disponibilidad.findOne({
                where: {
                    usuario_id,
                    dia_semana: diaSemana,
                    activo: true,
                    [Op.and]: [
                        {
                            [Op.or]: [
                                { fecha_fin_vigencia: null },
                                { fecha_fin_vigencia: { [Op.gte]: fecha } }
                            ]
                        },
                        { fecha_inicio_vigencia: { [Op.lte]: fecha } }
                    ]
                }
            });
            
            if (!disponibilidad) {
                return res.json({
                    success: true,
                    data: {
                        disponible: false,
                        horarios: [],
                        mensaje: 'El profesional no tiene disponibilidad para esta fecha'
                    }
                });
            }
            
            // Obtener citas ya programadas para esa fecha
            const citasProgramadas = await Cita.findAll({
                where: {
                    [Op.or]: [{ psicologo_id: usuario_id }, { becario_id: usuario_id }],
                    fecha,
                    estado: { [Op.in]: ['programada', 'confirmada'] }
                },
                attributes: ['hora', 'duracion_minutos'],
                order: [['hora', 'ASC']]
            });
            
            // Generar horarios disponibles
            const horariosDisponibles = this.generarHorariosDisponibles(
                disponibilidad.hora_inicio,
                disponibilidad.hora_fin,
                disponibilidad.intervalo_citas,
                citasProgramadas || [],
                disponibilidad.max_citas_dia
            );
            
            res.json({
                success: true,
                data: {
                    disponible: true,
                    horarios: horariosDisponibles,
                    intervalo_minutos: disponibilidad.intervalo_citas,
                    max_citas_dia: disponibilidad.max_citas_dia,
                    citas_actuales: (citasProgramadas || []).length
                }
            });
            
        } catch (error) {
            console.error('Error en obtenerHorariosDisponibles:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener horarios disponibles'
            });
        }
    }
    
    // Métodos auxiliares
    static validarHora(hora) {
        const regex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
        return regex.test(hora);
    }
    
    static compararHoras(hora1, hora2) {
        const [h1, m1] = hora1.split(':').map(Number);
        const [h2, m2] = hora2.split(':').map(Number);
        
        if (h1 !== h2) return h1 - h2;
        return m1 - m2;
    }
    
    static diaSemanaANumero(diaSemana) {
        const dias = {
            'domingo': 1,
            'lunes': 2,
            'martes': 3,
            'miercoles': 4,
            'jueves': 5,
            'viernes': 6,
            'sabado': 7
        };
        return dias[diaSemana.toLowerCase()] || 1;
    }
    
    static numeroADiaSemana(numero) {
        const dias = [
            'domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'
        ];
        return dias[numero] || 'domingo';
    }
    
    static async verificarPermisoVerDisponibilidad(solicitanteId, solicitanteRol, usuarioId) {
        if (solicitanteRol === 'coordinador') return true;
        
        if (solicitanteId === parseInt(usuarioId)) return true;
        
        if (solicitanteRol === 'psicologo') {
            // Verificar si es supervisor del usuario
            const relacion = await Asignacion.findOne({
                where: {
                    becario_id: usuarioId,
                    psicologo_id: solicitanteId,
                    estado: 'activa'
                },
                attributes: ['id']
            });

            return !!relacion;
        }
        
        return false;
    }
    
    static generarHorariosDisponibles(horaInicio, horaFin, intervalo, citasProgramadas, maxCitas) {
        const horarios = [];
        const citasPorHora = {};
        
        // Mapear citas existentes por hora
        citasProgramadas.forEach(cita => {
            const hora = cita.hora.substring(0, 5); // Formato HH:MM
            citasPorHora[hora] = true;
        });
        
        // Si ya alcanzó el máximo de citas, no hay horarios disponibles
        if (citasProgramadas.length >= maxCitas) {
            return horarios;
        }
        
        // Generar horarios cada X minutos
        let [hora, minuto] = horaInicio.split(':').map(Number);
        
        while (true) {
            const horaStr = `${hora.toString().padStart(2, '0')}:${minuto.toString().padStart(2, '0')}`;
            const horaFinCalculada = this.sumarMinutos(horaStr, intervalo);
            
            // Si pasa de la hora de fin, terminar
            if (this.compararHoras(horaFinCalculada, horaFin) > 0) {
                break;
            }
            
            // Si no hay cita en este horario, agregarlo
            if (!citasPorHora[horaStr]) {
                horarios.push({
                    hora: horaStr,
                    hora_fin: horaFinCalculada,
                    disponible: true
                });
            }
            
            // Avanzar intervalo
            minuto += intervalo;
            while (minuto >= 60) {
                hora += 1;
                minuto -= 60;
            }
        }
        
        return horarios;
    }
    
    static sumarMinutos(hora, minutos) {
        const [h, m] = hora.split(':').map(Number);
        let nuevaHora = h;
        let nuevosMinutos = m + minutos;
        
        while (nuevosMinutos >= 60) {
            nuevaHora += 1;
            nuevosMinutos -= 60;
        }
        
        return `${nuevaHora.toString().padStart(2, '0')}:${nuevosMinutos.toString().padStart(2, '0')}`;
    }
}

module.exports = DisponibilidadController;