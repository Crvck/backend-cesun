const { Op } = require('sequelize');
const sequelize = require('../config/db');
const bcrypt = require('bcryptjs');
const Solicitud = require('../models/Solicitud');
const EmailService = require('../services/emailService');
const Paciente = require('../models/pacienteModel');
const Cita = require('../models/citaModel');
const User = require('../models/userModel');
const Asignacion = require('../models/asignacionModel');
const Alta = require('../models/altaModel');
const Sesion = require('../models/sesionModel');
const ObservacionBecario = require('../models/observacionBecarioModel');
const Disponibilidad = require('../models/disponibilidadModel');

const formatDate = (date) => date.toISOString().split('T')[0];
const addDays = (date, days) => {
    const d = new Date(date);
    d.setDate(d.getDate() + days);
    return d;
};
const dayNamesEs = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
const getDayNameEs = (date) => dayNamesEs[date.getDay()] || 'domingo';
const startOfWeek = (date) => {
    const d = new Date(date);
    const day = (d.getDay() + 6) % 7;
    d.setDate(d.getDate() - day);
    d.setHours(0, 0, 0, 0);
    return d;
};
const getWeekKey = (date) => {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
};

const normalizarTexto = (value = '') =>
    String(value || '')
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');

const contienePalabra = (texto, palabras) => {
    const textoNormalizado = normalizarTexto(texto);
    return palabras.some(palabra => textoNormalizado.includes(normalizarTexto(palabra)));
};

class DashboardController {
    
