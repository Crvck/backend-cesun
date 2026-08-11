const express = require('express');
const router = express.Router();
const PsicopedagogicoController = require('../controllers/psicopedagogicoController');
const verifyToken = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

router.use(verifyToken);

router.get('/paciente/:paciente_id', requireRole(['psicopedagogico', 'coordinador']), PsicopedagogicoController.obtenerPerfil);
router.put('/paciente/:paciente_id/diagnostico', requireRole(['psicopedagogico', 'coordinador']), PsicopedagogicoController.guardarDiagnostico);
router.post('/paciente/:paciente_id/evoluciones', requireRole(['psicopedagogico', 'coordinador']), PsicopedagogicoController.agregarEvolucion);

module.exports = router;
