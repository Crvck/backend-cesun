const Solicitud = require('../models/Solicitud');
const sequelize = require('../config/db');
// IMPORTAMOS EL SERVICIO NUEVO
const notificationService = require('../services/notificationService'); 

exports.crearSolicitud = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    console.log('=== PREREGISTRO REQUEST ===');
    console.log('Body recibido:', JSON.stringify(req.body, null, 2));
    
    const { 
      nombre, email, telefono, esEstudiante, 
      matricula, institucionProcedencia, horasALiberar, motivo, disponibilidad
    } = req.body;

    console.log('Datos extraídos:', { nombre, email, telefono, esEstudiante, disponibilidad });

    // --- VALIDACIONES ---
    // Validar email no duplicado
    console.log('🔍 Verificando si email existe...');
    const solicitudExistente = await Solicitud.findOne({
      where: { email },
      transaction: t
    });

    if (solicitudExistente && solicitudExistente.estado === 'APROBADA') {
      console.log('❌ Email ya registrado y aprobado');
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Este email ya está registrado como usuario aprobado.'
      });
    }

    // Validar que tenga al menos un día de disponibilidad
    console.log('✅ Email disponible');
    console.log('🔍 Validando disponibilidad...');
    if (!disponibilidad || disponibilidad.length === 0) {
      console.log('❌ Sin disponibilidad');
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Debe seleccionar al menos un día de disponibilidad.'
      });
    }
    console.log('✅ Disponibilidad válida:', disponibilidad.length, 'días');

    // 1. Crear la Solicitud
    console.log('💾 Creando solicitud...');
    const nuevaSolicitud = await Solicitud.create({
      nombre_completo: nombre,
      email,
      telefono,
      origen: esEstudiante ? 'CESUN' : 'EXTERNO',
      matricula: esEstudiante ? matricula : null,
      institucion_procedencia: esEstudiante ? 'CESUN' : institucionProcedencia,
      horas_a_liberar: horasALiberar,
      motivo,
      estado: 'PENDIENTE',
      disponibilidad_horaria: JSON.stringify(disponibilidad) // Guardar disponibilidad como JSON en la solicitud
    }, { transaction: t });
    console.log('✅ Solicitud creada con ID:', nuevaSolicitud.id);

    // 2. USAR EL SERVICIO DE NOTIFICACIÓN
    console.log('📧 Enviando notificación a coordinadores...');
    await notificationService.notificarRol(
        'COORDINADOR', 
        {
            titulo: 'Nueva Solicitud de Ingreso',
            mensaje: `${nombre} ha solicitado ingresar como practicante.`,
            tipo: 'alerta_sistema',
            prioridad: 'media',
            accion_url: `/dashboard/solicitudes/${nuevaSolicitud.id}`,
            extra: { 
                solicitud_id: nuevaSolicitud.id,
                origen: esEstudiante ? 'CESUN' : 'Externo'
            }
        }, 
        t
    );
    console.log('✅ Notificación enviada');

    await t.commit();
    console.log('✅ Transacción completada');

    res.status(201).json({
      success: true,
      message: 'Solicitud enviada correctamente'
    });

  } catch (error) {
    await t.rollback();
    console.error('❌ Error en pre-registro:', error);
    console.error('Stack trace:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Error interno del servidor.'
    });
  }
};