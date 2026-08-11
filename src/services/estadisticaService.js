const { QueryTypes } = require('sequelize');
const sequelize = require('../config/db');

class EstadisticaService {
    
    static async calcularEstadisticasGenerales(periodo = 'mes') {
        try {
            let intervalo;
            switch (periodo) {
                case 'semana':
                    intervalo = 'INTERVAL 7 DAY';
                    break;
                case 'mes':
                    intervalo = 'INTERVAL 30 DAY';
                    break;
                case 'trimestre':
                    intervalo = 'INTERVAL 90 DAY';
                    break;
                case 'año':
                    intervalo = 'INTERVAL 365 DAY';
                    break;
                default:
                    intervalo = 'INTERVAL 30 DAY';
            }
            
            const [estadisticas] = await sequelize.query(`
                SELECT 
                    -- Pacientes
                    (SELECT COUNT(*) FROM pacientes WHERE created_at >= DATE_SUB(CURDATE(), ${intervalo})) as nuevos_pacientes,
                    (SELECT COUNT(*) FROM pacientes WHERE activo = TRUE) as pacientes_activos,
                    (SELECT COUNT(*) FROM pacientes WHERE activo = FALSE) as pacientes_inactivos,
                    
                    -- Citas
                    (SELECT COUNT(*) FROM citas WHERE fecha >= DATE_SUB(CURDATE(), ${intervalo})) as total_citas,
                    (SELECT COUNT(*) FROM citas WHERE fecha >= DATE_SUB(CURDATE(), ${intervalo}) AND estado = 'completada') as citas_completadas,
                    (SELECT COUNT(*) FROM citas WHERE fecha >= DATE_SUB(CURDATE(), ${intervalo}) AND estado = 'cancelada') as citas_canceladas,
                    
                    -- Tasa de asistencia
                    ROUND(
                        (SELECT COUNT(*) FROM citas WHERE fecha >= DATE_SUB(CURDATE(), ${intervalo}) AND estado = 'completada') * 100.0 / 
                        NULLIF((SELECT COUNT(*) FROM citas WHERE fecha >= DATE_SUB(CURDATE(), ${intervalo}) AND estado IN ('programada', 'confirmada', 'completada')), 0),
                        2
                    ) as tasa_asistencia,
                    
                    -- Profesionales
                    (SELECT COUNT(*) FROM users WHERE rol = 'psicologo' AND activo = TRUE) as psicologos_activos,
                    (SELECT COUNT(*) FROM users WHERE rol = 'becario' AND activo = TRUE) as becarios_activos,
                    
                    -- Sesiones registradas
                    (SELECT COUNT(*) FROM sesiones s 
                     JOIN citas c ON s.cita_id = c.id 
                     WHERE c.fecha >= DATE_SUB(CURDATE(), ${intervalo})) as sesiones_registradas,
                    
                    -- Altas
                    (SELECT COUNT(*) FROM altas WHERE fecha_alta >= DATE_SUB(CURDATE(), ${intervalo})) as altas_realizadas,
                    
                    -- Observaciones
                    (SELECT COUNT(*) FROM observaciones_becarios WHERE fecha >= DATE_SUB(CURDATE(), ${intervalo})) as observaciones_realizadas
            `, { type: QueryTypes.SELECT });
            
            return estadisticas;
            
        } catch (error) {
            console.error('Error en calcularEstadisticasGenerales:', error);
            throw error;
        }
    }
    
