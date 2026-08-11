const { QueryTypes } = require('sequelize');
const sequelize = require('../config/db');

const checkPermission = (permisoNombre) => {
    return async (req, res, next) => {
        try {
            const userId = req.user.id;
            
            // Consultar si el usuario tiene el permiso
            const query = `
                SELECT up.concedido 
                FROM usuario_permisos up
                JOIN permisos p ON up.permiso_id = p.id
                WHERE up.usuario_id = ?
                AND p.nombre = ?
            `;
            
            const result = await sequelize.query(query, {
                replacements: [userId, permisoNombre],
                type: QueryTypes.SELECT
            });
            
            if (result.length > 0 && result[0].concedido) {
                return next();
            }
            
            // Si no tiene permiso específico, verificar por rol básico
            const user = await sequelize.query(
                'SELECT rol FROM users WHERE id = ?',
                { replacements: [userId], type: QueryTypes.SELECT }
            );
            
            const userRole = user[0]?.rol;
            
            // Permisos por rol (fallback)
            const rolePermissions = {
                'coordinador': [
                    'ver_panel_coordinacion', 'gestionar_usuarios', 'gestionar_pacientes',
                    'gestionar_asignaciones', 'ver_agenda_global', 'generar_reportes',
                    'gestionar_altas'
                ],
                    'terapeuta': [
                        'ver_panel_terapeuta', 'gestionar_pacientes_terapeuta', 'ver_expedientes_terapeuta',
                        'registrar_sesiones_terapeuta', 'gestionar_mis_citas_terapeuta'
                    ],
                    'coterapeuta': [
                        'ver_panel_coterapeuta', 'gestionar_pacientes_coterapeuta', 'ver_expedientes_coterapeuta',
                        'registrar_sesiones_coterapeuta', 'gestionar_mis_citas_coterapeuta'
                    ],
                    'psicopedagogico': [
                        'ver_panel_psicopedagogico', 'gestionar_pacientes_psicopedagogico', 'ver_expedientes_psicopedagogico',
                        'registrar_sesiones_psicopedagogico', 'gestionar_mis_citas_psicopedagogico'
                    ]
            };
            
            if (userRole && rolePermissions[userRole]?.includes(permisoNombre)) {
                return next();
            }
            
            return res.status(403).json({
                success: false,
                message: 'No tiene permisos para acceder a esta funcionalidad'
            });
            
        } catch (error) {
            console.error('Error en checkPermission:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al verificar permisos'
            });
        }
    };
};

const requireRole = (roles) => {
    return async (req, res, next) => {
        try {
            const userId = req.user.id;
            
            const user = await sequelize.query(
                'SELECT rol FROM users WHERE id = ?',
                { replacements: [userId], type: QueryTypes.SELECT }
            );
            
            if (user.length === 0 || !roles.includes(user[0].rol)) {
                return res.status(403).json({
                    success: false,
                    message: 'Acceso denegado para este rol'
                });
            }
            
            next();
        } catch (error) {
            console.error('Error en requireRole:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al verificar rol'
            });
        }
    };
};

module.exports = { checkPermission, requireRole };