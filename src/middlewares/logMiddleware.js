const { QueryTypes } = require('sequelize');
const sequelize = require('../config/db');

const logMiddleware = (tipoLog, modulo, accion) => {
    return async (req, res, next) => {
        const startTime = Date.now();
        
        // Guardar referencia a la función original de res.json
        const originalJson = res.json;
        
        // Sobrescribir res.json para capturar la respuesta
        res.json = function(data) {
            // Restaurar la función original
            res.json = originalJson;
            
            // Calcular tiempo de respuesta
            const responseTime = Date.now() - startTime;
            
            // Registrar el log en segundo plano (no bloquear la respuesta)
            registrarLogAsync({
                usuario_id: req.user?.id || null,
                tipo_log: tipoLog,
                modulo: modulo,
                accion: accion,
                descripcion: `${accion} - ${req.method} ${req.originalUrl}`,
                ip_address: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
                user_agent: req.headers['user-agent'],
                datos_extra: {
                    method: req.method,
                    url: req.originalUrl,
                    query_params: req.query,
                    body_params: req.body,
                    response_status: res.statusCode,
                    response_time_ms: responseTime,
                    success: data?.success || false
                },
                severidad: res.statusCode >= 500 ? 'error' : 
                          res.statusCode >= 400 ? 'advertencia' : 'info'
            }).catch(console.error);
            
            // Llamar a la función original
            return originalJson.call(this, data);
        };
        
        next();
    };
};

// Función asíncrona para registrar logs
async function registrarLogAsync(logData) {
    try {
        await sequelize.query(`
            INSERT INTO logs_sistema (
                usuario_id, tipo_log, modulo, accion, descripcion,
                ip_address, user_agent, datos_extra, severidad, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())
        `, {
            replacements: [
                logData.usuario_id,
                logData.tipo_log,
                logData.modulo,
                logData.accion,
                logData.descripcion,
                logData.ip_address,
                logData.user_agent,
                JSON.stringify(logData.datos_extra),
                logData.severidad
            ]
        });
    } catch (error) {
        console.error('Error al registrar log:', error);
    }
}

// Middleware para logs de autenticación
const logAuthMiddleware = logMiddleware('login', 'autenticacion', 'Login usuario');

// Middleware para logs de creación
const logCreacionMiddleware = (modulo) => logMiddleware('creacion', modulo, 'Crear registro');

// Middleware para logs de modificación
const logModificacionMiddleware = (modulo) => logMiddleware('modificacion', modulo, 'Modificar registro');

// Middleware para logs de eliminación
const logEliminacionMiddleware = (modulo) => logMiddleware('eliminacion', modulo, 'Eliminar registro');

// Middleware para logs de consulta
const logConsultaMiddleware = (modulo) => logMiddleware('consulta', modulo, 'Consultar registros');

// Middleware para logs de reportes
const logReporteMiddleware = logMiddleware('reporte', 'reportes', 'Generar reporte');

// Middleware para logs de errores
const logErrorMiddleware = (error, req, res, next) => {
    registrarLogAsync({
        usuario_id: req.user?.id || null,
        tipo_log: 'error',
        modulo: 'sistema',
        accion: 'Error en solicitud',
        descripcion: `Error: ${error.message}`,
        ip_address: req.ip || req.headers['x-forwarded-for'] || req.connection.remoteAddress,
        user_agent: req.headers['user-agent'],
        datos_extra: {
            method: req.method,
            url: req.originalUrl,
            error_stack: error.stack,
            error_message: error.message
        },
        severidad: 'error'
    }).catch(console.error);
    
    next(error);
};

// Middleware para auditoría de datos sensibles
const auditoriaMiddleware = (modulo, camposSensibles = []) => {
    return async (req, res, next) => {
        // Guardar datos originales para comparación posterior
        if (req.method === 'PUT' || req.method === 'PATCH') {
            const datosOriginales = await obtenerDatosOriginales(req);
            req._datosOriginales = datosOriginales;
        }
        
        next();
    };
};

async function obtenerDatosOriginales(req) {
    // Esta función obtendría los datos originales de la base de datos
    // Implementación específica según el módulo
    return {};
}

module.exports = {
    logMiddleware,
    logAuthMiddleware,
    logCreacionMiddleware,
    logModificacionMiddleware,
    logEliminacionMiddleware,
    logConsultaMiddleware,
    logReporteMiddleware,
    logErrorMiddleware,
    auditoriaMiddleware,
    registrarLogAsync
};