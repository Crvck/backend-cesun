// backend/src/controllers/reporteController.js - Añade este método
const { Parser } = require('json2csv');
const fs = require('fs');
const path = require('path');
const Cita = require('../models/citaModel');
const Paciente = require('../models/pacienteModel');
const User = require('../models/userModel');
const Disponibilidad = require('../models/disponibilidadModel');
const Sesion = require('../models/sesionModel');
const { Op, fn, col, QueryTypes } = require('sequelize');

class ReporteController {
    // Método para exportar agenda a CSV
    static async exportarAgendaCSV(req, res) {
        try {
            const { 
                fecha_inicio, 
                fecha_fin, 
                psicologo_id, 
                tipo_consulta 
            } = req.body;

            // Construir condiciones de filtro
            const whereClause = {};
            
            if (fecha_inicio && fecha_fin) {
                whereClause.fecha = {
                    [Op.between]: [fecha_inicio, fecha_fin]
                };
            }
            
            if (psicologo_id) whereClause.psicologo_id = psicologo_id;
            if (tipo_consulta) whereClause.tipo_consulta = tipo_consulta;

            // Obtener citas con información relacionada
            const citas = await Cita.findAll({
                where: whereClause,
                include: [
                    {
                        model: Paciente,
                        attributes: ['nombre', 'apellido', 'telefono', 'email']
                    },
                    {
                        model: User,
                        as: 'Psicologo',
                        attributes: ['nombre', 'apellido', 'especialidad']
                    },
                    {
                        model: User,
                        as: 'Becario',
                        attributes: ['nombre', 'apellido']
                    }
                ],
                order: [
                    ['fecha', 'ASC'],
                    ['hora', 'ASC']
                ]
            });

            // Preparar datos para CSV
            const datosCSV = citas.map(cita => ({
                Fecha: cita.fecha,
                Hora: cita.hora,
                'Duración (min)': cita.duracion,
                Paciente: cita.Paciente ? `${cita.Paciente.nombre} ${cita.Paciente.apellido}` : '',
                'Teléfono Paciente': cita.Paciente?.telefono || '',
                'Email Paciente': cita.Paciente?.email || '',
                Psicólogo: cita.Psicologo ? `${cita.Psicologo.nombre} ${cita.Psicologo.apellido}` : '',
                Especialidad: cita.Psicologo?.especialidad || '',
                Becario: cita.Becario ? `${cita.Becario.nombre} ${cita.Becario.apellido}` : '',
                'Tipo Consulta': cita.tipo_consulta === 'presencial' ? 'Presencial' : 'Virtual',
                Estado: cita.estado,
                Notas: cita.notas || '',
                'Motivo Cancelación': cita.motivo_cancelacion || ''
            }));

            // Convertir a CSV
            const json2csvParser = new Parser();
            const csv = json2csvParser.parse(datosCSV);

            // Crear nombre de archivo
            const fechaActual = new Date().toISOString().split('T')[0];
            const nombreArchivo = `agenda_${fecha_inicio || fechaActual}_a_${fecha_fin || fechaActual}.csv`;

            // Configurar headers para descarga
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="${nombreArchivo}"`);
            
            res.send(csv);

        } catch (error) {
            console.error('Error exportando agenda a CSV:', error);
            res.status(500).json({
                success: false,
                message: 'Error al exportar agenda',
                error: error.message
            });
        }
    }

    // Método para exportar disponibilidad a CSV
    static async exportarDisponibilidadCSV(req, res) {
        try {
            const { fecha } = req.body;
            const fechaConsulta = fecha || new Date().toISOString().split('T')[0];
            
            // Consulta de disponibilidad
            const profesionales = await User.findAll({
                where: {
                    rol: { [Op.in]: ['psicologo', 'becario'] },
                    activo: true
                },
                include: [
                    {
                        model: Disponibilidad,
                        as: 'Disponibilidades',
                        where: { activo: true },
                        required: false
                    }
                ],
                order: [
                    ['rol', 'ASC'],
                    ['apellido', 'ASC'],
                    ['nombre', 'ASC'],
                    [{ model: Disponibilidad, as: 'Disponibilidades' }, 'dia_semana', 'ASC']
                ]
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

            const disponibilidad = [];
            profesionales.forEach((prof) => {
                const dispList = prof.Disponibilidades || [];
                if (dispList.length === 0) {
                    disponibilidad.push({
                        profesional: `${prof.nombre} ${prof.apellido}`,
                        rol: prof.rol,
                        especialidad: prof.especialidad,
                        dia_semana: '',
                        hora_inicio: '',
                        hora_fin: '',
                        max_citas_dia: null,
                        citas_programadas: citasMap[prof.id] || 0
                    });
                } else {
                    dispList.forEach((d) => {
                        const horaInicio = typeof d.hora_inicio === 'string' ? d.hora_inicio.substring(0, 5) : d.hora_inicio;
                        const horaFin = typeof d.hora_fin === 'string' ? d.hora_fin.substring(0, 5) : d.hora_fin;
                        disponibilidad.push({
                            profesional: `${prof.nombre} ${prof.apellido}`,
                            rol: prof.rol,
                            especialidad: prof.especialidad,
                            dia_semana: d.dia_semana,
                            hora_inicio: horaInicio,
                            hora_fin: horaFin,
                            max_citas_dia: d.max_citas_dia,
                            citas_programadas: citasMap[prof.id] || 0
                        });
                    });
                }
            });

            // Preparar datos para CSV
            const datosCSV = disponibilidad.map(item => ({
                Profesional: item.profesional,
                Rol: item.rol,
                Especialidad: item.especialidad || '',
                'Día Semana': item.dia_semana || '',
                'Hora Inicio': item.hora_inicio || '',
                'Hora Fin': item.hora_fin || '',
                'Máx. Citas/Día': item.max_citas_dia || 8,
                'Citas Programadas': item.citas_programadas || 0,
                'Disponibilidad': item.citas_programadas >= (item.max_citas_dia || 8) ? 'Completo' : 'Disponible'
            }));

            // Convertir a CSV
            const json2csvParser = new Parser();
            const csv = json2csvParser.parse(datosCSV);

            // Configurar headers para descarga
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="disponibilidad_${fechaConsulta}.csv"`);
            
            res.send(csv);

        } catch (error) {
            console.error('Error exportando disponibilidad a CSV:', error);
            res.status(500).json({
                success: false,
                message: 'Error al exportar disponibilidad',
                error: error.message
            });
        }
    }

    static async generarReporteConflictos(req, res) {
        try {
            const { fecha_inicio, fecha_fin } = req.body;

            // Buscar citas solapadas
            const whereCitas = {
                estado: { [Op.in]: ['programada', 'confirmada'] }
            };
            if (fecha_inicio && fecha_fin) {
                whereCitas.fecha = { [Op.between]: [fecha_inicio, fecha_fin] };
            }

            const citas = await Cita.findAll({
                where: whereCitas,
                include: [
                    { model: Paciente, attributes: ['id', 'nombre', 'apellido'] },
                    { model: User, as: 'Psicologo', attributes: ['id', 'nombre', 'apellido'] }
                ],
                order: [['fecha', 'ASC'], ['hora', 'ASC']]
            });

            const toMinutes = (hora) => {
                if (!hora) return 0;
                const [h, m] = hora.split(':').map(Number);
                return h * 60 + (m || 0);
            };

            const conflictos = [];
            const grupos = citas.reduce((acc, cita) => {
                const key = `${cita.psicologo_id}-${cita.fecha}`;
                if (!acc[key]) acc[key] = [];
                acc[key].push(cita);
                return acc;
            }, {});

            Object.values(grupos).forEach((grupo) => {
                for (let i = 0; i < grupo.length; i++) {
                    const c1 = grupo[i];
                    const c1Inicio = toMinutes(c1.hora);
                    const c1Fin = c1Inicio + (c1.duracion || 50);

                    for (let j = i + 1; j < grupo.length; j++) {
                        const c2 = grupo[j];
                        const c2Inicio = toMinutes(c2.hora);
                        const c2Fin = c2Inicio + (c2.duracion || 50);

                        const haySolape = c1Inicio < c2Fin && c2Inicio < c1Fin;
                        if (!haySolape) continue;

                        conflictos.push({
                            cita1_id: c1.id,
                            paciente1_id: c1.paciente_id,
                            paciente1_nombre: c1.Paciente?.nombre,
                            paciente1_apellido: c1.Paciente?.apellido,
                            psicologo1_id: c1.psicologo_id,
                            psicologo1_nombre: c1.Psicologo?.nombre,
                            psicologo1_apellido: c1.Psicologo?.apellido,
                            fecha_conflicto: c1.fecha,
                            hora_inicio1: c1.hora,
                            hora_fin1: `${String(Math.floor(c1Fin / 60)).padStart(2, '0')}:${String(c1Fin % 60).padStart(2, '0')}`,
                            cita2_id: c2.id,
                            paciente2_id: c2.paciente_id,
                            paciente2_nombre: c2.Paciente?.nombre,
                            paciente2_apellido: c2.Paciente?.apellido,
                            psicologo2_id: c2.psicologo_id,
                            psicologo2_nombre: c2.Psicologo?.nombre,
                            psicologo2_apellido: c2.Psicologo?.apellido,
                            hora_inicio2: c2.hora,
                            hora_fin2: `${String(Math.floor(c2Fin / 60)).padStart(2, '0')}:${String(c2Fin % 60).padStart(2, '0')}`
                        });
                    }
                }
            });

            res.json({
                success: true,
                data: {
                    conflictos,
                    total_conflictos: conflictos.length,
                    periodo: fecha_inicio && fecha_fin ? `${fecha_inicio} a ${fecha_fin}` : 'Todo el período'
                }
            });

        } catch (error) {
            console.error('Error generando reporte de conflictos:', error);
            res.status(500).json({
                success: false,
                message: 'Error al generar reporte de conflictos',
                error: error.message
            });
        }
    }

    // Guardar un reporte generado (recibe base64 para el archivo y metadatos)
    static async guardarReporte(req, res) {
        try {
            const { nombre, tipo, fecha, generado_por, archivo_base64, archivo_ext = 'docx' } = req.body;
            if (!archivo_base64) {
                return res.status(400).json({ success: false, message: 'No se recibió archivo' });
            }

            const buffer = Buffer.from(archivo_base64, 'base64');
            const timestamp = Date.now();
            const filename = `reporte_${timestamp}.${archivo_ext}`;
            const dir = path.join(__dirname, '..', '..', 'public', 'temp', 'reportes');
            fs.mkdirSync(dir, { recursive: true });
            const filePath = path.join(dir, filename);
            fs.writeFileSync(filePath, buffer);

            const archivoUrl = `/temp/reportes/${filename}`;

            // Responder con la URL y metadatos (no usamos BD por simplicidad)
            res.json({
                success: true,
                data: {
                    archivo_url: archivoUrl,
                    nombre,
                    tipo,
                    fecha,
                    generado_por
                }
            });
        } catch (error) {
            console.error('Error guardando reporte:', error);
            res.status(500).json({ success: false, message: 'Error al guardar reporte', error: error.message });
        }
    }

    // Obtener estadísticas filtradas por tipo de reporte y fechas
    static async obtenerEstadisticasReporte(req, res) {
        try {
            const { 
                tipo_reporte = 'mensual', 
                fecha_inicio = null, 
                fecha_fin = null 
            } = req.body;

            // Valores por defecto
            let estadisticas = {
                pacientes_activos: 0,
                pacientes_nuevos_mes: 0,
                total_citas: 0,
                citas_completadas: 0,
                citas_canceladas: 0,
                citas_pendientes: 0,
                tasa_completitud: 0,
                tasa_cancelacion: 0,
                duracion_promedio: 0,
                total_sesiones: 0,
                pacientes_con_sesiones: 0,
                sesiones_completadas: 0,
                becarios_activos: 0,
                coterapeutas_activos: 0,
                total_citas_becarios: 0,
                total_citas_coterapeutas: 0,
                pacientes_atendidos_becarios: 0,
                pacientes_atendidos_coterapeutas: 0,
                px_atendidos_canalizaciones: 0,
                px_atendidos_crisis: 0,
                altas_totales: 0,
                asignaciones_activas: 0,
                citas_presenciales: 0,
                citas_virtuales: 0,
                motivos_cancelacion: []
            };

            // Consulta simple para estadísticas
            try {
                // Citas
                const whereCitas = {};
                if (fecha_inicio && fecha_fin) {
                    whereCitas.fecha = { [Op.between]: [fecha_inicio, fecha_fin] };
                }

                const [totalCitas, completadas, canceladas, presenciales, virtuales] = await Promise.all([
                    Cita.count({ where: whereCitas }),
                    Cita.count({ where: { ...whereCitas, estado: 'completada' } }),
                    Cita.count({ where: { ...whereCitas, estado: 'cancelada' } }),
                    Cita.count({ where: { ...whereCitas, tipo_consulta: 'presencial' } }),
                    Cita.count({ where: { ...whereCitas, tipo_consulta: 'virtual' } })
                ]);

                estadisticas.total_citas = totalCitas;
                estadisticas.citas_completadas = completadas;
                estadisticas.citas_canceladas = canceladas;
                estadisticas.citas_pendientes = totalCitas - completadas - canceladas;
                estadisticas.citas_presenciales = presenciales;
                estadisticas.citas_virtuales = virtuales;
                
                if (totalCitas > 0) {
                    estadisticas.tasa_completitud = Math.round((completadas / totalCitas) * 100 * 100) / 100;
                    estadisticas.tasa_cancelacion = Math.round((canceladas / totalCitas) * 100 * 100) / 100;
                }

                // Obtener motivos de cancelación agrupados
                const citasCanceladas = await Cita.findAll({
                    where: { 
                        ...whereCitas, 
                        estado: 'cancelada',
                        motivo_cancelacion: { [Op.ne]: null }
                    },
                    attributes: ['motivo_cancelacion'],
                    raw: true
                });

                // Agrupar y contar motivos
                const motivosMap = {};
                citasCanceladas.forEach(cita => {
                    const motivo = cita.motivo_cancelacion || 'Sin especificar';
                    motivosMap[motivo] = (motivosMap[motivo] || 0) + 1;
                });

                // Convertir a array y ordenar por cantidad
                estadisticas.motivos_cancelacion = Object.entries(motivosMap)
                    .map(([motivo, cantidad]) => ({ motivo, cantidad }))
                    .sort((a, b) => b.cantidad - a.cantidad)
                    .slice(0, 10); // Top 10 motivos

                // Duración promedio
                const citasConDuracion = await Cita.findAll({
                    where: { ...whereCitas, duracion: { [Op.ne]: null } },
                    attributes: [[fn('AVG', col('duracion')), 'promedio']],
                    raw: true
                });
                estadisticas.duracion_promedio = Math.round(citasConDuracion[0]?.promedio || 0);

                estadisticas.pacientes_activos = await Paciente.count({ where: { activo: true } });

                const [canalizacionCount, crisisCount] = await Promise.all([
                    Paciente.sequelize.query(`
                        SELECT COUNT(DISTINCT p.id) AS total
                        FROM pacientes p
                        INNER JOIN expedientes e ON p.id = e.paciente_id
                        WHERE p.activo = true
                        AND e.motivo_consulta_especial = 'Por canalizacion'
                    `, { type: QueryTypes.SELECT }),
                    Paciente.sequelize.query(`
                        SELECT COUNT(DISTINCT p.id) AS total
                        FROM pacientes p
                        INNER JOIN expedientes e ON p.id = e.paciente_id
                        WHERE p.activo = true
                        AND e.motivo_consulta_especial = 'Por Crisis'
                    `, { type: QueryTypes.SELECT })
                ]);

                estadisticas.px_atendidos_canalizaciones = parseInt(canalizacionCount?.[0]?.total) || 0;
                estadisticas.px_atendidos_crisis = parseInt(crisisCount?.[0]?.total) || 0;

                if (fecha_inicio && fecha_fin) {
                    estadisticas.pacientes_nuevos_mes = await Paciente.count({
                        where: {
                            activo: true,
                            created_at: { [Op.between]: [fecha_inicio, fecha_fin] }
                        }
                    });
                } else {
                    const hace30 = new Date();
                    hace30.setDate(hace30.getDate() - 30);
                    estadisticas.pacientes_nuevos_mes = await Paciente.count({
                        where: {
                            activo: true,
                            created_at: { [Op.gte]: hace30 }
                        }
                    });
                }

                if (tipo_reporte === 'clinico') {
                    const [totalSesiones, pacientesConSesiones] = await Promise.all([
                        Sesion.count(),
                        Sesion.count({ distinct: true, col: 'paciente_id' })
                    ]);
                    estadisticas.total_sesiones = totalSesiones;
                    estadisticas.pacientes_con_sesiones = pacientesConSesiones;
                    estadisticas.sesiones_completadas = totalSesiones;
                } else if (tipo_reporte === 'becarios' || tipo_reporte === 'coterapeutas') {
                    const rolBuscar = tipo_reporte === 'becarios' ? 'becario' : 'coterapeuta';
                    const activos = await User.count({ where: { rol: rolBuscar, activo: true } });
                    
                    if (tipo_reporte === 'becarios') {
                        estadisticas.becarios_activos = activos;
                    } else {
                        estadisticas.coterapeutas_activos = activos;
                    }
                }

            } catch (err) {
                console.warn('Error en estadísticas detalladas:', err.message);
            }

            res.json({ 
                success: true, 
                data: estadisticas
            });
        } catch (error) {
            console.error('Error obteniendo estadísticas de reporte:', error);
            res.status(500).json({ 
                success: false, 
                message: 'Error al obtener estadísticas', 
                error: error.message 
            });
        }
    }

    // Listar reportes guardados en disco
    static async listarReportes(req, res) {
        try {
            const dir = path.join(__dirname, '..', '..', 'public', 'temp', 'reportes');
            if (!fs.existsSync(dir)) {
                return res.json({ success: true, data: [] });
            }

            const files = fs.readdirSync(dir).filter(f => f.endsWith('.docx'));
            const reportes = files.map(f => {
                const stat = fs.statSync(path.join(dir, f));
                return {
                    nombre: f,
                    archivo_url: `/temp/reportes/${f}`,
                    fecha: new Date(stat.mtime).toISOString(),
                    size: stat.size
                };
            });

            res.json({ success: true, data: reportes });
        } catch (error) {
            console.error('Error listando reportes:', error);
            res.status(500).json({ success: false, message: 'Error al listar reportes', error: error.message });
        }
    }
}

module.exports = ReporteController;