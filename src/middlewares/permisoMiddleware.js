const { QueryTypes } = require('sequelize');
const sequelize = require('../config/db');

const permisoMiddleware = (permisoNombre) => {
    return async (req, res, next) => {
        try {
            const usuarioId = req.user.id;
            
            // Consultar si el usuario tiene el permiso específico
            const query = `
                SELECT up.concedido 
                FROM usuario_permisos up
                JOIN permisos p ON up.permiso_id = p.id
                WHERE up.usuario_id = ?
                AND p.nombre = ?
                AND up.concedido = TRUE
            `;
            
            const result = await sequelize.query(query, {
                replacements: [usuarioId, permisoNombre],
                type: QueryTypes.SELECT
            });
            
            if (result.length > 0) {
                return next();
            }
            
            // Si no tiene permiso específico, verificar por rol
            const [usuario] = await sequelize.query(
                'SELECT rol FROM users WHERE id = ?',
                { replacements: [usuarioId], type: QueryTypes.SELECT }
            );
            
            if (!usuario) {
                return res.status(403).json({
                    success: false,
                    message: 'Usuario no encontrado'
                });
            }
            
            // Permisos por defecto según rol
            const permisosPorRol = {
                coordinador: [
                    'ver_panel_coordinacion',
                    'gestionar_usuarios',
                    'gestionar_fundaciones',
                    'gestionar_pacientes',
                    'gestionar_asignaciones',
                    'ver_agenda_global',
                    'generar_reportes',
                    'ver_estadisticas',
                    'gestionar_altas',
                    'ver_expedientes_completos',
                    'configurar_sistema'
                ],
                terapeuta: [
                    'ver_panel_terapeuta',
                    'ver_mis_pacientes',
                    'gestionar_mis_citas',
                    'registrar_sesiones',
                    'supervisar_coterapeutas',
                    'crear_observaciones',
                    'ver_expedientes_asignados',
                    'dar_altas_pacientes'
                ],
                psicopedagogico: [
                    'ver_panel_psicopedagogico',
                    'ver_mis_pacientes',
                    'ver_expedientes_asignados',
                    'registrar_sesiones'
                ],
                coterapeuta: [
                    'ver_panel_coterapeuta',
                    'ver_citas_dia',
                    'gestionar_citas_asignadas',
                    'ver_pacientes_asignados',
                    'ver_observaciones_propias',
                    'configurar_disponibilidad'
                ]
            };
            
            if (permisosPorRol[usuario.rol]?.includes(permisoNombre)) {
                return next();
            }
            
            return res.status(403).json({
                success: false,
                message: `No tiene el permiso necesario: ${permisoNombre}`
            });
            
        } catch (error) {
            console.error('Error en permisoMiddleware:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al verificar permisos'
            });
        }
    };
};

// Middleware para verificar múltiples permisos (al menos uno)
const algunPermisoMiddleware = (permisos) => {
    return async (req, res, next) => {
        try {
            const usuarioId = req.user.id;
            
            // Consultar permisos del usuario
            const query = `
                SELECT p.nombre
                FROM usuario_permisos up
                JOIN permisos p ON up.permiso_id = p.id
                WHERE up.usuario_id = ?
                AND up.concedido = TRUE
                AND p.nombre IN (?)
            `;
            
            const resultados = await sequelize.query(query, {
                replacements: [usuarioId, permisos],
                type: QueryTypes.SELECT
            });
            
            if (resultados.length > 0) {
                return next();
            }
            
            // Verificar por rol
            const [usuario] = await sequelize.query(
                'SELECT rol FROM users WHERE id = ?',
                { replacements: [usuarioId], type: QueryTypes.SELECT }
            );
            
            if (!usuario) {
                return res.status(403).json({
                    success: false,
                    message: 'Usuario no encontrado'
                });
            }
            
            const permisosPorRol = {
                coordinador: [
                    'ver_panel_coordinacion',
                    'gestionar_usuarios',
                    'gestionar_fundaciones',
                    'gestionar_pacientes',
                    'gestionar_asignaciones',
                    'ver_agenda_global',
                    'generar_reportes',
                    'ver_estadisticas',
                    'gestionar_altas',
                    'ver_expedientes_completos',
                    'configurar_sistema'
                ],
                terapeuta: [
                    'ver_panel_terapeuta',
                    'ver_mis_pacientes',
                    'gestionar_mis_citas',
                    'registrar_sesiones',
                    'supervisar_coterapeutas',
                    'crear_observaciones',
                    'ver_expedientes_asignados',
                    'dar_altas_pacientes'
                ],
                psicopedagogico: [
                    'ver_panel_psicopedagogico',
                    'ver_mis_pacientes',
                    'ver_expedientes_asignados',
                    'registrar_sesiones'
                ],
                coterapeuta: [
                    'ver_panel_coterapeuta',
                    'ver_citas_dia',
                    'gestionar_citas_asignadas',
                    'ver_pacientes_asignados',
                    'ver_observaciones_propias',
                    'configurar_disponibilidad'
                ]
            };
            
            // Verificar si algún permiso requerido está en los permisos del rol
            const tieneAlgunPermiso = permisos.some(permiso => 
                permisosPorRol[usuario.rol]?.includes(permiso)
            );
            
            if (tieneAlgunPermiso) {
                return next();
            }
            
            return res.status(403).json({
                success: false,
                message: 'No tiene los permisos necesarios para esta acción'
            });
            
        } catch (error) {
            console.error('Error en algunPermisoMiddleware:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al verificar permisos'
            });
        }
    };
};