    static async calcularEstadisticasPsicologo(psicologoId, fechaInicio, fechaFin) {
        try {
            const [estadisticas] = await sequelize.query(`
                SELECT 
                    u.id,
                    CONCAT(u.nombre, ' ', u.apellido) as psicologo,
                    
                    -- Citas
                    COUNT(c.id) as total_citas,
                    SUM(CASE WHEN c.estado = 'completada' THEN 1 ELSE 0 END) as citas_completadas,
                    SUM(CASE WHEN c.estado = 'cancelada' THEN 1 ELSE 0 END) as citas_canceladas,
                    ROUND(SUM(CASE WHEN c.estado = 'completada' THEN 1 ELSE 0 END) * 100.0 / COUNT(c.id), 2) as tasa_completitud,
                    
                    -- Pacientes
                    COUNT(DISTINCT c.paciente_id) as pacientes_unicos,
                    COUNT(DISTINCT a.becario_id) as becarios_supervisados,
                    
                    -- Tiempo
                    ROUND(AVG(c.duracion_minutos), 1) as duracion_promedio,
                    SUM(c.duracion_minutos) / 60.0 as horas_total,
                    
                    -- Sesiones registradas
                    COUNT(s.id) as sesiones_registradas,
                    
                    -- Observaciones
                    COUNT(ob.id) as observaciones_realizadas,
                    ROUND(AVG(ob.calificacion), 2) as promedio_calificacion_observaciones,
                    
                    -- Altas
                    COUNT(al.id) as altas_realizadas
                    
                FROM users u
                LEFT JOIN citas c ON u.id = c.psicologo_id 
                    AND c.fecha BETWEEN ? AND ?
                LEFT JOIN sesiones s ON c.id = s.cita_id
                LEFT JOIN asignaciones a ON u.id = a.psicologo_id AND a.estado = 'activa'
                LEFT JOIN observaciones_becarios ob ON u.id = ob.supervisor_id
                    AND ob.fecha BETWEEN ? AND ?
                LEFT JOIN altas al ON u.id = al.usuario_id
                    AND al.fecha_alta BETWEEN ? AND ?
                WHERE u.id = ?
                GROUP BY u.id, u.nombre, u.apellido
            `, {
                replacements: [fechaInicio, fechaFin, fechaInicio, fechaFin, fechaInicio, fechaFin, psicologoId],
                type: QueryTypes.SELECT
            });
            
            return estadisticas;
            
        } catch (error) {
            console.error('Error en calcularEstadisticasPsicologo:', error);
            throw error;
        }
    }
    
    static async calcularEstadisticasBecario(becarioId, fechaInicio, fechaFin) {
        try {
            const [estadisticas] = await sequelize.query(`
                SELECT 
                    u.id,
                    CONCAT(u.nombre, ' ', u.apellido) as becario,
                    
                    -- Citas
                    COUNT(c.id) as total_citas,
                    SUM(CASE WHEN c.estado = 'completada' THEN 1 ELSE 0 END) as citas_completadas,
                    SUM(CASE WHEN c.estado = 'cancelada' THEN 1 ELSE 0 END) as citas_canceladas,
                    ROUND(SUM(CASE WHEN c.estado = 'completada' THEN 1 ELSE 0 END) * 100.0 / COUNT(c.id), 2) as tasa_completitud,
                    
                    -- Pacientes
                    COUNT(DISTINCT c.paciente_id) as pacientes_unicos,
                    
                    -- Observaciones recibidas
                    COUNT(ob.id) as observaciones_recibidas,
                    ROUND(AVG(ob.calificacion), 2) as promedio_calificacion,
                    MIN(ob.calificacion) as calificacion_minima,
                    MAX(ob.calificacion) as calificacion_maxima,
                    
                    -- Tiempo entre citas
                    ROUND(AVG(
                        DATEDIFF(
                            (SELECT MIN(c2.fecha) FROM citas c2 
                             WHERE c2.becario_id = c.becario_id 
                             AND c2.paciente_id = c.paciente_id 
                             AND c2.id > c.id),
                            c.fecha
                        )
                    ), 1) as dias_promedio_entre_citas
                    
                FROM users u
                LEFT JOIN citas c ON u.id = c.becario_id 
                    AND c.fecha BETWEEN ? AND ?
                LEFT JOIN observaciones_becarios ob ON u.id = ob.becario_id
                    AND ob.fecha BETWEEN ? AND ?
                WHERE u.id = ?
                GROUP BY u.id, u.nombre, u.apellido
            `, {
                replacements: [becarioId, fechaInicio, fechaFin, fechaInicio, fechaFin],
                type: QueryTypes.SELECT
            });
            
            return estadisticas;
            
        } catch (error) {
            console.error('Error en calcularEstadisticasBecario:', error);
            throw error;
        }
    }
    
    static async calcularTendenciasMensuales(meses = 6) {
        try {
            const tendencias = await sequelize.query(`
                SELECT 
                    DATE_FORMAT(fecha, '%Y-%m') as mes,
                    COUNT(*) as total_citas,
                    SUM(CASE WHEN estado = 'completada' THEN 1 ELSE 0 END) as citas_completadas,
                    SUM(CASE WHEN estado = 'cancelada' THEN 1 ELSE 0 END) as citas_canceladas,
                    COUNT(DISTINCT paciente_id) as pacientes_unicos,
                    COUNT(DISTINCT psicologo_id) as psicologos_activos,
                    COUNT(DISTINCT becario_id) as becarios_activos,
                    (SELECT COUNT(*) FROM altas WHERE DATE_FORMAT(fecha_alta, '%Y-%m') = DATE_FORMAT(c.fecha, '%Y-%m')) as altas_realizadas,
                    ROUND(SUM(CASE WHEN estado = 'completada' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as tasa_completitud
                FROM citas c
                WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL ? MONTH)
                GROUP BY DATE_FORMAT(fecha, '%Y-%m')
                ORDER BY mes
            `, {
                replacements: [meses],
                type: QueryTypes.SELECT
            });
            
            return tendencias;
            
        } catch (error) {
            console.error('Error en calcularTendenciasMensuales:', error);
            throw error;
        }
    }
    
