const express = require('express');
const router = express.Router();
const DashboardController = require('../controllers/dashboardController'); // Asegúrate que la mayúscula coincida con tu archivo
const verifyToken = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');

// --- MIDDLEWARE GLOBAL PARA ESTAS RUTAS ---
// Todas las rutas debajo de esto requieren que el usuario esté logueado (tenga Token)
router.use(verifyToken);

// --- RUTAS GET (VISUALIZACIÓN) ---
router.get('/coordinador', requireRole(['coordinador']), DashboardController.obtenerDashboardCoordinador);
router.get('/psicologo', requireRole(['terapeuta']), DashboardController.obtenerDashboardPsicologo);
router.get('/becario', requireRole(['coterapeuta']), DashboardController.obtenerDashboardBecario);

router.get('/metricas-globales', requireRole(['coordinador']), DashboardController.obtenerMetricasGlobales);

// --- RUTA POST (ACCIÓN DE APROBAR) ---
// Esta es la ruta crítica que faltaba o estaba mal ubicada.
// La URL final será: POST http://localhost:3000/api/dashboard/aprobar-solicitud
router.post('/aprobar-solicitud', requireRole(['coordinador']), DashboardController.aprobarSolicitud);

// --- RUTA POST (ACCIÓN DE DENEGAR) ---
// Ruta para rechazar solicitudes de ingreso
router.post('/denegar-solicitud', requireRole(['coordinador']), DashboardController.denegarSolicitud);

module.exports = router;