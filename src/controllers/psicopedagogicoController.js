const PsicopedagogicoPerfil = require('../models/psicopedagogicoPerfilModel');
const PsicopedagogicoEvolucion = require('../models/psicopedagogicoEvolucionModel');
const Sesion = require('../models/sesionModel');
const Cita = require('../models/citaModel');

class PsicopedagogicoController {
    static async obtenerPerfil(req, res) {
        try {
            const { paciente_id } = req.params;

            const perfil = await PsicopedagogicoPerfil.findOne({
                where: { paciente_id },
                include: [{ model: PsicopedagogicoEvolucion, as: 'Evoluciones', order: [['fecha', 'DESC']] }]
            });

            const sesiones = await Sesion.findAll({
                include: [{ model: Cita, where: { paciente_id } }],
                order: [['fecha', 'DESC']]
            });

            res.json({
                success: true,
                data: {
                    perfil: perfil || null,
                    sesiones: sesiones || [],
                    evoluciones: perfil?.Evoluciones || []
                }
            });
        } catch (error) {
            console.error('Error en obtenerPerfil:', error);
            res.status(500).json({ success: false, message: 'Error al obtener perfil psicopedagógico' });
        }
    }

    static async guardarDiagnostico(req, res) {
        try {
            const { paciente_id } = req.params;
            const { diagnostico } = req.body;

            let perfil = await PsicopedagogicoPerfil.findOne({ where: { paciente_id } });
            if (!perfil) {
                perfil = await PsicopedagogicoPerfil.create({ paciente_id, diagnostico: diagnostico || null });
            } else {
                await perfil.update({ diagnostico: diagnostico || null });
            }

            res.json({ success: true, data: perfil });
        } catch (error) {
            console.error('Error en guardarDiagnostico:', error);
            res.status(500).json({ success: false, message: 'Error al guardar diagnóstico' });
        }
    }

    static async agregarEvolucion(req, res) {
        try {
            const { paciente_id } = req.params;
            const { fecha, descripcion } = req.body;

            if (!fecha || !descripcion) {
                return res.status(400).json({ success: false, message: 'Fecha y descripción son requeridas' });
            }

            let perfil = await PsicopedagogicoPerfil.findOne({ where: { paciente_id } });
            if (!perfil) {
                perfil = await PsicopedagogicoPerfil.create({ paciente_id, diagnostico: null });
            }

            const evolucion = await PsicopedagogicoEvolucion.create({
                perfil_id: perfil.id,
                fecha,
                descripcion
            });

            res.json({ success: true, data: evolucion });
        } catch (error) {
            console.error('Error en agregarEvolucion:', error);
            res.status(500).json({ success: false, message: 'Error al registrar evolución' });
        }
    }
}

module.exports = PsicopedagogicoController;
