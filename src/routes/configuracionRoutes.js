const express = require('express');
const ConfiguracionController = require('../controllers/configuracionController');

const router = express.Router();

router.get('/', ConfiguracionController.obtenerTodas);
router.get('/:categoria', ConfiguracionController.obtenerPorCategoria);
router.put('/', ConfiguracionController.actualizarMultiple);
router.put('/:categoria', ConfiguracionController.actualizarCategoria);

module.exports = router;
