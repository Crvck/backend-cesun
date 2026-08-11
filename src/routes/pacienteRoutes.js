const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');
const Paciente = require('../models/pacienteModel');
const Expediente = require('../models/expedienteModel');
const { QueryTypes } = require('sequelize');
const sequelize = require('../config/db'); // AÑADE ESTA IMPORTACIÓN

const parseDisponibilidad = (value, comentarios) => {
    let disponibilidad = value;

    if (!disponibilidad || disponibilidad === 'null') {
        disponibilidad = { dias: [] };
    } else if (typeof disponibilidad === 'string') {
        try {
            disponibilidad = JSON.parse(disponibilidad);
        } catch (err) {
            disponibilidad = { dias: [] };
        }
    }

    if (typeof disponibilidad !== 'object' || Array.isArray(disponibilidad)) {
        disponibilidad = { dias: [] };
    }

    return {
        dias: Array.isArray(disponibilidad.dias) ? disponibilidad.dias : [],
        comentarios: comentarios ?? disponibilidad.comentarios ?? ''
    };
};

const normalizeDisponibilidadInput = (value) => {
    if (!value) return { dias: [], comentarios: '' };

    if (typeof value === 'string') {
        try {
            value = JSON.parse(value);
        } catch (err) {
            return { dias: [], comentarios: '' };
        }
    }

    if (typeof value !== 'object' || Array.isArray(value)) {
        return { dias: [], comentarios: '' };
    }

    return {
        dias: Array.isArray(value.dias) ? value.dias.map((dia) => ({
            dia: dia.dia || '',
            horarios: Array.isArray(dia.horarios)
                ? dia.horarios.map((horario) => ({
                    inicio: horario.inicio || '',
                    fin: horario.fin || ''
                }))
                : []
        })) : [],
        comentarios: value.comentarios || ''
    };
};

