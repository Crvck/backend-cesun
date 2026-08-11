const express = require('express');
const router = express.Router();
const DisponibilidadController = require('../controllers/disponibilidadController');
const verifyToken = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

// Todas las rutas requieren autenticación
router.use(verifyToken);

// Gestión de disponibilidad personal
router.post('/', requireRole(['terapeuta', 'coterapeuta']), DisponibilidadController.crearDisponibilidad);
router.get('/mi-disponibilidad', requireRole(['terapeuta', 'coterapeuta']), DisponibilidadController.obtenerMiDisponibilidad);
router.put('/:id', requireRole(['terapeuta', 'coterapeuta']), DisponibilidadController.actualizarDisponibilidad);
router.put('/:id/desactivar', requireRole(['terapeuta', 'coterapeuta']), DisponibilidadController.desactivarDisponibilidad);

// Consulta de disponibilidad
router.get('/usuario/:usuario_id', requireRole(['coordinador', 'terapeuta']), DisponibilidadController.obtenerDisponibilidadUsuario);
router.get('/horarios-disponibles', requireRole(['coordinador', 'terapeuta', 'coterapeuta']), DisponibilidadController.obtenerHorariosDisponibles);

module.exports = router;