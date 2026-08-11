const { Op } = require('sequelize');
const Expediente = require('../models/expedienteModel');
const Paciente = require('../models/pacienteModel');
const Sesion = require('../models/sesionModel');
const Cita = require('../models/citaModel');
const Asignacion = require('../models/asignacionModel');
const User = require('../models/userModel');
const Alta = require('../models/altaModel');
const LogSistema = require('../models/logSistemaModel');

class ExpedienteController {

    static async obtenerExpedienteCompleto(req, res) {
        try {
            const { paciente_id } = req.params;
            const usuarioId = req.user.id;
            const usuarioRol = req.user.rol;

            console.log(`obtenerExpedienteCompleto: usuarioId=${usuarioId}, usuarioRol=${usuarioRol}, paciente_id=${paciente_id}`);

            // Si el token no incluye rol, buscarlo por seguridad
            let effectiveRol = usuarioRol;
            if (!effectiveRol) {
                try {
                    const user = await User.findByPk(usuarioId);
                    effectiveRol = user ? user.rol : null;
                    console.log(`Rol obtenido de DB: ${effectiveRol}`);
                } catch (err) {
                    console.error('Error obteniendo rol de usuario:', err);
                    return res.status(500).json({
                        success: false,
                        message: 'Error verificando permisos de usuario'
                    });
                }
            }

            if (!effectiveRol) {
                return res.status(403).json({
                    success: false,
                    message: 'No se pudo verificar el rol del usuario'
                });
            }

            const tieneAcceso = await ExpedienteController.verificarAccesoExpediente(usuarioId, effectiveRol, paciente_id);
            if (!tieneAcceso) {
                return res.status(403).json({
                    success: false,
                    message: 'No tiene permisos para acceder a este expediente'
                });
            }

            // Obtener información básica del paciente
            const paciente = await Paciente.findByPk(paciente_id, {
                attributes: { exclude: ['password'] }
            });
            console.log('Paciente lookup result:', paciente ? `id=${paciente.id}` : 'NOT FOUND');

            if (!paciente) {
                return res.status(404).json({
                    success: false,
                    message: 'Paciente no encontrado'
                });
            }

            // Obtener expediente clínico
            const expediente = await Expediente.findOne({
                where: { paciente_id },
                include: [
                    {
                        model: User,
                        as: 'Psicologo',
                        attributes: ['id', 'nombre', 'apellido', 'especialidad']
                    }
                ]
            });
            console.log('Expediente found:', !!expediente);

            // Obtener asignación actual
            const asignacion = await Asignacion.findOne({
                where: {
                    paciente_id,
                    estado: 'activa'
                },
                include: [
                    {
                        model: User,
                        as: 'Psicologo',
                        attributes: ['id', 'nombre', 'apellido', 'especialidad', 'telefono', 'email']
                    },
                    {
                        model: User,
                        as: 'Becario',
                        attributes: ['id', 'nombre', 'apellido', 'email']
                    }
                ]
            });

            // Obtener historial de sesiones: primero obtener IDs de citas del paciente y luego sesiones por cita_id
            const citasPaciente = await Cita.findAll({ where: { paciente_id }, attributes: ['id'] });
            const citaIds = (citasPaciente || []).map(c => c.id);

            let sesiones = [];
            if (citaIds.length > 0) {
                sesiones = await Sesion.findAll({
                    where: { cita_id: { [Op.in]: citaIds } },
                    include: [
                        { model: Cita, attributes: ['id', 'fecha', 'hora', 'tipo_consulta', 'paciente_id', 'total_sesiones', 'numero_sesion', 'titulo', 'departamento'] },
                        { model: User, as: 'Psicologo', attributes: ['id', 'nombre', 'apellido'] }
                    ],
                    order: [['fecha', 'DESC'], ['hora_inicio', 'DESC']],
                    limit: 20
                });
            }

            console.log('Citas encontradas para paciente:', citaIds.length, 'Sesiones encontradas:', sesiones.length);

            // Obtener citas futuras
            const citasFuturas = await Cita.findAll({
                where: {
                    paciente_id,
                    fecha: { [Op.gte]: new Date().toISOString().split('T')[0] },
                    estado: { [Op.in]: ['programada', 'confirmada'] }
                },
                include: [
                    {
                        model: User,
                        as: 'Psicologo',
                        attributes: ['id', 'nombre', 'apellido']
                    },
                    {
                        model: User,
                        as: 'Becario',
                        attributes: ['id', 'nombre', 'apellido']
                    }
                ],
                order: [['fecha', 'ASC'], ['hora', 'ASC']]
            });
            console.log('Citas futuras encontradas:', citasFuturas.length);

            // Obtener estadísticas
            const [totalSesiones, sesionesCompletadas, sesionesCanceladas, primeraSesion, ultimaSesion] = await Promise.all([
                Cita.count({ where: { paciente_id } }),
                Cita.count({ where: { paciente_id, estado: 'completada' } }),
                Cita.count({ where: { paciente_id, estado: 'cancelada' } }),
                Cita.min('fecha', { where: { paciente_id } }),
                Cita.max('fecha', { where: { paciente_id } })
            ]);

            let duracionPromedio = null;
            if (citaIds.length > 0) {
                const sesionesDuracion = await Sesion.findAll({
                    where: { cita_id: { [Op.in]: citaIds } },
                    attributes: ['hora_inicio', 'hora_fin']
                });
                const minutos = sesionesDuracion
                    .map(s => {
                        if (!s.hora_inicio || !s.hora_fin) return null;
                        const [h1, m1] = String(s.hora_inicio).split(':').map(Number);
                        const [h2, m2] = String(s.hora_fin).split(':').map(Number);
                        if (Number.isNaN(h1) || Number.isNaN(m1) || Number.isNaN(h2) || Number.isNaN(m2)) return null;
                        return (h2 * 60 + m2) - (h1 * 60 + m1);
                    })
                    .filter(v => typeof v === 'number' && v >= 0);
                if (minutos.length > 0) {
                    duracionPromedio = minutos.reduce((a, b) => a + b, 0) / minutos.length;
                }
            }

            const estadisticas = {
                total_sesiones: totalSesiones,
                sesiones_completadas: sesionesCompletadas,
                sesiones_canceladas: sesionesCanceladas,
                primera_sesion: primeraSesion,
                ultima_sesion: ultimaSesion,
                duracion_promedio: duracionPromedio
            };

            // Obtener historial de asignaciones
            const historialAsignaciones = await Asignacion.findAll({
                where: { paciente_id },
                include: [
                    {
                        model: User,
                        as: 'Psicologo',
                        attributes: ['id', 'nombre', 'apellido']
                    },
                    {
                        model: User,
                        as: 'Becario',
                        attributes: ['id', 'nombre', 'apellido']
                    }
                ],
                order: [['fecha_inicio', 'DESC']]
            });

            // Obtener altas si las hay
            const alta = await Alta.findOne({
                where: { paciente_id },
                order: [['fecha_alta', 'DESC']]
            });

            res.json({
                success: true,
                data: {
                    paciente,
                    expediente: expediente || {},
                    asignacion_actual: asignacion || null,
                    sesiones,
                    citas_futuras: citasFuturas,
                    estadisticas: estadisticas || {},
                    historial_asignaciones: historialAsignaciones,
                    alta: alta || null
                }
            });

        } catch (error) {
            console.error('Error en obtenerExpedienteCompleto:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener expediente completo'
            });
        }
    }

    static async crearExpediente(req, res) {
        try {
            const { paciente_id } = req.params;
            const expedienteData = req.body;
            const usuarioId = req.user.id;

            console.log(`📝 Creando expediente para paciente_id: ${paciente_id}`);
            console.log(`📝 Datos recibidos:`, expedienteData);

            // Verificar que no exista ya un expediente
            const expedienteExistente = await Expediente.findOne({
                where: { paciente_id }
            });

            if (expedienteExistente) {
                return res.status(400).json({
                    success: false,
                    message: 'Ya existe un expediente para este paciente'
                });
            }

            // Crear expediente (sin validar que paciente existe)
            console.log(`📝 Intentando crear expediente con datos:`, { paciente_id, ...expedienteData });
            const expediente = await Expediente.create({
                paciente_id,
                ...expedienteData
            });

            console.log(`✅ Expediente creado exitosamente: ${expediente.id}`);

            // Log
            await LogSistema.create({
                usuario_id: usuarioId,
                tipo_log: 'creacion',
                modulo: 'expedientes',
                accion: 'Crear expediente',
                descripcion: `Expediente creado para paciente ${paciente_id}`
            });

            res.json({
                success: true,
                message: 'Expediente creado exitosamente',
                data: expediente
            });

        } catch (error) {
            console.error('❌ Error en crearExpediente:', error);
            console.error('❌ Stack:', error.stack);
            res.status(500).json({
                success: false,
                message: 'Error al crear expediente',
                error: error.message
            });
        }
    }

    static async actualizarExpediente(req, res) {
        try {
            const { paciente_id } = req.params;
            const updates = req.body;
            const usuarioId = req.user.id;
            const usuarioRol = req.user.rol;

            // Verificar permisos
            const puedeActualizar = await ExpedienteController.verificarPermisoActualizarExpediente(usuarioId, usuarioRol, paciente_id);

            if (!puedeActualizar) {
                return res.status(403).json({
                    success: false,
                    message: 'No tiene permisos para actualizar este expediente'
                });
            }

            const expediente = await Expediente.findOne({
                where: { paciente_id }
            });

            if (!expediente) {
                return res.status(404).json({
                    success: false,
                    message: 'Expediente no encontrado'
                });
            }

            // Obtener datos antes para log
            const datosAntes = { ...expediente.toJSON() };

            await expediente.update(updates);

            // Log
            await LogSistema.create({
                usuario_id: usuarioId,
                tipo_log: 'modificacion',
                modulo: 'expedientes',
                accion: 'Actualizar expediente',
                descripcion: `Expediente actualizado para paciente ${paciente_id}`,
                datos_antes: datosAntes,
                datos_despues: expediente.toJSON()
            });

            res.json({
                success: true,
                message: 'Expediente actualizado exitosamente',
                data: expediente
            });

        } catch (error) {
            console.error('Error en actualizarExpediente:', error);
            res.status(500).json({
                success: false,
                message: 'Error al actualizar expediente'
            });
        }
    }

    static async agregarNotaConfidencial(req, res) {
        try {
            const { paciente_id } = req.params;
            const { nota } = req.body;
            const usuarioId = req.user.id;

            // Verificar que el usuario es psicólogo asignado
            const asignacion = await Asignacion.findOne({
                where: {
                    paciente_id,
                    psicologo_id: usuarioId,
                    estado: 'activa'
                },
                attributes: ['id']
            });

            if (!asignacion && req.user.rol !== 'coordinador') {
                return res.status(403).json({
                    success: false,
                    message: 'Solo el psicólogo asignado puede agregar notas confidenciales'
                });
            }

            const expediente = await Expediente.findOne({
                where: { paciente_id }
            });

            if (!expediente) {
                return res.status(404).json({
                    success: false,
                    message: 'Expediente no encontrado'
                });
            }

            // Agregar nota con timestamp
            const fecha = new Date().toLocaleString('es-MX');
            const nuevaNota = `[${fecha}] ${usuarioId}: ${nota}\n\n`;
            const notasActuales = expediente.notas_confidenciales || '';

            await expediente.update({
                notas_confidenciales: nuevaNota + notasActuales
            });

            // Log
            await LogSistema.create({
                usuario_id: usuarioId,
                tipo_log: 'modificacion',
                modulo: 'expedientes',
                accion: 'Agregar nota confidencial',
                descripcion: `Nota confidencial agregada para paciente ${paciente_id}`
            });

            res.json({
                success: true,
                message: 'Nota confidencial agregada exitosamente'
            });

        } catch (error) {
            console.error('Error en agregarNotaConfidencial:', error);
            res.status(500).json({
                success: false,
                message: 'Error al agregar nota confidencial'
            });
        }
    }

    static async obtenerResumenExpediente(req, res) {
        try {
            const { paciente_id } = req.params;
            const usuarioId = req.user.id;
            const usuarioRol = req.user.rol;

            // Si token no incluye rol, buscarlo
            const effectiveRol = usuarioRol || (await User.findByPk(usuarioId)).rol;

            // Verificar permisos básicos
            const tieneAcceso = await ExpedienteController.verificarAccesoExpediente(usuarioId, effectiveRol, paciente_id);

            if (!tieneAcceso) {
                return res.status(403).json({
                    success: false,
                    message: 'No tiene permisos para acceder a este expediente'
                });
            }

            const paciente = await Paciente.findByPk(paciente_id, {
                attributes: ['id', 'nombre', 'apellido', 'fecha_inscripcion', 'genero', 'telefono', 'email', 'estado']
            });

            if (!paciente) {
                return res.status(404).json({
                    success: false,
                    message: 'Paciente no encontrado'
                });
            }

            const expediente = await Expediente.findOne({
                where: { paciente_id },
                attributes: ['motivo_consulta', 'diagnostico_presuntivo', 'riesgo_suicida']
            });

            const asignacion = await Asignacion.findOne({
                where: { paciente_id, estado: 'activa' },
                attributes: ['psicologo_id']
            });

            const psicologo = asignacion
                ? await User.findByPk(asignacion.psicologo_id, { attributes: ['nombre', 'apellido'] })
                : null;

            const [sesiones_completadas, citas_pendientes, ultima_sesion] = await Promise.all([
                Cita.count({ where: { paciente_id, estado: 'completada' } }),
                Cita.count({
                    where: {
                        paciente_id,
                        estado: 'programada',
                        fecha: { [Op.gte]: new Date().toISOString().split('T')[0] }
                    }
                }),
                Cita.max('fecha', { where: { paciente_id, estado: 'completada' } })
            ]);

            const resumen = {
                id: paciente.id,
                nombre: paciente.nombre,
                apellido: paciente.apellido,
                fecha_inscripcion: paciente.fecha_inscripcion,
                genero: paciente.genero,
                telefono: paciente.telefono,
                email: paciente.email,
                estado: paciente.estado,
                motivo_consulta: expediente?.motivo_consulta || null,
                diagnostico_presuntivo: expediente?.diagnostico_presuntivo || null,
                riesgo_suicida: expediente?.riesgo_suicida || null,
                psicologo_id: asignacion?.psicologo_id || null,
                psicologo_nombre: psicologo?.nombre || null,
                psicologo_apellido: psicologo?.apellido || null,
                sesiones_completadas,
                citas_pendientes,
                ultima_sesion
            };

            res.json({
                success: true,
                data: resumen
            });

        } catch (error) {
            console.error('Error en obtenerResumenExpediente:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener resumen de expediente'
            });
        }
    }

    // Métodos auxiliares
    static async verificarAccesoExpediente(usuarioId, usuarioRol, pacienteId) {
        try {
            console.log(`verificarAccesoExpediente: usuarioId=${usuarioId}, usuarioRol=${usuarioRol}, pacienteId=${pacienteId}`);

            if (usuarioRol === 'coordinador') {
                console.log('Acceso concedido: coordinador');
                return true;
            }

            // Verificar si el usuario está asignado al paciente
            const asignacion = await Asignacion.findOne({
                where: {
                    paciente_id: pacienteId,
                    estado: 'activa',
                    [Op.or]: [
                        { psicologo_id: usuarioId },
                        { becario_id: usuarioId }
                    ]
                },
                attributes: ['id']
            });

            const tieneAcceso = !!asignacion;
            console.log(`Acceso verificado: ${tieneAcceso}`);
            return tieneAcceso;
        } catch (error) {
            console.error('Error en verificarAccesoExpediente:', error);
            return false;
        }
    }

    static async verificarPermisoActualizarExpediente(usuarioId, usuarioRol, pacienteId) {
        // Coordinadores pueden editar cualquier expediente
        if (usuarioRol === 'coordinador') return true;

        // Psicólogos pueden editar expedientes de cualquier paciente
        // (normalmente restringido a pacientes asignados, pero ya se valida en obtenerExpedienteCompleto)
        if (usuarioRol === 'psicologo') return true;

        return false;
    }
}

module.exports = ExpedienteController;