    static async obtenerDashboardCoordinador(req, res) {
        try {
            const usuarioId = req.user.id;
            
            // Inicializamos las variables
            let estadisticas = {};
            let cancelacionesMes = {};
            let citasPorDia = [];
            let topTerapeutas = [];
            let coterapeutasConCarga = [];
            let actividadReciente = [];
            let solicitudesPendientes = []; // <--- NUEVA VARIABLE
            let completadasPorOrigen = {
                foraneos: 0,
                comunidadCesun: 0,
                canalizaciones: 0
            };
            let completadasPorKapi = {};
            
            // --- BLOQUE 1: Estadísticas generales ---
            try {
                const hoy = new Date();
                const hoyStr = formatDate(hoy);
                const mananaStr = formatDate(addDays(hoy, 1));
                const sieteDiasAtras = formatDate(addDays(hoy, -7));
                const treintaDiasAtras = formatDate(addDays(hoy, -30));
                const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
                const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);
                const primerDiaMesStr = formatDate(primerDiaMes);
                const ultimoDiaMesStr = formatDate(ultimoDiaMes);

                const solicitudesPendientesList = await Solicitud.findAll();
                const solicitudesPendientesFiltradas = solicitudesPendientesList.filter(s =>
                    String(s.estado || '').trim().toUpperCase() === 'PENDIENTE'
                );

                const [
                    pacientes_activos,
                    pacientes_inactivos,
                    pacientes_nuevos_hoy,
                    citas_hoy,
                    citas_completadas_hoy,
                    citas_canceladas_hoy,
                    citas_semana,
                    terapeutas_activos,
                    coterapeutas_activos,
                    coordinadores_activos,
                    asignaciones_activas,
                    asignaciones_finalizadas_mes,
                    altas_mes,
                    altas_hoy,
                    solicitudesIngreso,
                    sesionesCrisis,
                    canceladasMes,
                    completadasMes,
                    cancelacionesConMotivo
                ] = await Promise.all([
                    Paciente.count({ where: { activo: true } }),
                    Paciente.count({ where: { activo: false } }),
                    Paciente.count({ where: { created_at: { [Op.between]: [hoyStr, mananaStr] } } }),
                    Cita.count({ where: { fecha: hoyStr, estado: { [Op.in]: ['programada', 'confirmada'] } } }),
                    Cita.count({ where: { fecha: hoyStr, estado: 'completada' } }),
                    Cita.count({ where: { fecha: hoyStr, estado: 'cancelada' } }),
                    Cita.count({ where: { fecha: { [Op.between]: [sieteDiasAtras, hoyStr] } } }),
                    User.count({ where: { rol: 'terapeuta', activo: true } }),
                    User.count({ where: { rol: 'coterapeuta', activo: true } }),
                    User.count({ where: { rol: 'coordinador', activo: true } }),
                    Asignacion.count({ where: { estado: 'activa' } }),
                    Asignacion.count({ where: { estado: 'finalizada', fecha_fin: { [Op.gte]: treintaDiasAtras } } }),
                    Alta.count({ where: { fecha_alta: { [Op.gte]: treintaDiasAtras } } }),
                    Alta.count({ where: { fecha_alta: hoyStr } }),
                    Solicitud.findAll({
                        where: { email: { [Op.ne]: null } },
                        attributes: ['email', 'origen', 'institucion_procedencia', 'motivo'],
                        raw: true
                    }),
                    Sesion.findAll({
                        where: { tipo_sesion: 'crisis' },
                        include: [{ model: Cita, attributes: ['paciente_id'] }]
                    }),
                    Cita.count({
                        where: {
                            fecha: { [Op.between]: [primerDiaMesStr, ultimoDiaMesStr] },
                            estado: 'cancelada'
                        }
                    }),
                    Cita.count({
                        where: {
                            fecha: { [Op.between]: [primerDiaMesStr, ultimoDiaMesStr] },
                            estado: 'completada'
                        }
                    }),
                    Cita.findAll({
                        where: {
                            fecha: { [Op.between]: [primerDiaMesStr, ultimoDiaMesStr] },
                            estado: 'cancelada',
                            motivo_cancelacion: { [Op.ne]: null }
                        },
                        attributes: ['motivo_cancelacion'],
                        raw: true
                    })
                ]);

                const solicitudesPorEmail = solicitudesIngreso.reduce((acc, solicitud) => {
                    const email = String(solicitud.email || '').trim().toLowerCase();
                    if (!email) return acc;
                    acc[email] = solicitud; // Última solicitud por email prevalece
                    return acc;
                }, {});

                const citasCompletadas = await Cita.findAll({
                    where: { estado: 'completada' },
                    include: [{ model: User, as: 'Psicologo', required: true, attributes: ['id', 'nombre', 'apellido', 'email'] }],
                    attributes: ['id', 'psicologo_id'],
                    raw: false
                });

                citasCompletadas.forEach(cita => {
                    const usuario = cita.Psicologo;
                    const email = usuario?.email?.trim().toLowerCase();
                    if (!email) return;

                    const solicitud = solicitudesPorEmail[email];
                    if (!solicitud) return;

                    const origen = String(solicitud.origen || '').toUpperCase();
                    const institucion = String(solicitud.institucion_procedencia || '');
                    const motivo = String(solicitud.motivo || '');
                    const esCanalizado = contienePalabra(institucion, ['canaliz', 'canalización']) ||
                        contienePalabra(motivo, ['canaliz', 'canalización']);

                    if (esCanalizado) {
                        completadasPorOrigen.canalizaciones += 1;
                    } else if (origen === 'CESUN') {
                        completadasPorOrigen.comunidadCesun += 1;
                    } else {
                        completadasPorOrigen.foraneos += 1;
                    }

                    const key = usuario.id;
                    if (!completadasPorKapi[key]) {
                        completadasPorKapi[key] = {
                            psicologo_id: usuario.id,
                            nombre: `${usuario.nombre} ${usuario.apellido}`,
                            email: usuario.email,
                            origen: origen || 'EXTERNO',
                            total_completadas: 0
                        };
                    }
                    completadasPorKapi[key].total_completadas += 1;
                });

                const pacientesCrisis = new Set();
                sesionesCrisis.forEach(sesion => {
                    if (sesion.Cita?.paciente_id) {
                        pacientesCrisis.add(sesion.Cita.paciente_id);
                    }
                });

                const motivosCancelacionMesMap = cancelacionesConMotivo.reduce((acc, cita) => {
                    const motivo = String(cita.motivo_cancelacion || 'Sin especificar').trim() || 'Sin especificar';
                    acc[motivo] = (acc[motivo] || 0) + 1;
                    return acc;
                }, {});

                const motivosCancelacionMes = Object.entries(motivosCancelacionMesMap)
                    .map(([motivo, cantidad]) => ({ motivo, cantidad }))
                    .sort((a, b) => b.cantidad - a.cantidad);

                const totalCancelacionesMes = canceladasMes + completadasMes;
                const promedioCancelacionesMes = totalCancelacionesMes > 0
                    ? Math.round((canceladasMes / totalCancelacionesMes) * 100)
                    : 0;

                estadisticas = {
                    pacientes_activos,
                    pacientes_inactivos,
                    pacientes_nuevos_hoy,
                    citas_hoy,
                    citas_completadas_hoy,
                    citas_canceladas_hoy,
                    citas_semana,
                    terapeutas_activos,
                    coterapeutas_activos,
                    coordinadores_activos,
                    asignaciones_activas,
                    asignaciones_finalizadas_mes,
                    altas_mes,
                    altas_hoy,
                    solicitudes_pendientes_count: solicitudesPendientesFiltradas.length,
                    px_atendidos_foraneos: completadasPorOrigen.foraneos,
                    px_atendidos_comunidad_cesun: completadasPorOrigen.comunidadCesun,
                    px_atendidos_canalizaciones: completadasPorOrigen.canalizaciones,
                    px_atendidos_crisis: pacientesCrisis.size
                };

                cancelacionesMes = {
                    promedio: promedioCancelacionesMes,
                    canceladas: canceladasMes,
                    completadas: completadasMes,
                    total: totalCancelacionesMes,
                    motivos: motivosCancelacionMes
                };

                solicitudesPendientes = solicitudesPendientesFiltradas.sort(
                    (a, b) => new Date(a.fecha_solicitud) - new Date(b.fecha_solicitud)
                );
            } catch (e) {
                console.warn('Error en estadísticas:', e.message);
                estadisticas = {};
            }
            
            // --- BLOQUE 2: Citas por día ---
            try {
                const hoy = new Date();
                const weekStart = startOfWeek(hoy);
                const weekEnd = addDays(weekStart, 6);
                const citasSemana = await Cita.findAll({
                    where: { fecha: { [Op.between]: [formatDate(weekStart), formatDate(weekEnd)] } },
                    attributes: ['fecha', 'estado']
                });

                const map = citasSemana.reduce((acc, cita) => {
                    const fecha = cita.fecha instanceof Date ? cita.fecha : new Date(cita.fecha);
                    const dia = getDayNameEs(fecha);
                    if (!acc[dia]) acc[dia] = { dia, total_citas: 0, completadas: 0, canceladas: 0 };
                    acc[dia].total_citas += 1;
                    if (cita.estado === 'completada') acc[dia].completadas += 1;
                    if (cita.estado === 'cancelada') acc[dia].canceladas += 1;
                    return acc;
                }, {});

                const order = ['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo'];
                citasPorDia = Object.values(map).sort((a, b) => order.indexOf(a.dia) - order.indexOf(b.dia));
            } catch (e) {
                console.warn('Error en citas por día:', e.message);
            }
            
            // --- BLOQUE 3: Top terapeutas ---
            try {
                const treintaDiasAtras = formatDate(addDays(new Date(), -30));
                const terapeutas = await User.findAll({
                    where: { rol: 'terapeuta', activo: true },
                    attributes: ['id', 'nombre', 'apellido']
                });
                const ids = terapeutas.map(t => t.id);
                const citas = await Cita.findAll({
                    where: { psicologo_id: { [Op.in]: ids }, fecha: { [Op.gte]: treintaDiasAtras } },
                    attributes: ['psicologo_id', 'estado']
                });

                const stats = terapeutas.map(t => {
                    const citasTer = citas.filter(c => c.psicologo_id === t.id);
                    const total_citas = citasTer.length;
                    const citas_completadas = citasTer.filter(c => c.estado === 'completada').length;
                    return {
                        id: t.id,
                        nombre_completo: `${t.nombre} ${t.apellido}`,
                        total_citas,
                        citas_completadas
                    };
                }).sort((a, b) => b.citas_completadas - a.citas_completadas).slice(0, 5);

                topTerapeutas = stats;
            } catch (e) {
                console.warn('Error en top terapeutas:', e.message);
            }
            
            // --- BLOQUE 4: Coterapeutas con carga ---
            try {
                const treintaDiasAtras = formatDate(addDays(new Date(), -30));
                const coterapeutas = await User.findAll({
                    where: { rol: 'coterapeuta', activo: true },
                    attributes: ['id', 'nombre', 'apellido']
                });
                const coterapeutaIds = coterapeutas.map(c => c.id);

                const asignaciones = await Asignacion.findAll({
                    where: { becario_id: { [Op.in]: coterapeutaIds }, estado: 'activa' },
                    include: [{ model: Paciente, attributes: ['id', 'nombre', 'apellido'] }]
                });

                const citas = await Cita.findAll({
                    where: { becario_id: { [Op.in]: coterapeutaIds }, fecha: { [Op.gte]: treintaDiasAtras } },
                    attributes: ['id', 'becario_id']
                });

                const asignacionesPorCoterapeuta = asignaciones.reduce((acc, a) => {
                    const id = a.becario_id;
                    if (!acc[id]) acc[id] = { pacientes: new Map(), pacientes_asignados: 0 };
                    if (a.Paciente && !acc[id].pacientes.has(a.Paciente.id)) {
                        acc[id].pacientes.set(a.Paciente.id, `${a.Paciente.nombre} ${a.Paciente.apellido}`);
                        acc[id].pacientes_asignados += 1;
                    }
                    return acc;
                }, {});

                const citasPorCoterapeuta = citas.reduce((acc, c) => {
                    acc[c.becario_id] = (acc[c.becario_id] || 0) + 1;
                    return acc;
                }, {});

                coterapeutasConCarga = coterapeutas.map(ct => {
                    const asignacionInfo = asignacionesPorCoterapeuta[ct.id] || { pacientes: new Map(), pacientes_asignados: 0 };
                    return {
                        id: ct.id,
                        nombre_completo: `${ct.nombre} ${ct.apellido}`,
                        pacientes_asignados: asignacionInfo.pacientes_asignados,
                        citas_este_mes: citasPorCoterapeuta[ct.id] || 0,
                        pacientes: Array.from(asignacionInfo.pacientes.values()).join(', ')
                    };
                }).sort((a, b) => b.pacientes_asignados - a.pacientes_asignados).slice(0, 5);
            } catch (e) {
                console.warn('Error en coterapeutas con carga:', e.message);
            }
            
            // --- BLOQUE 5: Actividad reciente ---
            try {
                const citasRecientes = await Cita.findAll({
                    include: [{ model: User, as: 'Psicologo', attributes: ['nombre', 'apellido'] }],
                    order: [['created_at', 'DESC']],
                    limit: 5
                });

                actividadReciente = citasRecientes.map(c => ({
                    id: c.id,
                    paciente_id: c.paciente_id,
                    fecha: c.fecha,
                    fecha_evento: c.created_at,
                    tipo_evento: 'Cita creada',
                    usuario: c.Psicologo ? `${c.Psicologo.nombre} ${c.Psicologo.apellido}` : null,
                    nombre_usuario: c.Psicologo?.nombre || null
                }));
            } catch (e) {
                console.warn('Error en actividad reciente:', e.message);
            }

            // --- BLOQUE 6: Solicitudes Pendientes ---
            try {
                if (!solicitudesPendientes.length) {
                    const solicitudesPendientesList = await Solicitud.findAll({
                        order: [['fecha_solicitud', 'ASC']]
                    });
                    solicitudesPendientes = solicitudesPendientesList.filter(s =>
                        String(s.estado || '').trim().toUpperCase() === 'PENDIENTE'
                    );
                }
            } catch (e) {
                console.warn('Error obteniendo solicitudes pendientes:', e.message);
                solicitudesPendientes = [];
            }

const completadasPorKapiArray = Object.values(completadasPorKapi).sort((a, b) => b.total_completadas - a.total_completadas);

                res.json({
                    success: true,
                    data: {
                        estadisticas,
                        cancelaciones_mes: cancelacionesMes,
                        citas_por_dia: citasPorDia,
                        top_terapeutas: topTerapeutas,
                        completadas_por_kapi: completadasPorKapiArray,
                        completadas_por_origen: completadasPorOrigen,
                        coterapeutas_con_carga: coterapeutasConCarga,
                        actividad_reciente: actividadReciente,
                        solicitudes_pendientes: solicitudesPendientes,
                        ultima_actualizacion: new Date().toISOString()
                    }
                });

        } catch (error) {
            console.error('Error en obtenerDashboardCoordinador:', error);
            res.status(500).json({ success: false, message: 'Error al obtener dashboard de coordinador' });
        }
    }

    static async obtenerDashboardPsicologo(req, res) {
        try {
            const usuarioId = req.user.id;
            
            const hoy = new Date();
            const hoyStr = formatDate(hoy);

            const pacientes_asignados = await Asignacion.count({
                where: { psicologo_id: usuarioId, estado: 'activa' },
                distinct: true,
                col: 'paciente_id'
            });
            const citas_hoy = await Cita.count({ where: { psicologo_id: usuarioId, fecha: hoyStr } });
            const estadisticas = { pacientes_asignados, citas_hoy };

            const proximasCitasList = await Cita.findAll({
                where: {
                    psicologo_id: usuarioId,
                    fecha: { [Op.gte]: hoyStr },
                    estado: { [Op.in]: ['programada', 'confirmada'] }
                },
                include: [
                    { model: Paciente, attributes: ['nombre', 'apellido'] },
                    { model: User, as: 'Becario', attributes: ['nombre', 'apellido'] }
                ],
                order: [['fecha', 'ASC'], ['hora', 'ASC']],
                limit: 10
            });

            const proximasCitas = proximasCitasList.map(c => ({
                id: c.id,
                fecha: c.fecha,
                hora: c.hora,
                estado: c.estado,
                paciente: c.Paciente ? `${c.Paciente.nombre} ${c.Paciente.apellido}` : null,
                coterapeuta_nombre: c.Becario ? c.Becario.nombre : null
            }));

            const asignaciones = await Asignacion.findAll({
                where: { psicologo_id: usuarioId, estado: 'activa' },
                include: [{ model: Paciente, attributes: ['id', 'nombre', 'apellido', 'activo'] }]
            });
            const pacientesIds = asignaciones.map(a => a.paciente_id);
            const citasCompletadas = await Cita.findAll({
                where: { paciente_id: { [Op.in]: pacientesIds }, estado: 'completada' },
                attributes: ['paciente_id', 'fecha']
            });
            const citasPorPaciente = citasCompletadas.reduce((acc, c) => {
                const fecha = c.fecha instanceof Date ? c.fecha : new Date(c.fecha);
                if (!acc[c.paciente_id]) acc[c.paciente_id] = { total: 0, ultima: fecha };
                acc[c.paciente_id].total += 1;
                if (fecha > acc[c.paciente_id].ultima) acc[c.paciente_id].ultima = fecha;
                return acc;
            }, {});

            const pacientesSeguimiento = asignaciones
                .filter(a => a.Paciente?.activo)
                .map(a => {
                    const info = citasPorPaciente[a.paciente_id];
                    const ultima = info?.ultima || null;
                    const dias = ultima ? Math.floor((hoy - ultima) / (1000 * 60 * 60 * 24)) : null;
                    return {
                        id: a.Paciente.id,
                        paciente: `${a.Paciente.nombre} ${a.Paciente.apellido}`,
                        ultima_sesion: ultima ? formatDate(ultima) : null,
                        dias_desde_ultima: dias,
                        total_sesiones: info?.total || 0
                    };
                })
                .filter(p => p.dias_desde_ultima === null || p.dias_desde_ultima > 14)
                .sort((a, b) => (b.dias_desde_ultima ?? Infinity) - (a.dias_desde_ultima ?? Infinity))
                .slice(0, 5);

            const observacionesRecientesList = await ObservacionBecario.findAll({
                where: { supervisor_id: usuarioId },
                include: [{ model: User, as: 'Becario', attributes: ['nombre', 'apellido'] }],
                order: [['fecha', 'DESC'], ['created_at', 'DESC']],
                limit: 5
            });
            const observacionesRecientes = observacionesRecientesList.map(ob => ({
                id: ob.id,
                fecha: ob.fecha,
                aspecto_evaluado: ob.aspecto_evaluado,
                calificacion: ob.calificacion,
                coterapeuta: ob.Becario ? `${ob.Becario.nombre} ${ob.Becario.apellido}` : null,
                plan_accion: ob.plan_accion,
                fecha_seguimiento: ob.fecha_seguimiento
            }));

            const disponibilidadList = await Disponibilidad.findAll({
                where: { usuario_id: usuarioId, activo: true }
            });
            const fechaFin = formatDate(addDays(hoy, 7));
            const citasSemana = await Cita.findAll({
                where: {
                    psicologo_id: usuarioId,
                    fecha: { [Op.between]: [hoyStr, fechaFin] },
                    estado: { [Op.in]: ['programada', 'confirmada'] }
                },
                attributes: ['fecha', 'hora']
            });

            const disponibilidadSemana = disponibilidadList.map(d => {
                const citas_programadas = citasSemana.filter(c => {
                    const fecha = c.fecha instanceof Date ? c.fecha : new Date(c.fecha);
                    const dia = getDayNameEs(fecha);
                    if (dia !== d.dia_semana) return false;
                    return c.hora >= d.hora_inicio && c.hora <= d.hora_fin;
                }).length;
                return {
                    dia_semana: d.dia_semana,
                    hora_inicio: d.hora_inicio,
                    hora_fin: d.hora_fin,
                    citas_programadas
                };
            }).sort((a, b) => dayNamesEs.indexOf(a.dia_semana) - dayNamesEs.indexOf(b.dia_semana));
            
            res.json({
                success: true,
                data: {
                    estadisticas,
                    proximas_citas: proximasCitas,
                    pacientes_seguimiento: pacientesSeguimiento,
                    observaciones_recientes: observacionesRecientes,
                    disponibilidad_semana: disponibilidadSemana,
                    ultima_actualizacion: new Date().toISOString()
                }
            });
            
        } catch (error) {
            console.error('Error en obtenerDashboardPsicologo:', error);
            res.status(500).json({ success: false, message: 'Error al obtener dashboard de psicólogo' });
        }
    }
    
    static async obtenerDashboardBecario(req, res) {
        try {
            const usuarioId = req.user.id;
            
            const hoy = new Date();
            const hoyStr = formatDate(hoy);
            const treintaDiasAtras = formatDate(addDays(hoy, -30));

            const [
                pacientes_asignados,
                citas_hoy,
                citas_completadas_hoy,
                citas_mes,
                citas_completadas_total,
                observaciones_mes,
                promedio_calificacion
            ] = await Promise.all([
                Asignacion.count({ where: { becario_id: usuarioId, estado: 'activa' }, distinct: true, col: 'paciente_id' }),
                Cita.count({ where: { becario_id: usuarioId, fecha: hoyStr, estado: { [Op.in]: ['programada', 'confirmada'] } } }),
                Cita.count({ where: { becario_id: usuarioId, fecha: hoyStr, estado: 'completada' } }),
                Cita.count({ where: { becario_id: usuarioId, fecha: { [Op.between]: [treintaDiasAtras, hoyStr] } } }),
                Cita.count({ where: { becario_id: usuarioId, estado: 'completada' } }),
                ObservacionBecario.count({ where: { becario_id: usuarioId, fecha: { [Op.gte]: treintaDiasAtras } } }),
                ObservacionBecario.avg('calificacion', { where: { becario_id: usuarioId } })
            ]);

            const supervisorAsignacion = await Asignacion.findOne({
                where: { becario_id: usuarioId, estado: 'activa' },
                include: [{ model: User, as: 'Psicologo', attributes: ['nombre', 'apellido'] }]
            });
            const supervisor = supervisorAsignacion?.Psicologo
                ? `${supervisorAsignacion.Psicologo.nombre} ${supervisorAsignacion.Psicologo.apellido}`
                : null;

            const estadisticas = {
                pacientes_asignados,
                citas_hoy,
                citas_completadas_hoy,
                citas_mes,
                citas_completadas_total,
                observaciones_mes,
                promedio_calificacion: promedio_calificacion ? Math.round(promedio_calificacion * 100) / 100 : 0,
                supervisor
            };

            const citasHoyList = await Cita.findAll({
                where: { becario_id: usuarioId, fecha: hoyStr, estado: { [Op.in]: ['programada', 'confirmada', 'completada'] } },
                include: [
                    { model: Paciente, attributes: ['nombre', 'apellido', 'telefono'] },
                    { model: User, as: 'Psicologo', attributes: ['nombre'] }
                ],
                order: [['hora', 'ASC']]
            });
            const citasHoy = citasHoyList.map(c => ({
                id: c.id,
                hora: c.hora,
                estado: c.estado,
                tipo_consulta: c.tipo_consulta,
                paciente: c.Paciente ? `${c.Paciente.nombre} ${c.Paciente.apellido}` : null,
                paciente_telefono: c.Paciente?.telefono || null,
                terapeuta_nombre: c.Psicologo?.nombre || null
            }));

            const proximasCitasList = await Cita.findAll({
                where: { becario_id: usuarioId, fecha: { [Op.gt]: hoyStr }, estado: { [Op.in]: ['programada', 'confirmada'] } },
                include: [{ model: Paciente, attributes: ['nombre', 'apellido', 'telefono'] }],
                order: [['fecha', 'ASC'], ['hora', 'ASC']],
                limit: 10
            });
            const proximasCitas = proximasCitasList.map(c => ({
                id: c.id,
                fecha: c.fecha,
                hora: c.hora,
                estado: c.estado,
                paciente: c.Paciente ? `${c.Paciente.nombre} ${c.Paciente.apellido}` : null,
                paciente_telefono: c.Paciente?.telefono || null
            }));

            const observacionesRecientesList = await ObservacionBecario.findAll({
                where: { becario_id: usuarioId },
                include: [{ model: User, as: 'Supervisor', attributes: ['nombre', 'apellido'] }],
                order: [['fecha', 'DESC']],
                limit: 5
            });
            const observacionesRecientes = observacionesRecientesList.map(ob => ({
                id: ob.id,
                fecha: ob.fecha,
                aspecto_evaluado: ob.aspecto_evaluado,
                calificacion: ob.calificacion,
                fortalezas: ob.fortalezas,
                areas_mejora: ob.areas_mejora,
                supervisor: ob.Supervisor ? `${ob.Supervisor.nombre} ${ob.Supervisor.apellido}` : null,
                fecha_seguimiento: ob.fecha_seguimiento
            }));

            const sieteDiasAtras = formatDate(addDays(hoy, -7));
            const citasCompletadas = await Cita.findAll({
                where: { becario_id: usuarioId, estado: 'completada', fecha: { [Op.gte]: sieteDiasAtras } },
                include: [{ model: Paciente, attributes: ['nombre', 'apellido'] }],
                order: [['fecha', 'DESC']],
                limit: 10
            });
            const sesionIds = citasCompletadas.map(c => c.id);
            const sesiones = await Sesion.findAll({ where: { cita_id: { [Op.in]: sesionIds } }, attributes: ['cita_id'] });
            const sesionesMap = sesiones.reduce((acc, s) => { acc[s.cita_id] = true; return acc; }, {});

            const tareasPendientes = citasCompletadas
                .filter(c => !sesionesMap[c.id])
                .slice(0, 5)
                .map(c => ({
                    cita_id: c.id,
                    fecha: c.fecha,
                    hora: c.hora,
                    paciente: c.Paciente ? `${c.Paciente.nombre} ${c.Paciente.apellido}` : null,
                    dias_pasados: Math.floor((hoy - new Date(c.fecha)) / (1000 * 60 * 60 * 24))
                }));

            const disponibilidadList = await Disponibilidad.findAll({
                where: { usuario_id: usuarioId, activo: true },
                order: [['dia_semana', 'ASC'], ['hora_inicio', 'ASC']]
            });
            const disponibilidad = disponibilidadList.map(d => ({
                dia_semana: d.dia_semana,
                hora_inicio: d.hora_inicio,
                hora_fin: d.hora_fin
            }));
            
            res.json({
                success: true,
                data: {
                    estadisticas,
                    citas_hoy: citasHoy,
                    proximas_citas: proximasCitas,
                    observaciones_recientes: observacionesRecientes,
                    tareas_pendientes: tareasPendientes,
                    disponibilidad,
                    ultima_actualizacion: new Date().toISOString()
                }
            });
            
        } catch (error) {
            console.error('Error en obtenerDashboardBecario:', error);
            res.status(500).json({ success: false, message: 'Error al obtener dashboard de coterapeuta' });
        }
    }
    
    static async obtenerMetricasGlobales(req, res) {
        try {
            const { periodo = 'mes' } = req.query;
            
            let days;
            switch (periodo) {
                case 'mes': days = 30; break;
                case 'trimestre': days = 90; break;
                case 'semestre': days = 180; break;
                case 'año': days = 365; break;
                default: days = 30;
            }

            const fechaInicio = formatDate(addDays(new Date(), -days));

            const pacientes = await Paciente.findAll({
                where: { created_at: { [Op.gte]: fechaInicio } },
                attributes: ['id', 'activo']
            });

            const citas = await Cita.findAll({
                where: { fecha: { [Op.gte]: fechaInicio } },
                attributes: ['id', 'estado', 'paciente_id', 'tipo_consulta', 'fecha']
            });

            const altas = await Alta.findAll({
                where: { fecha_alta: { [Op.gte]: fechaInicio } },
                attributes: ['id', 'tipo_alta', 'paciente_id', 'fecha_alta']
            });

            const sesiones = citas.length > 0
                ? await Sesion.count({ where: { cita_id: { [Op.in]: citas.map(c => c.id) } } })
                : 0;

            const total_pacientes = pacientes.length;
            const pacientes_activos = pacientes.filter(p => p.activo).length;
            const pacientes_inactivos = total_pacientes - pacientes_activos;
            const total_citas = citas.length;
            const citas_completadas = citas.filter(c => c.estado === 'completada').length;
            const citas_canceladas = citas.filter(c => c.estado === 'cancelada').length;
            const altas_realizadas = altas.length;
            const altas_terapeuticas = altas.filter(a => a.tipo_alta === 'terapeutica').length;
            const tasa_completitud_citas = total_citas > 0
                ? Math.round((citas_completadas / total_citas) * 10000) / 100
                : 0;
            const tasa_abandono = altas_realizadas > 0
                ? Math.round((altas.filter(a => a.tipo_alta === 'abandono').length / altas_realizadas) * 10000) / 100
                : 0;

            const metricas = {
                total_pacientes,
                pacientes_activos,
                pacientes_inactivos,
                total_citas,
                citas_completadas,
                citas_canceladas,
                sesiones_registradas: sesiones,
                altas_realizadas,
                altas_terapeuticas,
                tasa_completitud_citas,
                tasa_abandono
            };

            const evolucionMap = citas.reduce((acc, c) => {
                const fecha = c.fecha instanceof Date ? c.fecha : new Date(c.fecha);
                const semana = getWeekKey(fecha);
                if (!acc[semana]) acc[semana] = { semana, total_citas: 0, citas_completadas: 0, pacientes: new Set(), altas_realizadas: 0 };
                acc[semana].total_citas += 1;
                if (c.estado === 'completada') acc[semana].citas_completadas += 1;
                if (c.paciente_id) acc[semana].pacientes.add(c.paciente_id);
                return acc;
            }, {});

            altas.forEach(a => {
                const fecha = a.fecha_alta instanceof Date ? a.fecha_alta : new Date(a.fecha_alta);
                const semana = getWeekKey(fecha);
                if (!evolucionMap[semana]) evolucionMap[semana] = { semana, total_citas: 0, citas_completadas: 0, pacientes: new Set(), altas_realizadas: 0 };
                evolucionMap[semana].altas_realizadas += 1;
            });

            const evolucionSemanal = Object.values(evolucionMap)
                .map(item => ({
                    semana: item.semana,
                    total_citas: item.total_citas,
                    citas_completadas: item.citas_completadas,
                    pacientes_atendidos: item.pacientes.size,
                    altas_realizadas: item.altas_realizadas
                }))
                .sort((a, b) => a.semana.localeCompare(b.semana))
                .slice(-12);

            const distribucionConsultaMap = citas.reduce((acc, c) => {
                const tipo = c.tipo_consulta || 'no especificado';
                acc[tipo] = (acc[tipo] || 0) + 1;
                return acc;
            }, {});
            const distribucionConsulta = Object.entries(distribucionConsultaMap).map(([tipo_consulta, cantidad]) => ({
                tipo_consulta,
                cantidad,
                porcentaje: total_citas > 0 ? Math.round((cantidad / total_citas) * 10000) / 100 : 0
            }));

            const distribucionAltaMap = altas.reduce((acc, a) => {
                const tipo = a.tipo_alta || 'no especificado';
                acc[tipo] = (acc[tipo] || 0) + 1;
                return acc;
            }, {});
            const distribucionAlta = Object.entries(distribucionAltaMap).map(([tipo_alta, cantidad]) => ({
                tipo_alta,
                cantidad,
                porcentaje: altas_realizadas > 0 ? Math.round((cantidad / altas_realizadas) * 10000) / 100 : 0
            }));
            
            res.json({
                success: true,
                data: {
                    periodo,
                    metricas,
                    evolucion_semanal: evolucionSemanal.reverse(),
                    distribucion_consulta: distribucionConsulta,
                    distribucion_alta: distribucionAlta,
                    fecha_consulta: new Date().toISOString()
                }
            });
            
        } catch (error) {
            console.error('Error en obtenerMetricasGlobales:', error);
            res.status(500).json({ success: false, message: 'Error al obtener métricas globales' });
        }
    }

    static async denegarSolicitud(req, res) {
        console.log("=== INICIANDO denegarSolicitud ===");
        const { solicitudId } = req.body;
        
        if (!solicitudId) {
            return res.status(400).json({ message: "Falta el ID de la solicitud." });
        }
        
        try {
            await Solicitud.update(
                { 
                    estado: 'RECHAZADO',
                    fecha_resolucion: new Date(),
                    aprobado_por: req.user.id
                },
                { where: { id: solicitudId }, validate: false }
            );

            return res.status(200).json({ message: "Solicitud denegada correctamente.", success: true });
            
        } catch (error) {
            console.error("Error al denegar solicitud:", error.message);
            return res.status(500).json({ message: "Error interno: " + error.message });
        }
    }

    static async aprobarSolicitud(req, res) {
        console.log("=== INICIANDO aprobarSolicitud ===");
        const { solicitudId, rolAsignado } = req.body;
        console.log("--> Datos recibidos:", { solicitudId, rolAsignado });

        if (!solicitudId || !rolAsignado) {
            console.log("--> ERROR: Faltan datos requeridos");
            return res.status(400).json({ message: "Faltan datos requeridos (ID o Rol)." });
        }

        const transaction = await sequelize.transaction();
        console.log("--> Transacción iniciada");

        try {
            const solicitud = await Solicitud.findByPk(solicitudId, { transaction });
            if (!solicitud) {
                await transaction.rollback();
                return res.status(404).json({ message: "Solicitud no encontrada en la BD." });
            }

            const existingUser = await User.findOne({ where: { email: solicitud.email }, transaction });
            if (existingUser) {
                await transaction.rollback();
                return res.status(400).json({ message: "El email ya está registrado en el sistema." });
            }

            const nombreSimple = solicitud.nombre_completo.split(' ')[0];
            const rawPassword = `${nombreSimple}123`;
            const passwordHash = await bcrypt.hash(rawPassword, 10);

            const partesNombre = solicitud.nombre_completo.split(' ');
            const nombreUser = partesNombre[0];
            const apellidoUser = partesNombre.slice(1).join(' ') || '.';

            const nuevoUsuario = await User.create({
                nombre: nombreUser,
                apellido: apellidoUser,
                email: solicitud.email,
                password: passwordHash,
                rol: rolAsignado.toLowerCase(),
                telefono: solicitud.telefono,
                activo: true
            }, { transaction });

            // Crear registros de disponibilidad si existen en la solicitud
            if (solicitud.disponibilidad_horaria) {
                try {
                    const Disponibilidad = require('../models/disponibilidadModel');
                    const disponibilidades = JSON.parse(solicitud.disponibilidad_horaria);
                    
                    if (Array.isArray(disponibilidades) && disponibilidades.length > 0) {
                        for (const disp of disponibilidades) {
                            await Disponibilidad.create({
                                usuario_id: nuevoUsuario.id,
                                dia_semana: disp.dia_semana,
                                hora_inicio: disp.hora_inicio,
                                hora_fin: disp.hora_fin,
                                tipo_disponibilidad: 'regular',
                                activo: true,
                                fecha_inicio_vigencia: new Date()
                            }, { transaction });
                        }
                        console.log(`--> ${disponibilidades.length} registros de disponibilidad creados.`);
                    }
                } catch (dispError) {
                    console.error("--> Error al crear disponibilidades (no bloqueante):", dispError.message);
                }
            }

            await solicitud.update({ 
                estado: 'APROBADA',
                fecha_resolucion: new Date(),
                aprobado_por: req.user.id
            }, { transaction, validate: false });

            await transaction.commit();
            console.log("--> Transacción completada y usuario creado.");

            try {
                await EmailService.enviarBienvenidaUsuario({
                    nombre: nombreUser,
                    apellido: apellidoUser,
                    email: solicitud.email,
                    passwordTemporal: rawPassword,
                    rol: rolAsignado
                });
            } catch (emailError) {
                console.error("--> Error al enviar correo (no bloqueante):", emailError.message);
            }

            res.status(200).json({
                message: "Solicitud aprobada y usuario creado correctamente.",
                success: true
            });

        } catch (error) {
            await transaction.rollback();
            console.error("=== ERROR CRÍTICO en aprobarSolicitud ===", error);
            res.status(500).json({ message: "Error interno: " + error.message });
        }
    }
}

module.exports = DashboardController;