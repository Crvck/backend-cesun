const express = require('express');
const router = express.Router();
const RecordatorioController = require('../controllers/recordatorioController');
const verifyToken = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

router.use(verifyToken);

router.get('/configuracion', requireRole(['coordinador']), RecordatorioController.obtenerConfiguracion);
router.put('/configuracion', requireRole(['coordinador']), RecordatorioController.actualizarConfiguracion);
router.post('/enviar', requireRole(['coordinador']), RecordatorioController.enviarRecordatorios);

module.exports = router;