const normalizeFechaInscripcion = (value) => {
    if (!value) return null;
    if (typeof value !== 'string') return null;

    const regex = /^(\d{4})-(\d{2})-(\d{2})$/;
    const matches = value.match(regex);
    if (!matches) return null;

    const year = Number(matches[1]);
    const month = Number(matches[2]);
    const day = Number(matches[3]);
    const currentYear = new Date().getFullYear();

    if (year < 1900 || year > currentYear) return null;
    if (month < 1 || month > 12) return null;

    const maxDay = new Date(year, month, 0).getDate();
    if (day < 1 || day > maxDay) return null;

    return `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
};

const calcularEdadRegistro = (fechaNacimiento) => {
    if (!fechaNacimiento) return null;
    const nacimiento = new Date(fechaNacimiento);
    if (Number.isNaN(nacimiento.getTime())) return null;
    const hoy = new Date();
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const mesDiff = hoy.getMonth() - nacimiento.getMonth();
    if (mesDiff < 0 || (mesDiff === 0 && hoy.getDate() < nacimiento.getDate())) {
        edad -= 1;
    }
    return edad;
};

// Listar pacientes (solo coordinadores)
router.get('/', verifyToken, requireRole(['coordinador']), async (req, res) => {
    try {
        const query = `
            SELECT p.*, COALESCE(e.motivo_consulta, '') as motivo_consulta, COALESCE(e.motivo_consulta_especial, 'No aplica') as motivo_consulta_especial
      FROM pacientes p
      LEFT JOIN expedientes e ON p.id = e.paciente_id
      ORDER BY p.apellido, p.nombre
    `;

        const pacientes = await sequelize.query(query, { type: QueryTypes.SELECT });

        // DEBUG: mostrar cantidad y algunas muestras
        try {
            console.log(`GET /api/pacientes -> encontrados ${pacientes.length} pacientes`);
            if (pacientes.length > 0) {
                const muestras = pacientes.slice(0, 5).map(p => ({ id: p.id, nombre: `${p.nombre} ${p.apellido}`, motivo: p.motivo_consulta }));
                console.log('Muestras pacientes:', muestras);
            }
        } catch (logErr) {
            console.warn('No fue posible loggear pacientes:', logErr.message);
        }

        const mapped = pacientes.map(p => ({
            id: p.id,
            nombre: p.nombre,
            apellido: p.apellido,
            email: p.email,
            telefono: p.telefono,
            fecha_inscripcion: p.fecha_inscripcion,
            genero: p.genero,
            direccion: p.direccion,
            es_estudiante: p.es_estudiante ?? false,
            matricula: p.matricula || null,
            institucion_educativa: p.institucion_educativa || null,
            carrera: p.carrera || null,
            disponibilidad: parseDisponibilidad(p.disponibilidad, p.comentarios_disponibilidad),
            edad_registro: p.edad_registro ?? null,
            usuario_registro_id: p.usuario_registro_id ?? null,
            usuario_registro_nombre: p.usuario_registro_nombre || null,
            usuario_registro_rol: p.usuario_registro_rol || null,
            estado: p.estado,
            activo: p.activo,
            notas: p.notas,
            motivo_consulta: p.motivo_consulta || null,
            motivo_consulta_especial: p.motivo_consulta_especial || 'No aplica',
            fundacion_id: p.fundacion_id,
            fecha_ingreso: p.created_at,
            fecha_alta: p.deleted_at || null
        }));

        res.json(mapped);
    } catch (error) {
        console.error('Error al listar pacientes:', error);
        res.status(500).json({ message: 'Error al obtener pacientes' });
    }
});

// Crear paciente (solo coordinadores)
router.post('/', verifyToken, requireRole(['coordinador']), async (req, res) => {
    try {
        const data = req.body;
        if (!data.nombre || !data.apellido || !data.motivo_consulta) {
            return res.status(400).json({ message: 'Faltan datos requeridos' });
        }

        const fechaInscripcion = normalizeFechaInscripcion(data.fecha_inscripcion);
        if (data.fecha_inscripcion && fechaInscripcion === null) {
            return res.status(400).json({ message: 'Fecha de inscripción inválida' });
        }

        const disponibilidadIn = normalizeDisponibilidadInput(data.disponibilidad);
        const motivoConsultaEspecial = data.motivo_consulta_especial || 'No aplica';
        const paciente = await Paciente.create({
            nombre: data.nombre,
            apellido: data.apellido,
            email: data.email || null,
            telefono: data.telefono || null,
            fecha_inscripcion: fechaInscripcion,
            genero: data.genero || null,
            direccion: data.direccion || null,
            es_estudiante: typeof data.es_estudiante === 'boolean' ? data.es_estudiante : false,
            matricula: data.matricula || null,
            institucion_educativa: data.institucion_educativa || null,
            carrera: data.carrera || null,
            disponibilidad: disponibilidadIn,
            comentarios_disponibilidad: disponibilidadIn.comentarios || null,
            edad_registro: calcularEdadRegistro(data.fecha_inscripcion),
            usuario_registro_id: req.user?.id || null,
            usuario_registro_nombre: req.user ? `${req.user.nombre || ''} ${req.user.apellido || ''}`.trim() : null,
            usuario_registro_rol: req.user?.rol || null,
            estado: data.estado || 'activo',
            activo: typeof data.activo === 'boolean' ? data.activo : true,
            notas: data.antecedentes || null,
            fundacion_id: req.user?.fundacion_id || data.fundacion_id || null
        });

        // Crear expediente inicial si se proporcionó motivo_consulta o el motivo especial
        if (data.motivo_consulta || data.motivo_consulta_especial || data.contacto_emergencia_nombre || data.contacto_emergencia_telefono) {
            try {
                const expediente = await Expediente.create({
                    paciente_id: paciente.id,
                    motivo_consulta: data.motivo_consulta || null,
                    motivo_consulta_especial: motivoConsultaEspecial,
                    psicologo_id: data.psicologo_id || null,
                    emergencia_contacto: data.contacto_emergencia_nombre || null,
                    emergencia_telefono: data.contacto_emergencia_telefono || null
                });
                console.log(`Se creó expediente inicial (paciente_id=${paciente.id}, expediente_id=${expediente.id})`);
            } catch (err) {
                // No bloquear la creación del paciente por error al crear expediente
                console.warn('No se pudo crear expediente inicial:', err.message);
            }
        }

        res.status(201).json({
            id: paciente.id,
            nombre: paciente.nombre,
            apellido: paciente.apellido,
            email: paciente.email,
            telefono: paciente.telefono,
            fecha_inscripcion: paciente.fecha_inscripcion,
            genero: paciente.genero,
            direccion: paciente.direccion,
            carrera: paciente.carrera,
            disponibilidad: {
              ...(paciente.disponibilidad || { dias: [] }),
              comentarios: paciente.comentarios_disponibilidad || null
            },
            edad_registro: paciente.edad_registro,
            usuario_registro_id: paciente.usuario_registro_id,
            usuario_registro_nombre: paciente.usuario_registro_nombre,
            usuario_registro_rol: paciente.usuario_registro_rol,
            estado: paciente.estado,
            activo: paciente.activo,
            fecha_ingreso: paciente.created_at,
            sesiones_completadas: 0,
            motivo_consulta: data.motivo_consulta || null,
            motivo_consulta_especial: motivoConsultaEspecial
        });
    } catch (error) {
        console.error('Error al crear paciente:', error);
        res.status(500).json({ message: 'Error al crear paciente' });
    }
});

// Actualizar paciente (solo coordinadores)
router.put('/:id', verifyToken, requireRole(['coordinador']), async (req, res) => {
    try {
        const id = req.params.id;
        const paciente = await Paciente.findByPk(id);
        if (!paciente) return res.status(404).json({ message: 'Paciente no encontrado' });

        const data = req.body;
        const fechaInscripcion = data.hasOwnProperty('fecha_inscripcion') ? normalizeFechaInscripcion(data.fecha_inscripcion) : paciente.fecha_inscripcion;
        if (data.hasOwnProperty('fecha_inscripcion') && data.fecha_inscripcion && fechaInscripcion === null) {
            return res.status(400).json({ message: 'Fecha de inscripción inválida' });
        }
        const disponibilidadIn = normalizeDisponibilidadInput(data.disponibilidad);
        const motivoConsultaEspecial = data.motivo_consulta_especial ?? null;
        const updated = await paciente.update({
            nombre: data.nombre ?? paciente.nombre,
            apellido: data.apellido ?? paciente.apellido,
            email: data.email ?? paciente.email,
            telefono: data.telefono ?? paciente.telefono,
            fecha_inscripcion: data.hasOwnProperty('fecha_inscripcion') ? fechaInscripcion : paciente.fecha_inscripcion,
            genero: data.genero ?? paciente.genero,
            direccion: data.direccion ?? paciente.direccion,
            es_estudiante: typeof data.es_estudiante === 'boolean' ? data.es_estudiante : paciente.es_estudiante,
            matricula: data.matricula ?? paciente.matricula,
            institucion_educativa: data.institucion_educativa ?? paciente.institucion_educativa,
            carrera: data.carrera ?? paciente.carrera,
            disponibilidad: data.disponibilidad ? disponibilidadIn : paciente.disponibilidad,
            comentarios_disponibilidad: data.disponibilidad ? disponibilidadIn.comentarios : paciente.comentarios_disponibilidad,
            estado: data.estado ?? paciente.estado,
            activo: typeof data.activo === 'boolean' ? data.activo : paciente.activo,
            notas: data.antecedentes ?? paciente.notas,
            fundacion_id: data.fundacion_id ?? paciente.fundacion_id ?? req.user?.fundacion_id ?? null
        });

        if (data.motivo_consulta || data.motivo_consulta_especial || data.contacto_emergencia_nombre || data.contacto_emergencia_telefono) {
            const [expediente] = await Expediente.findOrCreate({
                where: { paciente_id: updated.id },
                defaults: {
                    paciente_id: updated.id,
                    motivo_consulta: data.motivo_consulta || null,
                    motivo_consulta_especial: motivoConsultaEspecial || 'No aplica',
                    emergencia_contacto: data.contacto_emergencia_nombre || null,
                    emergencia_telefono: data.contacto_emergencia_telefono || null,
                    psicologo_id: data.psicologo_id || null
                }
            });

            await expediente.update({
                motivo_consulta: data.motivo_consulta ?? expediente.motivo_consulta,
                motivo_consulta_especial: data.motivo_consulta_especial ?? expediente.motivo_consulta_especial ?? 'No aplica',
                emergencia_contacto: data.contacto_emergencia_nombre ?? expediente.emergencia_contacto,
                emergencia_telefono: data.contacto_emergencia_telefono ?? expediente.emergencia_telefono
            });
        }

        res.json({
            id: updated.id,
            nombre: updated.nombre,
            apellido: updated.apellido,
            email: updated.email,
            telefono: updated.telefono,
            fecha_inscripcion: updated.fecha_inscripcion,
            genero: updated.genero,
            direccion: updated.direccion,
            carrera: updated.carrera,
            disponibilidad: {
              ...(updated.disponibilidad || { dias: [] }),
              comentarios: updated.comentarios_disponibilidad || null
            },
            estado: updated.estado,
            activo: updated.activo,
                        fecha_ingreso: updated.created_at,
                        motivo_consulta: data.motivo_consulta ?? null,
                        motivo_consulta_especial: motivoConsultaEspecial || 'No aplica'
        });
    } catch (error) {
        console.error('Error al actualizar paciente:', error);
        res.status(500).json({ message: 'Error al actualizar paciente' });
    }
});

// Eliminar paciente (soft-delete) (solo coordinadores)
router.delete('/:id', verifyToken, requireRole(['coordinador']), async (req, res) => {
    try {
        const id = req.params.id;
        const paciente = await Paciente.findByPk(id);
        if (!paciente) return res.status(404).json({ message: 'Paciente no encontrado' });

        await paciente.update({ activo: false, estado: 'alta_terapeutica' });

        res.json({ message: 'Paciente inactivado correctamente', id: paciente.id });
    } catch (error) {
        console.error('Error al eliminar paciente:', error);
        res.status(500).json({ message: 'Error al eliminar paciente' });
    }
});

// Obtener pacientes activos (coordinador -> todos, terapeuta/coterapeuta/psicopedagogico -> solo asignados a él/ella)
router.get('/activos', verifyToken, requireRole(['coordinador', 'terapeuta', 'coterapeuta', 'psicopedagogico']), async (req, res) => {
    try {
        const userId = req.user.id;
        const [userRow] = await sequelize.query('SELECT rol FROM users WHERE id = ?', { replacements: [userId], type: QueryTypes.SELECT });
        const role = userRow && userRow.rol;
        const isAssignedRole = role === 'terapeuta' || role === 'coterapeuta' || role === 'psicopedagogico';

        let whereAdditional = '';
        const replacements = {};
        if (isAssignedRole) {
            // Si es terapeuta o coterapeuta, mostrar solo pacientes con asignación activa donde sea terapeuta o coterapeuta
            whereAdditional = ' AND (a.psicologo_id = :userId OR a.becario_id = :userId)';
            replacements.userId = userId;
        }

        const query = `
            SELECT 
                p.*,
                CONCAT(p.nombre, ' ', p.apellido) as nombre_completo,
                TIMESTAMPDIFF(YEAR, p.fecha_inscripcion, CURDATE()) as edad,
                COUNT(DISTINCT c.id) as sesiones_completadas,
                CONCAT(u_psi.nombre, ' ', u_psi.apellido) as psicologo_nombre,
                CONCAT(u_bec.nombre, ' ', u_bec.apellido) as becario_nombre,
                a.fecha_inicio,
                e.motivo_consulta,
                e.motivo_consulta_especial
            FROM pacientes p
            LEFT JOIN expedientes e ON p.id = e.paciente_id
            LEFT JOIN asignaciones a ON p.id = a.paciente_id AND a.estado = 'activa'
            LEFT JOIN users u_psi ON a.psicologo_id = u_psi.id
            LEFT JOIN users u_bec ON a.becario_id = u_bec.id
            LEFT JOIN citas c ON p.id = c.paciente_id AND c.estado = 'completada'
            WHERE p.activo = true
            ${whereAdditional}
            GROUP BY p.id, e.id, u_psi.id, u_bec.id, a.id
            ORDER BY p.apellido, p.nombre
        `;

        const pacientes = await sequelize.query(query, {
            type: QueryTypes.SELECT,
            replacements
        });

        const mappedPacientes = pacientes.map((p) => ({
            ...p,
            disponibilidad: parseDisponibilidad(p.disponibilidad, p.comentarios_disponibilidad)
        }));

        res.json({
            success: true,
            data: mappedPacientes
        });

    } catch (error) {
        console.error('Error al obtener pacientes activos:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener pacientes activos',
            error: error.message
        });
    }
});

// Obtener pacientes sin asignar (solo coordinador)
router.get('/sin-asignar', verifyToken, requireRole(['coordinador']), async (req, res) => {
    try {
        const query = `
      SELECT p.id, p.nombre, p.apellido, COALESCE(e.motivo_consulta, '') as motivo_consulta, p.created_at as fecha_ingreso
      FROM pacientes p
      LEFT JOIN expedientes e ON p.id = e.paciente_id
      LEFT JOIN asignaciones a ON p.id = a.paciente_id AND a.estado = 'activa'
      WHERE p.activo = true
      AND a.id IS NULL
      ORDER BY p.apellido, p.nombre
    `;

        const pacientes = await sequelize.query(query, { type: QueryTypes.SELECT });

        // DEBUG: mostrar algunos valores devueltos para verificar motivo_consulta
        try {
            console.log(`GET /api/pacientes/sin-asignar -> encontrados ${pacientes.length} pacientes`);
            if (pacientes.length > 0) {
                const muestras = pacientes.slice(0, 5).map(p => ({ id: p.id, nombre: `${p.nombre} ${p.apellido}`, motivo: p.motivo_consulta }));
                console.log('Muestras:', muestras);
            }
        } catch (logErr) {
            console.warn('No fue posible loggear pacientes sin asignar:', logErr.message);
        }

        res.json({ success: true, data: pacientes });
    } catch (error) {
        console.error('Error al obtener pacientes sin asignar:', error);
        res.status(500).json({ success: false, message: 'Error al obtener pacientes sin asignar', error: error.message });
    }
});

router.get('/candidatos-alta', verifyToken, requireRole(['coordinador', 'terapeuta']), async (req, res) => {
    try {
        console.log('🔍 Solicitando candidatos a alta...');

        // Query sin filtro por ultimo_no_aprobado (columna eliminada)
        const query = `
          SELECT 
            p.id,
            CONCAT(p.nombre, ' ', p.apellido) as paciente_nombre,
            TIMESTAMPDIFF(YEAR, p.fecha_inscripcion, CURDATE()) as edad,
            e.motivo_consulta,
            DATE(p.created_at) as fecha_ingreso,
            COUNT(DISTINCT c.id) as sesiones_totales,
            SUM(CASE WHEN c.estado = 'completada' THEN 1 ELSE 0 END) as sesiones_completadas,
            CONCAT(u_psi.nombre, ' ', u_psi.apellido) as psicologo_nombre,
            CONCAT(u_bec.nombre, ' ', u_bec.apellido) as becario_nombre
          FROM pacientes p
          LEFT JOIN expedientes e ON p.id = e.paciente_id
          LEFT JOIN asignaciones a ON p.id = a.paciente_id AND a.estado = 'activa'
          LEFT JOIN users u_psi ON a.psicologo_id = u_psi.id
          LEFT JOIN users u_bec ON a.becario_id = u_bec.id
          LEFT JOIN citas c ON p.id = c.paciente_id AND c.estado != 'cancelada'
          WHERE p.activo = true
          GROUP BY p.id, e.motivo_consulta, u_psi.nombre, u_psi.apellido, u_bec.nombre, u_bec.apellido
          HAVING COUNT(DISTINCT c.id) > 0
             AND SUM(CASE WHEN c.estado = 'completada' THEN 1 ELSE 0 END) = COUNT(DISTINCT c.id)
          ORDER BY COUNT(DISTINCT c.id) DESC, paciente_nombre ASC
        `;

        console.log('📊 Ejecutando query de candidatos a alta...');
        const candidatos = await sequelize.query(query, {
            type: QueryTypes.SELECT
        });

        console.log(`✅ Candidatos encontrados: ${candidatos.length}`);

        // Para debugging: mostrar qué pacientes se encontraron
        if (candidatos.length > 0) {
            console.log('📋 Lista de candidatos encontrados:');
            candidatos.forEach((c, i) => {
                console.log(`${i + 1}. ${c.paciente_nombre} - ${c.sesiones_completadas} sesiones`);
            });
        }

        res.json({
            success: true,
            data: candidatos
        });

    } catch (error) {
        console.error('❌ Error CRÍTICO al obtener candidatos a alta:', error);
        console.error('📌 Mensaje de error:', error.message);
        console.error('📌 Stack trace:', error.stack);

        // Para debugging: probar una query más simple
        try {
            console.log('🔄 Probando query alternativa...');
            const querySimple = `
              SELECT p.id, CONCAT(p.nombre, ' ', p.apellido) as paciente_nombre
              FROM pacientes p
              WHERE p.activo = true
              LIMIT 5
            `;
            const prueba = await sequelize.query(querySimple, { type: QueryTypes.SELECT });
            console.log('🔍 Resultado de prueba:', prueba);
        } catch (err) {
            console.error('❌ Error en query de prueba:', err.message);
        }

        res.status(500).json({
            success: false,
            message: 'Error al obtener candidatos a alta: ' + error.message,
            debug: process.env.NODE_ENV === 'development' ? {
                error: error.message,
                stack: error.stack
            } : undefined
        });
    }
});

// Obtener paciente por ID con detalles
router.get('/:id', verifyToken, requireRole(['coordinador', 'terapeuta']), async (req, res) => {
    try {
        const { id } = req.params;

        const query = `
            SELECT 
                p.*,
                CONCAT(p.nombre, ' ', p.apellido) as nombre_completo,
                TIMESTAMPDIFF(YEAR, p.fecha_inscripcion, CURDATE()) as edad,
                COUNT(DISTINCT c.id) as sesiones_completadas,
                CONCAT(u_psi.nombre, ' ', u_psi.apellido) as psicologo_nombre,
                CONCAT(u_bec.nombre, ' ', u_bec.apellido) as becario_nombre,
                a.fecha_inicio,
                a.estado as estado_asignacion,
                e.motivo_consulta,
                e.motivo_consulta_especial,
                e.diagnostico_presuntivo,
                e.riesgo_suicida
            FROM pacientes p
            LEFT JOIN expedientes e ON p.id = e.paciente_id
            LEFT JOIN asignaciones a ON p.id = a.paciente_id AND a.estado = 'activa'
            LEFT JOIN users u_psi ON a.psicologo_id = u_psi.id
            LEFT JOIN users u_bec ON a.becario_id = u_bec.id
            LEFT JOIN citas c ON p.id = c.paciente_id AND c.estado = 'completada'
            WHERE p.id = ?
            GROUP BY p.id, e.id, u_psi.id, u_bec.id, a.id
        `;

        const [paciente] = await sequelize.query(query, {
            replacements: [id],
            type: QueryTypes.SELECT
        });

        if (!paciente) {
            return res.status(404).json({
                success: false,
                message: 'Paciente no encontrado'
            });
        }

        paciente.disponibilidad = parseDisponibilidad(paciente.disponibilidad, paciente.comentarios_disponibilidad);

        res.json({
            success: true,
            data: paciente
        });

    } catch (error) {
        console.error('Error al obtener paciente:', error);
        res.status(500).json({
            success: false,
            message: 'Error al obtener paciente'
        });
    }
});

// backend/src/routes/pacienteRoutes.js - Agrega este endpoint
router.post('/:id/marcar-no-aprobado', verifyToken, requireRole(['coordinador', 'terapeuta']), async (req, res) => {
    try {
        const { id } = req.params;
        const { motivo } = req.body;

        // Registrar en logs o en una tabla específica
        await sequelize.query(`
            INSERT INTO logs_sistema (usuario_id, tipo_log, modulo, accion, descripcion, created_at)
            VALUES (?, 'modificacion', 'altas', 'No aprobar alta paciente', ?, NOW())
        `, {
            replacements: [req.user.id, `Paciente ${id} no aprobado para alta - Motivo: ${motivo || 'Sin motivo especificado'}`]
        });

        // También podrías crear una notificación para el psicólogo
        const [pacienteInfo] = await sequelize.query(`
            SELECT CONCAT(p.nombre, ' ', p.apellido) as paciente_nombre,
                   a.psicologo_id
            FROM pacientes p
            LEFT JOIN asignaciones a ON p.id = a.paciente_id AND a.estado = 'activa'
            WHERE p.id = ?
        `, {
            replacements: [id],
            type: QueryTypes.SELECT
        });

        if (pacienteInfo && pacienteInfo.psicologo_id) {
            await sequelize.query(`
                INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, created_at)
                VALUES (?, 'observacion_nueva', 'Paciente no aprobado para alta', 
                        CONCAT('El paciente ', ?, ' no fue aprobado para alta terapéutica. Continuar tratamiento.'), NOW())
            `, {
                replacements: [pacienteInfo.psicologo_id, pacienteInfo.paciente_nombre]
            });
        }

        res.json({
            success: true,
            message: 'Paciente marcado como no aprobado para alta'
        });

    } catch (error) {
        console.error('Error al marcar paciente como no aprobado:', error);
        res.status(500).json({
            success: false,
            message: 'Error al procesar la solicitud'
        });
    }
});

router.post('/:id/no-aprobar-alta', verifyToken, requireRole(['coordinador', 'terapeuta']), async (req, res) => {
    try {
        const { id } = req.params;
        const { motivo } = req.body || {}; // Agregar campo para motivo

        console.log(`📝 Marcando paciente ${id} como no aprobado...`);

        // Verificar que el paciente existe y está activo
        const paciente = await Paciente.findByPk(id);

        if (!paciente || !paciente.activo) {
            return res.status(404).json({
                success: false,
                message: 'Paciente no encontrado o ya inactivo'
            });
        }

        // 1. Obtener estadísticas del paciente
        const [estadisticas] = await sequelize.query(`
            SELECT 
                COUNT(*) as total_sesiones,
                COUNT(CASE WHEN estado = 'completada' THEN 1 END) as sesiones_completadas
            FROM citas 
            WHERE paciente_id = ?
            AND estado IN ('completada', 'cancelada')
        `, {
            replacements: [id],
            type: QueryTypes.SELECT
        });

        // 2. Crear registro en la tabla altas con tipo 'no_aprobado'
        await sequelize.query(`
            INSERT INTO altas (
                paciente_id, 
                usuario_id, 
                tipo_alta, 
                fecha_alta, 
                motivo_detallado, 
                sesiones_totales,
                created_at
            ) VALUES (?, ?, ?, CURDATE(), ?, ?, NOW())
        `, {
            replacements: [
                id,
                req.user.id,
                'no_aprobado',  // Nuevo tipo de alta
                motivo || 'Paciente no aprobado para alta terapéutica por el coordinador',
                estadisticas?.sesiones_completadas || 0
            ]
        });

        // 3. (Eliminado) No se actualiza columna ultimo_no_aprobado porque no existe

        // 4. Registrar en logs
        await sequelize.query(`
            INSERT INTO logs_sistema (usuario_id, tipo_log, modulo, accion, descripcion, created_at)
            VALUES (?, 'modificacion', 'altas', 'No aprobar alta', ?, NOW())
        `, {
            replacements: [req.user.id, `Paciente ${id} (${paciente.nombre} ${paciente.apellido}) NO APROBADO para alta`]
        });

        // 5. Obtener el ID del registro de alta creado
        const [altaCreada] = await sequelize.query(`
            SELECT * FROM altas 
            WHERE paciente_id = ? 
            AND tipo_alta = 'no_aprobado'
            ORDER BY created_at DESC 
            LIMIT 1
        `, {
            replacements: [id],
            type: QueryTypes.SELECT
        });

        console.log(`✅ Paciente ${id} registrado como NO APROBADO en tabla altas`);

        res.json({
            success: true,
            message: 'Paciente registrado como no aprobado para alta',
            data: {
                paciente_id: id,
                alta_id: altaCreada?.id,
                fecha_no_aprobado: new Date().toISOString().split('T')[0],
                paciente_nombre: `${paciente.nombre} ${paciente.apellido}`,
                tipo_alta: 'no_aprobado'
            }
        });

    } catch (error) {
        console.error('❌ Error al marcar paciente como no aprobado:', error);
        console.error('📌 Detalles del error:', error.message);
        res.status(500).json({
            success: false,
            message: 'Error al procesar la solicitud: ' + error.message
        });
    }
});
module.exports = router;