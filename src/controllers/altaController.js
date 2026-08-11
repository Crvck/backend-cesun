const { Op, fn, col, literal } = require('sequelize');
const sequelize = require('../config/db');
const Alta = require('../models/altaModel');
const Paciente = require('../models/pacienteModel');
const Cita = require('../models/citaModel');
const Asignacion = require('../models/asignacionModel');
const User = require('../models/userModel');
const Notificacion = require('../models/notificacionModel');
const LogSistema = require('../models/logSistemaModel');

class AltaController {
    
    static async darAltaPaciente(req, res) {
        try {
            const { paciente_id, tipo_alta, motivo_detallado, recomendaciones, 
                    evaluacion_final, seguimiento_recomendado, fecha_seguimiento } = req.body;
            const usuarioId = req.user.id;
            
            // Verificar que el paciente existe y está activo
            const paciente = await Paciente.findByPk(paciente_id);
            
            if (!paciente || !paciente.activo) {
                return res.status(404).json({
                    success: false,
                    message: 'Paciente no encontrado o ya dado de alta'
                });
            }
            
            // Obtener estadísticas del paciente
            const totalSesiones = await Cita.count({
                where: {
                    paciente_id,
                    estado: { [Op.in]: ['completada', 'cancelada'] }
                }
            });
            const sesionesCompletadas = await Cita.count({
                where: {
                    paciente_id,
                    estado: 'completada'
                }
            });
            const primeraSesion = await Cita.min('fecha', {
                where: {
                    paciente_id,
                    estado: { [Op.in]: ['completada', 'cancelada'] }
                }
            });
            const ultimaSesion = await Cita.max('fecha', {
                where: {
                    paciente_id,
                    estado: { [Op.in]: ['completada', 'cancelada'] }
                }
            });

            const estadisticas = {
                total_sesiones: totalSesiones,
                sesiones_completadas: sesionesCompletadas,
                primera_sesion: primeraSesion,
                ultima_sesion: ultimaSesion
            };
            
            // Iniciar transacción
            const transaction = await sequelize.transaction();
            
            try {
                // 1. Registrar el alta
                const alta = await Alta.create({
                    paciente_id,
                    usuario_id: usuarioId,
                    tipo_alta,
                    fecha_alta: new Date().toISOString().split('T')[0],
                    motivo_detallado,
                    recomendaciones,
                    sesiones_totales: estadisticas?.sesiones_completadas || 0,
                    evaluacion_final,
                    seguimiento_recomendado,
                    fecha_seguimiento: seguimiento_recomendado ? fecha_seguimiento : null
                }, { transaction });
                
                // 2. Desactivar paciente
                await paciente.update({
                    activo: false,
                    estado: `alta_${tipo_alta}`,
                    updated_at: new Date()
                }, { transaction });
                
                // 3. Finalizar asignaciones activas
                await Asignacion.update({
                    estado: 'finalizada',
                    fecha_fin: new Date().toISOString().split('T')[0],
                    motivo_fin: `Paciente dado de alta (${tipo_alta})`
                }, {
                    where: { paciente_id, estado: 'activa' },
                    transaction
                });
                
                // 4. Cancelar citas futuras - VERSIÓN CORREGIDA
                const fechaHoy = new Date().toISOString().split('T')[0];
                
                await Cita.update({
                    estado: 'cancelada',
                    motivo_cancelacion: `Paciente dado de alta (${tipo_alta})`,
                    updated_at: new Date()
                }, {
                    where: {
                        paciente_id,
                        fecha: { [Op.gte]: fechaHoy },
                        estado: { [Op.in]: ['programada', 'confirmada'] }
                    },
                    transaction
                });
                
                // 5. Obtener profesionales asignados para notificaciones
                const asignacionesActivas = await Asignacion.findAll({
                    where: { paciente_id, estado: 'activa' },
                    attributes: ['psicologo_id', 'becario_id'],
                    transaction
                });
                
                // 6. Crear notificaciones
                if (asignacionesActivas.length > 0) {
                    const notificaciones = [];
                    const titulo = 'Paciente dado de alta';
                    const mensaje = `El paciente ${paciente.nombre} ${paciente.apellido} ha sido dado de alta (${tipo_alta}).`;

                    const destinatarios = new Set();
                    asignacionesActivas.forEach((a) => {
                        if (a.psicologo_id) destinatarios.add(a.psicologo_id);
                        if (a.becario_id) destinatarios.add(a.becario_id);
                    });

                    if (destinatarios.size > 0) {
                        await Notificacion.bulkCreate(
                            Array.from(destinatarios).map((usuarioIdNotif) => ({
                                usuario_id: usuarioIdNotif,
                                tipo: 'alerta_sistema',
                                titulo,
                                mensaje
                            })),
                            { transaction }
                        );
                    }
                }
                
                // 7. Registrar log
                await LogSistema.create({
                    usuario_id: usuarioId,
                    tipo_log: 'modificacion',
                    modulo: 'altas',
                    accion: 'Dar de alta paciente',
                    descripcion: `Alta paciente ${paciente_id} - Tipo: ${tipo_alta}`
                }, { transaction });
                
                // Commit transacción
                await transaction.commit();
                
                res.json({
                    success: true,
                    message: 'Paciente dado de alta exitosamente',
                    data: {
                        alta,
                        paciente: {
                            id: paciente.id,
                            nombre: paciente.nombre,
                            apellido: paciente.apellido,
                            estado: paciente.estado
                        },
                        estadisticas
                    }
                });
                
            } catch (error) {
                await transaction.rollback();
                console.error('Error en transacción de alta:', error);
                throw error;
            }
            
        } catch (error) {
            console.error('Error en darAltaPaciente:', error);
            res.status(500).json({
                success: false,
                message: 'Error al dar de alta paciente',
                error: error.message
            });
        }
    }
    
