const Configuracion = require('../models/configuracionModel');

const CATEGORIAS = [
	'general',
	'clinica',
	'citas',
	'notificaciones',
	'seguridad',
	'avanzada'
];

const DEFAULTS = {
	general: {
		nombreConsultorio: 'PsicoGestión Consultorio',
		direccion: 'Av. Principal 123, Ciudad',
		telefono: '+123 456 7890',
		email: 'contacto@psicogestion.com',
		sitioWeb: 'https://psicogestion.com',
		moneda: 'USD',
		zonaHoraria: 'America/Mexico_City',
		idioma: 'es'
	},
	clinica: {
		duracionSesionDefault: 50,
		sesionesGratuitas: 3,
		edadMinima: 16,
		maxPacientesPsicologo: 15,
		maxPacientesBecario: 5,
		requiereSupervision: true,
		frecuenciaSupervision: 'semanal'
	},
	citas: {
		horarioInicio: '09:00',
		horarioFin: '20:00',
		intervaloCitas: 15,
		antelacionReserva: 30,
		recordatorio24h: true,
		recordatorio1h: true,
		margenCancelacion: 24,
		maxCitasDia: 8
	},
	notificaciones: {
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
	},
	seguridad: {
		requerirVerificacionEmail: true,
		intentosLogin: 3,
		bloqueoTemporal: 30,
		expiracionSesion: 60,
		requerir2FA: false,
		registroIP: true,
		politicasAceptadas: true
	},
	avanzada: {
		backupAutomatico: true,
		frecuenciaBackup: 'diario',
		retencionBackups: 30,
		logsDetallados: true,
		modoMantenimiento: false,
		versionAPI: '1.0.0',
		debugMode: false
	}
};

const getDefaultValores = (categoria) => JSON.parse(JSON.stringify(DEFAULTS[categoria] || {}));

const normalizarCategoria = (categoriaRaw) => (categoriaRaw || '').toLowerCase();

async function asegurarRegistro(categoria) {
	const categoriaNormalizada = normalizarCategoria(categoria);
	let registro = await Configuracion.findOne({ where: { categoria: categoriaNormalizada } });

	if (!registro) {
		registro = await Configuracion.create({
			categoria: categoriaNormalizada,
			valores: getDefaultValores(categoriaNormalizada)
		});
	}

	return registro;
}

class ConfiguracionController {
	static async obtenerTodas(req, res) {
		try {
			const resultado = {};

			for (const categoria of CATEGORIAS) {
				const registro = await asegurarRegistro(categoria);
				resultado[categoria] = registro.valores || getDefaultValores(categoria);
			}

			res.json({ success: true, data: resultado });
		} catch (error) {
			console.error('Error al obtener configuraciones:', error);
			res.status(500).json({ success: false, message: 'Error al obtener configuraciones', error: error.message });
		}
	}

	static async obtenerPorCategoria(req, res) {
		try {
			const categoria = normalizarCategoria(req.params.categoria);

			if (!CATEGORIAS.includes(categoria)) {
				return res.status(400).json({ success: false, message: 'Categoría no permitida' });
			}

			const registro = await asegurarRegistro(categoria);

			res.json({ success: true, data: registro.valores || getDefaultValores(categoria) });
		} catch (error) {
			console.error('Error al obtener configuración:', error);
			res.status(500).json({ success: false, message: 'Error al obtener configuración', error: error.message });
		}
	}

	static async actualizarCategoria(req, res) {
		try {
			const categoria = normalizarCategoria(req.params.categoria);

			if (!CATEGORIAS.includes(categoria)) {
				return res.status(400).json({ success: false, message: 'Categoría no permitida' });
			}

			const registro = await asegurarRegistro(categoria);
			const nuevosValores = { ...getDefaultValores(categoria), ...registro.valores, ...req.body };

			await registro.update({ valores: nuevosValores });

			res.json({ success: true, message: `Configuración ${categoria} guardada`, data: nuevosValores });
		} catch (error) {
			console.error('Error al actualizar configuración:', error);
			res.status(500).json({ success: false, message: 'Error al actualizar configuración', error: error.message });
		}
	}

	static async actualizarMultiple(req, res) {
		try {
			const payload = req.body || {};
			const resultado = {};

			for (const categoria of CATEGORIAS) {
				if (payload[categoria]) {
					const registro = await asegurarRegistro(categoria);
					const valoresCombinados = { ...getDefaultValores(categoria), ...registro.valores, ...payload[categoria] };
					await registro.update({ valores: valoresCombinados });
					resultado[categoria] = valoresCombinados;
				}
			}

			res.json({ success: true, message: 'Configuraciones actualizadas', data: resultado });
		} catch (error) {
			console.error('Error al actualizar configuraciones:', error);
			res.status(500).json({ success: false, message: 'Error al actualizar configuraciones', error: error.message });
		}
	}
}

module.exports = ConfiguracionController;