    static async calcularDistribucionPorGenero() {
        try {
            const distribucion = await sequelize.query(`
                SELECT 
                    COALESCE(genero, 'no especificado') as genero,
                    COUNT(*) as cantidad,
                    ROUND(COUNT(*) * 100.0 / SUM(COUNT(*)) OVER(), 2) as porcentaje
                FROM pacientes
                WHERE activo = TRUE
                GROUP BY genero
                ORDER BY cantidad DESC
            `, { type: QueryTypes.SELECT });
            
            return distribucion;
            
        } catch (error) {
            console.error('Error en calcularDistribucionPorGenero:', error);
            throw error;
        }
    }
    
    static async calcularHorariosMasProductivos() {
        try {
            const horarios = await sequelize.query(`
                SELECT 
                    HOUR(hora) as hora,
                    COUNT(*) as total_citas,
                    SUM(CASE WHEN estado = 'completada' THEN 1 ELSE 0 END) as citas_completadas,
                    ROUND(SUM(CASE WHEN estado = 'completada' THEN 1 ELSE 0 END) * 100.0 / COUNT(*), 2) as tasa_completitud,
                    ROUND(AVG(duracion_minutos), 1) as duracion_promedio
                FROM citas
                WHERE fecha >= DATE_SUB(CURDATE(), INTERVAL 3 MONTH)
                GROUP BY HOUR(hora)
                ORDER BY total_citas DESC
                LIMIT 8
            `, { type: QueryTypes.SELECT });
            
            return horarios;
            
        } catch (error) {
            console.error('Error en calcularHorariosMasProductivos:', error);
            throw error;
        }
    }
    
    static async calcularMetricasEficiencia() {
        try {
            const [metricas] = await sequelize.query(`
                SELECT 
                    -- Tiempo promedio entre primera y última cita por paciente
                    ROUND(AVG(DATEDIFF(
                        ultima_cita.ultima,
                        primera_cita.primera
                    )), 1) as dias_tratamiento_promedio,
                    
                    -- Citas promedio por paciente
                    ROUND(AVG(total_citas.total), 1) as citas_promedio_por_paciente,
                    
                    -- Tasa de retención (pacientes con más de 1 cita)
                    ROUND(
                        COUNT(DISTINCT CASE WHEN total_citas.total > 1 THEN total_citas.paciente_id END) * 100.0 / 
                        COUNT(DISTINCT total_citas.paciente_id),
                        2
                    ) as tasa_retencion,
                    
                    -- Tiempo promedio para primera cita después del registro
                    ROUND(AVG(DATEDIFF(
                        primera_cita.primera,
                        p.created_at
                    )), 1) as dias_para_primera_cita
                    
                FROM pacientes p
                LEFT JOIN (
                    SELECT paciente_id, MIN(fecha) as primera
                    FROM citas 
                    WHERE estado = 'completada'
                    GROUP BY paciente_id
                ) primera_cita ON p.id = primera_cita.paciente_id
                LEFT JOIN (
                    SELECT paciente_id, MAX(fecha) as ultima
                    FROM citas 
                    WHERE estado = 'completada'
                    GROUP BY paciente_id
                ) ultima_cita ON p.id = ultima_cita.paciente_id
                LEFT JOIN (
                    SELECT paciente_id, COUNT(*) as total
                    FROM citas 
                    WHERE estado = 'completada'
                    GROUP BY paciente_id
                ) total_citas ON p.id = total_citas.paciente_id
                WHERE p.activo = TRUE
            `, { type: QueryTypes.SELECT });
            
            return metricas;
            
        } catch (error) {
            console.error('Error en calcularMetricasEficiencia:', error);
            throw error;
        }
    }
    