    static async obtenerAltas(req, res) {
        try {
            const { fecha_inicio, fecha_fin, tipo_alta, psicologo_id, estado } = req.query;
            
            const whereClause = {};
            if (estado) whereClause.estado = estado;
            if (fecha_inicio) whereClause.fecha_alta = { ...(whereClause.fecha_alta || {}), [Op.gte]: fecha_inicio };
            if (fecha_fin) whereClause.fecha_alta = { ...(whereClause.fecha_alta || {}), [Op.lte]: fecha_fin };
            if (tipo_alta) whereClause.tipo_alta = tipo_alta;

            const include = [
                {
                    model: Paciente,
                    attributes: ['nombre', 'apellido', 'telefono']
                },
                {
                    model: User,
                    attributes: ['nombre', 'apellido']
                }
            ];

            if (psicologo_id) {
                include.push({
                    model: Asignacion,
                    required: true,
                    where: { psicologo_id, estado: 'finalizada' },
                    attributes: []
                });
            }

            const altas = await Alta.findAll({
                where: whereClause,
                include,
                attributes: {
                    include: [
                        [
                            literal("(SELECT COUNT(DISTINCT c.id) FROM citas c WHERE c.paciente_id = Alta.paciente_id AND c.estado = 'completada')"),
                            'total_sesiones'
                        ],
                        [
                            literal("(SELECT CONCAT(u.nombre, ' ', u.apellido) FROM asignaciones a JOIN users u ON a.psicologo_id = u.id WHERE a.paciente_id = Alta.paciente_id ORDER BY a.updated_at DESC LIMIT 1)"),
                            'terapeuta_nombre'
                        ],
                        [
                            literal("(SELECT CONCAT(u.nombre, ' ', u.apellido) FROM asignaciones a JOIN users u ON a.becario_id = u.id WHERE a.paciente_id = Alta.paciente_id ORDER BY a.updated_at DESC LIMIT 1)"),
                            'coterapeuta_nombre'
                        ]
                    ]
                },
                order: [['fecha_alta', 'DESC'], [Paciente, 'apellido', 'ASC'], [Paciente, 'nombre', 'ASC']],
                distinct: true
            });
            
            res.json({
                success: true,
                data: altas,
                count: altas.length
            });
            
        } catch (error) {
            console.error('Error en obtenerAltas:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener altas'
            });
        }
    }
    
    static async obtenerAltaDetalle(req, res) {
        try {
            const { id } = req.params;
            
            const alta = await Alta.findByPk(id, {
                include: [
                    {
                        model: Paciente,
                        attributes: ['nombre', 'apellido', 'fecha_inscripcion', 'genero', 'email', 'telefono']
                    },
                    {
                        model: User,
                        attributes: ['nombre', 'apellido']
                    }
                ]
            });
            
            if (!alta) {
                return res.status(404).json({
                    success: false,
                    message: 'Alta no encontrada'
                });
            }
            
            const total_sesiones = await Cita.count({
                where: { paciente_id: alta.paciente_id, estado: 'completada' }
            });

            const ultimasSesiones = await Cita.findAll({
                where: { paciente_id: alta.paciente_id, estado: 'completada' },
                attributes: ['fecha'],
                order: [['fecha', 'DESC']],
                limit: 10
            });

            const asignacionReciente = await Asignacion.findOne({
                where: { paciente_id: alta.paciente_id },
                order: [['fecha_inicio', 'DESC']],
                attributes: ['psicologo_id']
            });

            const psicologo = asignacionReciente
                ? await User.findByPk(asignacionReciente.psicologo_id, { attributes: ['nombre', 'apellido'] })
                : null;

            res.json({
                success: true,
                data: {
                    ...alta.toJSON(),
                    paciente_nombre: alta.Paciente?.nombre,
                    paciente_apellido: alta.Paciente?.apellido,
                    paciente_email: alta.Paciente?.email,
                    paciente_telefono: alta.Paciente?.telefono,
                    usuario_nombre: alta.User?.nombre,
                    usuario_apellido: alta.User?.apellido,
                    psicologo_nombre: psicologo?.nombre || null,
                    psicologo_apellido: psicologo?.apellido || null,
                    total_sesiones,
                    ultimas_sesiones: ultimasSesiones.map(s => s.fecha).join(', ')
                }
            });
            
        } catch (error) {
            console.error('Error en obtenerAltaDetalle:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener detalle de alta'
            });
        }
    }
    
    static async obtenerEstadisticasAltas(req, res) {
        try {
            const { fecha_inicio, fecha_fin } = req.query;
            
            const whereClause = {};
            if (fecha_inicio) whereClause.fecha_alta = { ...(whereClause.fecha_alta || {}), [Op.gte]: fecha_inicio };
            if (fecha_fin) whereClause.fecha_alta = { ...(whereClause.fecha_alta || {}), [Op.lte]: fecha_fin };

            const estadisticas = await Alta.findAll({
                where: whereClause,
                attributes: [
                    'tipo_alta',
                    [fn('COUNT', col('id')), 'total'],
                    [fn('MONTH', col('fecha_alta')), 'mes'],
                    [fn('YEAR', col('fecha_alta')), 'anio'],
                    [fn('AVG', col('sesiones_totales')), 'promedio_sesiones'],
                    [fn('SUM', literal("CASE WHEN seguimiento_recomendado = TRUE THEN 1 ELSE 0 END")), 'seguimientos_recomendados']
                ],
                group: ['tipo_alta', fn('YEAR', col('fecha_alta')), fn('MONTH', col('fecha_alta'))],
                order: [[literal('anio'), 'DESC'], [literal('mes'), 'DESC'], [literal('total'), 'DESC']]
            });

            const totales = await Alta.findOne({
                where: whereClause,
                attributes: [
                    [fn('COUNT', col('id')), 'total_altas'],
                    [fn('AVG', col('sesiones_totales')), 'promedio_sesiones_global'],
                    [fn('MIN', col('fecha_alta')), 'primera_alta'],
                    [fn('MAX', col('fecha_alta')), 'ultima_alta']
                ]
            });

            const [promedioRows] = await sequelize.query(`
                SELECT AVG(total_citas) AS promedio_citas_mensuales
                FROM (
                    SELECT COUNT(*) AS total_citas
                    FROM citas
                    WHERE estado IN ('programada', 'confirmada', 'completada')
                    GROUP BY YEAR(fecha), MONTH(fecha)
                ) AS mensual
            `);

            const promedioCitasMensuales = Number(promedioRows?.[0]?.promedio_citas_mensuales || 0);
            const totalesData = totales ? totales.get({ plain: true }) : {};
            totalesData.promedio_citas_mensuales = promedioCitasMensuales;
            
            res.json({
                success: true,
                data: {
                    estadisticas,
                    totales: totalesData
                }
            });
            
        } catch (error) {
            console.error('Error en obtenerEstadisticasAltas:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener estadísticas de altas'
            });
        }
    }
    
    // Método auxiliar para verificar permisos
    static async verificarPermisoAlta(usuarioId, pacienteId) {
        const usuarioRol = await this.obtenerRolUsuario(usuarioId);
        
        if (usuarioRol === 'coordinador') return true;
        
        if (usuarioRol === 'terapeuta') {
            const asignacion = await Asignacion.findOne({
                where: { paciente_id: pacienteId, psicologo_id: usuarioId, estado: 'activa' },
                attributes: ['id']
            });

            return Boolean(asignacion);
        }
        
        return false;
    }
    
    static async obtenerRolUsuario(usuarioId) {
        const usuario = await User.findByPk(usuarioId, { attributes: ['rol'] });
        return usuario?.rol;
    }

    // Nuevo método: Terapeuta propone un paciente para alta
    static async proponerAlta(req, res) {
        try {
            const paciente_id = req.params.paciente_id; // Leer del parámetro de URL
            const { evaluacion_final, recomendaciones } = req.body;
            const psicologo_id = req.user.id;

            console.log(`📋 Propuesta de alta - Paciente ID: ${paciente_id}, Terapeuta ID: ${psicologo_id}`);

            // Verificar que el paciente existe y está activo
            const paciente = await Paciente.findByPk(paciente_id);
            if (!paciente || !paciente.activo) {
                return res.status(404).json({
                    success: false,
                    message: 'Paciente no encontrado o ya dado de alta'
                });
            }

            // Verificar que el terapeuta tiene asignado este paciente
            const asignacion = await Asignacion.findOne({
                where: { paciente_id, psicologo_id, estado: 'activa' }
            });

            if (!asignacion) {
                return res.status(403).json({
                    success: false,
                    message: 'No tienes asignado este paciente'
                });
            }

            // Verificar si ya hay una propuesta pendiente
            const propuestaExistente = await Alta.findOne({
                where: { paciente_id, estado: 'propuesta' }
            });

            if (propuestaExistente) {
                return res.status(409).json({
                    success: false,
                    message: 'Ya existe una propuesta de alta pendiente para este paciente'
                });
            }

            // Obtener estadísticas del paciente
            const sesiones_completadas = await Cita.count({
                where: { paciente_id, estado: 'completada' }
            });

            // Crear propuesta de alta
            const propuesta = await Alta.create({
                paciente_id,
                psicologo_id,
                usuario_id: psicologo_id, // Por defecto el psicólogo
                tipo_alta: 'terapeutica',
                estado: 'propuesta',
                fecha_propuesta: new Date().toISOString().split('T')[0],
                evaluacion_final: evaluacion_final || null,
                recomendaciones: recomendaciones || null,
                sesiones_totales: sesiones_completadas || 0
            });

            // Crear notificación para coordinador
            const coordinadores = await User.findAll({
                where: { rol: 'coordinador', activo: true },
                attributes: ['id']
            });

            if (coordinadores.length > 0) {
                await Notificacion.bulkCreate(
                    coordinadores.map((u) => ({
                        usuario_id: u.id,
                        tipo: 'alerta_sistema',
                        titulo: 'Nueva propuesta de alta',
                        mensaje: `${paciente.nombre} ${paciente.apellido} ha sido propuesto para alta por su psicólogo`
                    }))
                );
            }

            res.json({
                success: true,
                message: 'Propuesta de alta enviada exitosamente',
                data: propuesta
            });

        } catch (error) {
            console.error('Error en proponerAlta:', error);
            res.status(500).json({
                success: false,
                message: 'Error al proponer alta',
                error: error.message
            });
        }
    }

    // Nuevo método: Coordinador aprueba o rechaza propuesta
    static async procesarPropuesta(req, res) {
        try {
            const { id } = req.params;
            const { accion, motivo_rechazo, tipo_alta, evaluacion_final, recomendaciones } = req.body;
            const coordinador_id = req.user.id;

            // Verificar que es coordinador
            if (req.user.rol !== 'coordinador') {
                return res.status(403).json({
                    success: false,
                    message: 'Solo coordinadores pueden procesar propuestas'
                });
            }

            // Obtener propuesta
            const propuesta = await Alta.findByPk(id);
            if (!propuesta || propuesta.estado !== 'propuesta') {
                return res.status(404).json({
                    success: false,
                    message: 'Propuesta no encontrada o ya procesada'
                });
            }

            const paciente = await Paciente.findByPk(propuesta.paciente_id);

            if (accion === 'aprobar') {
                // Iniciar transacción
                const transaction = await sequelize.transaction();

                try {
                    // 1. Actualizar propuesta a aprobada
                    await propuesta.update({
                        estado: 'aprobada',
                        usuario_id: coordinador_id,
                        tipo_alta: tipo_alta || 'terapeutica',
                        evaluacion_final: evaluacion_final || null,
                        recomendaciones: recomendaciones || null,
                        fecha_alta: new Date().toISOString().split('T')[0]
                    }, { transaction });

                    // 2. Desactivar paciente
                    await paciente.update({
                        activo: false,
                        estado: `alta_${tipo_alta || 'terapeutica'}`,
                        updated_at: new Date()
                    }, { transaction });

                    // 3. Finalizar asignaciones activas
                    await Asignacion.update({
                        estado: 'finalizada',
                        fecha_fin: new Date().toISOString().split('T')[0],
                        motivo_fin: `Paciente dado de alta por coordinador`
                    }, {
                        where: { paciente_id: propuesta.paciente_id, estado: 'activa' },
                        transaction
                    });

                    // 4. Cancelar citas futuras
                    const fechaHoy = new Date().toISOString().split('T')[0];
                    await Cita.update({
                        estado: 'cancelada',
                        motivo_cancelacion: `Paciente dado de alta`,
                        updated_at: new Date()
                    }, {
                        where: {
                            paciente_id: propuesta.paciente_id,
                            fecha: { [Op.gte]: fechaHoy },
                            estado: { [Op.in]: ['programada', 'confirmada'] }
                        },
                        transaction
                    });

                    // 5. Notificar a psicólogo y becario
                    const asignacionReciente = await Asignacion.findOne({
                        where: { paciente_id: propuesta.paciente_id },
                        attributes: ['psicologo_id', 'becario_id'],
                        order: [['fecha_inicio', 'DESC']],
                        transaction
                    });

                    if (asignacionReciente) {
                        const notificaciones = [];
                        const titulo = 'Paciente dado de alta';
                        const mensaje = `La propuesta de alta para ${paciente.nombre} ${paciente.apellido} ha sido aprobada.`;

                        if (asignacionReciente.psicologo_id) {
                            notificaciones.push({ usuario_id: asignacionReciente.psicologo_id, tipo: 'alerta_sistema', titulo, mensaje });
                        }
                        if (asignacionReciente.becario_id) {
                            notificaciones.push({ usuario_id: asignacionReciente.becario_id, tipo: 'alerta_sistema', titulo, mensaje });
                        }

                        if (notificaciones.length > 0) {
                            await Notificacion.bulkCreate(notificaciones, { transaction });
                        }
                    }

                    await transaction.commit();

                    res.json({
                        success: true,
                        message: 'Propuesta aprobada y paciente dado de alta',
                        data: propuesta
                    });

                } catch (error) {
                    await transaction.rollback();
                    throw error;
                }

            } else if (accion === 'rechazar') {
                // Rechazar propuesta
                await propuesta.update({
                    estado: 'rechazada',
                    motivo_rechazo: motivo_rechazo || 'Sin motivo especificado'
                });

                // Notificar a psicólogo
                await Notificacion.create({
                    usuario_id: propuesta.psicologo_id,
                    tipo: 'alerta_sistema',
                    titulo: 'Propuesta de alta rechazada',
                    mensaje: `Tu propuesta de alta para ${paciente.nombre} ${paciente.apellido} ha sido rechazada. Motivo: ${motivo_rechazo || 'Sin especificar'}`
                });

                res.json({
                    success: true,
                    message: 'Propuesta rechazada',
                    data: propuesta
                });
            } else {
                return res.status(400).json({
                    success: false,
                    message: 'Acción inválida. Use "aprobar" o "rechazar"'
                });
            }

        } catch (error) {
            console.error('Error en procesarPropuesta:', error);
            res.status(500).json({
                success: false,
                message: 'Error al procesar propuesta',
                error: error.message
            });
        }
    }
}

module.exports = AltaController;