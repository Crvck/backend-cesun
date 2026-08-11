const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/authMiddleware');
const RoleController = require('../controllers/roleController');

// Todas las rutas requieren autenticación
router.use(verifyToken);

// Obtener permisos del usuario actual
router.get('/my-permissions', RoleController.getMyPermissions);

// Obtener información específica del rol
router.get('/my-role-info', RoleController.getUserRoleInfo);

// Verificar permiso específico
router.get('/check-permission/:permission', RoleController.checkPermission);

module.exports = router;