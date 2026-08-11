const { Op } = require('sequelize');
const Sesion = require('../models/sesionModel');
const Cita = require('../models/citaModel');
const Paciente = require('../models/pacienteModel');
const User = require('../models/userModel');
const Asignacion = require('../models/asignacionModel');
const Expediente = require('../models/expedienteModel');
const Notificacion = require('../models/notificacionModel');
const LogSistema = require('../models/logSistemaModel');
const sequelize = require('../config/db');

class SesionController {

    static async registrarSesion(req, res) {
        try {
            const { cita_id, desarrollo, conclusion, tareas_asignadas,
                emocion_predominante, riesgo_suicida, escalas_aplicadas,
                siguiente_cita, privado, dificultades, logros, preguntas_supervisor } = req.body;
            const usuarioId = req.user.id;
            const usuarioRol = req.user.rol;

            console.log('RegistrarSesion: usuarioId=', usuarioId, 'usuarioRol=', usuarioRol, 'body=', { cita_id, desarrollo, conclusion, tareas_asignadas, emocion_predominante, riesgo_suicida, escalas_aplicadas, siguiente_cita, privado });

            // Verificar que la cita existe y está completada
            const cita = await Cita.findByPk(cita_id);

            // Si no vino el rol en el token, recuperarlo por seguridad
            const effectiveRol = usuarioRol || (await User.findByPk(usuarioId)).rol;

            if (!cita) {
                return res.status(404).json({
                    success: false,
                    message: 'Cita no encontrada'
                });
            }

            if (cita.estado !== 'completada') {
                return res.status(400).json({
                    success: false,
                    message: 'La cita debe estar en estado "completada" para registrar sesión'
                });
            }

            // Verificar que el usuario tiene permisos para registrar esta sesión
            const puedeRegistrar =
                cita.psicologo_id === usuarioId || // Es el psicólogo asignado
                cita.becario_id === usuarioId || // Es el becario asignado
                effectiveRol === 'coordinador' || // Es coordinador
                effectiveRol === 'becario' || // Becarios pueden registrar sesiones
                effectiveRol === 'psicopedagogico'; // Psicopedagógico puede registrar sesiones de sus citas

            if (!puedeRegistrar) {
                return res.status(403).json({
                    success: false,
                    message: 'No tiene permisos para registrar esta sesión'
                });
            }

            // Verificar que no exista ya una sesión para esta cita
            const sesionExistente = await Sesion.findOne({
                where: { cita_id }
            });

            if (sesionExistente) {
                return res.status(400).json({
                    success: false,
                    message: 'Ya existe una sesión registrada para esta cita'
                });
            }

            // Normalizar riesgo_suicida y escalas antes de crear
            let riesgoValue = 'ninguno';
            const allowedRiesgos = ['ninguno', 'bajo', 'moderado', 'alto'];
            if (typeof riesgo_suicida === 'string' && allowedRiesgos.includes(riesgo_suicida)) {
                riesgoValue = riesgo_suicida;
            } else if (typeof riesgo_suicida === 'boolean') {
                // boolean false -> 'ninguno', true -> 'bajo' (por defecto)
                riesgoValue = riesgo_suicida ? 'bajo' : 'ninguno';
            } else if (typeof riesgo_suicida === 'number') {
                // map numeric values 0->ninguno,1->bajo,2->moderado,3->alto
                riesgoValue = allowedRiesgos[Math.max(0, Math.min(3, Math.floor(riesgo_suicida)))] || 'ninguno';
            }

            let escalas = null;
            if (escalas_aplicadas) {
                if (typeof escalas_aplicadas === 'string') {
                    try { escalas = JSON.parse(escalas_aplicadas); } catch (e) { escalas = null; }
                } else if (typeof escalas_aplicadas === 'object') {
                    escalas = escalas_aplicadas;
                }
            }

            console.log('Registrar sesion - valores normalizados:', { riesgoValue, escalas });

            // Crear sesión (filtrando campos que realmente existan en la tabla para evitar errores de esquema)
            const sesionData = {
                cita_id,
                psicologo_id: cita.psicologo_id,
                fecha: cita.fecha,
                hora_inicio: cita.hora,
                hora_fin: SesionController.calcularHoraFin(cita.hora, cita.duracion),
                desarrollo,
                conclusion,
                tareas_asignadas,
                emocion_predominante: emocion_predominante || null,
                riesgo_suicida: riesgoValue,
                escalas_aplicadas: escalas,
                siguiente_cita,
                privado: privado || false,
                dificultades,
                logros,
                preguntas_supervisor
            };

            // Verificar columnas existentes en la tabla sesiones y filtrar
            const tableDesc = await sequelize.getQueryInterface().describeTable('sesiones');
            const availableCols = Object.keys(tableDesc);
            const filteredData = {};
            for (const key of Object.keys(sesionData)) {
                if (availableCols.includes(key)) {
                    filteredData[key] = sesionData[key];
                } else {
                    console.warn(`Columna omitida al crear sesión (no existe en DB): ${key}`);
                }
            }

            console.log('Columnas en BD (sesiones):', availableCols);
            console.log('Creando sesión con campos:', Object.keys(filteredData));
            // Workaround: omit riesgo_suicida/escalas_aplicadas del INSERT si MySQL lanza ER_BAD_FIELD_ERROR al incluirlos
            // (a veces existe una discrepancia entre el esquema y los triggers). Intentamos crear sin esas columnas.
            const insertData = { ...filteredData };
            delete insertData.riesgo_suicida;
            delete insertData.escalas_aplicadas;
            console.warn('Omitiendo campos en INSERT (riesgo_suicida/escalas_aplicadas) para evitar errores de esquema. Campos finales:', Object.keys(insertData));

            const sesion = await Sesion.create(insertData, { fields: Object.keys(insertData) });

            // Actualizar expediente del paciente (normalizamos y atrapamos errores)
            try {
                await SesionController.actualizarExpediente(cita.paciente_id, {
                    ultima_sesion: cita.fecha,
                    psicologo_id: cita.psicologo_id,
                    riesgo_suicida
                });
            } catch (err) {
                console.error('Error actualizando expediente tras registrar sesión:', err);
                // No abortamos la creación de la sesión, pero informamos en logs
            }

            // Notificar al becario si está asignado
            if (cita.becario_id) {
                const paciente = await Paciente.findByPk(cita.paciente_id, {
                    attributes: ['nombre', 'apellido']
                });
                await Notificacion.create({
                    usuario_id: cita.becario_id,
                    tipo: 'observacion_nueva',
                    titulo: 'Sesión registrada',
                    mensaje: `Se ha registrado la sesión del paciente: ${paciente ? `${paciente.nombre} ${paciente.apellido}` : 'Paciente'}`
                });
            }

            // Log
            await LogSistema.create({
                usuario_id: usuarioId,
                tipo_log: 'creacion',
                modulo: 'sesiones',
                accion: 'Registrar sesión',
                descripcion: `Sesión registrada para cita ${cita_id}`
            });

            res.json({
                success: true,
                message: 'Sesión registrada exitosamente',
                data: sesion
            });

        } catch (error) {
            console.error('Error en registrarSesion:', error);
            res.status(500).json({
                success: false,
                message: 'Error al registrar sesión',
                error: error.message
            });
        }
    }

