const { Op } = require('sequelize');
const { Permiso, UsuarioPermiso } = require('../models/permisoModel');
const User = require('../models/userModel');
const Paciente = require('../models/pacienteModel');
const Cita = require('../models/citaModel');
const Asignacion = require('../models/asignacionModel');
const ObservacionBecario = require('../models/observacionBecarioModel');

class RoleController {
    
    static async getMyPermissions(req, res) {
        try {
            const userId = req.user.id;

            const permissions = await UsuarioPermiso.findAll({
                where: {
                    usuario_id: userId,
                    concedido: true
                },
                include: [
                    {
                        model: Permiso,
                        attributes: ['nombre', 'descripcion', 'categoria']
                    }
                ],
                attributes: ['concedido']
            });

            const mapped = permissions.map((item) => ({
                nombre: item.Permiso?.nombre,
                descripcion: item.Permiso?.descripcion,
                categoria: item.Permiso?.categoria,
                concedido: item.concedido
            }));

            res.json({
                success: true,
                data: mapped
            });
            
        } catch (error) {
            console.error('Error en getMyPermissions:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener permisos'
            });
        }
    }
    
    static async getUserRoleInfo(req, res) {
        try {
            const userId = req.user.id;
            const user = await User.findByPk(userId, {
                attributes: ['id', 'email', 'nombre', 'apellido', 'rol', 'especialidad']
            });

            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'Usuario no encontrado'
                });
            }

            const today = new Date().toISOString().slice(0, 10);

            const citasHoyBecario = await Cita.count({
                where: {
                    becario_id: userId,
                    fecha: today
                }
            });

            const pacientesAsignadosBecario = await Asignacion.count({
                where: {
                    becario_id: userId,
                    fecha_fin: null
                }
            });

            const userInfo = {
                ...user.toJSON(),
                citas_hoy: citasHoyBecario,
                pacientes_asignados: pacientesAsignadosBecario
            };
            
            // Agregar estadísticas específicas por rol
            let estadisticas = {};
            
            switch (userInfo.rol) {
                case 'coordinador':
                    estadisticas = {
                        coterapeutas_activos: await User.count({ where: { rol: 'coterapeuta', activo: true } }),
                        terapeutas_activos: await User.count({ where: { rol: 'terapeuta', activo: true } }),
                        pacientes_activos: await Paciente.count({ where: { activo: true } }),
                        citas_hoy: await Cita.count({
                            where: {
                                fecha: today,
                                estado: { [Op.in]: ['programada', 'confirmada'] }
                            }
                        }),
                        citas_completadas_hoy: await Cita.count({
                            where: {
                                fecha: today,
                                estado: 'completada'
                            }
                        })
                    };
                    break;
                    
                case 'terapeuta':
                    estadisticas = {
                        pacientes_asignados: await Asignacion.count({
                            where: { psicologo_id: userId, fecha_fin: null }
                        }),
                        citas_hoy: await Cita.count({
                            where: {
                                psicologo_id: userId,
                                fecha: today,
                                estado: { [Op.in]: ['programada', 'confirmada'] }
                            }
                        }),
                        coterapeutas_asignados: await Asignacion.count({
                            where: {
                                psicologo_id: userId,
                                fecha_fin: null,
                                becario_id: { [Op.ne]: null }
                            }
                        })
                    };
                    break;
                    
                case 'coterapeuta':
                    estadisticas = {
                        pacientes_asignados: await Asignacion.count({
                            where: { becario_id: userId, fecha_fin: null }
                        }),
                        citas_hoy: await Cita.count({
                            where: {
                                becario_id: userId,
                                fecha: today,
                                estado: { [Op.in]: ['programada', 'confirmada'] }
                            }
                        }),
                        observaciones_hoy: await ObservacionBecario.count({
                            where: {
                                becario_id: userId,
                                fecha: today
                            }
                        })
                    };
                    break;
            }
            
            res.json({
                success: true,
                data: {
                    user: userInfo,
                    estadisticas: estadisticas
                }
            });
            
        } catch (error) {
            console.error('Error en getUserRoleInfo:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener información del rol'
            });
        }
    }
    
    static async checkPermission(req, res) {
        try {
            const { permission } = req.params;
            const userId = req.user.id;

            const permiso = await UsuarioPermiso.findOne({
                where: {
                    usuario_id: userId,
                    concedido: true
                },
                include: [
                    {
                        model: Permiso,
                        where: { nombre: permission },
                        attributes: ['id']
                    }
                ],
                attributes: ['id']
            });

            res.json({
                success: true,
                hasPermission: Boolean(permiso)
            });
            
        } catch (error) {
            console.error('Error en checkPermission:', error);
            res.status(500).json({
                success: false,
                message: 'Error al verificar permiso'
            });
        }
    }
}

module.exports = RoleController;