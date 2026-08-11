const express = require('express');
const router = express.Router();
const verifyToken = require('../middlewares/authMiddleware');
const { requireRole } = require('../middlewares/roleMiddleware');
const bcrypt = require('bcryptjs');
const User = require('../models/userModel');
const { Op } = require('sequelize');
const EmailService = require('../services/emailService');
const Cita = require('../models/citaModel');
const Paciente = require('../models/pacienteModel');
const Asignacion = require('../models/asignacionModel');
const Solicitud = require('../models/Solicitud');
const Disponibilidad = require('../models/disponibilidadModel');
const { sequelize } = require('../models/userModel');

// Obtener todos los coterapeutas
router.get('/becarios', verifyToken, async (req, res) => {
  try {
    const becarios = await User.findAll({
      where: { rol: 'coterapeuta', activo: true },
      attributes: ['id', 'nombre', 'apellido', 'email'],
      order: [['apellido', 'ASC'], ['nombre', 'ASC']]
    });
    
    res.json(becarios);
  } catch (error) {
    res.status(500).json({ message: 'Error al obtener coterapeutas' });
  }
});

// Obtener todos los usuarios (coordinadores pueden acceder)
router.get('/', verifyToken, requireRole(['coordinador']), async (req, res) => {
  try {
    const whereClause = {};
    if (req.query.rol) {
      const rol = req.query.rol;
      if (rol === 'terapeuta') {
        whereClause.rol = { [Op.in]: ['terapeuta', 'psicologo'] };
      } else if (rol === 'coterapeuta') {
        whereClause.rol = { [Op.in]: ['coterapeuta', 'becario'] };
      } else {
        whereClause.rol = rol;
      }
    }
    if (req.query.activo !== undefined) {
      whereClause.activo = req.query.activo === 'true' || req.query.activo === true;
    }

    const users = await User.findAll({
      where: whereClause,
      attributes: ['id', 'nombre', 'apellido', 'email', 'telefono', 'rol', 'especialidad', 'fundacion_id', 'activo', 'created_at'],
      order: [['apellido', 'ASC'], ['nombre', 'ASC']]
    });

    // Calcular horas para cada usuario
    const usersConHoras = await Promise.all(users.map(async (u) => {
      // Obtener citas completadas del usuario
      const citasCompletadas = await Cita.findAll({
        where: {
          [Op.or]: [
            { psicologo_id: u.id },
            { becario_id: u.id }
          ],
          estado: 'completada'
        },
        attributes: ['duracion'],
        raw: true
      });

      // Calcular horas liberadas (suma de duraciones en minutos, convertir a horas, redondear)
      const minutosLiberados = citasCompletadas
        .filter(c => c.duracion)
        .reduce((sum, c) => sum + c.duracion, 0);
      const horasLiberadas = Math.round(minutosLiberados / 60);

      // Obtener horas objetivo de la solicitud
      let horasObjetivo = 0;
      const solicitud = await Solicitud.findOne({
        where: {
          email: u.email,
          estado: 'APROBADA'
        },
        attributes: ['horas_a_liberar'],
        order: [['fecha_resolucion', 'DESC']]
      });

      if (solicitud && solicitud.horas_a_liberar) {
        horasObjetivo = solicitud.horas_a_liberar;
      }

      return {
        id: u.id,
        nombre: u.nombre,
        apellido: u.apellido,
        email: u.email,
        telefono: u.telefono,
        rol: u.rol,
        especialidad: u.especialidad,
        fundacion_id: u.fundacion_id,
        activo: u.activo,
        fecha_registro: u.created_at,
        horas_liberadas: horasLiberadas,
        horas_objetivo: horasObjetivo
      };
    }));

    res.json(usersConHoras);
  } catch (error) {
    console.error('Error al listar usuarios:', error);
    res.status(500).json({ message: 'Error al obtener usuarios' });
  }
});

