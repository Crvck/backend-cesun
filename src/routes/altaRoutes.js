const express = require('express');
const router = express.Router();
const AltaController = require('../controllers/altaController');
const verifyToken = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

// Todas las rutas requieren autenticación
router.use(verifyToken);

// Rutas específicas primero (antes de las genéricas con :id)
// Psicólogo propone un paciente para alta
router.post('/proponer/:paciente_id', requireRole(['terapeuta']), AltaController.proponerAlta);

// Coordinador procesa propuesta (aprueba/rechaza)
router.put('/:id/procesar', requireRole(['coordinador']), AltaController.procesarPropuesta);

// Obtener estadísticas
router.get('/estadisticas', requireRole(['coordinador']), AltaController.obtenerEstadisticasAltas);

// Dar de alta paciente (ruta heredada, se mantiene)
router.post('/', requireRole(['terapeuta', 'coordinador']), AltaController.darAltaPaciente);

// Obtener altas
router.get('/', requireRole(['coordinador', 'terapeuta']), AltaController.obtenerAltas);

// Obtener detalle de alta (última, porque :id puede coincidir con todo)
router.get('/:id', requireRole(['coordinador', 'terapeuta']), AltaController.obtenerAltaDetalle);

module.exports = router;