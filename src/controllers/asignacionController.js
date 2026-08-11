const { Op, fn, col, literal } = require('sequelize');
const Asignacion = require('../models/asignacionModel');
const Paciente = require('../models/pacienteModel');
const User = require('../models/userModel');
const Notificacion = require('../models/notificacionModel');
const LogSistema = require('../models/logSistemaModel');
const BecarioHoras = require('../models/becarioHorasModel');

class AsignacionController {

    static async crearAsignacion(req, res) {
        try {
            const { paciente_id, psicologo_id, becario_id, notas, terapeuta_id, coterapeuta_id } = req.body;
            const usuarioId = req.user.id;
            const finalPsicologoId = psicologo_id || terapeuta_id;
            const finalBecarioId = becario_id || coterapeuta_id;

            if (!finalPsicologoId) {
                return res.status(400).json({
                    success: false,
                    message: 'Falta terapeuta_id para asignar'
                });
            }

            // Validar que el paciente existe y está activo
            const paciente = await Paciente.findByPk(paciente_id);
            if (!paciente || !paciente.activo) {
                return res.status(404).json({
                    success: false,
                    message: 'Paciente no encontrado o inactivo'
                });
            }

            // Validar que el terapeuta existe y es terapeuta
            const psicologo = await User.findOne({
                where: { id: finalPsicologoId, rol: { [Op.in]: ['terapeuta', 'psicologo'] }, activo: true }
            });

            if (!psicologo) {
                return res.status(404).json({
                    success: false,
                    message: 'Terapeuta no encontrado o inactivo'
                });
            }

            // Validar que el coterapeuta existe si se especifica
            if (finalBecarioId) {
                const becario = await User.findOne({
                    where: { id: finalBecarioId, rol: { [Op.in]: ['coterapeuta', 'becario', 'psicopedagogico'] }, activo: true }
                });

                if (!becario) {
                    return res.status(404).json({
                        success: false,
                        message: 'Coterapeuta no encontrado o inactivo'
                    });
                }
            }

            // Verificar que no haya asignación activa
            const asignacionExistente = await Asignacion.findOne({
                where: {
                    paciente_id,
                    estado: 'activa'
                }
            });

            if (asignacionExistente) {
                // Finalizar asignación anterior
                await asignacionExistente.update({
                    estado: 'finalizada',
                    fecha_fin: new Date().toISOString().split('T')[0],
                    motivo_fin: 'Reasignación'
                });
            }

            // Crear nueva asignación
            const asignacion = await Asignacion.create({
                paciente_id,
                psicologo_id: finalPsicologoId,
                becario_id: finalBecarioId || null,
                notas,
                fecha_inicio: new Date().toISOString().split('T')[0]
            });

            // Actualizar paciente con terapeuta asignado
            await paciente.update({ fundacion_id: psicologo.fundacion_id });

            // Crear notificaciones
            await Notificacion.bulkCreate([
                {
                    usuario_id: finalPsicologoId,
                    tipo: 'asignacion_nueva',
                    titulo: 'Nueva asignación',
                    mensaje: `Se le ha asignado el paciente: ${paciente.nombre} ${paciente.apellido}`
                },
                {
                    usuario_id: usuarioId,
                    tipo: 'asignacion_nueva',
                    titulo: 'Nueva asignación',
                    mensaje: `Ha sido asignado como supervisor del paciente: ${paciente.nombre} ${paciente.apellido}`
                }
            ]);

            if (finalBecarioId) {
                await Notificacion.create({
                    usuario_id: finalBecarioId,
                    tipo: 'asignacion_nueva',
                    titulo: 'Nueva asignación',
                    mensaje: `Se le ha asignado el paciente: ${paciente.nombre} ${paciente.apellido}`
                });
            }

            // Log
            await LogSistema.create({
                usuario_id: usuarioId,
                tipo_log: 'creacion',
                modulo: 'asignaciones',
                accion: 'Crear asignación',
                descripcion: `Asignación creada: Paciente ${paciente.id} → Terapeuta ${finalPsicologoId}${finalBecarioId ? ` + Coterapeuta ${finalBecarioId}` : ''}`
            });

            // Recuperar asignación creada con asociaciones para devolver datos completos al cliente
            const asignacionCompleta = await Asignacion.findOne({
                where: { id: asignacion.id },
                include: [
                    { model: Paciente, attributes: ['id', 'nombre', 'apellido'] },
                    { model: User, as: 'Psicologo', attributes: ['id', 'nombre', 'apellido', 'email'] },
                    { model: User, as: 'Becario', attributes: ['id', 'nombre', 'apellido', 'email'] }
                ]
            });

            console.log('Asignacion creada (completa):', JSON.stringify(asignacionCompleta, null, 2));

            res.json({
                success: true,
                message: 'Asignación creada exitosamente',
                data: asignacionCompleta
            });

        } catch (error) {
            console.error('Error en crearAsignacion:', error);
            res.status(500).json({
                success: false,
                message: 'Error al crear asignación',
                error: error.message
            });
        }
    }

