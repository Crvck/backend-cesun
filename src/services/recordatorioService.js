const { Op } = require('sequelize');
const Configuracion = require('../models/configuracionModel');
const User = require('../models/userModel');
const Cita = require('../models/citaModel');
const Paciente = require('../models/pacienteModel');
const EmailService = require('./emailService');

const DEFAULT_NOTIFICACIONES = {
    emailNuevaCita: true,
    emailCancelacion: true,
    emailRecordatorio: true,
    emailReportes: true,
    smsRecordatorio: false,
    notificacionesPush: true,
    emailCoordinador: 'coordinador@psicogestion.com',
    recordatorio_citas_activo: true,
    recordatorio_citas_frecuencia_dias: 7,
    recordatorio_citas_rango_dias: 7,
    recordatorio_citas_hora: '09:00',
    recordatorio_citas_ultima_fecha: null
};

const ensureNotificacionesConfig = async () => {
    let registro = await Configuracion.findOne({ where: { categoria: 'notificaciones' } });
    if (!registro) {
        registro = await Configuracion.create({ categoria: 'notificaciones', valores: DEFAULT_NOTIFICACIONES });
    }

    const valores = { ...DEFAULT_NOTIFICACIONES, ...(registro.valores || {}) };
    if (JSON.stringify(valores) !== JSON.stringify(registro.valores || {})) {
        await registro.update({ valores });
    }
    return { registro, valores };
};

const parseHora = (hora) => {
    const [h, m] = String(hora || '00:00').split(':').map(Number);
    return { h: Number.isNaN(h) ? 0 : h, m: Number.isNaN(m) ? 0 : m };
};

const daysBetween = (a, b) => {
    const start = new Date(a.getFullYear(), a.getMonth(), a.getDate());
    const end = new Date(b.getFullYear(), b.getMonth(), b.getDate());
    return Math.floor((end - start) / (1000 * 60 * 60 * 24));
};

class RecordatorioService {
    static async enviarRecordatorios({ forzar = false } = {}) {
        const { registro, valores } = await ensureNotificacionesConfig();
        if (!valores.recordatorio_citas_activo && !forzar) {
            return { enviado: false, motivo: 'desactivado' };
        }

        const now = new Date();
        const { h, m } = parseHora(valores.recordatorio_citas_hora);
        const ultima = valores.recordatorio_citas_ultima_fecha ? new Date(valores.recordatorio_citas_ultima_fecha) : null;
        const frecuencia = Number(valores.recordatorio_citas_frecuencia_dias) || 7;

        if (!forzar) {
            const diasDesdeUltima = ultima ? daysBetween(ultima, now) : null;
            if (diasDesdeUltima !== null && diasDesdeUltima < frecuencia) {
                return { enviado: false, motivo: 'frecuencia' };
            }
            if (now.getHours() < h || (now.getHours() === h && now.getMinutes() < m)) {
                return { enviado: false, motivo: 'hora' };
            }
        }

        const rangoDias = Number(valores.recordatorio_citas_rango_dias) || 7;
        const fechaInicio = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const fechaFin = new Date(fechaInicio);
        fechaFin.setDate(fechaFin.getDate() + rangoDias);
        const fechaInicioStr = fechaInicio.toISOString().split('T')[0];
        const fechaFinStr = fechaFin.toISOString().split('T')[0];

            const usuarios = await User.findAll({
                where: {
                    activo: true,
                    rol: { [Op.in]: ['terapeuta', 'coterapeuta', 'psicopedagogico', 'psicologo', 'becario'] }
                },
                attributes: ['id', 'nombre', 'apellido', 'email']
            });

        let enviados = 0;
        for (const usuario of usuarios) {
            if (!usuario.email) continue;

            const citas = await Cita.findAll({
                where: {
                    fecha: { [Op.between]: [fechaInicioStr, fechaFinStr] },
                    [Op.or]: [{ psicologo_id: usuario.id }, { becario_id: usuario.id }]
                },
                include: [{ model: Paciente, attributes: ['nombre', 'apellido'] }],
                order: [['fecha', 'ASC'], ['hora', 'ASC']]
            });

            if (citas.length === 0) continue;

            const ok = await EmailService.enviarRecordatorioCitasUsuario({
                usuario,
                citas,
                rangoDias
            });

            if (ok) enviados += 1;
        }

        await registro.update({
            valores: {
                ...valores,
                recordatorio_citas_ultima_fecha: new Date().toISOString()
            }
        });

        return { enviado: true, enviados };
    }

    static async obtenerConfiguracion() {
        const { valores } = await ensureNotificacionesConfig();
        return valores;
    }

    static async actualizarConfiguracion(payload) {
        const { registro, valores } = await ensureNotificacionesConfig();
        const nuevosValores = { ...valores, ...payload };
        await registro.update({ valores: nuevosValores });
        return nuevosValores;
    }
}

module.exports = RecordatorioService;
