const express = require('express');
const router = express.Router();
const NotificacionController = require('../controllers/notificacionController');
const verifyToken = require('../middlewares/authMiddleware');

// Todas las rutas requieren autenticación
router.use(verifyToken);

// Obtener notificaciones del usuario
router.get('/', NotificacionController.obtenerMisNotificaciones);
router.get('/recientes', NotificacionController.obtenerNotificacionesRecientes);

// Marcar notificaciones como leídas
router.put('/:id/leer', NotificacionController.marcarComoLeido);
router.put('/leer-todas', NotificacionController.marcarTodasComoLeidas);

// Crear notificación (solo coordinadores)
router.post('/', verifyToken, NotificacionController.crearNotificacion);

// Eliminar notificación
router.delete('/:id', NotificacionController.eliminarNotificacion);

module.exports = router;