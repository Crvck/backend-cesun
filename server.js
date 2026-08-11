const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') }); // Ajusta la ruta del .env si es necesario

const express = require('express');
const swaggerUi = require('swagger-ui-express');
const swaggerDocument = require('./src/doc/swagger.json');
const cors = require('cors');
const sequelize = require('./src/config/db');

// --- IMPORTAR MODELOS ---
require('./src/models/userModel');
require('./src/models/pacienteModel');
require('./src/models/citaModel');
require('./src/models/configuracionModel');
require('./src/models/Solicitud'); 
require('./src/models/psicopedagogicoPerfilModel');
require('./src/models/psicopedagogicoEvolucionModel');

// --- IMPORTAR RUTAS ---
const authRoutes = require('./src/routes/authRoutes');
const citaRoutes = require('./src/routes/citaRoutes');
const roleRoutes = require('./src/routes/roleRoutes');
const fundacionRoutes = require('./src/routes/fundacionRoutes');
const asignacionRoutes = require('./src/routes/asignacionRoutes');
const sesionRoutes = require('./src/routes/sesionRoutes');
const notificacionRoutes = require('./src/routes/notificacionRoutes');
const altaRoutes = require('./src/routes/altaRoutes');
const reporteRoutes = require('./src/routes/reporteRoutes');
const observacionRoutes = require('./src/routes/observacionRoutes');
const disponibilidadRoutes = require('./src/routes/disponibilidadRoutes');
const expedienteRoutes = require('./src/routes/expedienteRoutes');
const dashboardRoutes = require('./src/routes/dashboardRoutes'); // <--- AQUÍ IMPORTAMOS DASHBOARD
const agendaRoutes = require('./src/routes/agendaRoutes');
const estadisticaRoutes = require('./src/routes/estadisticaRoutes');
const configuracionRoutes = require('./src/routes/configuracionRoutes');
const pacienteRoutes = require('./src/routes/pacienteRoutes');
const userRoutes = require('./src/routes/userRoutes');
const preregistroRoutes = require('./src/routes/preregistroRoutes');
const psicopedagogicoRoutes = require('./src/routes/psicopedagogicoRoutes');
const recordatorioRoutes = require('./src/routes/recordatorioRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// --- CONFIGURACIÓN DE CORS ---
const normalizeOrigin = (value = '') =>
  value
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
const allowedOrigin = normalizeOrigin('http://localhost:3001'); // Cambiado a localhost:3001 para desarrollo local
//const allowedOrigin = normalizeOrigin('https://cesun-frontend-a3n6gtint-crvcks-projects.vercel.app');

// --- CORS RESTRINGIDO (CERRADO) ---
// Solo se permite el frontend oficial indicado.
app.use(cors({  
  origin: (origin, callback) => {
    if (!origin) {
      return callback(null, true);
    }

    if (normalizeOrigin(origin) === allowedOrigin) {
      return callback(null, true);
    }

    console.warn(`⚠️  CORS BLOQUEADO: Origen no autorizado "${origin}" intentó acceder al servidor`);
    console.warn(`📋 Origen permitido: ${allowedOrigin}`);
    return callback(new Error('Not allowed by CORS'));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// --- DOCUMENTACIÓN SWAGGER ---
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

app.get('/', (req, res) => {
  res.send('Server is running! Check /api-docs for documentation.');
});

// --- DEFINICIÓN DE ENDPOINTS ---
app.use('/api/auth', authRoutes);
app.use('/api/citas', citaRoutes);
app.use('/api/fundaciones', fundacionRoutes);
app.use('/api/asignaciones', asignacionRoutes);
app.use('/api/sesiones', sesionRoutes);
app.use('/api/notificaciones', notificacionRoutes);
app.use('/api/altas', altaRoutes);
app.use('/api/reportes', reporteRoutes);
app.use('/api/observaciones', observacionRoutes);
app.use('/api/disponibilidad', disponibilidadRoutes);
app.use('/api/expedientes', expedienteRoutes);
app.use('/api/agenda', agendaRoutes);
app.use('/api/estadisticas', estadisticaRoutes);
app.use('/api/configuracion', configuracionRoutes);
app.use('/api/users', userRoutes);
app.use('/api/roles', roleRoutes);
app.use('/api/pacientes', pacienteRoutes);
app.use('/api/preregistro', preregistroRoutes);
app.use('/api/psicopedagogico', psicopedagogicoRoutes);
app.use('/api/recordatorios', recordatorioRoutes);

// --- ENDPOINT DASHBOARD ---
app.use('/api/dashboard', dashboardRoutes); 

module.exports = app;

if (require.main === module) {
  sequelize.authenticate()
    .then(() => {
      console.log("✅ Conexión a base de datos y autenticación exitosa.");
      console.log("ℹ️ No se sincroniza el esquema automáticamente para evitar cambios de constraints existentes.");
      app.listen(PORT, () => {
        console.log(`Backend running on http://localhost:${PORT}`);
        console.log(`Swagger docs: http://localhost:${PORT}/api-docs`);
        //console.log(`🔒 CORS activo de forma estricta (Solo dominios autorizados)`);
        console.log(`Endpoints disponibles:`);
        console.log(`  POST /api/dashboard/aprobar-solicitud (Verificado)`);
        console.log(`  POST /api/dashboard/denegar-solicitud (Verificado)`);
      });

      const RecordatorioService = require('./src/services/recordatorioService');
      setInterval(() => {
        RecordatorioService.enviarRecordatorios().catch(err =>
          console.error('Error en recordatorio programado:', err)
        );
      }, 60 * 60 * 1000);
    })
    .catch(error => {
      console.error('❌ No se pudo conectar a la base de datos:', error);
      process.exit(1);
    });
}