// Crear nuevo usuario (solo coordinadores)
router.post('/', verifyToken, requireRole(['coordinador']), async (req, res) => {
  try {
    const { nombre, apellido, email, telefono, rol, especialidad, fundacion_id, activo, password } = req.body;

    if (!nombre || !apellido || !email || !password) {
      return res.status(400).json({ message: 'Faltan datos requeridos' });
    }

    // Hashear contraseña
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    const newUser = await User.create({
      nombre,
      apellido,
      email,
      telefono,
      rol: rol || 'coterapeuta',
      especialidad,
      fundacion_id: fundacion_id || null,
      activo: typeof activo === 'boolean' ? activo : true,
      password: hashed
    });

    // Enviar correo con credenciales (no bloqueante)
    EmailService.enviarBienvenidaUsuario({
      nombre,
      apellido,
      email,
      passwordTemporal: password,
      rol: rol || 'coterapeuta'
    }).catch(() => {});

    res.status(201).json({
      id: newUser.id,
      nombre: newUser.nombre,
      apellido: newUser.apellido,
      email: newUser.email,
      telefono: newUser.telefono,
      rol: newUser.rol,
      especialidad: newUser.especialidad,
      fundacion_id: newUser.fundacion_id,
      activo: newUser.activo,
      fecha_registro: newUser.created_at
    });

  } catch (error) {
    console.error('Error al crear usuario:', error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'El correo ya está registrado' });
    }
    res.status(500).json({ message: 'Error al crear usuario' });
  }
});

// Actualizar usuario (solo coordinadores)
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const id = req.params.id;
    const { nombre, apellido, email, telefono, rol, especialidad, fundacion_id, activo, password, direccion, cedula_profesional } = req.body;

    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Verificar permisos: coordinador puede editar todo, usuario puede editar su propio perfil
    const tokenUserId = req.user.id || req.user.userId;
    const isCoordinador = req.user.rol === 'coordinador' || req.user.role === 'coordinador';
    const isSelfEdit = tokenUserId === parseInt(id);

    if (!isCoordinador && !isSelfEdit) {
      return res.status(403).json({ message: 'No tienes permiso para editar este usuario' });
    }

    const updatedFields = {
      nombre: nombre ?? user.nombre,
      apellido: apellido ?? user.apellido,
      telefono: telefono ?? user.telefono,
      especialidad: especialidad ?? user.especialidad,
      direccion: direccion ?? user.direccion,
      cedula_profesional: cedula_profesional ?? user.cedula_profesional
    };

    // Solo coordinadores pueden cambiar rol, email, fundacion y estado
    if (isCoordinador) {
      updatedFields.email = email ?? user.email;
      updatedFields.rol = rol ?? user.rol;
      updatedFields.fundacion_id = fundacion_id ?? user.fundacion_id;
      updatedFields.activo = typeof activo === 'boolean' ? activo : user.activo;
    } else if (email && email !== user.email) {
      // Usuario normal puede cambiar su email
      updatedFields.email = email;
    }

    // Si envían password, hashearla (solo coordinadores)
    let passwordCambiada = false;
    if (password && isCoordinador) {
      const salt = await bcrypt.genSalt(10);
      updatedFields.password = await bcrypt.hash(password, salt);
      passwordCambiada = true;
    }

    await user.update(updatedFields);

    // Enviar correo si se cambió la contraseña
    if (passwordCambiada) {
      try {
        await EmailService.enviarCambioContrasena({
          nombre: user.nombre,
          apellido: user.apellido,
          email: user.email,
          passwordNueva: password
        });
      } catch (error) {
        console.error('Error al enviar correo de cambio de contraseña:', error);
        // No bloquear la respuesta si hay error en email
      }
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        nombre: user.nombre,
        apellido: user.apellido,
        email: user.email,
        telefono: user.telefono,
        rol: user.rol,
        especialidad: user.especialidad,
        direccion: user.direccion,
        cedula_profesional: user.cedula_profesional,
        fundacion_id: user.fundacion_id,
        activo: user.activo,
        fecha_registro: user.created_at
      }
    });
  } catch (error) {
    console.error('Error al actualizar usuario:', error);
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ message: 'El correo ya está registrado' });
    }
    res.status(500).json({ message: 'Error al actualizar usuario' });
  }
});

