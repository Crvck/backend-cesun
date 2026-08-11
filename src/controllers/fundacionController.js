const { Op } = require('sequelize');
const Fundacion = require('../models/fundacionModel');
const Paciente = require('../models/pacienteModel');
const User = require('../models/userModel');
const Cita = require('../models/citaModel');
const Alta = require('../models/altaModel');
const LogSistema = require('../models/logSistemaModel');

class FundacionController {
    
    static async crearFundacion(req, res) {
        try {
            const fundacionData = req.body;
            const usuarioId = req.user.id;
            
            const fundacion = await Fundacion.create(fundacionData);
            
            // Log
            await LogSistema.create({
                usuario_id: usuarioId,
                tipo_log: 'creacion',
                modulo: 'fundaciones',
                accion: 'Crear fundación',
                descripcion: `Nueva fundación: ${fundacion.nombre}`
            });
            
            res.json({
                success: true,
                message: 'Fundación creada exitosamente',
                data: fundacion
            });
            
        } catch (error) {
            console.error('Error en crearFundacion:', error);
            res.status(500).json({
                success: false,
                message: 'Error al crear fundación',
                error: error.message
            });
        }
    }
    
    static async obtenerFundaciones(req, res) {
        try {
            const { activo } = req.query;
            const whereClause = {};
            
            if (activo !== undefined) {
                whereClause.activo = activo === 'true';
            }
            
            const fundaciones = await Fundacion.findAll({
                where: whereClause,
                order: [['nombre', 'ASC']]
            });
            
            res.json({
                success: true,
                data: fundaciones,
                count: fundaciones.length
            });
            
        } catch (error) {
            console.error('Error en obtenerFundaciones:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener fundaciones'
            });
        }
    }
    
    static async obtenerFundacion(req, res) {
        try {
            const { id } = req.params;
            
            const fundacion = await Fundacion.findByPk(id);
            
            if (!fundacion) {
                return res.status(404).json({
                    success: false,
                    message: 'Fundación no encontrada'
                });
            }
            
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
            const startOfNextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

            const total_pacientes = await Paciente.count({
                where: { fundacion_id: id, activo: true }
            });

            const total_profesionales = await User.count({
                where: { fundacion_id: id, activo: true }
            });

            const citas_mes_actual = await Cita.count({
                include: [
                    {
                        model: Paciente,
                        where: { fundacion_id: id }
                    }
                ],
                where: {
                    fecha: {
                        [Op.gte]: startOfMonth.toISOString().slice(0, 10),
                        [Op.lt]: startOfNextMonth.toISOString().slice(0, 10)
                    }
                }
            });

            const altas_mes_actual = await Alta.count({
                include: [
                    {
                        model: Paciente,
                        where: { fundacion_id: id }
                    }
                ],
                where: {
                    fecha_alta: {
                        [Op.gte]: startOfMonth.toISOString().slice(0, 10),
                        [Op.lt]: startOfNextMonth.toISOString().slice(0, 10)
                    }
                }
            });
            
            res.json({
                success: true,
                data: {
                    fundacion: fundacion,
                    estadisticas: {
                        total_pacientes,
                        total_profesionales,
                        citas_mes_actual,
                        altas_mes_actual
                    }
                }
            });
            
        } catch (error) {
            console.error('Error en obtenerFundacion:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener fundación'
            });
        }
    }
    
    static async actualizarFundacion(req, res) {
        try {
            const { id } = req.params;
            const updates = req.body;
            const usuarioId = req.user.id;
            
            const fundacion = await Fundacion.findByPk(id);
            
            if (!fundacion) {
                return res.status(404).json({
                    success: false,
                    message: 'Fundación no encontrada'
                });
            }
            
            // Obtener datos antes para log
            const datosAntes = { ...fundacion.toJSON() };
            
            await fundacion.update(updates);
            
            // Log
            await LogSistema.create({
                usuario_id: usuarioId,
                tipo_log: 'modificacion',
                modulo: 'fundaciones',
                accion: 'Actualizar fundación',
                descripcion: `Fundación actualizada: ${fundacion.nombre}`,
                datos_antes: datosAntes,
                datos_despues: fundacion.toJSON()
            });
            
            res.json({
                success: true,
                message: 'Fundación actualizada exitosamente',
                data: fundacion
            });
            
        } catch (error) {
            console.error('Error en actualizarFundacion:', error);
            res.status(500).json({
                success: false,
                message: 'Error al actualizar fundación'
            });
        }
    }
    
    static async desactivarFundacion(req, res) {
        try {
            const { id } = req.params;
            const { motivo } = req.body;
            const usuarioId = req.user.id;
            
            const fundacion = await Fundacion.findByPk(id);
            
            if (!fundacion) {
                return res.status(404).json({
                    success: false,
                    message: 'Fundación no encontrada'
                });
            }
            
            // Verificar que no haya pacientes activos
            const pacientesActivos = await Paciente.count({
                where: { fundacion_id: id, activo: true }
            });

            if (pacientesActivos > 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No se puede desactivar la fundación porque tiene pacientes activos'
                });
            }
            
            await fundacion.update({ activo: false });
            
            // Log
            await LogSistema.create({
                usuario_id: usuarioId,
                tipo_log: 'modificacion',
                modulo: 'fundaciones',
                accion: 'Desactivar fundación',
                descripcion: `Fundación desactivada: ${fundacion.nombre}. Motivo: ${motivo}`
            });
            
            res.json({
                success: true,
                message: 'Fundación desactivada exitosamente'
            });
            
        } catch (error) {
            console.error('Error en desactivarFundacion:', error);
            res.status(500).json({
                success: false,
                message: 'Error al desactivar fundación'
            });
        }
    }
}

module.exports = FundacionController;