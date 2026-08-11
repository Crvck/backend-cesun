const { body, param, query, validationResult } = require('express-validator');

// Validaciones comunes
const validacionesComunes = {
    email: body('email').isEmail().normalizeEmail(),
    telefono: body('telefono').optional().isMobilePhone('any-MX'),
    fecha: body('fecha').isDate().toDate(),
    hora: body('hora').matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    numeroPositivo: body().custom((value, { path }) => {
        if (typeof value === 'number' && value > 0) return true;
        throw new Error(`${path} debe ser un número positivo`);
    })
};

// Validaciones para pacientes
const validarPaciente = [
    body('nombre').notEmpty().trim().isLength({ min: 2, max: 100 }),
    body('apellido').notEmpty().trim().isLength({ min: 2, max: 100 }),
    validacionesComunes.email.optional(),
    validacionesComunes.telefono,
    body('fecha_inscripcion').optional().isDate(),
    body('genero').optional().isIn(['masculino', 'femenino', 'otro', 'prefiero_no_decir']),
    body('direccion').optional().trim(),
    body('estado').optional().isIn(['activo', 'inactivo', 'pendiente']),
    body('activo').optional().isBoolean(),
    body('notas').optional().trim(),
    body('fundacion_id').optional().isInt()
];

// Validaciones para citas
const validarCita = [
    body('paciente_id').isInt(),
    body('psicologo_id').optional().isInt(),
    body('becario_id').optional().isInt(),
    validacionesComunes.fecha,
    validacionesComunes.hora,
    body('tipo_consulta').isIn(['presencial', 'virtual']),
    body('estado').optional().isIn(['programada', 'confirmada', 'completada', 'cancelada']),
    body('duracion').optional().isInt({ min: 15, max: 120 }),
    body('notas').optional().trim()
];

// Validaciones para sesiones
const validarSesion = [
    body('cita_id').isInt(),
    body('desarrollo').notEmpty().trim(),
    body('conclusion').optional().trim(),
    body('tareas_asignadas').optional().trim(),
    body('emocion_predominante').optional().trim(),
    body('riesgo_suicida').optional().isIn(['ninguno', 'bajo', 'moderado', 'alto']),
    body('escalas_aplicadas').optional().isJSON(),
    body('siguiente_cita').optional().isDate(),
    body('privado').optional().isBoolean()
];

// Validaciones para usuarios
const validarUsuario = [
    validacionesComunes.email,
    body('password').isLength({ min: 6 }),
    body('nombre').notEmpty().trim().isLength({ min: 2, max: 100 }),
    body('apellido').notEmpty().trim().isLength({ min: 2, max: 100 }),
    validacionesComunes.telefono.optional(),
    body('rol').isIn(['coordinador', 'psicologo', 'becario']),
    body('especialidad').optional().trim(),
    body('fundacion_id').optional().isInt(),
    body('activo').optional().isBoolean()
];

// Validaciones para observaciones de becarios
const validarObservacion = [
    body('becario_id').isInt(),
    body('cita_id').optional().isInt(),
    body('tipo_observacion').isIn(['sesion_observada', 'retroalimentacion', 'evaluacion_periodica', 'incidencia', 'reconocimiento']),
    body('aspecto_evaluado').isIn(['empatia', 'tecnicas', 'documentacion', 'puntualidad', 'profesionalismo', 'etica']),
    body('calificacion').isInt({ min: 1, max: 10 }),
    body('fortalezas').optional().trim(),
    body('areas_mejora').optional().trim(),
    body('recomendaciones').optional().trim(),
    body('plan_accion').optional().trim(),
    body('fecha_seguimiento').optional().isDate(),
    body('privada').optional().isBoolean()
];

// Validaciones para disponibilidad
const validarDisponibilidad = [
    body('dia_semana').isIn(['lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo']),
    validacionesComunes.hora.custom((value, { req }) => {
        const horaInicio = value;
        const horaFin = req.body.hora_fin;
        
        if (!horaFin) return true;
        
        const [h1, m1] = horaInicio.split(':').map(Number);
        const [h2, m2] = horaFin.split(':').map(Number);
        
        if (h2 < h1 || (h2 === h1 && m2 <= m1)) {
            throw new Error('La hora de fin debe ser mayor que la hora de inicio');
        }
        
        return true;
    }),
    body('hora_fin').matches(/^([01]?[0-9]|2[0-3]):[0-5][0-9]$/),
    body('tipo_disponibilidad').optional().isIn(['regular', 'extraordinaria', 'limitada']),
    body('max_citas_dia').optional().isInt({ min: 1, max: 12 }),
    body('intervalo_citas').optional().isInt({ min: 15, max: 120 }),
    body('fecha_fin_vigencia').optional().isDate()
];

// Validaciones para altas
const validarAlta = [
    body('paciente_id').isInt(),
    body('tipo_alta').isIn(['terapeutica', 'abandono', 'traslado', 'graduacion', 'no_continua', 'otro']),
    body('motivo_detallado').optional().trim(),
    body('recomendaciones').optional().trim(),
    body('evaluacion_final').optional().isIn(['excelente', 'buena', 'regular', 'mala']),
    body('seguimiento_recomendado').optional().isBoolean(),
    body('fecha_seguimiento').optional().isDate()
];

// Validaciones para reportes
const validarReporte = [
    query('mes').optional().isInt({ min: 1, max: 12 }),
    query('anio').optional().isInt({ min: 2000, max: 2100 }),
    query('fecha_inicio').optional().isDate(),
    query('fecha_fin').optional().isDate(),
    query('formato').optional().isIn(['pdf', 'excel', 'csv', 'html']),
    query('tipo').optional().isIn(['citas', 'pacientes', 'sesiones', 'becarios'])
];

// Middleware de validación
const validarResultados = (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({
            success: false,
            message: 'Errores de validación',
            errors: errors.array().map(err => ({
                campo: err.param,
                mensaje: err.msg,
                valor: err.value
            }))
        });
    }
    next();
};

// Validaciones de parámetros de ruta
const validarId = [
    param('id').isInt(),
    validarResultados
];

const validarPacienteId = [
    param('paciente_id').isInt(),
    validarResultados
];

const validarUsuarioId = [
    param('usuario_id').isInt(),
    validarResultados
];

// Exportar todas las validaciones
module.exports = {
    validacionesComunes,
    validarPaciente,
    validarCita,
    validarSesion,
    validarUsuario,
    validarObservacion,
    validarDisponibilidad,
    validarAlta,
    validarReporte,
    validarResultados,
    validarId,
    validarPacienteId,
    validarUsuarioId
};