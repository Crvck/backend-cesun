const { Op } = require('sequelize');
const ObservacionBecario = require('../models/observacionBecarioModel');
const User = require('../models/userModel');
const Cita = require('../models/citaModel');
const Paciente = require('../models/pacienteModel');
const Asignacion = require('../models/asignacionModel');
const Notificacion = require('../models/notificacionModel');
const LogSistema = require('../models/logSistemaModel');

class ObservacionController {
    
    static async crearObservacion(req, res) {
        try {
            const { becario_id, cita_id, tipo_observacion, aspecto_evaluado, 
                    calificacion, fortalezas, areas_mejora, recomendaciones, 
                    plan_accion, fecha_seguimiento, privada } = req.body;
            const supervisorId = req.user.id;
            
            // Verificar que el supervisor es psicólogo o coordinador
            const supervisor = await User.findByPk(supervisorId);
            if (!['psicologo', 'coordinador'].includes(supervisor.rol)) {
                return res.status(403).json({
                    success: false,
                    message: 'Solo psicólogos y coordinadores pueden crear observaciones'
                });
            }
            
            // Verificar que el becario existe y es becario
            const becario = await User.findOne({
                where: { id: becario_id, rol: 'becario', activo: true }
            });
            
            if (!becario) {
                return res.status(404).json({
                    success: false,
                    message: 'Becario no encontrado o inactivo'
                });
            }
            
            // Verificar que la cita existe si se especifica
            if (cita_id) {
                const cita = await Cita.findByPk(cita_id);
                if (!cita) {
                    return res.status(404).json({
                        success: false,
                        message: 'Cita no encontrada'
                    });
                }
                
                // Verificar que el becario está asignado a la cita
                if (cita.becario_id !== parseInt(becario_id)) {
                    return res.status(400).json({
                        success: false,
                        message: 'El becario no está asignado a esta cita'
                    });
                }
            }
            
            // Crear observación
            const observacion = await ObservacionBecario.create({
                becario_id,
                supervisor_id: supervisorId,
                cita_id,
                fecha: new Date().toISOString().split('T')[0],
                tipo_observacion,
                aspecto_evaluado,
                calificacion,
                fortalezas,
                areas_mejora,
                recomendaciones,
                plan_accion,
                fecha_seguimiento,
                privada: privada || false
            });
            
            // Notificar al becario
            await Notificacion.create({
                usuario_id: becario_id,
                tipo: 'observacion_nueva',
                titulo: 'Nueva observación',
                mensaje: 'Tienes una nueva observación de tu supervisor. Revisa tu panel para más detalles.'
            });
            
            // Log
            await LogSistema.create({
                usuario_id: supervisorId,
                tipo_log: 'creacion',
                modulo: 'observaciones',
                accion: 'Crear observación',
                descripcion: `Observación creada para becario ${becario_id}`
            });
            
            res.json({
                success: true,
                message: 'Observación creada exitosamente',
                data: observacion
            });
            
        } catch (error) {
            console.error('Error en crearObservacion:', error);
            res.status(500).json({
                success: false,
                message: 'Error al crear observación',
                error: error.message
            });
        }
    }
    