// Eliminar usuario (soft-delete colocando activo=false) (solo coordinadores)
router.delete('/:id', verifyToken, requireRole(['coordinador']), async (req, res) => {
  try {
    const id = req.params.id;
    const user = await User.findByPk(id);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Soft-delete
    await user.update({ activo: false });

    res.json({
      message: 'Usuario eliminado (inactivado) correctamente',
      id: user.id,
      usuario: {
        id: user.id,
        nombre: user.nombre,
        apellido: user.apellido,
        email: user.email,
        telefono: user.telefono,
        rol: user.rol,
        especialidad: user.especialidad,
        fundacion_id: user.fundacion_id,
        activo: user.activo,
        fecha_registro: user.created_at
      }
    });
  } catch (error) {
    console.error('Error al eliminar usuario:', error);
    res.status(500).json({ message: 'Error al eliminar usuario' });
  }
});

// Cambiar contraseña (cualquier usuario autenticado)
router.post('/change-password', verifyToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user.id || req.user.userId;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Contraseña actual y nueva son requeridas' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'La nueva contraseña debe tener al menos 6 caracteres' });
    }

    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Verificar contraseña actual
    const isValidPassword = await bcrypt.compare(currentPassword, user.password);
    if (!isValidPassword) {
      return res.status(401).json({ message: 'Contraseña actual incorrecta' });
    }

    // Hashear nueva contraseña
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(newPassword, salt);

    await user.update({ password: hashedPassword });

    res.json({
      success: true,
      message: 'Contraseña actualizada correctamente'
    });
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    res.status(500).json({ message: 'Error al cambiar contraseña' });
  }
});

