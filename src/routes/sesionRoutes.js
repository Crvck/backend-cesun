const express = require('express');
const router = express.Router();
const SesionController = require('../controllers/sesionController');
const verifyToken = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

// Todas las rutas requieren autenticación
router.use(verifyToken);

// Registrar sesión (terapeutas, coterapeutas, psicopedagógicos y coordinadores)
router.post('/', requireRole(['terapeuta', 'coterapeuta', 'psicopedagogico', 'coordinador']), SesionController.registrarSesion);

// Obtener sesiones por paciente
router.get('/paciente/:paciente_id', requireRole(['terapeuta', 'coterapeuta', 'psicopedagogico', 'coordinador']), SesionController.obtenerSesionesPaciente);
// Obtener sesiones recientes (global)
router.get('/recientes', requireRole(['terapeuta', 'coterapeuta', 'psicopedagogico', 'coordinador']), SesionController.obtenerSesionesRecientes);
// Obtener detalle
router.get('/:id', requireRole(['terapeuta', 'coterapeuta', 'psicopedagogico', 'coordinador']), SesionController.obtenerSesionDetalle);

// Actualizar sesión (solo psicólogo creador o coordinador)
router.put('/:id', requireRole(['terapeuta', 'coordinador']), SesionController.actualizarSesion);

module.exports = router;