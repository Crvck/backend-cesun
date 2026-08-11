const { Op } = require('sequelize');
const Notificacion = require('../models/notificacionModel');
const User = require('../models/userModel');

class NotificacionController {
    
    static async obtenerMisNotificaciones(req, res) {
        try {
            const usuarioId = req.user.id;
            const { leido, limit = 50, offset = 0 } = req.query;
            
            const whereClause = { usuario_id: usuarioId };
            
            if (leido !== undefined) {
                whereClause.leido = leido === 'true';
            }
            
            const notificaciones = await Notificacion.findAll({
                where: whereClause,
                order: [['created_at', 'DESC']],
                limit: parseInt(limit),
                offset: parseInt(offset)
            });
            
            // Contar no leídas
            const countNoLeidas = await Notificacion.count({
                where: { usuario_id: usuarioId, leido: false }
            });
            
            res.json({
                success: true,
                data: notificaciones,
                count: notificaciones.length,
                countNoLeidas,
                total: await Notificacion.count({ where: { usuario_id: usuarioId } })
            });
            
        } catch (error) {
            console.error('Error en obtenerMisNotificaciones:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener notificaciones'
            });
        }
    }
    
    static async marcarComoLeido(req, res) {
        try {
            const { id } = req.params;
            const usuarioId = req.user.id;
            
            const notificacion = await Notificacion.findOne({
                where: { id, usuario_id: usuarioId }
            });
            
            if (!notificacion) {
                return res.status(404).json({
                    success: false,
                    message: 'Notificación no encontrada'
                });
            }
            
            await notificacion.update({
                leido: true,
                leido_at: new Date()
            });
            
            res.json({
                success: true,
                message: 'Notificación marcada como leída'
            });
            
        } catch (error) {
            console.error('Error en marcarComoLeido:', error);
            res.status(500).json({
                success: false,
                message: 'Error al marcar notificación como leída'
            });
        }
    }
    
    static async marcarTodasComoLeidas(req, res) {
        try {
            const usuarioId = req.user.id;
            
            await Notificacion.update(
                { leido: true, leido_at: new Date() },
                { where: { usuario_id: usuarioId, leido: false } }
            );
            
            res.json({
                success: true,
                message: 'Todas las notificaciones marcadas como leídas'
            });
            
        } catch (error) {
            console.error('Error en marcarTodasComoLeidas:', error);
            res.status(500).json({
                success: false,
                message: 'Error al marcar notificaciones como leídas'
            });
        }
    }
    
    static async crearNotificacion(req, res) {
        try {
            const { usuario_id, tipo, titulo, mensaje, prioridad, datos_extra } = req.body;
            const creadorId = req.user.id;
            
            // Validar que el usuario receptor existe
            const usuario = await User.findOne({
                where: { id: usuario_id, activo: true },
                attributes: ['id']
            });

            if (!usuario) {
                return res.status(404).json({
                    success: false,
                    message: 'Usuario receptor no encontrado o inactivo'
                });
            }
            
            const notificacion = await Notificacion.create({
                usuario_id,
                tipo,
                titulo,
                mensaje,
                prioridad: prioridad || 'media',
                datos_extra: datos_extra || null
            });
            
            res.json({
                success: true,
                message: 'Notificación creada exitosamente',
                data: notificacion
            });
            
        } catch (error) {
            console.error('Error en crearNotificacion:', error);
            res.status(500).json({
                success: false,
                message: 'Error al crear notificación'
            });
        }
    }
    
    static async eliminarNotificacion(req, res) {
        try {
            const { id } = req.params;
            const usuarioId = req.user.id;
            
            const notificacion = await Notificacion.findOne({
                where: { id, usuario_id: usuarioId }
            });
            
            if (!notificacion) {
                return res.status(404).json({
                    success: false,
                    message: 'Notificación no encontrada'
                });
            }
            
            await notificacion.destroy();
            
            res.json({
                success: true,
                message: 'Notificación eliminada exitosamente'
            });
            
        } catch (error) {
            console.error('Error en eliminarNotificacion:', error);
            res.status(500).json({
                success: false,
                message: 'Error al eliminar notificación'
            });
        }
    }
    
    static async obtenerNotificacionesRecientes(req, res) {
        try {
            const usuarioId = req.user.id;
            const horas = parseInt(req.query.horas) || 24;
            
            const notificaciones = await Notificacion.findAll({
                where: {
                    usuario_id: usuarioId,
                    created_at: {
                        [Op.gte]: new Date(Date.now() - horas * 60 * 60 * 1000)
                    }
                },
                order: [['created_at', 'DESC']],
                limit: 20
            });
            
            res.json({
                success: true,
                data: notificaciones,
                count: notificaciones.length
            });
            
        } catch (error) {
            console.error('Error en obtenerNotificacionesRecientes:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener notificaciones recientes'
            });
        }
    }
    
    // Método para enviar notificación de sistema
    static async enviarNotificacionSistema(usuarioId, tipo, titulo, mensaje, datosExtra = null) {
        try {
            await Notificacion.create({
                usuario_id: usuarioId,
                tipo,
                titulo,
                mensaje,
                prioridad: 'media',
                datos_extra: datosExtra
            });
            
            return true;
        } catch (error) {
            console.error('Error al enviar notificación de sistema:', error);
            return false;
        }
    }
}

module.exports = NotificacionController;