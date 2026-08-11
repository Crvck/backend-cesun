// backend/src/controllers/agendaController.js - Versión simplificada sin verificación de roles
const Cita = require('../models/citaModel');
const Paciente = require('../models/pacienteModel');
const User = require('../models/userModel');
const Disponibilidad = require('../models/disponibilidadModel');
const Notificacion = require('../models/notificacionModel');
const { Op, fn, col, literal } = require('sequelize');

class AgendaController {

    static async obtenerAgendaGlobal(req, res) {
        try {
            const { 
                fecha_inicio, 
                fecha_fin, 
                psicologo_id, 
                becario_id, 
                paciente_id,
                estado,
                tipo_consulta,
                departamento,
                limit = 50,
                offset = 0
            } = req.query;
            
            // Construir condiciones de filtro
            const whereClause = {};
            
            if (fecha_inicio && fecha_fin) {
                whereClause.fecha = {
                    [Op.between]: [fecha_inicio, fecha_fin]
                };
            } else if (fecha_inicio) {
                whereClause.fecha = { [Op.gte]: fecha_inicio };
            } else if (fecha_fin) {
                whereClause.fecha = { [Op.lte]: fecha_fin };
            } else {
                // Por defecto, mostrar solo citas futuras y de hoy
                whereClause.fecha = { [Op.gte]: new Date().toISOString().split('T')[0] };
            }
            
            if (psicologo_id) whereClause.psicologo_id = psicologo_id;
            if (becario_id) whereClause.becario_id = becario_id;
            if (paciente_id) whereClause.paciente_id = paciente_id;
            if (estado) whereClause.estado = estado;
            if (tipo_consulta) whereClause.tipo_consulta = tipo_consulta;
            if (departamento) whereClause.departamento = departamento;
            
            console.log('Where clause:', whereClause);
            
            const citas = await Cita.findAll({
                where: whereClause,
                include: [
                    {
                        model: Paciente,
                        attributes: ['id', 'nombre', 'apellido', 'telefono', 'email']
                    },
                    {
                        model: User,
                        as: 'Psicologo',
                        attributes: ['id', 'nombre', 'apellido', 'especialidad']
                    },
                    {
                        model: User,
                        as: 'Becario',
                        attributes: ['id', 'nombre', 'apellido']
                    }
                ],
                order: [
                    ['fecha', 'ASC'],
                    ['hora', 'ASC']
                ],
                limit: parseInt(limit),
                offset: parseInt(offset)
            });
            
            console.log('Citas encontradas:', citas.length);
            
            const estadisticas = {
                total_citas: citas.length,
                programadas: citas.filter(c => c.estado === 'programada').length,
                confirmadas: citas.filter(c => c.estado === 'confirmada').length,
                completadas: citas.filter(c => c.estado === 'completada').length,
                canceladas: citas.filter(c => c.estado === 'cancelada').length,
                psicologos_involucrados: new Set(citas.map(c => c.psicologo_id)).size,
                becarios_involucrados: new Set(citas.map(c => c.becario_id).filter(Boolean)).size,
                pacientes_atendidos: new Set(citas.map(c => c.paciente_id)).size
            };
            
            res.json({
                success: true,
                data: {
                    citas,
                    estadisticas,
                    filtros: {
                        fecha_inicio,
                        fecha_fin,
                        psicologo_id,
                        becario_id,
                        paciente_id,
                        estado,
                        tipo_consulta,
                        departamento
                    }
                },
                count: citas.length
            });
            
        } catch (error) {
            console.error('Error detallado en obtenerAgendaGlobal:', error);
            console.error('Stack trace:', error.stack);
            res.status(500).json({
                success: false,
                message: 'Error al obtener agenda global',
                error: error.message,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            });
        }
    }
    
