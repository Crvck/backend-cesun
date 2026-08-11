const { Op } = require('sequelize');
const Cita = require('../models/citaModel');
const Paciente = require('../models/pacienteModel');
const User = require('../models/userModel');
const Sesion = require('../models/sesionModel');
const Asignacion = require('../models/asignacionModel');
const ObservacionBecario = require('../models/observacionBecarioModel');
const Alta = require('../models/altaModel');
const Disponibilidad = require('../models/disponibilidadModel');

const toDate = (value) => (value ? new Date(value) : null);
const formatMonth = (value) => (value ? String(value).slice(0, 7) : null);
const toMinutes = (hora) => {
    if (!hora) return null;
    const [h, m] = String(hora).split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
};

const buildDateFilter = (fecha_inicio, fecha_fin) => {
    if (fecha_inicio && fecha_fin) return { [Op.between]: [fecha_inicio, fecha_fin] };
    if (fecha_inicio) return { [Op.gte]: fecha_inicio };
    if (fecha_fin) return { [Op.lte]: fecha_fin };
    return null;
};

class EstadisticaController {
    static async obtenerEstadisticasGenerales(req, res) {
        try {
            const { fecha_inicio, fecha_fin } = req.query;
            const whereFecha = buildDateFilter(fecha_inicio, fecha_fin);

            const whereCitas = whereFecha ? { fecha: whereFecha } : {};
            const citas = await Cita.findAll({
                where: whereCitas,
                attributes: ['id', 'estado', 'paciente_id', 'psicologo_id', 'becario_id', 'duracion', 'fecha']
            });

            const total_citas = citas.length;
            const programadas = citas.filter(c => c.estado === 'programada').length;
            const confirmadas = citas.filter(c => c.estado === 'confirmada').length;
            const completadas = citas.filter(c => c.estado === 'completada').length;
            const canceladas = citas.filter(c => c.estado === 'cancelada').length;
            const tasa_completitud = total_citas > 0 ? Math.round((completadas / total_citas) * 10000) / 100 : 0;
            const tasa_cancelacion = total_citas > 0 ? Math.round((canceladas / total_citas) * 10000) / 100 : 0;
            const pacientes_unicos = new Set(citas.map(c => c.paciente_id)).size;
            const psicologos_activos = new Set(citas.map(c => c.psicologo_id).filter(Boolean)).size;
            const becarios_activos = new Set(citas.map(c => c.becario_id).filter(Boolean)).size;
            const duracion_promedio = total_citas > 0
                ? Math.round((citas.reduce((sum, c) => sum + (c.duracion || 0), 0) / total_citas) * 10) / 10
                : 0;

            const estadisticasCitas = {
                total_citas,
                programadas,
                confirmadas,
                completadas,
                canceladas,
                tasa_completitud,
                tasa_cancelacion,
                pacientes_unicos,
                psicologos_activos,
                becarios_activos,
                duracion_promedio
            };

            const pacientes = await Paciente.findAll({
                attributes: ['id', 'genero', 'activo', 'fecha_inscripcion', 'created_at']
            });
            const total_pacientes = pacientes.length;
            const pacientes_activos = pacientes.filter(p => p.activo).length;
            const pacientes_inactivos = total_pacientes - pacientes_activos;
            const generos_unicos = new Set(pacientes.map(p => p.genero || 'no especificado')).size;

            const edades = pacientes
                .map(p => {
                    if (!p.fecha_inscripcion) return null;
                    const n = toDate(p.fecha_inscripcion);
                    if (!n) return null;
                    const hoy = new Date();
                    return hoy.getFullYear() - n.getFullYear();
                })
                .filter(v => typeof v === 'number');
            const edad_promedio = edades.length > 0
                ? Math.round((edades.reduce((a, b) => a + b, 0) / edades.length) * 10) / 10
                : 0;

            const whereAltas = whereFecha ? { fecha_alta: whereFecha } : {};
            const altas_totales = await Alta.count({ where: whereAltas });

            const estadisticasPacientes = {
                total_pacientes,
                pacientes_activos,
                pacientes_inactivos,
                generos_unicos,
                edad_promedio,
                altas_totales
            };

            const distribucionMap = pacientes.reduce((acc, p) => {
                const genero = p.genero || 'no especificado';
                acc[genero] = (acc[genero] || 0) + 1;
                return acc;
            }, {});
            const distribucionGenero = Object.entries(distribucionMap)
                .map(([genero, cantidad]) => ({
                    genero,
                    cantidad,
                    porcentaje: total_pacientes > 0 ? Math.round((cantidad / total_pacientes) * 10000) / 100 : 0
                }))
                .sort((a, b) => b.cantidad - a.cantidad);

            const fechaLimite = whereFecha ? null : (() => {
                const d = new Date();
                d.setMonth(d.getMonth() - 6);
                return d.toISOString().split('T')[0];
            })();
            const citasEvolucion = whereFecha
                ? citas
                : citas.filter(c => c.fecha >= fechaLimite);

            const evolucionMap = citasEvolucion.reduce((acc, c) => {
                const mes = formatMonth(c.fecha);
                if (!mes) return acc;
                if (!acc[mes]) {
                    acc[mes] = {
                        mes,
                        total_citas: 0,
                        citas_completadas: 0,
                        pacientes_unicos: new Set(),
                        psicologos_activos: new Set()
                    };
                }
                acc[mes].total_citas += 1;
                if (c.estado === 'completada') acc[mes].citas_completadas += 1;
                if (c.paciente_id) acc[mes].pacientes_unicos.add(c.paciente_id);
                if (c.psicologo_id) acc[mes].psicologos_activos.add(c.psicologo_id);
                return acc;
            }, {});

            const evolucion_mensual = Object.values(evolucionMap)
                .map(item => ({
                    mes: item.mes,
                    total_citas: item.total_citas,
                    citas_completadas: item.citas_completadas,
                    pacientes_unicos: item.pacientes_unicos.size,
                    psicologos_activos: item.psicologos_activos.size
                }))
                .sort((a, b) => a.mes.localeCompare(b.mes));

            const psicologos = await User.findAll({
                where: { rol: 'psicologo', activo: true },
                attributes: ['id', 'nombre', 'apellido', 'especialidad']
            });
            const top_psicologos = psicologos.map(p => {
                const citasPsi = citas.filter(c => c.psicologo_id === p.id);
                const total = citasPsi.length;
                const comp = citasPsi.filter(c => c.estado === 'completada').length;
                const pacientesUnicos = new Set(citasPsi.map(c => c.paciente_id)).size;
                const durProm = total > 0
                    ? Math.round((citasPsi.reduce((s, c) => s + (c.duracion || 0), 0) / total) * 10) / 10
                    : 0;
                return {
                    id: p.id,
                    psicologo: `${p.nombre} ${p.apellido}`,
                    especialidad: p.especialidad,
                    total_citas: total,
                    citas_completadas: comp,
                    tasa_completitud: total > 0 ? Math.round((comp / total) * 10000) / 100 : 0,
                    pacientes_unicos: pacientesUnicos,
                    duracion_promedio: durProm
                };
            }).sort((a, b) => b.citas_completadas - a.citas_completadas).slice(0, 10);

            res.json({
                success: true,
                data: {
                    periodo: {
                        fecha_inicio: fecha_inicio || 'No especificado',
                        fecha_fin: fecha_fin || 'No especificado'
                    },
                    citas: estadisticasCitas,
                    pacientes: estadisticasPacientes,
                    distribucion_genero: distribucionGenero,
                    evolucion_mensual,
                    top_psicologos,
                    fecha_consulta: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Error en obtenerEstadisticasGenerales:', error);
            res.status(500).json({ success: false, message: 'Error al obtener estadísticas generales' });
        }
    }

    static async obtenerEstadisticasPsicologo(req, res) {
        try {
            const { psicologo_id, fecha_inicio, fecha_fin } = req.query;
            const usuarioId = req.user.id;
            const usuarioRol = req.user.rol;

            let psicologoConsulta = psicologo_id;
            if (!psicologoConsulta && usuarioRol === 'psicologo') {
                psicologoConsulta = usuarioId;
            } else if (!psicologoConsulta) {
                return res.status(400).json({ success: false, message: 'Se requiere especificar un psicólogo' });
            }

            const psicologo = await User.findOne({
                where: { id: psicologoConsulta, rol: 'psicologo' },
                attributes: ['id', 'nombre', 'apellido', 'especialidad']
            });

            if (!psicologo) {
                return res.status(404).json({ success: false, message: 'Psicólogo no encontrado' });
            }

            const whereFecha = buildDateFilter(fecha_inicio, fecha_fin);
            const whereCitas = { psicologo_id: psicologoConsulta, ...(whereFecha ? { fecha: whereFecha } : {}) };
            const citas = await Cita.findAll({
                where: whereCitas,
                attributes: ['id', 'estado', 'paciente_id', 'duracion', 'fecha', 'tipo_consulta', 'hora']
            });

            const total_citas = citas.length;
            const citas_completadas = citas.filter(c => c.estado === 'completada').length;
            const citas_canceladas = citas.filter(c => c.estado === 'cancelada').length;
            const tasa_completitud = total_citas > 0 ? Math.round((citas_completadas / total_citas) * 10000) / 100 : 0;
            const pacientes_unicos = new Set(citas.map(c => c.paciente_id)).size;

            const pacientes_activos = await Asignacion.count({
                where: { psicologo_id: psicologoConsulta, estado: 'activa' },
                distinct: true,
                col: 'paciente_id'
            });

            const sesiones = await Sesion.findAll({
                where: { psicologo_id: psicologoConsulta, ...(whereFecha ? { fecha: whereFecha } : {}) },
                attributes: ['hora_inicio', 'hora_fin']
            });
            const duraciones = sesiones
                .map(s => {
                    const ini = toMinutes(s.hora_inicio);
                    const fin = toMinutes(s.hora_fin);
                    return ini !== null && fin !== null ? fin - ini : null;
                })
                .filter(v => typeof v === 'number' && v >= 0);
            const duracion_promedio_sesiones = duraciones.length > 0
                ? Math.round((duraciones.reduce((a, b) => a + b, 0) / duraciones.length) * 10) / 10
                : 0;

            const becarios_supervisados = await Asignacion.count({
                where: { psicologo_id: psicologoConsulta, estado: 'activa', becario_id: { [Op.ne]: null } },
                distinct: true,
                col: 'becario_id'
            });

            const observaciones = await ObservacionBecario.findAll({
                where: { supervisor_id: psicologoConsulta, ...(whereFecha ? { fecha: whereFecha } : {}) },
                attributes: ['calificacion']
            });
            const observaciones_realizadas = observaciones.length;
            const promedio_calificacion_observaciones = observaciones.length > 0
                ? Math.round((observaciones.reduce((s, o) => s + (o.calificacion || 0), 0) / observaciones.length) * 100) / 100
                : 0;

            const altas_realizadas = await Alta.count({
                where: { usuario_id: psicologoConsulta, ...(whereFecha ? { fecha_alta: whereFecha } : {}) }
            });
            const altas_terapeuticas = await Alta.count({
                where: { usuario_id: psicologoConsulta, tipo_alta: 'terapeutica', ...(whereFecha ? { fecha_alta: whereFecha } : {}) }
            });

            const estadisticas = {
                total_citas,
                citas_completadas,
                citas_canceladas,
                tasa_completitud,
                pacientes_unicos,
                pacientes_activos,
                sesiones_registradas: sesiones.length,
                duracion_promedio_sesiones,
                becarios_supervisados,
                observaciones_realizadas,
                promedio_calificacion_observaciones,
                altas_realizadas,
                altas_terapeuticas
            };

            const evolucionMap = citas.reduce((acc, c) => {
                const mes = formatMonth(c.fecha);
                if (!mes) return acc;
                if (!acc[mes]) acc[mes] = { mes, total_citas: 0, citas_completadas: 0, pacientes_unicos: new Set(), sesiones_registradas: 0, altas_realizadas: 0 };
                acc[mes].total_citas += 1;
                if (c.estado === 'completada') acc[mes].citas_completadas += 1;
                if (c.paciente_id) acc[mes].pacientes_unicos.add(c.paciente_id);
                return acc;
            }, {});

            const sesionesPorMes = sesiones.reduce((acc, s) => {
                const mes = formatMonth(s.fecha);
                if (!mes) return acc;
                acc[mes] = (acc[mes] || 0) + 1;
                return acc;
            }, {});

            const altas = await Alta.findAll({
                where: { psicologo_id: psicologoConsulta, ...(whereFecha ? { fecha_alta: whereFecha } : {}) },
                attributes: ['fecha_alta']
            });
            const altasPorMes = altas.reduce((acc, a) => {
                const mes = formatMonth(a.fecha_alta);
                if (!mes) return acc;
                acc[mes] = (acc[mes] || 0) + 1;
                return acc;
            }, {});

            const evolucion_mensual = Object.values(evolucionMap)
                .map(item => ({
                    mes: item.mes,
                    total_citas: item.total_citas,
                    citas_completadas: item.citas_completadas,
                    pacientes_unicos: item.pacientes_unicos.size,
                    sesiones_registradas: sesionesPorMes[item.mes] || 0,
                    altas_realizadas: altasPorMes[item.mes] || 0
                }))
                .sort((a, b) => a.mes.localeCompare(b.mes));

            const distribucionMap = citas.reduce((acc, c) => {
                const tipo = c.tipo_consulta || 'no especificado';
                acc[tipo] = (acc[tipo] || 0) + 1;
                return acc;
            }, {});
            const distribucion_consulta = Object.entries(distribucionMap).map(([tipo_consulta, cantidad]) => ({
                tipo_consulta,
                cantidad,
                porcentaje: total_citas > 0 ? Math.round((cantidad / total_citas) * 10000) / 100 : 0
            }));

            const pacientesTopMap = citas.filter(c => c.estado === 'completada').reduce((acc, c) => {
                if (!acc[c.paciente_id]) {
                    acc[c.paciente_id] = { paciente_id: c.paciente_id, total_sesiones: 0, primera_sesion: c.fecha, ultima_sesion: c.fecha, duraciones: [] };
                }
                acc[c.paciente_id].total_sesiones += 1;
                if (c.fecha < acc[c.paciente_id].primera_sesion) acc[c.paciente_id].primera_sesion = c.fecha;
                if (c.fecha > acc[c.paciente_id].ultima_sesion) acc[c.paciente_id].ultima_sesion = c.fecha;
                if (c.duracion) acc[c.paciente_id].duraciones.push(c.duracion);
                return acc;
            }, {});

            const pacienteIds = Object.keys(pacientesTopMap).map(Number);
            const pacientesInfo = await Paciente.findAll({ where: { id: { [Op.in]: pacienteIds } }, attributes: ['id', 'nombre', 'apellido'] });
            const pacienteMap = pacientesInfo.reduce((acc, p) => { acc[p.id] = `${p.nombre} ${p.apellido}`; return acc; }, {});

            const pacientes_top = Object.values(pacientesTopMap).map(item => ({
                id: item.paciente_id,
                paciente: pacienteMap[item.paciente_id] || 'Paciente',
                total_sesiones: item.total_sesiones,
                primera_sesion: item.primera_sesion,
                ultima_sesion: item.ultima_sesion,
                duracion_promedio: item.duraciones.length > 0
                    ? Math.round((item.duraciones.reduce((a, b) => a + b, 0) / item.duraciones.length) * 10) / 10
                    : 0
            })).sort((a, b) => b.total_sesiones - a.total_sesiones).slice(0, 10);

            const horariosMap = citas.reduce((acc, c) => {
                if (!c.hora) return acc;
                const hora = parseInt(String(c.hora).split(':')[0], 10);
                if (Number.isNaN(hora)) return acc;
                if (!acc[hora]) acc[hora] = { hora, total_citas: 0, citas_completadas: 0 };
                acc[hora].total_citas += 1;
                if (c.estado === 'completada') acc[hora].citas_completadas += 1;
                return acc;
            }, {});
            const horarios_productivos = Object.values(horariosMap)
                .map(item => ({
                    ...item,
                    tasa_completitud: item.total_citas > 0 ? Math.round((item.citas_completadas / item.total_citas) * 10000) / 100 : 0
                }))
                .sort((a, b) => b.total_citas - a.total_citas)
                .slice(0, 8);

            res.json({
                success: true,
                data: {
                    psicologo,
                    periodo: {
                        fecha_inicio: fecha_inicio || 'No especificado',
                        fecha_fin: fecha_fin || 'No especificado'
                    },
                    estadisticas,
                    evolucion_mensual,
                    distribucion_consulta,
                    pacientes_top,
                    horarios_productivos,
                    fecha_consulta: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Error en obtenerEstadisticasPsicologo:', error);
            res.status(500).json({ success: false, message: 'Error al obtener estadísticas del psicólogo' });
        }
    }

    static async obtenerEstadisticasBecario(req, res) {
        try {
            const { becario_id, fecha_inicio, fecha_fin } = req.query;
            const usuarioId = req.user.id;
            const usuarioRol = req.user.rol;

            let becarioConsulta = becario_id;
            if (!becarioConsulta && usuarioRol === 'becario') {
                becarioConsulta = usuarioId;
            } else if (!becarioConsulta) {
                return res.status(400).json({ success: false, message: 'Se requiere especificar un becario' });
            }

            const becario = await User.findOne({
                where: { id: becarioConsulta, rol: 'becario' },
                attributes: ['id', 'nombre', 'apellido']
            });

            if (!becario) {
                return res.status(404).json({ success: false, message: 'Becario no encontrado' });
            }

            const whereFecha = buildDateFilter(fecha_inicio, fecha_fin);
            const whereCitas = { becario_id: becarioConsulta, ...(whereFecha ? { fecha: whereFecha } : {}) };
            const citas = await Cita.findAll({
                where: whereCitas,
                attributes: ['id', 'estado', 'paciente_id', 'fecha']
            });

            const total_citas = citas.length;
            const citas_completadas = citas.filter(c => c.estado === 'completada').length;
            const citas_canceladas = citas.filter(c => c.estado === 'cancelada').length;
            const tasa_completitud = total_citas > 0 ? Math.round((citas_completadas / total_citas) * 10000) / 100 : 0;
            const pacientes_unicos = new Set(citas.map(c => c.paciente_id)).size;

            const pacientes_activos = await Asignacion.count({
                where: { becario_id: becarioConsulta, estado: 'activa' },
                distinct: true,
                col: 'paciente_id'
            });

            const observaciones = await ObservacionBecario.findAll({
                where: { becario_id: becarioConsulta, ...(whereFecha ? { fecha: whereFecha } : {}) },
                attributes: ['calificacion', 'aspecto_evaluado', 'fecha']
            });

            const observaciones_recibidas = observaciones.length;
            const promedio_calificacion = observaciones.length > 0
                ? Math.round((observaciones.reduce((s, o) => s + (o.calificacion || 0), 0) / observaciones.length) * 100) / 100
                : 0;
            const calificacion_minima = observaciones.length > 0 ? Math.min(...observaciones.map(o => o.calificacion || 0)) : 0;
            const calificacion_maxima = observaciones.length > 0 ? Math.max(...observaciones.map(o => o.calificacion || 0)) : 0;

            const supervisorAsignacion = await Asignacion.findOne({
                where: { becario_id: becarioConsulta, estado: 'activa' },
                include: [{ model: User, as: 'Psicologo', attributes: ['nombre', 'apellido'] }]
            });
            const supervisor = supervisorAsignacion?.Psicologo
                ? `${supervisorAsignacion.Psicologo.nombre} ${supervisorAsignacion.Psicologo.apellido}`
                : null;

            const horarios_configurados = await Disponibilidad.count({
                where: { usuario_id: becarioConsulta, activo: true }
            });

            const citasPorPaciente = citas
                .filter(c => c.estado === 'completada')
                .sort((a, b) => a.fecha.localeCompare(b.fecha));
            const diffs = [];
            const lastByPaciente = {};
            citasPorPaciente.forEach(c => {
                const prev = lastByPaciente[c.paciente_id];
                if (prev) {
                    const diff = (new Date(c.fecha) - new Date(prev)) / (1000 * 60 * 60 * 24);
                    if (!Number.isNaN(diff)) diffs.push(diff);
                }
                lastByPaciente[c.paciente_id] = c.fecha;
            });
            const dias_promedio_entre_citas = diffs.length > 0
                ? Math.round((diffs.reduce((a, b) => a + b, 0) / diffs.length) * 10) / 10
                : 0;

            const estadisticas = {
                total_citas,
                citas_completadas,
                citas_canceladas,
                tasa_completitud,
                pacientes_unicos,
                pacientes_activos,
                observaciones_recibidas,
                promedio_calificacion,
                calificacion_minima,
                calificacion_maxima,
                supervisor,
                horarios_configurados,
                dias_promedio_entre_citas
            };

            const evolucionMap = observaciones.reduce((acc, o) => {
                const mes = formatMonth(o.fecha);
                if (!mes) return acc;
                if (!acc[mes]) acc[mes] = { mes, total_observaciones: 0, suma: 0, min: o.calificacion, max: o.calificacion };
                acc[mes].total_observaciones += 1;
                acc[mes].suma += o.calificacion || 0;
                acc[mes].min = Math.min(acc[mes].min, o.calificacion || 0);
                acc[mes].max = Math.max(acc[mes].max, o.calificacion || 0);
                return acc;
            }, {});
            const evolucion_calificaciones = Object.values(evolucionMap)
                .map(item => ({
                    mes: item.mes,
                    total_observaciones: item.total_observaciones,
                    promedio_calificacion: item.total_observaciones > 0 ? Math.round((item.suma / item.total_observaciones) * 100) / 100 : 0,
                    calificacion_minima: item.min,
                    calificacion_maxima: item.max
                }))
                .sort((a, b) => a.mes.localeCompare(b.mes));

            const aspectosMap = observaciones.reduce((acc, o) => {
                const key = o.aspecto_evaluado || 'no especificado';
                if (!acc[key]) acc[key] = { aspecto_evaluado: key, cantidad: 0, suma: 0 };
                acc[key].cantidad += 1;
                acc[key].suma += o.calificacion || 0;
                return acc;
            }, {});
            const distribucion_aspectos = Object.values(aspectosMap).map(item => ({
                aspecto_evaluado: item.aspecto_evaluado,
                cantidad: item.cantidad,
                promedio_calificacion: item.cantidad > 0 ? Math.round((item.suma / item.cantidad) * 100) / 100 : 0,
                porcentaje: observaciones_recibidas > 0 ? Math.round((item.cantidad / observaciones_recibidas) * 10000) / 100 : 0
            }));

            const citasPorDia = citas.reduce((acc, c) => {
                const dia = new Date(c.fecha).toLocaleDateString('es-MX', { weekday: 'long' });
                if (!acc[dia]) acc[dia] = { dia_semana: dia, total_citas: 0, citas_completadas: 0 };
                acc[dia].total_citas += 1;
                if (c.estado === 'completada') acc[dia].citas_completadas += 1;
                return acc;
            }, {});
            const citas_por_dia = Object.values(citasPorDia)
                .map(item => ({
                    ...item,
                    tasa_completitud: item.total_citas > 0 ? Math.round((item.citas_completadas / item.total_citas) * 10000) / 100 : 0
                }));

            const pacientesMap = citas.filter(c => c.estado === 'completada').reduce((acc, c) => {
                if (!acc[c.paciente_id]) acc[c.paciente_id] = { paciente_id: c.paciente_id, total_sesiones: 0, primera_sesion: c.fecha, ultima_sesion: c.fecha };
                acc[c.paciente_id].total_sesiones += 1;
                if (c.fecha < acc[c.paciente_id].primera_sesion) acc[c.paciente_id].primera_sesion = c.fecha;
                if (c.fecha > acc[c.paciente_id].ultima_sesion) acc[c.paciente_id].ultima_sesion = c.fecha;
                return acc;
            }, {});
            const pacienteIds = Object.keys(pacientesMap).map(Number);
            const pacientesInfo = await Paciente.findAll({ where: { id: { [Op.in]: pacienteIds } }, attributes: ['id', 'nombre', 'apellido'] });
            const pacienteMap = pacientesInfo.reduce((acc, p) => { acc[p.id] = `${p.nombre} ${p.apellido}`; return acc; }, {});

            const sesionesRegistradas = await Sesion.findAll({
                include: [{ model: Cita, where: { becario_id: becarioConsulta }, attributes: ['paciente_id'] }],
                attributes: ['id']
            });
            const sesionesPorPaciente = sesionesRegistradas.reduce((acc, s) => {
                const pacienteId = s.Cita?.paciente_id;
                if (!pacienteId) return acc;
                acc[pacienteId] = (acc[pacienteId] || 0) + 1;
                return acc;
            }, {});

            const pacientes_atendidos = Object.values(pacientesMap)
                .map(item => ({
                    id: item.paciente_id,
                    paciente: pacienteMap[item.paciente_id] || 'Paciente',
                    total_sesiones: item.total_sesiones,
                    primera_sesion: item.primera_sesion,
                    ultima_sesion: item.ultima_sesion,
                    sesiones_registradas: sesionesPorPaciente[item.paciente_id] || 0
                }))
                .sort((a, b) => b.total_sesiones - a.total_sesiones)
                .slice(0, 10);

            res.json({
                success: true,
                data: {
                    becario,
                    periodo: {
                        fecha_inicio: fecha_inicio || 'No especificado',
                        fecha_fin: fecha_fin || 'No especificado'
                    },
                    estadisticas,
                    evolucion_calificaciones,
                    distribucion_aspectos,
                    citas_por_dia,
                    pacientes_atendidos,
                    fecha_consulta: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Error en obtenerEstadisticasBecario:', error);
            res.status(500).json({ success: false, message: 'Error al obtener estadísticas del becario' });
        }
    }

    static async obtenerEstadisticasPaciente(req, res) {
        try {
            const { paciente_id } = req.params;

            const paciente = await Paciente.findByPk(paciente_id, {
                attributes: ['id', 'nombre', 'apellido', 'fecha_inscripcion', 'genero']
            });

            if (!paciente) {
                return res.status(404).json({ success: false, message: 'Paciente no encontrado' });
            }

            const citas = await Cita.findAll({
                where: { paciente_id },
                attributes: ['id', 'estado', 'fecha', 'duracion', 'psicologo_id', 'becario_id']
            });

            const total_citas = citas.length;
            const citas_completadas = citas.filter(c => c.estado === 'completada').length;
            const citas_canceladas = citas.filter(c => c.estado === 'cancelada').length;
            const tasa_asistencia = total_citas > 0 ? Math.round((citas_completadas / total_citas) * 10000) / 100 : 0;

            const primera_cita = citas.reduce((min, c) => (!min || c.fecha < min ? c.fecha : min), null);
            const ultima_cita = citas.reduce((max, c) => (!max || c.fecha > max ? c.fecha : max), null);
            const dias_tratamiento = primera_cita && ultima_cita
                ? Math.round((new Date(ultima_cita) - new Date(primera_cita)) / (1000 * 60 * 60 * 24))
                : 0;
            const duracion_promedio = total_citas > 0
                ? Math.round((citas.reduce((s, c) => s + (c.duracion || 0), 0) / total_citas) * 10) / 10
                : 0;

            const psicologos_atendieron = new Set(citas.map(c => c.psicologo_id).filter(Boolean)).size;
            const becarios_atendieron = new Set(citas.map(c => c.becario_id).filter(Boolean)).size;

            const sesiones_registradas = await Sesion.count({
                include: [{ model: Cita, where: { paciente_id } }]
            });

            const total_asignaciones = await Asignacion.count({ where: { paciente_id } });
            const asignaciones_activas = await Asignacion.count({ where: { paciente_id, estado: 'activa' } });
            const ultimo_alta = await Alta.findOne({ where: { paciente_id }, order: [['fecha_alta', 'DESC']] });

            const estadisticas = {
                total_citas,
                citas_completadas,
                citas_canceladas,
                tasa_asistencia,
                primera_cita,
                ultima_cita,
                dias_tratamiento,
                duracion_promedio,
                psicologos_atendieron,
                becarios_atendieron,
                sesiones_registradas,
                total_asignaciones,
                asignaciones_activas,
                ultimo_tipo_alta: ultimo_alta?.tipo_alta || null
            };

            const evolucionMap = citas.reduce((acc, c) => {
                const mes = formatMonth(c.fecha);
                if (!mes) return acc;
                if (!acc[mes]) acc[mes] = { mes, total_citas: 0, citas_completadas: 0, detalle_dias: [] };
                acc[mes].total_citas += 1;
                if (c.estado === 'completada') acc[mes].citas_completadas += 1;
                acc[mes].detalle_dias.push(`${new Date(c.fecha).getDate()}: ${c.estado === 'completada' ? '✓' : c.estado === 'cancelada' ? '✗' : '○'}`);
                return acc;
            }, {});

            const evolucion_citas = Object.values(evolucionMap)
                .map(item => ({
                    mes: item.mes,
                    total_citas: item.total_citas,
                    citas_completadas: item.citas_completadas,
                    detalle_dias: item.detalle_dias.join(', ')
                }))
                .sort((a, b) => a.mes.localeCompare(b.mes));

            const distribucionPsiMap = citas.reduce((acc, c) => {
                if (!c.psicologo_id) return acc;
                if (!acc[c.psicologo_id]) acc[c.psicologo_id] = { psicologo_id: c.psicologo_id, total_citas: 0, citas_completadas: 0, primera_cita: c.fecha, ultima_cita: c.fecha };
                acc[c.psicologo_id].total_citas += 1;
                if (c.estado === 'completada') acc[c.psicologo_id].citas_completadas += 1;
                if (c.fecha < acc[c.psicologo_id].primera_cita) acc[c.psicologo_id].primera_cita = c.fecha;
                if (c.fecha > acc[c.psicologo_id].ultima_cita) acc[c.psicologo_id].ultima_cita = c.fecha;
                return acc;
            }, {});

            const psicologoIds = Object.keys(distribucionPsiMap).map(Number);
            const psicologosInfo = await User.findAll({ where: { id: { [Op.in]: psicologoIds } }, attributes: ['id', 'nombre', 'apellido', 'especialidad'] });
            const psiMap = psicologosInfo.reduce((acc, u) => { acc[u.id] = u; return acc; }, {});

            const distribucion_psicologos = Object.values(distribucionPsiMap)
                .map(item => ({
                    id: item.psicologo_id,
                    psicologo: psiMap[item.psicologo_id] ? `${psiMap[item.psicologo_id].nombre} ${psiMap[item.psicologo_id].apellido}` : 'Psicólogo',
                    especialidad: psiMap[item.psicologo_id]?.especialidad || null,
                    total_citas: item.total_citas,
                    citas_completadas: item.citas_completadas,
                    tasa_completitud: item.total_citas > 0 ? Math.round((item.citas_completadas / item.total_citas) * 10000) / 100 : 0,
                    primera_cita: item.primera_cita,
                    ultima_cita: item.ultima_cita
                }))
                .sort((a, b) => b.total_citas - a.total_citas);

            const completadasOrdenadas = citas
                .filter(c => c.estado === 'completada')
                .sort((a, b) => a.fecha.localeCompare(b.fecha));
            const intervalos = [];
            for (let i = 1; i < completadasOrdenadas.length; i++) {
                const prev = new Date(completadasOrdenadas[i - 1].fecha);
                const curr = new Date(completadasOrdenadas[i].fecha);
                const dias = Math.round((curr - prev) / (1000 * 60 * 60 * 24));
                if (!Number.isNaN(dias)) intervalos.push(dias);
            }
            const buckets = {
                '1 semana o menos': 0,
                '2 semanas': 0,
                '3 semanas': 0,
                '4 semanas': 0,
                'Más de 1 mes': 0
            };
            intervalos.forEach(dias => {
                if (dias <= 7) buckets['1 semana o menos'] += 1;
                else if (dias <= 14) buckets['2 semanas'] += 1;
                else if (dias <= 21) buckets['3 semanas'] += 1;
                else if (dias <= 30) buckets['4 semanas'] += 1;
                else buckets['Más de 1 mes'] += 1;
            });
            const totalIntervalos = intervalos.length || 1;
            const frecuencia_citas = Object.entries(buckets).map(([intervalo, cantidad]) => ({
                intervalo,
                cantidad,
                porcentaje: Math.round((cantidad / totalIntervalos) * 10000) / 100
            }));

            res.json({
                success: true,
                data: {
                    paciente,
                    estadisticas,
                    evolucion_citas,
                    distribucion_psicologos,
                    frecuencia_citas,
                    fecha_consulta: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Error en obtenerEstadisticasPaciente:', error);
            res.status(500).json({ success: false, message: 'Error al obtener estadísticas del paciente' });
        }
    }

    static async obtenerReporteComparativo(req, res) {
        try {
            const { periodo = 'mes', tipo_comparacion = 'psicologos' } = req.query;

            let days;
            switch (periodo) {
                case 'semana':
                    days = 7;
                    break;
                case 'trimestre':
                    days = 90;
                    break;
                case 'mes':
                default:
                    days = 30;
                    break;
            }

            let reporte;
            if (tipo_comparacion === 'psicologos') {
                reporte = await this.generarComparativoPsicologos(days);
            } else if (tipo_comparacion === 'becarios') {
                reporte = await this.generarComparativoBecarios(days);
            } else if (tipo_comparacion === 'meses') {
                reporte = await this.generarComparativoMeses(days);
            } else {
                return res.status(400).json({ success: false, message: 'Tipo de comparación no válido' });
            }

            res.json({
                success: true,
                data: {
                    tipo_comparacion,
                    periodo,
                    reporte,
                    fecha_generacion: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error('Error en obtenerReporteComparativo:', error);
            res.status(500).json({ success: false, message: 'Error al generar reporte comparativo' });
        }
    }

    static async generarComparativoPsicologos(days) {
        const fechaLimite = new Date();
        fechaLimite.setDate(fechaLimite.getDate() - days);
        const limiteStr = fechaLimite.toISOString().split('T')[0];

        const psicologos = await User.findAll({
            where: { rol: 'psicologo', activo: true },
            attributes: ['id', 'nombre', 'apellido', 'especialidad']
        });
        const citas = await Cita.findAll({
            where: { fecha: { [Op.gte]: limiteStr } },
            attributes: ['id', 'estado', 'paciente_id', 'psicologo_id', 'duracion']
        });
        const sesiones = await Sesion.findAll({
            where: { fecha: { [Op.gte]: limiteStr } },
            attributes: ['id', 'psicologo_id']
        });
        const observaciones = await ObservacionBecario.findAll({
            where: { fecha: { [Op.gte]: limiteStr } },
            attributes: ['id', 'supervisor_id']
        });
        const asignaciones = await Asignacion.findAll({
            where: { estado: 'activa' },
            attributes: ['psicologo_id', 'becario_id']
        });

        return psicologos.map(p => {
            const citasPsi = citas.filter(c => c.psicologo_id === p.id);
            const total = citasPsi.length;
            const completadas = citasPsi.filter(c => c.estado === 'completada').length;
            const canceladas = citasPsi.filter(c => c.estado === 'cancelada').length;
            const pacientes_unicos = new Set(citasPsi.map(c => c.paciente_id)).size;
            const duracion_promedio = total > 0
                ? Math.round((citasPsi.reduce((s, c) => s + (c.duracion || 0), 0) / total) * 10) / 10
                : 0;
            const sesiones_registradas = sesiones.filter(s => s.psicologo_id === p.id).length;
            const becarios_supervisados = new Set(asignaciones.filter(a => a.psicologo_id === p.id).map(a => a.becario_id).filter(Boolean)).size;
            const observaciones_realizadas = observaciones.filter(o => o.supervisor_id === p.id).length;

            return {
                id: p.id,
                psicologo: `${p.nombre} ${p.apellido}`,
                especialidad: p.especialidad,
                total_citas: total,
                citas_completadas: completadas,
                citas_canceladas: canceladas,
                tasa_completitud: total > 0 ? Math.round((completadas / total) * 10000) / 100 : 0,
                pacientes_unicos,
                duracion_promedio,
                sesiones_registradas,
                becarios_supervisados,
                observaciones_realizadas
            };
        }).sort((a, b) => b.citas_completadas - a.citas_completadas);
    }

    static async generarComparativoBecarios(days) {
        const fechaLimite = new Date();
        fechaLimite.setDate(fechaLimite.getDate() - days);
        const limiteStr = fechaLimite.toISOString().split('T')[0];

        const becarios = await User.findAll({
            where: { rol: 'becario', activo: true },
            attributes: ['id', 'nombre', 'apellido']
        });
        const citas = await Cita.findAll({
            where: { fecha: { [Op.gte]: limiteStr } },
            attributes: ['id', 'estado', 'paciente_id', 'becario_id']
        });
        const observaciones = await ObservacionBecario.findAll({
            where: { fecha: { [Op.gte]: limiteStr } },
            attributes: ['id', 'becario_id', 'calificacion']
        });
        const asignaciones = await Asignacion.findAll({
            where: { estado: 'activa' },
            attributes: ['becario_id', 'psicologo_id']
        });
        const psicologoMap = await User.findAll({
            where: { id: { [Op.in]: asignaciones.map(a => a.psicologo_id).filter(Boolean) } },
            attributes: ['id', 'nombre', 'apellido']
        }).then(list => list.reduce((acc, u) => { acc[u.id] = `${u.nombre} ${u.apellido}`; return acc; }, {}));

        return becarios.map(b => {
            const citasBec = citas.filter(c => c.becario_id === b.id);
            const total = citasBec.length;
            const completadas = citasBec.filter(c => c.estado === 'completada').length;
            const pacientes_unicos = new Set(citasBec.map(c => c.paciente_id)).size;
            const observacionesBec = observaciones.filter(o => o.becario_id === b.id);
            const promedio_calificacion = observacionesBec.length > 0
                ? Math.round((observacionesBec.reduce((s, o) => s + (o.calificacion || 0), 0) / observacionesBec.length) * 100) / 100
                : 0;
            const supervisorAsignacion = asignaciones.find(a => a.becario_id === b.id);
            const supervisor = supervisorAsignacion ? psicologoMap[supervisorAsignacion.psicologo_id] || null : null;

            return {
                id: b.id,
                becario: `${b.nombre} ${b.apellido}`,
                total_citas: total,
                citas_completadas: completadas,
                tasa_completitud: total > 0 ? Math.round((completadas / total) * 10000) / 100 : 0,
                pacientes_unicos,
                observaciones_recibidas: observacionesBec.length,
                promedio_calificacion,
                supervisor
            };
        }).sort((a, b) => b.citas_completadas - a.citas_completadas);
    }

    static async generarComparativoMeses(days) {
        const fechaLimite = new Date();
        fechaLimite.setDate(fechaLimite.getDate() - days);
        const limiteStr = fechaLimite.toISOString().split('T')[0];

        const citas = await Cita.findAll({
            where: { fecha: { [Op.gte]: limiteStr } },
            attributes: ['id', 'estado', 'paciente_id', 'psicologo_id', 'becario_id', 'fecha']
        });
        const sesiones = await Sesion.findAll({
            where: { fecha: { [Op.gte]: limiteStr } },
            attributes: ['id', 'fecha']
        });
        const altas = await Alta.findAll({
            where: { fecha_alta: { [Op.gte]: limiteStr } },
            attributes: ['id', 'fecha_alta']
        });

        const sesionesPorMes = sesiones.reduce((acc, s) => {
            const mes = formatMonth(s.fecha);
            if (!mes) return acc;
            acc[mes] = (acc[mes] || 0) + 1;
            return acc;
        }, {});
        const altasPorMes = altas.reduce((acc, a) => {
            const mes = formatMonth(a.fecha_alta);
            if (!mes) return acc;
            acc[mes] = (acc[mes] || 0) + 1;
            return acc;
        }, {});

        const mesesMap = citas.reduce((acc, c) => {
            const mes = formatMonth(c.fecha);
            if (!mes) return acc;
            if (!acc[mes]) acc[mes] = { mes, total_citas: 0, citas_completadas: 0, citas_canceladas: 0, pacientes_unicos: new Set(), psicologos_activos: new Set(), becarios_activos: new Set() };
            acc[mes].total_citas += 1;
            if (c.estado === 'completada') acc[mes].citas_completadas += 1;
            if (c.estado === 'cancelada') acc[mes].citas_canceladas += 1;
            if (c.paciente_id) acc[mes].pacientes_unicos.add(c.paciente_id);
            if (c.psicologo_id) acc[mes].psicologos_activos.add(c.psicologo_id);
            if (c.becario_id) acc[mes].becarios_activos.add(c.becario_id);
            return acc;
        }, {});

        return Object.values(mesesMap)
            .map(item => ({
                mes: item.mes,
                total_citas: item.total_citas,
                citas_completadas: item.citas_completadas,
                citas_canceladas: item.citas_canceladas,
                tasa_completitud: item.total_citas > 0 ? Math.round((item.citas_completadas / item.total_citas) * 10000) / 100 : 0,
                pacientes_unicos: item.pacientes_unicos.size,
                psicologos_activos: item.psicologos_activos.size,
                becarios_activos: item.becarios_activos.size,
                sesiones_registradas: sesionesPorMes[item.mes] || 0,
                altas_realizadas: altasPorMes[item.mes] || 0
            }))
            .sort((a, b) => a.mes.localeCompare(b.mes));
    }
}

module.exports = EstadisticaController;