    static async obtenerAsignacionesActivas(req, res) {
        try {
            const { psicologo_id, becario_id, paciente_id } = req.query;
            const usuarioId = req.user.id;

            const whereClause = { estado: 'activa' };

            if (psicologo_id) whereClause.psicologo_id = psicologo_id;
            if (becario_id) whereClause.becario_id = becario_id;
            if (paciente_id) whereClause.paciente_id = paciente_id;

            const asignaciones = await Asignacion.findAll({
                where: whereClause,
                include: [
                    {
                        model: Paciente,
                        attributes: ['id', 'nombre', 'apellido', 'email', 'telefono', 'estado']
                    },
                    {
                        model: User,
                        as: 'Psicologo',
                        attributes: ['id', 'nombre', 'apellido', 'email', 'especialidad']
                    },
                    {
                        model: User,
                        as: 'Becario',
                        attributes: ['id', 'nombre', 'apellido', 'email']
                    }
                ],
                order: [['fecha_inicio', 'DESC']]
            });

            res.json({
                success: true,
                data: asignaciones,
                count: asignaciones.length
            });

        } catch (error) {
            console.error('Error en obtenerAsignacionesActivas:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener asignaciones'
            });
        }
    }

    static async obtenerMisPacientes(req, res) {
        try {
            const usuarioId = req.user.id;
            const usuarioRol = req.user.rol;

            const today = new Date().toISOString().slice(0, 10);

            if (usuarioRol === 'terapeuta') {
                const asignaciones = await Asignacion.findAll({
                    where: {
                        psicologo_id: usuarioId,
                        estado: 'activa'
                    },
                    include: [
                        {
                            model: Paciente,
                            where: { activo: true },
                            attributes: {
                                include: [
                                    [literal('TIMESTAMPDIFF(YEAR, Paciente.fecha_inscripcion, CURDATE())'), 'edad'],
                                    [literal("(SELECT COUNT(*) FROM citas c WHERE c.paciente_id = Paciente.id AND c.estado = 'completada')"), 'sesiones_completadas'],
                                    [literal("(SELECT MAX(c.fecha) FROM citas c WHERE c.paciente_id = Paciente.id AND c.estado = 'completada')"), 'ultima_sesion'],
                                    [literal("(SELECT MIN(c.fecha) FROM citas c WHERE c.paciente_id = Paciente.id AND c.estado = 'programada' AND c.fecha >= CURDATE())"), 'proxima_cita'],
                                    [literal("(SELECT COUNT(*) FROM citas c WHERE c.paciente_id = Paciente.id AND c.estado = 'programada' AND c.fecha >= CURDATE())"), 'citas_pendientes'],
                                    [literal("(SELECT e.diagnostico_presuntivo FROM expedientes e WHERE e.paciente_id = Paciente.id LIMIT 1)"), 'diagnostico_presuntivo'],
                                    [literal("(SELECT e.diagnostico_definitivo FROM expedientes e WHERE e.paciente_id = Paciente.id LIMIT 1)"), 'diagnostico_definitivo'],
                                    [literal("(SELECT e.motivo_consulta FROM expedientes e WHERE e.paciente_id = Paciente.id LIMIT 1)"), 'motivo_consulta']
                                ]
                            }
                        },
                        {
                            model: User,
                            as: 'Becario',
                            attributes: ['id', 'nombre', 'apellido']
                        }
                    ],
                    order: [[Paciente, 'apellido', 'ASC'], [Paciente, 'nombre', 'ASC']]
                });

                const pacientes = asignaciones.map((a) => {
                    const p = a.Paciente?.toJSON ? a.Paciente.toJSON() : a.Paciente;
                    return {
                        ...p,
                        fecha_inicio: a.fecha_inicio,
                        becario_id: a.becario_id,
                        becario_nombre: a.Becario?.nombre || null,
                        becario_apellido: a.Becario?.apellido || null
                    };
                });

                res.json({
                    success: true,
                    data: pacientes,
                    count: pacientes.length
                });
                return;
            }

            if (usuarioRol === 'coterapeuta' || usuarioRol === 'psicopedagogico' || usuarioRol === 'becario') {
                const asignaciones = await Asignacion.findAll({
                    where: {
                        becario_id: usuarioId,
                        estado: 'activa'
                    },
                    include: [
                        {
                            model: Paciente,
                            where: { activo: true },
                            attributes: {
                                include: [
                                    [literal('TIMESTAMPDIFF(YEAR, Paciente.fecha_inscripcion, CURDATE())'), 'edad'],
                                    [literal(`(SELECT COUNT(*) FROM citas c WHERE c.paciente_id = Paciente.id AND c.becario_id = ${usuarioId} AND c.estado = 'completada')`), 'sesiones_completadas'],
                                    [literal(`(SELECT MAX(c.fecha) FROM citas c WHERE c.paciente_id = Paciente.id AND c.becario_id = ${usuarioId} AND c.estado = 'completada')`), 'ultima_sesion'],
                                    [literal(`(SELECT MIN(c.fecha) FROM citas c WHERE c.paciente_id = Paciente.id AND c.becario_id = ${usuarioId} AND c.estado = 'programada' AND c.fecha >= CURDATE())`), 'proxima_cita'],
                                    [literal(`(SELECT COUNT(*) FROM citas c WHERE c.paciente_id = Paciente.id AND c.becario_id = ${usuarioId} AND c.estado = 'programada' AND c.fecha >= CURDATE())`), 'citas_pendientes'],
                                    [literal("(SELECT e.diagnostico_presuntivo FROM expedientes e WHERE e.paciente_id = Paciente.id LIMIT 1)"), 'diagnostico_presuntivo'],
                                    [literal("(SELECT e.diagnostico_definitivo FROM expedientes e WHERE e.paciente_id = Paciente.id LIMIT 1)"), 'diagnostico_definitivo'],
                                    [literal("(SELECT e.motivo_consulta FROM expedientes e WHERE e.paciente_id = Paciente.id LIMIT 1)"), 'motivo_consulta']
                                ]
                            }
                        },
                        {
                            model: User,
                            as: 'Psicologo',
                            attributes: ['id', 'nombre', 'apellido']
                        }
                    ],
                    order: [[Paciente, 'apellido', 'ASC'], [Paciente, 'nombre', 'ASC']]
                });

                const pacientes = asignaciones.map((a) => {
                    const p = a.Paciente?.toJSON ? a.Paciente.toJSON() : a.Paciente;
                    return {
                        ...p,
                        fecha_inicio: a.fecha_inicio,
                        psicologo_id: a.psicologo_id,
                        psicologo_nombre: a.Psicologo?.nombre || null,
                        psicologo_apellido: a.Psicologo?.apellido || null
                    };
                });

                res.json({
                    success: true,
                    data: pacientes,
                    count: pacientes.length
                });
                return;
            }

            return res.status(403).json({
                success: false,
                message: 'Acceso no permitido para este rol'
            });

            console.log('Pacientes encontrados:', pacientes.length);
            if (pacientes.length > 0) {
                console.log('Primer paciente:', pacientes[0]);
            }

            res.json({
                success: true,
                data: pacientes,
                count: pacientes.length
            });

        } catch (error) {
            console.error('Error en obtenerMisPacientes:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener pacientes asignados'
            });
        }
    }

    static async finalizarAsignacion(req, res) {
        try {
            const { id } = req.params;
            const { motivo_fin, notas } = req.body;
            const usuarioId = req.user.id;

            const asignacion = await Asignacion.findByPk(id);

            if (!asignacion || asignacion.estado !== 'activa') {
                return res.status(404).json({
                    success: false,
                    message: 'Asignación activa no encontrada'
                });
            }

            // Obtener datos antes para log
            const datosAntes = { ...asignacion.toJSON() };

            await asignacion.update({
                estado: 'finalizada',
                fecha_fin: new Date().toISOString().split('T')[0],
                motivo_fin: motivo_fin || 'Finalización manual',
                notas: notas ? `${asignacion.notas || ''}\n--- Finalización ---\n${notas}` : asignacion.notas
            });

            // Log
            await LogSistema.create({
                usuario_id: usuarioId,
                tipo_log: 'modificacion',
                modulo: 'asignaciones',
                accion: 'Finalizar asignación',
                descripcion: `Asignación finalizada ID: ${id}`,
                datos_antes: datosAntes,
                datos_despues: asignacion.toJSON()
            });

            res.json({
                success: true,
                message: 'Asignación finalizada exitosamente'
            });

        } catch (error) {
            console.error('Error en finalizarAsignacion:', error);
            res.status(500).json({
                success: false,
                message: 'Error al finalizar asignación'
            });
        }
    }

    static async obtenerHistorialAsignaciones(req, res) {
        try {
            const { paciente_id } = req.params;

            const asignaciones = await Asignacion.findAll({
                where: { paciente_id },
                include: [
                    {
                        model: User,
                        as: 'Psicologo',
                        attributes: ['id', 'nombre', 'apellido', 'email']
                    },
                    {
                        model: User,
                        as: 'Becario',
                        attributes: ['id', 'nombre', 'apellido', 'email']
                    }
                ],
                order: [['fecha_inicio', 'DESC']]
            });

            res.json({
                success: true,
                data: asignaciones,
                count: asignaciones.length
            });

        } catch (error) {
            console.error('Error en obtenerHistorialAsignaciones:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener historial de asignaciones'
            });
        }
    }

    static async obtenerMisBecarios(req, res) {
        try {
            const usuarioId = req.user.id;
            const usuarioRol = req.user.rol;

            // Solo terapeutas pueden ver sus coterapeutas asignados
            if (usuarioRol !== 'terapeuta') {
                return res.status(403).json({
                    success: false,
                    message: 'Acceso no permitido para este rol'
                });
            }

            const asignaciones = await Asignacion.findAll({
                where: {
                    psicologo_id: usuarioId,
                    estado: 'activa',
                    becario_id: { [Op.ne]: null }
                },
                attributes: [
                    'becario_id',
                    [fn('COUNT', col('paciente_id')), 'pacientes_asignados']
                ],
                group: ['becario_id']
            });

            const becarioIds = asignaciones.map(a => a.becario_id);
            const becarios = await User.findAll({
                where: {
                    id: { [Op.in]: becarioIds },
                    rol: 'coterapeuta',
                    activo: true
                },
                attributes: ['id', 'nombre', 'apellido', 'email', 'telefono', 'especialidad', 'activo', 'created_at'],
                order: [['apellido', 'ASC'], ['nombre', 'ASC']]
            });

            const pacientesAsignadosMap = asignaciones.reduce((acc, item) => {
                acc[item.becario_id] = parseInt(item.get('pacientes_asignados'), 10) || 0;
                return acc;
            }, {});

            let horasMap = {};
            if (becarios.length > 0) {
                const ids = becarios.map(b => b.id);
                await BecarioHoras.sync();
                const horasRows = await BecarioHoras.findAll({
                    where: { becario_id: { [Op.in]: ids } },
                    attributes: ['becario_id', [fn('SUM', col('horas')), 'horas_acumuladas']],
                    group: ['becario_id']
                });
                horasRows.forEach(r => { horasMap[r.becario_id] = parseFloat(r.get('horas_acumuladas')) || 0; });
            }

            const becariosConHoras = becarios.map(b => ({
                ...b.toJSON(),
                pacientes_asignados: pacientesAsignadosMap[b.id] ?? 0,
                horas_acumuladas: horasMap[b.id] ?? 0
            }));

            res.json({
                success: true,
                data: becariosConHoras,
                count: becariosConHoras.length
            });

        } catch (error) {
            console.error('Error en obtenerMisBecarios:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener coterapeutas asignados'
            });
        }
    }

    static async registrarHorasBecario(req, res) {
        try {
            const becarioId = parseInt(req.params.id, 10);
            const valorHoras = parseFloat(req.body.horas);
            const comentario = req.body.comentario || null;

            if (!becarioId || Number.isNaN(becarioId)) {
                return res.status(400).json({ success: false, message: 'Coterapeuta inválido' });
            }
            if (!valorHoras || Number.isNaN(valorHoras) || valorHoras <= 0) {
                return res.status(400).json({ success: false, message: 'Horas debe ser mayor a 0' });
            }

            await BecarioHoras.sync();

            await BecarioHoras.create({
                becario_id: becarioId,
                horas: valorHoras,
                comentario
            });

            const totalRow = await BecarioHoras.findOne({
                where: { becario_id: becarioId },
                attributes: [[fn('SUM', col('horas')), 'horas_acumuladas']]
            });

            return res.json({
                success: true,
                message: 'Horas registradas',
                data: {
                    becario_id: becarioId,
                    horas: valorHoras,
                    horas_acumuladas: parseFloat(totalRow?.get('horas_acumuladas')) || 0
                }
            });

        } catch (error) {
            console.error('Error en registrarHorasBecario:', error);
            res.status(500).json({ success: false, message: 'Error al registrar horas', error: error.message });
        }
    }
}

module.exports = AsignacionController;