const express = require('express');
const router = express.Router();
const ReporteController = require('../controllers/reporteController');
const { QueryTypes } = require('sequelize');
const sequelize = require('../config/db');
const verifyToken = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

// Exportar agenda a CSV
router.post('/exportar-agenda-csv', ReporteController.exportarAgendaCSV);

// Exportar disponibilidad a CSV
router.post('/exportar-disponibilidad-csv', ReporteController.exportarDisponibilidadCSV);

// Obtener estadísticas filtradas para reportes (el usuario ya está autenticado al acceder a la página)
router.post('/estadisticas', ReporteController.obtenerEstadisticasReporte);

// Generar reporte de conflictos
router.post('/reporte-conflictos', ReporteController.generarReporteConflictos);

// Guardar (persistir) un reporte generado (recibe base64 y metadatos)
router.post('/generar', verifyToken, requireRole(['coordinador']), ReporteController.guardarReporte);

// Listar reportes guardados
router.get('/', verifyToken, requireRole(['coordinador']), ReporteController.listarReportes);

router.get('/altas', verifyToken, requireRole(['coordinador']), async (req, res) => {
    try {
        const { formato = 'excel', fecha_inicio, fecha_fin } = req.query;
        
        let query = `
            SELECT 
                a.*,
                CONCAT(p.nombre, ' ', p.apellido) as paciente_nombre,
                p.fecha_inscripcion,
                p.genero,
                p.telefono,
                CONCAT(u.nombre, ' ', u.apellido) as profesional_alta,
                e.motivo_consulta,
                COUNT(DISTINCT c.id) as sesiones_completadas
            FROM altas a
            JOIN pacientes p ON a.paciente_id = p.id
            JOIN users u ON a.usuario_id = u.id
            LEFT JOIN expedientes e ON p.id = e.paciente_id
            LEFT JOIN citas c ON p.id = c.paciente_id AND c.estado = 'completada'
            WHERE 1=1
        `;
        
        const replacements = [];
        
        if (fecha_inicio) {
            query += ` AND a.fecha_alta >= ?`;
            replacements.push(fecha_inicio);
        }
        
        if (fecha_fin) {
            query += ` AND a.fecha_alta <= ?`;
            replacements.push(fecha_fin);
        }
        
        query += ` GROUP BY a.id, p.id, u.id, e.id
                  ORDER BY a.fecha_alta DESC`;
        
        const altas = await sequelize.query(query, {
            replacements,
            type: QueryTypes.SELECT
        });
        
        // Para una implementación real, aquí generarías el archivo Excel/PDF
        // Por ahora, simulamos la URL
        const archivoUrl = `/temp/reporte-altas-${Date.now()}.${formato}`;
        
        res.json({
            success: true,
            data: {
                archivo_url: archivoUrl,
                total_registros: altas.length,
                fecha_generacion: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('Error generando reporte de altas:', error);
        res.status(500).json({
            success: false,
            message: 'Error al generar reporte de altas'
        });
    }
});
module.exports = router;