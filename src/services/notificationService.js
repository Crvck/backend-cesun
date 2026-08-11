const Notificacion = require('../models/notificacionModel');
const User = require('../models/userModel'); // Asumiendo que tu modelo de usuario se llama User

/**
 * Crea notificaciones masivas para todos los usuarios de un ROL específico.
 * @param {string} rol - Ej: 'COORDINADOR', 'PSICOLOGO'
 * @param {object} datos - { titulo, mensaje, tipo, prioridad, accion_url, extra }
 * @param {object} transaction - Objeto de transacción de Sequelize (Opcional)
 */
exports.notificarRol = async (rol, datos, transaction = null) => {
    try {
        // 1. Buscar todos los usuarios con ese rol
        const destinatarios = await User.findAll({
            where: { rol: rol, activo: true },
            attributes: ['id'],
            transaction
        });

        if (!destinatarios.length) return false;

        // 2. Preparar el array de notificaciones
        const notificacionesArray = destinatarios.map(usuario => ({
            usuario_id: usuario.id, // ID del destinatario
            titulo: datos.titulo,
            mensaje: datos.mensaje,
            tipo: datos.tipo || 'alerta_sistema', // Default del ENUM
            prioridad: datos.prioridad || 'media',
            accion_url: datos.accion_url || null,
            datos_extra: datos.extra || null, // JSON
            leido: false
        }));

        // 3. Insertar masivamente (bulkCreate es más rápido)
        await Notificacion.bulkCreate(notificacionesArray, { transaction });
        
        return true;
    } catch (error) {
        console.error('Error en NotificationService (notificarRol):', error);
        throw error; // Lanzamos el error para que el controlador decida si hace rollback
    }
};

/**
 * Crea una notificación para un usuario específico (por ID).
 * Útil para avisar al practicante que fue aceptado.
 */
exports.notificarUsuario = async (userId, datos, transaction = null) => {
    try {
        await Notificacion.create({
            usuario_id: userId,
            titulo: datos.titulo,
            mensaje: datos.mensaje,
            tipo: datos.tipo || 'alerta_sistema',
            prioridad: datos.prioridad || 'media',
            accion_url: datos.accion_url || null,
            datos_extra: datos.extra || null
        }, { transaction });

        return true;
    } catch (error) {
        console.error('Error en NotificationService (notificarUsuario):', error);
        throw error;
    }
};