    static async obtenerAgendaDiaria(req, res) {
        try {
            const { fecha } = req.query;
            
            const fechaConsulta = fecha || new Date().toISOString().split('T')[0];
            
            const citasRaw = await Cita.findAll({
                where: { fecha: fechaConsulta },
                include: [
                    { model: Paciente, attributes: ['nombre', 'apellido', 'telefono', 'email'] },
                    { model: User, as: 'Psicologo', attributes: ['nombre', 'apellido', 'especialidad'] },
                    { model: User, as: 'Becario', attributes: ['nombre', 'apellido'] }
                ],
                order: [['hora', 'ASC']]
            });

            const citas = citasRaw.map((c) => ({
                id: c.id,
                fecha: c.fecha,
                hora: c.hora,
                estado: c.estado,
                tipo_consulta: c.tipo_consulta,
                duracion_minutos: c.duracion,
                notas: c.notas,
                paciente: c.Paciente ? `${c.Paciente.nombre} ${c.Paciente.apellido}` : '',
                paciente_telefono: c.Paciente?.telefono || '',
                paciente_email: c.Paciente?.email || '',
                psicologo: c.Psicologo ? `${c.Psicologo.nombre} ${c.Psicologo.apellido}` : '',
                becario: c.Becario ? `${c.Becario.nombre} ${c.Becario.apellido}` : '',
                psicologo_especialidad: c.Psicologo?.especialidad || ''
            }));
            
            // Obtener disponibilidad de profesionales para este día
            const diaSemana = this.obtenerDiaSemana(fechaConsulta);

            const profesionales = await User.findAll({
                where: {
                    rol: { [Op.in]: ['psicologo', 'becario'] },
                    activo: true
                },
                include: [
                    {
                        model: Disponibilidad,
                        as: 'Disponibilidades',
                        where: { dia_semana: diaSemana, activo: true },
                        required: false
                    }
                ],
                order: [['rol', 'ASC'], ['apellido', 'ASC'], ['nombre', 'ASC']]
            });

            const citasProgramadas = await Cita.findAll({
                where: {
                    fecha: fechaConsulta,
                    estado: { [Op.in]: ['programada', 'confirmada'] }
                },
                attributes: ['psicologo_id', [fn('COUNT', col('id')), 'citas_programadas']],
                group: ['psicologo_id']
            });

            const citasMap = citasProgramadas.reduce((acc, row) => {
                acc[row.psicologo_id] = parseInt(row.get('citas_programadas'), 10) || 0;
                return acc;
            }, {});

            const disponibilidad = profesionales.map((u) => {
                const horarios = (u.Disponibilidades || []).map(d => {
                    const inicio = typeof d.hora_inicio === 'string' ? d.hora_inicio.substring(0, 5) : d.hora_inicio;
                    const fin = typeof d.hora_fin === 'string' ? d.hora_fin.substring(0, 5) : d.hora_fin;
                    return `${inicio} - ${fin}`;
                });

                return {
                    id: u.id,
                    profesional: `${u.nombre} ${u.apellido}`,
                    rol: u.rol,
                    horarios_disponibles: horarios.join(', '),
                    citas_programadas: citasMap[u.id] || 0
                };
            });
            
            res.json({
                success: true,
                data: {
                    fecha: fechaConsulta,
                    citas,
                    disponibilidad: disponibilidad || [],
                    total_citas: citas.length
                }
            });
            
        } catch (error) {
            console.error('Error en obtenerAgendaDiaria:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener agenda diaria'
            });
        }
    }
    
    static async obtenerCalendarioMensual(req, res) {
        try {
            const { mes, anio } = req.query;
            
            const mesActual = mes || new Date().getMonth() + 1;
            const anioActual = anio || new Date().getFullYear();
            
            const inicioMes = new Date(anioActual, mesActual - 1, 1);
            const finMes = new Date(anioActual, mesActual, 0);
            const inicioStr = inicioMes.toISOString().split('T')[0];
            const finStr = finMes.toISOString().split('T')[0];

            const citasMes = await Cita.findAll({
                where: {
                    fecha: { [Op.between]: [inicioStr, finStr] }
                },
                include: [{ model: Paciente, attributes: ['nombre', 'apellido'] }],
                order: [['fecha', 'ASC'], ['hora', 'ASC']]
            });

            const citasPorDiaMap = citasMes.reduce((acc, cita) => {
                const fecha = cita.fecha;
                if (!acc[fecha]) {
                    acc[fecha] = {
                        fecha,
                        total_citas: 0,
                        programadas: 0,
                        confirmadas: 0,
                        completadas: 0,
                        canceladas: 0,
                        detalle_citas: []
                    };
                }

                acc[fecha].total_citas += 1;
                if (cita.estado === 'programada') acc[fecha].programadas += 1;
                if (cita.estado === 'confirmada') acc[fecha].confirmadas += 1;
                if (cita.estado === 'completada') acc[fecha].completadas += 1;
                if (cita.estado === 'cancelada') acc[fecha].canceladas += 1;

                const pacienteInicial = cita.Paciente ? `${cita.Paciente.nombre[0]}. ${cita.Paciente.apellido}` : '';
                acc[fecha].detalle_citas.push(`${cita.hora} ${pacienteInicial}`.trim());

                return acc;
            }, {});
            
            // Crear calendario
            const diasMes = new Date(anioActual, mesActual, 0).getDate();
            const calendario = [];
            
            for (let dia = 1; dia <= diasMes; dia++) {
                const fecha = `${anioActual}-${mesActual.toString().padStart(2, '0')}-${dia.toString().padStart(2, '0')}`;
                const datosDia = citasPorDiaMap[fecha];
                
                calendario.push({
                    fecha,
                    dia,
                    dia_semana: this.obtenerDiaSemana(fecha),
                    total_citas: datosDia ? datosDia.total_citas : 0,
                    programadas: datosDia ? datosDia.programadas : 0,
                    confirmadas: datosDia ? datosDia.confirmadas : 0,
                    completadas: datosDia ? datosDia.completadas : 0,
                    canceladas: datosDia ? datosDia.canceladas : 0,
                    detalle_citas: datosDia ? datosDia.detalle_citas.join('; ') : null
                });
            }
            
            const total_citas_mes = citasMes.length;
            const pacientes_unicos = new Set(citasMes.map(c => c.paciente_id)).size;
            const psicologos_activos = new Set(citasMes.map(c => c.psicologo_id)).size;
            const becarios_activos = new Set(citasMes.map(c => c.becario_id).filter(Boolean)).size;
            const citas_completadas = citasMes.filter(c => c.estado === 'completada').length;
            const duracion_promedio = citasMes.length > 0
                ? Math.round((citasMes.reduce((sum, c) => sum + (c.duracion || 0), 0) / citasMes.length) * 10) / 10
                : 0;

            const estadisticasMes = {
                total_citas_mes,
                pacientes_unicos,
                psicologos_activos,
                becarios_activos,
                citas_completadas,
                duracion_promedio
            };
            
            res.json({
                success: true,
                data: {
                    mes: mesActual,
                    anio: anioActual,
                    calendario,
                    estadisticas: estadisticasMes || {},
                    total_dias: diasMes
                }
            });
            
        } catch (error) {
            console.error('Error en obtenerCalendarioMensual:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener calendario mensual'
            });
        }
    }
    
    static async reprogramarCita(req, res) {
        try {
            const { id } = req.params;
            const { nueva_fecha, nueva_hora, motivo } = req.body;
            
            const cita = await Cita.findByPk(id);
            
            if (!cita) {
                return res.status(404).json({
                    success: false,
                    message: 'Cita no encontrada'
                });
            }
            
            // Verificar que la nueva fecha/hora no se solape
            const orConditions = [];
            if (cita.psicologo_id) orConditions.push({ psicologo_id: cita.psicologo_id });
            if (cita.becario_id) orConditions.push({ becario_id: cita.becario_id });

            const solapamiento = await Cita.findOne({
                where: {
                    id: { [Op.ne]: id },
                    fecha: nueva_fecha,
                    hora: nueva_hora,
                    estado: { [Op.in]: ['programada', 'confirmada'] },
                    ...(orConditions.length > 0 ? { [Op.or]: orConditions } : {})
                },
                attributes: ['id']
            });
            
            if (solapamiento) {
                return res.status(400).json({
                    success: false,
                    message: 'Ya existe una cita programada en ese horario'
                });
            }
            
            // Guardar datos originales para log
            const datosOriginales = {
                fecha: cita.fecha,
                hora: cita.hora,
                estado: cita.estado
            };
            
            // Actualizar cita
            await cita.update({
                fecha: nueva_fecha,
                hora: nueva_hora,
                estado: 'programada',
                motivo_cancelacion: motivo ? `Reprogramación: ${motivo}` : 'Reprogramación'
            });
            
            // Crear notificaciones
            const paciente = await Paciente.findByPk(cita.paciente_id, {
                attributes: ['email', 'nombre', 'apellido']
            });
            
            // Notificar al psicólogo
            if (cita.psicologo_id) {
                await Notificacion.create({
                    usuario_id: cita.psicologo_id,
                    tipo: 'cita_modificada',
                    titulo: 'Cita reprogramada',
                    mensaje: `Cita reprogramada para el paciente: ${paciente?.nombre || 'Paciente'} ${paciente?.apellido || ''}. Nueva fecha: ${nueva_fecha} ${nueva_hora}`
                });
            }
            
            // Notificar al becario si está asignado
            if (cita.becario_id) {
                await Notificacion.create({
                    usuario_id: cita.becario_id,
                    tipo: 'cita_modificada',
                    titulo: 'Cita reprogramada',
                    mensaje: `Cita reprogramada para el paciente: ${paciente?.nombre || 'Paciente'} ${paciente?.apellido || ''}. Nueva fecha: ${nueva_fecha} ${nueva_hora}`
                });
            }
            
            res.json({
                success: true,
                message: 'Cita reprogramada exitosamente',
                data: {
                    cita_id: id,
                    fecha_anterior: datosOriginales.fecha,
                    hora_anterior: datosOriginales.hora,
                    nueva_fecha,
                    nueva_hora
                }
            });
            
        } catch (error) {
            console.error('Error en reprogramarCita:', error);
            res.status(500).json({
                success: false,
                message: 'Error al reprogramar cita'
            });
        }
    }
    
    

    static async obtenerDisponibilidadProfesionales(req, res) {
        try {
            const { fecha } = req.query;
            const fechaConsulta = fecha || new Date().toISOString().split('T')[0];
            
            
            // Función auxiliar para obtener día de la semana
            const obtenerDiaSemana = (fechaStr) => {
                try {
                    const fechaObj = new Date(fechaStr);
                    const dias = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
                    return dias[fechaObj.getDay()];
                } catch (error) {
                    console.error('Error parseando fecha:', fechaStr, error);
                    return 'lunes';
                }
            };
            
            const diaSemana = obtenerDiaSemana(fechaConsulta);
            const obtenerRangoSemana = (fechaStr) => {
                const fechaObj = new Date(fechaStr);
                const dia = fechaObj.getDay();
                const diffLunes = dia === 0 ? -6 : 1 - dia;
                const inicio = new Date(fechaObj);
                inicio.setDate(fechaObj.getDate() + diffLunes);
                inicio.setHours(0, 0, 0, 0);
                const fin = new Date(inicio);
                fin.setDate(inicio.getDate() + 6);
                fin.setHours(23, 59, 59, 999);
                return { semanaInicio: inicio, semanaFin: fin };
            };
            const { semanaInicio, semanaFin } = obtenerRangoSemana(fechaConsulta);
            
            const profesionales = await User.findAll({
                where: {
                    rol: { [Op.in]: ['psicologo', 'becario'] },
                    activo: true
                },
                include: [
                    {
                        model: Disponibilidad,
                        as: 'Disponibilidades',
                        where: {
                            activo: true,
                            fecha_inicio_vigencia: { [Op.lte]: semanaFin },
                            [Op.or]: [
                                { fecha_fin_vigencia: null },
                                { fecha_fin_vigencia: { [Op.gte]: semanaInicio } }
                            ]
                        },
                        required: false
                    }
                ],
                order: [
                    [literal("CASE rol WHEN 'terapeuta' THEN 1 WHEN 'coterapeuta' THEN 2 WHEN 'psicopedagogico' THEN 3 ELSE 4 END"), 'ASC'],
                    ['apellido', 'ASC'],
                    ['nombre', 'ASC']
                ]
            });

            const citasPorPsicologo = await Cita.findAll({
                where: {
                    fecha: fechaConsulta,
                    estado: { [Op.in]: ['programada', 'confirmada'] },
                    psicologo_id: { [Op.ne]: null }
                },
                attributes: ['psicologo_id', [fn('COUNT', col('id')), 'citas_programadas']],
                group: ['psicologo_id']
            });

            const citasPorBecario = await Cita.findAll({
                where: {
                    fecha: fechaConsulta,
                    estado: { [Op.in]: ['programada', 'confirmada'] },
                    becario_id: { [Op.ne]: null }
                },
                attributes: ['becario_id', [fn('COUNT', col('id')), 'citas_programadas']],
                group: ['becario_id']
            });

            const citasMapPsi = citasPorPsicologo.reduce((acc, row) => {
                acc[row.psicologo_id] = parseInt(row.get('citas_programadas'), 10) || 0;
                return acc;
            }, {});

            const citasMapBec = citasPorBecario.reduce((acc, row) => {
                acc[row.becario_id] = parseInt(row.get('citas_programadas'), 10) || 0;
                return acc;
            }, {});

            const disponibilidadDetallada = profesionales.map((prof) => {
                const disponibilidadesSemana = prof.Disponibilidades || [];
                const disponibilidad = disponibilidadesSemana.find(d => d.dia_semana === diaSemana) || null;
                const citasProgramadas = prof.rol === 'coterapeuta'
                    ? (citasMapBec[prof.id] || 0)
                    : (citasMapPsi[prof.id] || 0);

                const maxCitas = disponibilidad ? parseInt(disponibilidad.max_citas_dia, 10) : 8;
                const cuposDisponibles = Math.max(0, maxCitas - citasProgramadas);
                const porcentajeOcupacion = maxCitas > 0 ? Math.round((citasProgramadas / maxCitas) * 100) : 0;

                let estado = 'disponible';
                if (cuposDisponibles === 0) estado = 'completo';
                else if (cuposDisponibles <= 2) estado = 'limitado';

                const horaInicio = disponibilidad?.hora_inicio ? String(disponibilidad.hora_inicio).substring(0, 5) : '09:00';
                const horaFin = disponibilidad?.hora_fin ? String(disponibilidad.hora_fin).substring(0, 5) : '18:00';

                return {
                    id: prof.id,
                    profesional: `${prof.nombre} ${prof.apellido}`,
                    rol: prof.rol,
                    especialidad: prof.especialidad || (prof.rol === 'coterapeuta' ? 'Coterapeuta' : 'Psicología General'),
                    email: prof.email,
                    hora_inicio: horaInicio,
                    hora_fin: horaFin,
                    max_citas_dia: maxCitas,
                    citas_programadas: citasProgramadas,
                    cupos_disponibles: cuposDisponibles,
                    porcentaje_ocupacion: porcentajeOcupacion,
                    estado,
                    intervalo_citas: disponibilidad?.intervalo_citas || 50,
                    tiene_disponibilidad_semana: disponibilidadesSemana.length > 0
                };
            });
            
            // Estadísticas generales
            const totalProfesionales = disponibilidadDetallada.length;
            const totalCupos = disponibilidadDetallada.reduce((sum, p) => sum + p.max_citas_dia, 0);
            const totalCitasProgramadas = disponibilidadDetallada.reduce((sum, p) => sum + p.citas_programadas, 0);
            const totalCuposDisponibles = disponibilidadDetallada.reduce((sum, p) => sum + p.cupos_disponibles, 0);
            const porcentajeTotalOcupacion = totalCupos > 0 ? Math.round((totalCitasProgramadas / totalCupos) * 100) : 0;
            
            console.log(`📊 Estadísticas: ${totalCitasProgramadas}/${totalCupos} citas (${porcentajeTotalOcupacion}% ocupado)`);
            
            res.json({
                success: true,
                data: {
                    fecha: fechaConsulta,
                    dia_semana: diaSemana,
                    disponibilidad: disponibilidadDetallada,
                    total_profesionales: totalProfesionales,
                    estadisticas: {
                        total_cupos: totalCupos,
                        total_citas_programadas: totalCitasProgramadas,
                        total_cupos_disponibles: totalCuposDisponibles,
                        porcentaje_ocupacion_total: porcentajeTotalOcupacion,
                        profesionales_disponibles: disponibilidadDetallada.filter(p => p.estado === 'disponible').length,
                        profesionales_limitados: disponibilidadDetallada.filter(p => p.estado === 'limitado').length,
                        profesionales_completos: disponibilidadDetallada.filter(p => p.estado === 'completo').length
                    }
                }
            });
            
        } catch (error) {
            console.error('❌ Error CRÍTICO en obtenerDisponibilidadProfesionales:', error);
            console.error('Stack trace:', error.stack);
            
            // Respuesta de error controlada
            res.status(500).json({
                success: false,
                message: 'Error al obtener disponibilidad de profesionales',
                error: process.env.NODE_ENV === 'development' ? error.message : 'Error interno del servidor',
                data: {
                    fecha: req.query.fecha || new Date().toISOString().split('T')[0],
                    dia_semana: 'lunes',
                    disponibilidad: [],
                    total_profesionales: 0,
                    estadisticas: {
                        total_cupos: 0,
                        total_citas_programadas: 0,
                        total_cupos_disponibles: 0,
                        porcentaje_ocupacion_total: 0,
                        profesionales_disponibles: 0,
                        profesionales_limitados: 0,
                        profesionales_completos: 0
                    }
                }
            });
        }
    }

    static async obtenerDisponibilidadPorDias(req, res) {
        try {
            const { dia_filtro, dias_filtro } = req.query;
            let diasFiltro = [];

            if (dias_filtro) {
                diasFiltro = String(dias_filtro)
                    .split(',')
                    .map(dia => dia.trim().toLowerCase())
                    .filter(Boolean);
            } else if (dia_filtro) {
                diasFiltro = [String(dia_filtro).trim().toLowerCase()];
            }

            const whereDisponibilidad = { activo: true };

            if (diasFiltro.length > 0) {
                whereDisponibilidad.dia_semana = { [Op.in]: diasFiltro };
            }

            const disponibilidades = await Disponibilidad.findAll({
                where: whereDisponibilidad,
                include: [
                    {
                        model: User,
                        as: 'Usuario',
                        where: { activo: true },
                        required: true
                    }
                ],
                order: [['dia_semana', 'ASC'], ['hora_inicio', 'ASC']]
            });

            const disponibilidadPorDia = {};

            disponibilidades.forEach((disponibilidad) => {
                const dia = disponibilidad.dia_semana;
                if (!disponibilidadPorDia[dia]) disponibilidadPorDia[dia] = [];

                const usuario = disponibilidad.Usuario;
                disponibilidadPorDia[dia].push({
                    id: usuario.id,
                    profesional: `${usuario.nombre} ${usuario.apellido}`,
                    rol: usuario.rol,
                    especialidad: usuario.especialidad || (usuario.rol === 'coterapeuta' ? 'Coterapeuta' : 'Terapia General'),
                    email: usuario.email,
                    telefono: usuario.telefono,
                    hora_inicio: disponibilidad.hora_inicio ? String(disponibilidad.hora_inicio).substring(0, 5) : null,
                    hora_fin: disponibilidad.hora_fin ? String(disponibilidad.hora_fin).substring(0, 5) : null,
                    max_citas_dia: disponibilidad.max_citas_dia,
                    intervalo_citas: disponibilidad.intervalo_citas,
                    tipo_disponibilidad: disponibilidad.tipo_disponibilidad
                });
            });

            res.json({
                success: true,
                data: {
                    dias: diasFiltro.length > 0 ? diasFiltro : Object.keys(disponibilidadPorDia),
                    disponibilidad_por_dia: disponibilidadPorDia
                }
            });
        } catch (error) {
            console.error('Error en obtenerDisponibilidadPorDias:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener disponibilidad por días'
            });
        }
    }

    static async obtenerDisponibilidadPorDias(req, res) {
        try {
            const { dia_filtro, dias_filtro } = req.query;
            let diasFiltro = [];

            if (dias_filtro) {
                diasFiltro = String(dias_filtro)
                    .split(',')
                    .map(dia => dia.trim().toLowerCase())
                    .filter(Boolean);
            } else if (dia_filtro) {
                diasFiltro = [String(dia_filtro).trim().toLowerCase()];
            }

            const whereDisponibilidad = { activo: true };

            if (diasFiltro.length > 0) {
                whereDisponibilidad.dia_semana = { [Op.in]: diasFiltro };
            }

            const disponibilidades = await Disponibilidad.findAll({
                where: whereDisponibilidad,
                include: [
                    {
                        model: User,
                        as: 'Usuario',
                        where: { activo: true },
                        required: true
                    }
                ],
                order: [['dia_semana', 'ASC'], ['hora_inicio', 'ASC']]
            });

            const disponibilidadPorDia = {};

            disponibilidades.forEach((disponibilidad) => {
                const dia = disponibilidad.dia_semana;
                if (!disponibilidadPorDia[dia]) disponibilidadPorDia[dia] = [];

                const usuario = disponibilidad.Usuario;
                disponibilidadPorDia[dia].push({
                    id: usuario.id,
                    profesional: `${usuario.nombre} ${usuario.apellido}`,
                    rol: usuario.rol,
                    especialidad: usuario.especialidad || (usuario.rol === 'coterapeuta' ? 'Coterapeuta' : 'Terapia General'),
                    email: usuario.email,
                    telefono: usuario.telefono,
                    hora_inicio: disponibilidad.hora_inicio ? String(disponibilidad.hora_inicio).substring(0, 5) : null,
                    hora_fin: disponibilidad.hora_fin ? String(disponibilidad.hora_fin).substring(0, 5) : null,
                    max_citas_dia: disponibilidad.max_citas_dia,
                    intervalo_citas: disponibilidad.intervalo_citas,
                    tipo_disponibilidad: disponibilidad.tipo_disponibilidad
                });
            });

            res.json({
                success: true,
                data: {
                    dias: diasFiltro.length > 0 ? diasFiltro : Object.keys(disponibilidadPorDia),
                    disponibilidad_por_dia: disponibilidadPorDia
                }
            });
        } catch (error) {
            console.error('Error en obtenerDisponibilidadPorDias:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener disponibilidad por días'
            });
        }
    }

    // Método auxiliar para obtener día de la semana
    static obtenerDiaSemana(fecha) {
        try {
            const fechaObj = new Date(fecha);
            const dias = ['domingo', 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado'];
            return dias[fechaObj.getDay()];
        } catch (error) {
            return 'lunes'; // Valor por defecto
        }
    }
    
    static construirWhereSQL(whereClause) {
        const condiciones = [];
        
        for (const [key, value] of Object.entries(whereClause)) {
            if (typeof value === 'object' && value[Op.between]) {
                condiciones.push(`${key} BETWEEN '${value[Op.between][0]}' AND '${value[Op.between][1]}'`);
            } else if (typeof value === 'object' && value[Op.gte]) {
                condiciones.push(`${key} >= '${value[Op.gte]}'`);
            } else if (typeof value === 'object' && value[Op.lte]) {
                condiciones.push(`${key} <= '${value[Op.lte]}'`);
            } else {
                condiciones.push(`${key} = ${typeof value === 'string' ? `'${value}'` : value}`);
            }
        }
        
        return condiciones.join(' AND ');
    }
    
}

module.exports = AgendaController;