// Obtener estadísticas detalladas de un usuario
router.get('/:id/estadisticas', verifyToken, requireRole(['coordinador']), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    
    // Verificar que el usuario existe
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: 'Usuario no encontrado' });
    }

    // Obtener fechas del mes actual
    const hoy = new Date();
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    const ultimoDiaMes = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0);

    // 1. Estadísticas de citas (como terapeuta y coterapeuta) del mes actual
    const citasComoPsicologo = await Cita.findAll({
      where: { 
        psicologo_id: userId,
        fecha: {
          [Op.gte]: primerDiaMes,
          [Op.lte]: ultimoDiaMes
        }
      },
      attributes: ['estado', 'motivo_cancelacion', 'duracion'],
      raw: true
    });

    const citasComoBecario = await Cita.findAll({
      where: { 
        becario_id: userId,
        fecha: {
          [Op.gte]: primerDiaMes,
          [Op.lte]: ultimoDiaMes
        }
      },
      attributes: ['estado', 'motivo_cancelacion', 'duracion'],
      raw: true
    });

    const todasCitas = [...citasComoPsicologo, ...citasComoBecario];
    
    const totalCitas = todasCitas.length;
    const citasCompletadas = todasCitas.filter(c => c.estado === 'completada').length;
    const citasCanceladas = todasCitas.filter(c => c.estado === 'cancelada').length;
    const citasPendientes = todasCitas.filter(c => c.estado === 'programada' || c.estado === 'confirmada').length;
    
    // Calcular porcentajes que sumen exactamente 100%
    let tasaCompletitud = 0;
    let tasaCancelacion = 0;
    let tasaPendientes = 0;
    
    if (totalCitas > 0) {
      // Calcular porcentajes iniciales
      const pctCompletitud = (citasCompletadas / totalCitas) * 100;
      const pctCancelacion = (citasCanceladas / totalCitas) * 100;
      const pctPendientes = (citasPendientes / totalCitas) * 100;
      
      // Redondear a 2 decimales
      tasaCompletitud = Math.round(pctCompletitud * 100) / 100;
      tasaCancelacion = Math.round(pctCancelacion * 100) / 100;
      tasaPendientes = Math.round(pctPendientes * 100) / 100;
      
      // Ajustar el error de redondeo en el valor más grande
      const suma = tasaCompletitud + tasaCancelacion + tasaPendientes;
      const diferencia = Math.round((100 - suma) * 100) / 100;
      
      if (diferencia !== 0) {
        // Encontrar el mayor para ajustar
        if (citasCompletadas >= citasCanceladas && citasCompletadas >= citasPendientes) {
          tasaCompletitud = Math.round((tasaCompletitud + diferencia) * 100) / 100;
        } else if (citasCanceladas >= citasPendientes) {
          tasaCancelacion = Math.round((tasaCancelacion + diferencia) * 100) / 100;
        } else {
          tasaPendientes = Math.round((tasaPendientes + diferencia) * 100) / 100;
        }
      }
    }
    
    // Calcular citas vencidas (citas pendientes cuya fecha ya pasó en el mes actual)
    hoy.setHours(0, 0, 0, 0);
    
    const citasVencidas = await Cita.count({
      where: {
        [Op.or]: [
          { psicologo_id: userId },
          { becario_id: userId }
        ],
        estado: { [Op.in]: ['programada', 'confirmada'] },
        fecha: { 
          [Op.gte]: primerDiaMes,
          [Op.lt]: hoy 
        }
      }
    });

    // Calcular horas liberadas (sumar duración de citas completadas, convertir de minutos a horas)
    const minutosLiberados = todasCitas
      .filter(c => c.estado === 'completada' && c.duracion)
      .reduce((sum, c) => sum + c.duracion, 0);
    const horasLiberadas = Math.round(minutosLiberados / 60); // Redondear a entero
    
    // 2. Motivos de cancelación
    const citasCanceladasConMotivo = todasCitas.filter(
      c => c.estado === 'cancelada' && c.motivo_cancelacion
    );

    const motivosMap = {};
    citasCanceladasConMotivo.forEach(c => {
      const motivo = c.motivo_cancelacion || 'Sin especificar';
      motivosMap[motivo] = (motivosMap[motivo] || 0) + 1;
    });

    const motivosCancelacion = Object.entries(motivosMap)
      .map(([motivo, cantidad]) => ({ motivo, cantidad }))
      .sort((a, b) => b.cantidad - a.cantidad);

    // 3. Pacientes asignados actualmente
    const asignacionesActivas = await Asignacion.findAll({
      where: {
        [Op.or]: [
          { psicologo_id: userId },
          { becario_id: userId }
        ],
        estado: 'activa'
      },
      include: [{
        model: Paciente,
        attributes: ['id', 'nombre', 'apellido', 'genero', 'fecha_inscripcion', 'activo']
      }],
      attributes: ['id', 'fecha_inicio', 'estado']
    });

    const pacientesAsignados = asignacionesActivas.map(a => {
      const edad = a.Paciente.fecha_inscripcion 
        ? Math.floor((new Date() - new Date(a.Paciente.fecha_inscripcion)) / (365.25 * 24 * 60 * 60 * 1000))
        : null;
      return {
        paciente_id: a.Paciente.id,
        nombre: a.Paciente.nombre,
        apellido: a.Paciente.apellido,
        genero: a.Paciente.genero,
        edad: edad,
        fecha_asignacion: a.fecha_inicio,
        activo: a.Paciente.activo
      };
    });

    // 4. Historial de pacientes (todas las asignaciones, incluyendo finalizadas)
    const todasAsignaciones = await Asignacion.findAll({
      where: {
        [Op.or]: [
          { psicologo_id: userId },
          { becario_id: userId }
        ]
      },
      include: [{
        model: Paciente,
        attributes: ['id', 'nombre', 'apellido', 'genero', 'fecha_inscripcion']
      }],
      attributes: ['id', 'fecha_inicio', 'fecha_fin', 'estado'],
      order: [['fecha_inicio', 'DESC']]
    });

    const historialPacientes = todasAsignaciones.map(a => {
      const edad = a.Paciente.fecha_inscripcion 
        ? Math.floor((new Date() - new Date(a.Paciente.fecha_inscripcion)) / (365.25 * 24 * 60 * 60 * 1000))
        : null;
      return {
        asignacion_id: a.id,
        paciente_id: a.Paciente.id,
        nombre: a.Paciente.nombre,
        apellido: a.Paciente.apellido,
        genero: a.Paciente.genero,
        edad: edad,
        fecha_asignacion: a.fecha_inicio,
        fecha_fin: a.fecha_fin,
        estado: a.estado
      };
    });

    // 5. Citas con pacientes (historial de sesiones)
    const citasConPacientes = await Cita.findAll({
      where: {
        [Op.or]: [
          { psicologo_id: userId },
          { becario_id: userId }
        ],
        estado: 'completada'
      },
      include: [{
        model: Paciente,
        attributes: ['id', 'nombre', 'apellido']
      }],
      attributes: ['id', 'fecha', 'hora', 'tipo_consulta', 'duracion', 'estado'],
      order: [['fecha', 'DESC']],
      limit: 50 // últimas 50 sesiones
    });

    const sesionesCompletadas = citasConPacientes.map(c => ({
      cita_id: c.id,
      paciente_id: c.Paciente.id,
      paciente_nombre: `${c.Paciente.nombre} ${c.Paciente.apellido}`,
      fecha: c.fecha,
      hora: c.hora,
      tipo_consulta: c.tipo_consulta,
      duracion: c.duracion
    }));

    // 6. Obtener horas objetivo del preregistro (solicitud aprobada)
    let horasObjetivo = 0;
    const solicitud = await Solicitud.findOne({
      where: {
        email: user.email,
        estado: 'APROBADA'
      },
      attributes: ['horas_a_liberar'],
      order: [['fecha_resolucion', 'DESC']]
    });

    if (solicitud && solicitud.horas_a_liberar) {
      horasObjetivo = solicitud.horas_a_liberar;
    }

    // 7. Obtener disponibilidad del usuario
    const disponibilidades = await Disponibilidad.findAll({
      where: {
        usuario_id: userId,
        activo: true
      },
      attributes: ['id', 'dia_semana', 'hora_inicio', 'hora_fin', 'tipo_disponibilidad', 'max_citas_dia', 'intervalo_citas'],
      order: [
        [sequelize.literal(`CASE dia_semana
          WHEN 'lunes' THEN 1
          WHEN 'martes' THEN 2
          WHEN 'miercoles' THEN 3
          WHEN 'jueves' THEN 4
          WHEN 'viernes' THEN 5
          WHEN 'sabado' THEN 6
          WHEN 'domingo' THEN 7
        END`)],
        ['hora_inicio', 'ASC']
      ]
    });

    const disponibilidadFormateada = disponibilidades.map(d => ({
      dia: d.dia_semana,
      hora_inicio: d.hora_inicio,
      hora_fin: d.hora_fin,
      tipo: d.tipo_disponibilidad,
      max_citas: d.max_citas_dia,
      duracion_cita: d.intervalo_citas
    }));

    res.json({
      usuario: {
        id: user.id,
        nombre: user.nombre,
        apellido: user.apellido,
        email: user.email,
        rol: user.rol,
        especialidad: user.especialidad
      },
      estadisticas: {
        total_citas: totalCitas,
        citas_completadas: citasCompletadas,
        citas_canceladas: citasCanceladas,
        citas_pendientes: citasPendientes,
        citas_vencidas: citasVencidas,
        tasa_completitud: tasaCompletitud,
        tasa_cancelacion: tasaCancelacion,
        tasa_pendientes: tasaPendientes,
        horas_liberadas: horasLiberadas,
        horas_objetivo: horasObjetivo
      },
      motivos_cancelacion: motivosCancelacion,
      pacientes_asignados: pacientesAsignados,
      historial_pacientes: historialPacientes,
      sesiones_completadas: sesionesCompletadas,
      disponibilidad: disponibilidadFormateada
    });

  } catch (error) {
    console.error('Error al obtener estadísticas de usuario:', error);
    res.status(500).json({ message: 'Error al obtener estadísticas', error: error.message });
  }
});

module.exports = router;