    static async obtenerObservacionesBecario(req, res) {
        try {
            const { becario_id } = req.params;
            const usuarioId = req.user.id;
            const usuarioRol = req.user.rol;
            
            // Verificar permisos
            const tienePermisos = await ObservacionController.verificarPermisosObservaciones(usuarioId, usuarioRol, becario_id);
            
            if (!tienePermisos) {
                return res.status(403).json({
                    success: false,
                    message: 'No tiene permisos para ver estas observaciones'
                });
            }
            
            const whereClause = { becario_id };
            
            // Si no es supervisor ni coordinador, solo mostrar no privadas o propias
            if (usuarioRol === 'becario' && parseInt(becario_id) !== usuarioId) {
                return res.status(403).json({
                    success: false,
                    message: 'Solo puedes ver tus propias observaciones'
                });
            }
            
            // Si es becario viendo sus propias observaciones, filtrar privadas de otros
            if (usuarioRol === 'becario') {
                whereClause.privada = false;
            }
            
            const observaciones = await ObservacionBecario.findAll({
                where: whereClause,
                include: [
                    {
                        model: User,
                        as: 'Supervisor',
                        attributes: ['id', 'nombre', 'apellido', 'especialidad']
                    },
                    {
                        model: Cita,
                        attributes: ['id', 'fecha', 'hora'],
                        include: [{
                            model: Paciente,
                            attributes: ['id', 'nombre', 'apellido']
                        }]
                    }
                ],
                order: [['fecha', 'DESC'], ['created_at', 'DESC']]
            });
            
            // Calcular promedio de calificaciones
            const promedio = observaciones.length > 0 
                ? observaciones.reduce((sum, obs) => sum + obs.calificacion, 0) / observaciones.length
                : 0;
            
            res.json({
                success: true,
                data: {
                    observaciones,
                    estadisticas: {
                        total: observaciones.length,
                        promedio: promedio.toFixed(2),
                        porAspecto: ObservacionController.agruparPorAspecto(observaciones)
                    }
                }
            });
            
        } catch (error) {
            console.error('Error en obtenerObservacionesBecario:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener observaciones'
            });
        }
    }
    
    static async obtenerObservacionesSupervisor(req, res) {
        try {
            const supervisorId = req.user.id;
            const { becario_id, fecha_inicio, fecha_fin } = req.query;
            
            const whereClause = { supervisor_id: supervisorId };
            
            if (becario_id) {
                whereClause.becario_id = becario_id;
            }
            
            if (fecha_inicio && fecha_fin) {
                whereClause.fecha = {
                    [Op.between]: [fecha_inicio, fecha_fin]
                };
            }
            
            const observaciones = await ObservacionBecario.findAll({
                where: whereClause,
                include: [
                    {
                        model: User,
                        as: 'Becario',
                        attributes: ['id', 'nombre', 'apellido', 'email']
                    },
                    {
                        model: Cita,
                        attributes: ['id', 'fecha', 'hora']
                    }
                ],
                order: [['fecha', 'DESC']]
            });
            
            // Agrupar por becario para estadísticas
            const estadisticasPorBecario = this.calcularEstadisticasPorBecario(observaciones);
            
            res.json({
                success: true,
                data: observaciones,
                estadisticas: estadisticasPorBecario
            });
            
        } catch (error) {
            console.error('Error en obtenerObservacionesSupervisor:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener observaciones'
            });
        }
    }
    
    static async actualizarObservacion(req, res) {
        try {
            const { id } = req.params;
            const updates = req.body;
            const usuarioId = req.user.id;
            
            const observacion = await ObservacionBecario.findByPk(id);
            
            if (!observacion) {
                return res.status(404).json({
                    success: false,
                    message: 'Observación no encontrada'
                });
            }
            
            // Verificar que es el supervisor creador
            if (observacion.supervisor_id !== usuarioId && req.user.rol !== 'coordinador') {
                return res.status(403).json({
                    success: false,
                    message: 'Solo el supervisor creador puede actualizar la observación'
                });
            }
            
            // Campos que no se pueden modificar
            const camposBloqueados = ['becario_id', 'supervisor_id', 'cita_id', 'fecha'];
            for (const campo of camposBloqueados) {
                if (updates[campo]) {
                    delete updates[campo];
                }
            }
            
            if (Object.keys(updates).length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No se proporcionaron campos válidos para actualizar'
                });
            }
            
            // Obtener datos antes para log
            const datosAntes = { ...observacion.toJSON() };
            
            await observacion.update(updates);
            
            // Notificar al becario si hay cambios importantes
            if (updates.calificacion || updates.recomendaciones || updates.plan_accion) {
                await Notificacion.create({
                    usuario_id: observacion.becario_id,
                    tipo: 'observacion_nueva',
                    titulo: 'Observación actualizada',
                    mensaje: 'Tu supervisor ha actualizado una observación. Revisa los cambios.'
                });
            }
            
            // Log
            await LogSistema.create({
                usuario_id: usuarioId,
                tipo_log: 'modificacion',
                modulo: 'observaciones',
                accion: 'Actualizar observación',
                descripcion: `Observación actualizada ID: ${id}`,
                datos_antes: datosAntes,
                datos_despues: observacion.toJSON()
            });
            
            res.json({
                success: true,
                message: 'Observación actualizada exitosamente',
                data: observacion
            });
            
        } catch (error) {
            console.error('Error en actualizarObservacion:', error);
            res.status(500).json({
                success: false,
                message: 'Error al actualizar observación'
            });
        }
    }
    
    static async eliminarObservacion(req, res) {
        try {
            const { id } = req.params;
            const usuarioId = req.user.id;
            const usuarioRol = req.user.rol;
            
            const observacion = await ObservacionBecario.findByPk(id);
            
            if (!observacion) {
                return res.status(404).json({
                    success: false,
                    message: 'Observación no encontrada'
                });
            }
            
            // Solo coordinador o supervisor creador puede eliminar
            if (observacion.supervisor_id !== usuarioId && usuarioRol !== 'coordinador') {
                return res.status(403).json({
                    success: false,
                    message: 'No tiene permisos para eliminar esta observación'
                });
            }
            
            // Obtener datos antes para log
            const datosAntes = { ...observacion.toJSON() };
            
            await observacion.destroy();
            
            // Log
            await LogSistema.create({
                usuario_id: usuarioId,
                tipo_log: 'eliminacion',
                modulo: 'observaciones',
                accion: 'Eliminar observación',
                descripcion: `Observación eliminada ID: ${id}`,
                datos_antes: datosAntes
            });
            
            res.json({
                success: true,
                message: 'Observación eliminada exitosamente'
            });
            
        } catch (error) {
            console.error('Error en eliminarObservacion:', error);
            res.status(500).json({
                success: false,
                message: 'Error al eliminar observación'
            });
        }
    }
    
    // Métodos auxiliares
    static async verificarPermisosObservaciones(usuarioId, usuarioRol, becarioId) {
        if (usuarioRol === 'coordinador') return true;
        
        if (usuarioRol === 'psicologo') {
            // Verificar si es supervisor del becario
            const relacion = await Asignacion.findOne({
                where: {
                    becario_id: becarioId,
                    psicologo_id: usuarioId,
                    estado: 'activa'
                },
                attributes: ['id']
            });

            return Boolean(relacion);
        }
        
        if (usuarioRol === 'becario') {
            return parseInt(becarioId) === usuarioId;
        }
        
        return false;
    }
    
    static agruparPorAspecto(observaciones) {
        const agrupado = {};
        
        observaciones.forEach(obs => {
            if (!agrupado[obs.aspecto_evaluado]) {
                agrupado[obs.aspecto_evaluado] = {
                    total: 0,
                    suma: 0,
                    promedio: 0
                };
            }
            
            agrupado[obs.aspecto_evaluado].total++;
            agrupado[obs.aspecto_evaluado].suma += obs.calificacion;
            agrupado[obs.aspecto_evaluado].promedio = 
                agrupado[obs.aspecto_evaluado].suma / agrupado[obs.aspecto_evaluado].total;
        });
        
        return agrupado;
    }
    
    static calcularEstadisticasPorBecario(observaciones) {
        const estadisticas = {};
        
        observaciones.forEach(obs => {
            if (!estadisticas[obs.becario_id]) {
                estadisticas[obs.becario_id] = {
                    becario_id: obs.becario_id,
                    becario_nombre: obs.Becario ? `${obs.Becario.nombre} ${obs.Becario.apellido}` : 'N/A',
                    total_observaciones: 0,
                    promedio_calificacion: 0,
                    suma_calificacion: 0,
                    aspectos_evaluados: new Set(),
                    ultima_observacion: null
                };
            }
            
            const stats = estadisticas[obs.becario_id];
            stats.total_observaciones++;
            stats.suma_calificacion += obs.calificacion;
            stats.promedio_calificacion = stats.suma_calificacion / stats.total_observaciones;
            stats.aspectos_evaluados.add(obs.aspecto_evaluado);
            
            if (!stats.ultima_observacion || new Date(obs.fecha) > new Date(stats.ultima_observacion)) {
                stats.ultima_observacion = obs.fecha;
            }
        });
        
        // Convertir Set a Array
        Object.keys(estadisticas).forEach(key => {
            estadisticas[key].aspectos_evaluados = Array.from(estadisticas[key].aspectos_evaluados);
        });
        
        return estadisticas;
    }

    static async enviarFeedback(req, res) {
        try {
            const { becarioId } = req.params;
            const { feedback, tipo } = req.body;
            const supervisorId = req.user.id;
            const supervisorRol = req.user.rol;

            // Verificar que sea psicólogo o coordinador
            if (!['psicologo', 'coordinador'].includes(supervisorRol)) {
                return res.status(403).json({
                    success: false,
                    message: 'Solo psicólogos y coordinadores pueden enviar feedback'
                });
            }

            // Verificar que el becario existe y está activo
            const becario = await User.findOne({
                where: { id: becarioId, rol: 'becario', activo: true }
            });

            if (!becario) {
                return res.status(404).json({
                    success: false,
                    message: 'Becario no encontrado'
                });
            }

            // Verificar que el supervisor tenga relación con el becario
            if (supervisorRol === 'psicologo') {
                const relacion = await Asignacion.findOne({
                    where: {
                        psicologo_id: supervisorId,
                        becario_id: becarioId,
                        estado: 'activa'
                    },
                    attributes: ['id']
                });

                if (!relacion) {
                    return res.status(403).json({
                        success: false,
                        message: 'No tienes permisos para supervisar a este becario'
                    });
                }
            }

            // Crear la observación de feedback
            const nuevaObservacion = await ObservacionBecario.create({
                becario_id: becarioId,
                supervisor_id: supervisorId,
                tipo_observacion: 'retroalimentacion',
                aspecto_evaluado: 'profesionalismo',
                calificacion: 5, // Calificación neutral por defecto para feedback
                recomendaciones: feedback,
                privada: false,
                fecha: new Date()
            });

            res.json({
                success: true,
                message: 'Feedback enviado correctamente',
                data: nuevaObservacion
            });

        } catch (error) {
            console.error('Error en enviarFeedback:', error);
            res.status(500).json({
                success: false,
                message: 'Error al enviar feedback'
            });
        }
    }
}

module.exports = ObservacionController;