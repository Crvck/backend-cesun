const express = require('express');
const router = express.Router();
const ExpedienteController = require('../controllers/expedienteController');
const verifyToken = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

// Todas las rutas requieren autenticación
router.use(verifyToken);

// Obtener expedientes
router.get('/paciente/:paciente_id/completo', requireRole(['terapeuta', 'coterapeuta', 'psicopedagogico', 'coordinador']), ExpedienteController.obtenerExpedienteCompleto);
router.get('/paciente/:paciente_id/resumen', requireRole(['terapeuta', 'coterapeuta', 'psicopedagogico', 'coordinador']), ExpedienteController.obtenerResumenExpediente);

// Crear y actualizar expedientes
router.post('/paciente/:paciente_id', requireRole(['terapeuta', 'coordinador']), ExpedienteController.crearExpediente);
router.put('/paciente/:paciente_id', requireRole(['terapeuta', 'coordinador']), ExpedienteController.actualizarExpediente);

// Notas confidenciales
router.post('/paciente/:paciente_id/nota-confidencial', requireRole(['terapeuta', 'coordinador']), ExpedienteController.agregarNotaConfidencial);

module.exports = router;