// Middleware para verificar todos los permisos
const todosPermisosMiddleware = (permisos) => {
    return async (req, res, next) => {
        try {
            const usuarioId = req.user.id;
            
            // Consultar permisos del usuario
            const query = `
                SELECT p.nombre
                FROM usuario_permisos up
                JOIN permisos p ON up.permiso_id = p.id
                WHERE up.usuario_id = ?
                AND up.concedido = TRUE
                AND p.nombre IN (?)
            `;
            
            const resultados = await sequelize.query(query, {
                replacements: [usuarioId, permisos],
                type: QueryTypes.SELECT
            });
            
            const permisosObtenidos = resultados.map(r => r.nombre);
            
            // Verificar si tiene todos los permisos requeridos
            const tieneTodos = permisos.every(permiso => 
                permisosObtenidos.includes(permiso)
            );
            
            if (tieneTodos) {
                return next();
            }
            
            // Verificar por rol
            const [usuario] = await sequelize.query(
                'SELECT rol FROM users WHERE id = ?',
                { replacements: [usuarioId], type: QueryTypes.SELECT }
            );
            
            if (!usuario) {
                return res.status(403).json({
                    success: false,
                    message: 'Usuario no encontrado'
                });
            }
            
            const permisosPorRol = {
                coordinador: [
                    'ver_panel_coordinacion',
                    'gestionar_usuarios',
                    'gestionar_fundaciones',
                    'gestionar_pacientes',
                    'gestionar_asignaciones',
                    'ver_agenda_global',
                    'generar_reportes',
                    'ver_estadisticas',
                    'gestionar_altas',
                    'ver_expedientes_completos',
                    'configurar_sistema'
                ],
                psicologo: [
                    'ver_panel_psicologo',
                    'ver_mis_pacientes',
                    'gestionar_mis_citas',
                    'registrar_sesiones',
                    'supervisar_becarios',
                    'crear_observaciones',
                    'ver_expedientes_asignados',
                    'dar_altas_pacientes'
                ],
                becario: [
                    'ver_panel_becario',
                    'ver_citas_dia',
                    'gestionar_citas_asignadas',
                    'ver_pacientes_asignados',
                    'ver_observaciones_propias',
                    'configurar_disponibilidad'
                ]
            };
            
            // Verificar si todos los permisos requeridos están en los permisos del rol
            const tieneTodosPorRol = permisos.every(permiso => 
                permisosPorRol[usuario.rol]?.includes(permiso)
            );
            
            if (tieneTodosPorRol) {
                return next();
            }
            
            return res.status(403).json({
                success: false,
                message: 'No tiene todos los permisos necesarios para esta acción'
            });
            
        } catch (error) {
            console.error('Error en todosPermisosMiddleware:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al verificar permisos'
            });
        }
    };
};

module.exports = {
    permisoMiddleware,
    algunPermisoMiddleware,
    todosPermisosMiddleware
};