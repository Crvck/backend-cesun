const express = require('express');
const router = express.Router();
const preregistroController = require('../controllers/preregistroController');

// Definimos la ruta POST para /api/preregistro
router.post('/', preregistroController.crearSolicitud);

module.exports = router;