    static async calcularSatisfaccionBecarios() {
        try {
            const satisfaccion = await sequelize.query(`
                SELECT 
                    u.id,
                    CONCAT(u.nombre, ' ', u.apellido) as becario,
                    COUNT(ob.id) as total_observaciones,
                    ROUND(AVG(ob.calificacion), 2) as promedio_calificacion,
                    ROUND(STDDEV(ob.calificacion), 2) as desviacion_estandar,
                    MIN(ob.calificacion) as calificacion_minima,
                    MAX(ob.calificacion) as calificacion_maxima,
                    COUNT(DISTINCT ob.aspecto_evaluado) as aspectos_evaluados,
                    (SELECT CONCAT(sup.nombre, ' ', sup.apellido) 
                     FROM asignaciones a 
                     JOIN users sup ON a.psicologo_id = sup.id 
                     WHERE a.becario_id = u.id AND a.estado = 'activa' LIMIT 1) as supervisor
                FROM users u
                LEFT JOIN observaciones_becarios ob ON u.id = ob.becario_id
                WHERE u.rol = 'becario' AND u.activo = TRUE
                GROUP BY u.id, u.nombre, u.apellido
                ORDER BY promedio_calificacion DESC
            `, { type: QueryTypes.SELECT });
            
            return satisfaccion;
            
        } catch (error) {
            console.error('Error en calcularSatisfaccionBecarios:', error);
            throw error;
        }
    }
    
    static async predecirDemanda(fechaInicio, fechaFin) {
        try {
            // Análisis histórico para predecir demanda
            const prediccion = await sequelize.query(`
                SELECT 
                    -- Por día de la semana
                    DAYNAME(fecha) as dia_semana,
                    COUNT(*) as historico_total,
                    ROUND(AVG(COUNT(*)) OVER(), 0) as promedio_diario,
                    
                    -- Por hora
                    HOUR(hora) as hora_dia,
                    COUNT(*) as citas_por_hora,
                    
                    -- Por psicólogo
                    psicologo_id,
                    COUNT(*) as citas_psicologo
                    
                FROM citas
                WHERE fecha BETWEEN ? AND ?
                AND estado IN ('programada', 'confirmada', 'completada')
                GROUP BY DAYNAME(fecha), HOUR(hora), psicologo_id
                ORDER BY dia_semana, hora_dia
            `, {
                replacements: [fechaInicio, fechaFin],
                type: QueryTypes.SELECT
            });
            
            return prediccion;
            
        } catch (error) {
            console.error('Error en predecirDemanda:', error);
            throw error;
        }
    }
    
    static async generarReporteComparativo(periodo, tipoComparacion) {
        try {
            let query;
            
            switch (tipoComparacion) {
                case 'psicologos':
                    query = `
                        SELECT 
                            u.id,
                            CONCAT(u.nombre, ' ', u.apellido) as profesional,
                            'psicologo' as tipo,
                            COUNT(c.id) as total_citas,
                            SUM(CASE WHEN c.estado = 'completada' THEN 1 ELSE 0 END) as citas_completadas,
                            ROUND(AVG(c.duracion_minutos), 1) as duracion_promedio,
                            COUNT(DISTINCT c.paciente_id) as pacientes_unicos
                        FROM users u
                        LEFT JOIN citas c ON u.id = c.psicologo_id
                            AND c.fecha >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
                        WHERE u.rol = 'psicologo' AND u.activo = TRUE
                        GROUP BY u.id, u.nombre, u.apellido
                        ORDER BY citas_completadas DESC
                    `;
                    break;
                    
                case 'becarios':
                    query = `
                        SELECT 
                            u.id,
                            CONCAT(u.nombre, ' ', u.apellido) as profesional,
                            'becario' as tipo,
                            COUNT(c.id) as total_citas,
                            SUM(CASE WHEN c.estado = 'completada' THEN 1 ELSE 0 END) as citas_completadas,
                            ROUND(AVG(ob.calificacion), 2) as promedio_calificacion,
                            COUNT(DISTINCT c.paciente_id) as pacientes_unicos
                        FROM users u
                        LEFT JOIN citas c ON u.id = c.becario_id
                            AND c.fecha >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
                        LEFT JOIN observaciones_becarios ob ON u.id = ob.becario_id
                            AND ob.fecha >= DATE_SUB(CURDATE(), INTERVAL ? DAY)
                        WHERE u.rol = 'becario' AND u.activo = TRUE
                        GROUP BY u.id, u.nombre, u.apellido
                        ORDER BY citas_completadas DESC
                    `;
                    break;
                    
                default:
                    throw new Error('Tipo de comparación no válido');
            }
            
            const resultados = await sequelize.query(query, {
                replacements: [periodo, periodo],
                type: QueryTypes.SELECT
            });
            
            return resultados;
            
        } catch (error) {
            console.error('Error en generarReporteComparativo:', error);
            throw error;
        }
    }
}

module.exports = EstadisticaService;