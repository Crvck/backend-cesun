const express = require('express');
const router = express.Router();
const CitaController = require('../controllers/citaController');
const verifyToken = require('../middlewares/authMiddleware');

// Todas las rutas requieren autenticación
router.use(verifyToken);

// Rutas de consulta
router.get('/citas-por-fecha', CitaController.obtenerCitasPorFecha);
router.get('/cita/:id', CitaController.obtenerCitaPorId);
router.get('/paciente/:paciente_id', CitaController.obtenerCitasPorPaciente);
router.get('/reporte-mensual', CitaController.generarReporteMensual);
router.get('/estadisticas', CitaController.obtenerEstadisticas);

// Rutas de modificación
router.post('/alta-paciente', CitaController.darAltaPaciente);
router.put('/cancelar-futuras/:paciente_id', CitaController.cancelarCitasFuturasPaciente);
router.put('/cita/:id', CitaController.actualizarCita);
router.post('/nueva', CitaController.crearNuevaCita);

module.exports = router;