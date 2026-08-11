const DatabaseService = require('../services/databaseService');

class CitaController {

    static async obtenerCitaPorId(req, res) {
        try {
            const { id } = req.params;

            if (!id) {
                return res.status(400).json({
                    success: false,
                    message: 'El parámetro id es requerido'
                });
            }

            console.log(`Buscando cita con id: ${id}`);

            const cita = await DatabaseService.obtenerCitaPorId(parseInt(id));

            if (!cita) {
                return res.status(404).json({
                    success: false,
                    message: 'Cita no encontrada'
                });
            }

            res.json({
                success: true,
                data: cita
            });

        } catch (error) {
            console.error('Error en obtenerCitaPorId:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener la cita',
                error: error.message
            });
        }
    }

    static async obtenerCitasPorPaciente(req, res) {
        try {
            const { paciente_id } = req.params;

            if (!paciente_id) {
                return res.status(400).json({
                    success: false,
                    message: 'El parámetro paciente_id es requerido'
                });
            }

            console.log(`Buscando citas para paciente_id: ${paciente_id}`);

            const citas = await DatabaseService.obtenerCitasPorPaciente(parseInt(paciente_id));

            console.log(`Citas encontradas: ${Array.isArray(citas) ? citas.length : 0}`);

            const citasArray = Array.isArray(citas) ? citas : [];

            res.json({
                success: true,
                data: citasArray,
                count: citasArray.length
            });

        } catch (error) {
            console.error('Error en obtenerCitasPorPaciente:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener citas del paciente',
                error: error.message
            });
        }
    }

    static async obtenerCitasPorFecha(req, res) {
        try {
            console.log('obtenerCitasPorFecha llamado');
            console.log('Query params:', req.query);

            const { fecha, becario_id } = req.query;

            // Validar parámetro requerido
            if (!fecha) {
                return res.status(400).json({
                    success: false,
                    message: 'El parámetro "fecha" es requerido (formato: YYYY-MM-DD)'
                });
            }

            // Si el usuario es becario, solo mostrar sus citas asignadas
            let becarioId = becario_id ? parseInt(becario_id) : null;
            if (req.user && req.user.role === 'becario') {
                becarioId = req.user.id;
            }

            console.log(`Buscando citas para fecha: ${fecha}, becarioId: ${becarioId}`);

            const citas = await DatabaseService.obtenerCitasPorFechaBecario(fecha, becarioId);

            console.log(`Citas encontradas: ${Array.isArray(citas) ? citas.length : 0}`);

            // Asegurarnos de que citas siempre sea un array
            const citasArray = Array.isArray(citas) ? citas : [];

            res.json({
                success: true,
                data: citasArray,
                count: citasArray.length
            });

        } catch (error) {
            console.error('Error en obtenerCitasPorFecha:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener citas',
                error: error.message
            });
        }
    }

    static async crearNuevaCita(req, res) {
        try {
            const { paciente, fecha, hora, tipo_consulta, departamento, duracion, notas, becario_id, color, terapeuta_id, coterapeuta_id, total_sesiones, titulo } = req.body;

            const normalizarFecha = (valor) => {
                if (!valor) return valor;
                if (typeof valor === 'string') {
                    return valor.split('T')[0];
                }
                if (valor instanceof Date && !Number.isNaN(valor.getTime())) {
                    return valor.toISOString().split('T')[0];
                }
                return valor;
            };

            const normalizarHora = (valor) => {
                if (!valor) return valor;
                if (typeof valor === 'string') {
                    return valor.length >= 5 ? valor.slice(0, 5) : valor;
                }
                return valor;
            };

            const fechaNormalizada = normalizarFecha(fecha);
            const horaNormalizada = normalizarHora(hora);

            // Verificar que el usuario esté autenticado
            if (!req.user || !req.user.id) {
                return res.status(401).json({ success: false, message: 'No autorizado: falta token o sesión' });
            }
            const usuarioId = req.user.id;
            const usuarioRol = req.user.rol || req.user.role;

            console.log('📝 Datos recibidos para nueva cita:', {
                paciente,
                paciente_id: req.body.paciente_id,
                titulo,
                fecha: fechaNormalizada,
                hora: horaNormalizada,
                tipo_consulta,
                departamento,
                duracion,
                notas,
                becario_id,
                terapeuta_id,
                coterapeuta_id,
                color,
                usuarioId,
                usuarioRol
            });

            // Validar campos requeridos
            if ((!paciente || !paciente.nombre || !paciente.apellido) && !req.body.paciente_id) {
                return res.status(400).json({
                    success: false,
                    message: 'Faltan campos requeridos: paciente (nombre, apellido) o paciente_id, fecha y hora'
                });
            }
            if (!fechaNormalizada || !horaNormalizada) {
                return res.status(400).json({
                    success: false,
                    message: 'Faltan campos requeridos: fecha y hora'
                });
            }

            // Si es becario/coterapeuta/psicopedagógico y no se especificó becario_id, asignar al usuario actual
            let finalBecarioId = coterapeuta_id || becario_id;
            if (['becario', 'coterapeuta', 'psicopedagogico'].includes(usuarioRol) && !finalBecarioId) {
                finalBecarioId = usuarioId;
            }

            const finalPsicologoId = terapeuta_id || (usuarioRol === 'terapeuta' ? usuarioId : null) || (usuarioRol === 'psicopedagogico' ? usuarioId : null);

            if (!finalPsicologoId) {
                return res.status(400).json({
                    success: false,
                    message: 'Falta terapeuta_id para asignar la cita'
                });
            }

            // Crear la cita usando DatabaseService
            const nuevaCita = await DatabaseService.crearNuevaCita({
                paciente,
                paciente_id: req.body.paciente_id || null,
                titulo: titulo || null,
                fecha: fechaNormalizada,
                hora: horaNormalizada,
                tipo_consulta: tipo_consulta || 'presencial',
                departamento: departamento || 'DEPAC',
                duracion: duracion || 50,
                notas,
                psicologo_id: finalPsicologoId,
                becario_id: finalBecarioId,
                color,
                usuarioId,
                total_sesiones: total_sesiones ? Number(total_sesiones) : 1
            });

            const createdCount = Array.isArray(nuevaCita) ? nuevaCita.length : 1;

            res.json({
                success: true,
                message: createdCount > 1 ? `Citas creadas exitosamente (${createdCount})` : 'Cita creada exitosamente',
                data: nuevaCita,
                count: createdCount
            });

        } catch (error) {
            console.error('❌ Error en crearNuevaCita:', error);
            res.status(500).json({
                success: false,
                message: `Error al crear la cita: ${error.message}`,
                error: error.message
            });
        }
    }

    static async generarReporteMensual(req, res) {
        try {
            const { mes, anio, psicologo_id } = req.query;
            const psicologoId = psicologo_id ? parseInt(psicologo_id) : null;

            const reporte = await DatabaseService.generarReporteMensual(
                parseInt(mes),
                parseInt(anio),
                psicologoId
            );

            res.json({
                success: true,
                data: reporte,
                count: reporte.length,
                mes: mes,
                anio: anio
            });

        } catch (error) {
            console.error('Error en generarReporteMensual:', error);
            res.status(500).json({
                success: false,
                message: 'Error al generar reporte',
                error: error.message
            });
        }
    }

    static async darAltaPaciente(req, res) {
        try {
            const { paciente_id, tipo_alta, notas } = req.body;
            const usuarioId = req.user.id;

            if (!paciente_id || !tipo_alta) {
                return res.status(400).json({
                    success: false,
                    message: 'Faltan campos requeridos: paciente_id y tipo_alta'
                });
            }

            await DatabaseService.darAltaPaciente(
                paciente_id,
                tipo_alta,
                usuarioId,
                notas
            );

            res.json({
                success: true,
                message: 'Paciente dado de alta exitosamente'
            });

        } catch (error) {
            console.error('Error en darAltaPaciente:', error);
            res.status(500).json({
                success: false,
                message: 'Error al dar de alta paciente',
                error: error.message
            });
        }
    }

    static async cancelarCitasFuturasPaciente(req, res) {
        try {
            const { paciente_id } = req.params;
            const { motivo_cancelacion } = req.body;
            const usuarioId = req.user.id;

            if (!paciente_id) {
                return res.status(400).json({
                    success: false,
                    message: 'El parámetro paciente_id es requerido'
                });
            }

            if (!motivo_cancelacion) {
                return res.status(400).json({
                    success: false,
                    message: 'El motivo_cancelacion es requerido'
                });
            }

            const citasCanceladas = await DatabaseService.cancelarCitasFuturasPaciente(
                parseInt(paciente_id),
                motivo_cancelacion,
                usuarioId
            );

            return res.json({
                success: true,
                message: 'Citas futuras canceladas exitosamente',
                citasCanceladas
            });
        } catch (error) {
            console.error('Error en cancelarCitasFuturasPaciente:', error);
            return res.status(500).json({
                success: false,
                message: 'Error al cancelar citas futuras',
                error: error.message
            });
        }
    }

    static async actualizarCita(req, res) {
        try {
            const { id } = req.params;
            const updates = req.body;
            const usuarioId = req.user.id;

            // Validar campos que se pueden actualizar
            const camposPermitidos = ['fecha', 'hora', 'tipo_consulta', 'estado', 'notas', 'motivo_cancelacion', 'psicologo_id', 'becario_id', 'color'];
            const updatesFiltrados = {};

            for (const campo of camposPermitidos) {
                if (updates[campo] !== undefined) {
                    updatesFiltrados[campo] = updates[campo];
                }
            }

            if (Object.keys(updatesFiltrados).length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'No se proporcionaron campos válidos para actualizar'
                });
            }

            const updatedCita = await DatabaseService.actualizarCita(
                parseInt(id),
                updatesFiltrados,
                usuarioId
            );

            res.json({
                success: true,
                message: 'Cita actualizada exitosamente',
                data: updatedCita
            });

        } catch (error) {
            console.error('Error en actualizarCita:', error);
            res.status(500).json({
                success: false,
                message: 'Error al actualizar cita',
                error: error.message
            });
        }
    }

    static async obtenerEstadisticas(req, res) {
        try {
            const { fecha_inicio, fecha_fin, psicologo_id } = req.query;
            const psicologoId = psicologo_id ? parseInt(psicologo_id) : null;

            const estadisticas = await DatabaseService.obtenerEstadisticas(
                fecha_inicio,
                fecha_fin,
                psicologoId
            );

            res.json({
                success: true,
                data: estadisticas
            });

        } catch (error) {
            console.error('Error en obtenerEstadisticas:', error);
            res.status(500).json({
                success: false,
                message: 'Error al obtener estadísticas',
                error: error.message
            });
        }
    }
}

module.exports = CitaController;