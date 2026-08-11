const express = require('express');
const router = express.Router();
const AsignacionController = require('../controllers/asignacionController');
const verifyToken = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

// Todas las rutas requieren autenticación
router.use(verifyToken);

// Rutas para coordinadores
router.post('/', requireRole(['coordinador']), AsignacionController.crearAsignacion);
router.get('/', requireRole(['coordinador']), AsignacionController.obtenerAsignacionesActivas);
router.put('/:id/finalizar', requireRole(['coordinador', 'terapeuta']), AsignacionController.finalizarAsignacion);
router.get('/paciente/:paciente_id/historial', requireRole(['coordinador', 'terapeuta']), AsignacionController.obtenerHistorialAsignaciones);
router.post('/becarios/:id/horas', requireRole(['coordinador', 'terapeuta']), AsignacionController.registrarHorasBecario);

// Rutas para terapeutas y coterapeutas
router.get('/mis-pacientes', requireRole(['terapeuta', 'coterapeuta']), AsignacionController.obtenerMisPacientes);
router.get('/mis-becarios', requireRole(['terapeuta']), AsignacionController.obtenerMisBecarios);

module.exports = router;