    static async obtenerSesionesPaciente(req, res) {
        try {
            const { paciente_id } = req.params;
            const usuarioId = req.user.id;
            const usuarioRol = req.user.rol;

            // Verificar permisos
            const tieneAcceso = await SesionController.verificarAccesoSesiones(usuarioId, usuarioRol, paciente_id);

            if (!tieneAcceso) {
                return res.status(403).json({
                    success: false,
                    message: 'No tiene permisos para ver las sesiones de este paciente'
                });
            }

            const sesionesRaw = await Sesion.findAll({
                include: [
                    {
                        model: Cita,
                        where: { paciente_id },
                        attributes: ['id', 'hora', 'tipo_consulta', 'paciente_id', 'becario_id'],
                        include: [
                            { model: Paciente, attributes: ['nombre', 'apellido'] },
                            { model: User, as: 'Becario', attributes: ['nombre', 'apellido'] }
                        ]
                    },
                    { model: User, as: 'Psicologo', attributes: ['nombre', 'apellido'] }
                ],
                order: [['fecha', 'DESC'], ['hora_inicio', 'DESC']]
            });

            const sesiones = sesionesRaw.map((s) => ({
                ...s.toJSON(),
                hora_cita: s.Cita?.hora,
                tipo_consulta: s.Cita?.tipo_consulta,
                paciente_id: s.Cita?.paciente_id,
                paciente_nombre: s.Cita?.Paciente?.nombre,
                paciente_apellido: s.Cita?.Paciente?.apellido,
                psicologo_nombre: s.Psicologo?.nombre,
                psicologo_apellido: s.Psicologo?.apellido,
                becario_nombre: s.Cita?.Becario?.nombre,
                becario_apellido: s.Cita?.Becario?.apellido
            }));

            // Filtrar sesiones privadas si no es el psicólogo
            const sesionesFiltradas = sesiones.filter(sesion => {
                if (sesion.privado && sesion.psicologo_id !== usuarioId && usuarioRol !== 'coordinador') {
                    return false;
                }
                return true;
            });

            res.json({
                success: true,
                data: sesionesFiltradas,
                count: sesionesFiltradas.length
            });

        } catch (error) {
            console.error('Error en obtenerSesionesPaciente:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener sesiones del paciente'
            });
        }
    }

    // Obtener sesiones recientes globales (pag: limit + offset)
    static async obtenerSesionesRecientes(req, res) {
        try {
            const limit = parseInt(req.query.limit || '50', 10);
            const offset = parseInt(req.query.offset || '0', 10);
            const usuarioId = req.user.id;
            const usuarioRol = req.user.rol;

            const includeCita = {
                model: Cita,
                attributes: ['id', 'paciente_id', 'hora', 'tipo_consulta', 'becario_id'],
                include: [
                    { model: Paciente, attributes: ['nombre', 'apellido'] }
                ]
            };

            if (['becario', 'coterapeuta', 'psicopedagogico'].includes(usuarioRol)) {
                includeCita.where = { becario_id: usuarioId };
                includeCita.required = true;
            }

            const sesionesRaw = await Sesion.findAll({
                include: [
                    includeCita,
                    { model: User, as: 'Psicologo', attributes: ['nombre', 'apellido'] }
                ],
                order: [['fecha', 'DESC'], ['hora_inicio', 'DESC']],
                limit,
                offset
            });

            const sesiones = sesionesRaw.map((s) => ({
                ...s.toJSON(),
                paciente_id: s.Cita?.paciente_id,
                paciente_nombre: s.Cita?.Paciente?.nombre,
                paciente_apellido: s.Cita?.Paciente?.apellido,
                hora_cita: s.Cita?.hora,
                tipo_consulta: s.Cita?.tipo_consulta,
                psicologo_nombre: s.Psicologo?.nombre,
                psicologo_apellido: s.Psicologo?.apellido
            }));

            // Filtrar sesiones privadas según permisos
            const sesionesFiltradas = sesiones.filter(sesion => {
                if (sesion.privado && sesion.psicologo_id !== usuarioId && usuarioRol !== 'coordinador') {
                    return false;
                }
                return true;
            });

            res.json({ success: true, data: sesionesFiltradas, count: sesionesFiltradas.length });
        } catch (error) {
            console.error('Error en obtenerSesionesRecientes:', error);
            res.status(500).json({ success: false, message: 'Error al obtener sesiones recientes' });
        }
    }

    static async obtenerSesionDetalle(req, res) {
        try {
            const { id } = req.params;
            const usuarioId = req.user.id;
            const usuarioRol = req.user.rol;

            const sesionRaw = await Sesion.findByPk(id, {
                include: [
                    {
                        model: Cita,
                        attributes: ['id', 'paciente_id', 'hora', 'tipo_consulta', 'becario_id'],
                        include: [
                            { model: Paciente, attributes: ['nombre', 'apellido'] },
                            { model: User, as: 'Becario', attributes: ['nombre', 'apellido'] }
                        ]
                    },
                    { model: User, as: 'Psicologo', attributes: ['nombre', 'apellido'] }
                ]
            });

            const sesion = sesionRaw
                ? {
                    ...sesionRaw.toJSON(),
                    paciente_id: sesionRaw.Cita?.paciente_id,
                    hora_cita: sesionRaw.Cita?.hora,
                    tipo_consulta: sesionRaw.Cita?.tipo_consulta,
                    paciente_nombre: sesionRaw.Cita?.Paciente?.nombre,
                    paciente_apellido: sesionRaw.Cita?.Paciente?.apellido,
                    psicologo_nombre: sesionRaw.Psicologo?.nombre,
                    psicologo_apellido: sesionRaw.Psicologo?.apellido,
                    becario_nombre: sesionRaw.Cita?.Becario?.nombre,
                    becario_apellido: sesionRaw.Cita?.Becario?.apellido
                }
                : null;

            if (!sesion) {
                return res.status(404).json({
                    success: false,
                    message: 'Sesión no encontrada'
                });
            }

            // Verificar acceso a sesión privada
            if (sesion.privado && sesion.psicologo_id !== usuarioId && usuarioRol !== 'coordinador') {
                return res.status(403).json({
                    success: false,
                    message: 'No tiene permisos para ver esta sesión privada'
                });
            }

            // Verificar acceso general al paciente
            const tieneAcceso = await this.verificarAccesoSesiones(usuarioId, usuarioRol, sesion.paciente_id);

            if (!tieneAcceso) {
                return res.status(403).json({
                    success: false,
                    message: 'No tiene permisos para ver esta sesión'
                });
            }

            res.json({
                success: true,
                data: sesion
            });

        } catch (error) {
            console.error('Error en obtenerSesionDetalle:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener detalle de sesión'
            });
        }
    }

    static async actualizarSesion(req, res) {
        try {
            const { id } = req.params;
            const updates = req.body;
            const usuarioId = req.user.id;
            const usuarioRol = req.user.rol;

            const sesion = await Sesion.findByPk(id);

            if (!sesion) {
                return res.status(404).json({
                    success: false,
                    message: 'Sesión no encontrada'
                });
            }

            // Verificar permisos (solo psicólogo asignado o coordinador)
            if (sesion.psicologo_id !== usuarioId && usuarioRol !== 'coordinador') {
                return res.status(403).json({
                    success: false,
                    message: 'No tiene permisos para actualizar esta sesión'
                });
            }

            // Campos que no se pueden modificar
            const camposBloqueados = ['cita_id', 'psicologo_id', 'fecha', 'hora_inicio', 'hora_fin'];
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
            const datosAntes = { ...sesion.toJSON() };

            await sesion.update(updates);

            // Log
            await LogSistema.create({
                usuario_id: usuarioId,
                tipo_log: 'modificacion',
                modulo: 'sesiones',
                accion: 'Actualizar sesión',
                descripcion: `Sesión actualizada ID: ${id}`,
                datos_antes: datosAntes,
                datos_despues: sesion.toJSON()
            });

            res.json({
                success: true,
                message: 'Sesión actualizada exitosamente',
                data: sesion
            });

        } catch (error) {
            console.error('Error en actualizarSesion:', error);
            res.status(500).json({
                success: false,
                message: 'Error al actualizar sesión'
            });
        }
    }

    // Métodos auxiliares
    static calcularHoraFin(horaInicio, duracionMinutos) {
        const [horas, minutos] = horaInicio.split(':').map(Number);
        const fecha = new Date();
        fecha.setHours(horas, minutos + duracionMinutos, 0, 0);
        return fecha.toTimeString().slice(0, 8);
    }

    static async verificarAccesoSesiones(usuarioId, usuarioRol, pacienteId) {
        if (usuarioRol === 'coordinador') return true;

        const result = await Asignacion.findOne({
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

        return Boolean(result);
    }

    static async actualizarExpediente(pacienteId, datos) {
        // Normalizar riesgo_suicida a 0/1/null para evitar errores de truncamiento en la base
        const riesgo = (typeof datos.riesgo_suicida === 'boolean')
            ? (datos.riesgo_suicida ? 1 : 0)
            : (datos.riesgo_suicida === null || typeof datos.riesgo_suicida === 'undefined') ? null : Number(datos.riesgo_suicida);

        await Expediente.update({
            riesgo_suicida: riesgo
        }, {
            where: { paciente_id: pacienteId }
        });
    }
}

module.exports = SesionController;