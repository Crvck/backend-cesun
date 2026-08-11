const RecordatorioService = require('../services/recordatorioService');

class RecordatorioController {
    static async enviarRecordatorios(req, res) {
        try {
            const resultado = await RecordatorioService.enviarRecordatorios({ forzar: true });
            res.json({ success: true, data: resultado });
        } catch (error) {
            console.error('Error al enviar recordatorios:', error);
            res.status(500).json({ success: false, message: 'Error al enviar recordatorios' });
        }
    }

    static async obtenerConfiguracion(req, res) {
        try {
            const config = await RecordatorioService.obtenerConfiguracion();
            res.json({ success: true, data: config });
        } catch (error) {
            console.error('Error al obtener configuración de recordatorios:', error);
            res.status(500).json({ success: false, message: 'Error al obtener configuración' });
        }
    }

    static async actualizarConfiguracion(req, res) {
        try {
            const config = await RecordatorioService.actualizarConfiguracion(req.body || {});
            res.json({ success: true, data: config });
        } catch (error) {
            console.error('Error al actualizar configuración de recordatorios:', error);
            res.status(500).json({ success: false, message: 'Error al actualizar configuración' });
        }
    }
}

module.exports = RecordatorioController;
