const sequelize = require('../config/db');
const { randomUUID } = require('crypto');
const { QueryTypes } = require('sequelize');

class DatabaseService {

    static async obtenerCitaPorId(citaId) {
        try {
            console.log('🔍 obtenerCitaPorId - citaId recibido:', citaId, 'tipo:', typeof citaId);

            const query = `
                SELECT 
                    c.id,
                    c.paciente_id,
                    c.fecha,
                    TIME_FORMAT(c.hora, '%H:%i') AS hora,
                    c.estado,
                    c.tipo_consulta,
                    c.duracion,
                    c.notas,
                    c.psicologo_id,
                    c.becario_id,
                    c.terapeuta_id,
                    c.coterapeuta_id,
                    c.total_sesiones,
                    CONCAT(p.nombre, ' ', p.apellido) AS paciente_nombre,
                    u_psi.nombre AS psicologo_nombre,
                    u_bec.nombre AS becario_nombre,
                    u_ter.nombre AS terapeuta_nombre,
                    u_coter.nombre AS coterapeuta_nombre
                FROM citas c
                JOIN pacientes p ON c.paciente_id = p.id
                LEFT JOIN users u_psi ON c.psicologo_id = u_psi.id
                LEFT JOIN users u_bec ON c.becario_id = u_bec.id
                LEFT JOIN users u_ter ON c.terapeuta_id = u_ter.id
                LEFT JOIN users u_coter ON c.coterapeuta_id = u_coter.id
                WHERE c.id = :citaId
            `;

            const [result] = await sequelize.query(query, {
                replacements: { citaId },
                type: QueryTypes.SELECT
            });

            console.log('✅ Cita encontrada:', result ? 'Sí' : 'No');

            return result || null;

        } catch (error) {
            console.error('Error en obtenerCitaPorId:', error);
            throw error;
        }
    }

    static async obtenerCitasPorPaciente(pacienteId) {
        try {
            console.log('🔍 obtenerCitasPorPaciente - pacienteId recibido:', pacienteId, 'tipo:', typeof pacienteId);

            // Primero obtener el paciente
            const [paciente] = await sequelize.query(
                'SELECT id, nombre, apellido FROM pacientes WHERE id = :pacienteId',
                { replacements: { pacienteId }, type: QueryTypes.SELECT }
            );

            if (!paciente) {
                console.log('❌ Paciente no encontrado');
                return [];
            }

            console.log('👤 Paciente encontrado:', paciente);

            // Buscar todos los IDs de pacientes duplicados (mismo nombre y apellido)
            const duplicados = await sequelize.query(
                `SELECT id FROM pacientes 
                 WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(:nombre)) 
                 AND LOWER(TRIM(apellido)) = LOWER(TRIM(:apellido))`,
                {
                    replacements: {
                        nombre: paciente.nombre,
                        apellido: paciente.apellido
                    },
                    type: QueryTypes.SELECT
                }
            );

            const pacienteIds = duplicados.map(p => p.id);
            console.log('🔄 IDs de pacientes duplicados:', pacienteIds);

            // Buscar citas de cualquiera de los pacientes duplicados
            const query = `
                SELECT 
                    c.id,
                    c.paciente_id,
                    c.fecha,
                    TIME_FORMAT(c.hora, '%H:%i') AS hora,
                    c.estado,
                    c.tipo_consulta,
                    c.duracion,
                    c.notas,
                    CONCAT(p.nombre, ' ', p.apellido) AS paciente_nombre,
                    u_psi.nombre AS psicologo_nombre,
                    u_bec.nombre AS becario_nombre
                FROM citas c
                JOIN pacientes p ON c.paciente_id = p.id
                LEFT JOIN users u_psi ON c.psicologo_id = u_psi.id
                LEFT JOIN users u_bec ON c.becario_id = u_bec.id
                WHERE c.paciente_id IN (:pacienteIds)
                ORDER BY c.fecha DESC, c.hora DESC
            `;

            console.log('📝 Ejecutando query con pacienteIds:', pacienteIds);

            const results = await sequelize.query(query, {
                replacements: { pacienteIds },
                type: QueryTypes.SELECT
            });

            console.log('✅ Resultados obtenidos:', results.length);
            if (results.length > 0) {
                console.log('📋 Primera cita encontrada:', results[0]);
            }

            return results;

        } catch (error) {
            console.error('Error en obtenerCitasPorPaciente:', error);
            throw error;
        }
    }

    static async obtenerCitasPorFechaBecario(fecha, becarioId = null) {
        try {
            let query = `
                SELECT 
                    c.*,
                    CONCAT(p.nombre, ' ', p.apellido) AS paciente_nombre,
                    p.telefono AS paciente_telefono,
                    p.email AS paciente_email,
                    u_psi.nombre AS psicologo_nombre,
                    u_bec.nombre AS becario_nombre,
                    c.duracion AS duracion,
                    c.notas AS notas,
                    TIME_FORMAT(c.hora, '%H:%i') AS hora_formatted  -- Formatea la hora
                FROM citas c
                JOIN pacientes p ON c.paciente_id = p.id
                LEFT JOIN users u_psi ON c.psicologo_id = u_psi.id
                LEFT JOIN users u_bec ON c.becario_id = u_bec.id
                WHERE DATE(c.fecha) = :fecha
            `;

            const params = { fecha };

            if (becarioId !== null && becarioId !== undefined) {
                query += ` AND c.becario_id = :becarioId`;
                params.becarioId = becarioId;
            }

            query += ` ORDER BY c.hora`;

            const results = await sequelize.query(query, {
                replacements: params,
                type: QueryTypes.SELECT
            });

            // Mapea los resultados para usar los nombres correctos
            return results.map(row => {
                return {
                    ...row,
                    hora: row.hora_formatted,  // Usa la hora formateada
                    duracion: row.duracion || 50,
                    notas: row.notas || ''
                };
            });

        } catch (error) {
            console.error('Error en obtenerCitasPorFechaBecario:', error);
            throw error;
        }
    }
    // En /src/services/databaseService.js
    static async crearNuevaCita(datosCita) {
        const transaction = await sequelize.transaction();

        try {
            console.log('🔧 Creando nueva cita con datos:', datosCita);

            // 1. Buscar o crear el paciente
            let paciente;

            if (datosCita.paciente_id) {
                const [pacienteExistente] = await sequelize.query(`
                    SELECT id FROM pacientes WHERE id = :paciente_id LIMIT 1
                `, {
                    replacements: { paciente_id: datosCita.paciente_id },
                    transaction
                });

                if (pacienteExistente && pacienteExistente.length > 0) {
                    paciente = pacienteExistente[0];
                    console.log('✅ Usando paciente existente por ID:', paciente);
                } else {
                    throw new Error(`No se encontró paciente con id ${datosCita.paciente_id}`);
                }
            } else if (datosCita.paciente && datosCita.paciente.nombre && datosCita.paciente.apellido) {
                // Primero intentar buscar por nombre y apellido con TRIM
                const [pacienteExistente] = await sequelize.query(`
                    SELECT id FROM pacientes 
                    WHERE LOWER(TRIM(nombre)) = LOWER(TRIM(:nombre)) 
                    AND LOWER(TRIM(apellido)) = LOWER(TRIM(:apellido))
                    LIMIT 1
                `, {
                    replacements: {
                        nombre: datosCita.paciente.nombre.trim(),
                        apellido: datosCita.paciente.apellido.trim()
                    },
                    transaction
                });

                if (pacienteExistente && pacienteExistente.length > 0) {
                    paciente = pacienteExistente[0];
                    console.log('✅ Usando paciente existente:', paciente);
                } else {
                    // Crear nuevo paciente
                    console.log('📋 Creando nuevo paciente');
                    await sequelize.query(`
                        INSERT INTO pacientes (
                            nombre, apellido, email, telefono, estado, activo, created_at, updated_at
                        ) VALUES (
                            :nombre, :apellido, :email, :telefono, 'activo', TRUE, NOW(), NOW()
                        )
                        `, {
                        replacements: {
                            nombre: datosCita.paciente.nombre.trim(),
                            apellido: datosCita.paciente.apellido.trim(),
                            email: datosCita.paciente.email || null,
                            telefono: datosCita.paciente.telefono || null
                        },
                        transaction
                    });

                    const [[pacienteInsertado]] = await sequelize.query(
                        'SELECT LAST_INSERT_ID() AS id',
                        { transaction }
                    );

                    paciente = { id: pacienteInsertado.id };
                    console.log('✅ Nuevo paciente creado con ID:', paciente.id);
                }
            } else {
                throw new Error('Falta información de paciente para crear la cita');
            }

            // 2. Verificar que el profesional de apoyo existe si se especificó
            if (datosCita.becario_id) {
                const [becario] = await sequelize.query(`
                    SELECT id FROM users WHERE id = :becario_id AND rol IN ('becario', 'coterapeuta', 'psicopedagogico')
                `, {
                    replacements: { becario_id: datosCita.becario_id },
                    transaction
                });

                if (!becario || becario.length === 0) {
                    throw new Error('El profesional de apoyo especificado no existe');
                }
            }

            const totalSesiones = Math.max(1, Number(datosCita.total_sesiones || 1));
            const repetirSemanal = totalSesiones > 1;
            const serieId = totalSesiones > 1 ? (datosCita.serie_id || randomUUID()) : null;
            const horaSql = datosCita.hora && String(datosCita.hora).length === 5 ? `${datosCita.hora}:00` : datosCita.hora;

            const parseFechaUtc = (fechaStr) => {
                const [y, m, d] = String(fechaStr || '').split('-').map(Number);
                return new Date(Date.UTC(y, (m || 1) - 1, d || 1));
            };

            const formatFechaUtc = (fechaDate) => fechaDate.toISOString().split('T')[0];

            const baseFecha = parseFechaUtc(datosCita.fecha);
            const fechas = Array.from({ length: totalSesiones }, (_, i) => {
                const fecha = new Date(baseFecha);
                fecha.setUTCDate(baseFecha.getUTCDate() + (repetirSemanal ? i * 7 : i));
                return formatFechaUtc(fecha);
            });

            const citasCreadas = [];

            for (let i = 0; i < fechas.length; i += 1) {
                const fechaSesion = fechas[i];

                // 3. Verificar que no haya conflicto de horario
                const [citasConflicto] = await sequelize.query(`
                    SELECT id FROM citas 
                    WHERE fecha = :fecha 
                    AND hora = :hora 
                    AND estado IN ('programada', 'confirmada')
                    AND (
                        psicologo_id = :psicologo_id
                        OR (:becario_id IS NOT NULL AND becario_id = :becario_id)
                    )
                `, {
                    replacements: {
                        fecha: fechaSesion,
                        hora: horaSql,
                        psicologo_id: datosCita.psicologo_id || datosCita.usuarioId,
                        becario_id: datosCita.becario_id || null
                    },
                    transaction
                });

                if (citasConflicto && citasConflicto.length > 0) {
                    throw new Error(`Ya existe una cita programada para este horario con este terapeuta/coterapeuta (${fechaSesion} ${datosCita.hora})`);
                }

                // 4. Crear la cita
                await sequelize.query(`
                    INSERT INTO citas (
                        paciente_id,
                        titulo,
                        psicologo_id,
                        becario_id,
                        fecha,
                        hora,
                        duracion,
                        tipo_consulta,
                        departamento,
                        estado,
                        notas,
                        color,
                        total_sesiones,
                        numero_sesion,
                        serie_id,
                        created_at,
                        updated_at
                    ) VALUES (
                        :paciente_id,
                        :titulo,
                        :psicologo_id,
                        :becario_id,
                        :fecha,
                        :hora,
                        :duracion,
                        :tipo_consulta,
                        :departamento,
                        :estado,
                        :notas,
                        :color,
                        :total_sesiones,
                        :numero_sesion,
                        :serie_id,
                        NOW(),
                        NOW()
                    )
                `, {
                    replacements: {
                        paciente_id: paciente.id,
                        titulo: datosCita.titulo || null,
                        psicologo_id: datosCita.psicologo_id || datosCita.usuarioId,
                        becario_id: datosCita.becario_id || null,
                        fecha: fechaSesion,
                        hora: datosCita.hora,
                        duracion: datosCita.duracion || 50,
                        tipo_consulta: datosCita.tipo_consulta,
                        departamento: datosCita.departamento || 'DEPAC',
                        estado: 'programada',
                        notas: datosCita.notas || null,
                        color: datosCita.color || null,
                        total_sesiones: totalSesiones,
                        numero_sesion: i + 1,
                        serie_id: serieId
                    },
                    transaction
                });

                const [[citaInsertada]] = await sequelize.query(
                    'SELECT LAST_INSERT_ID() AS id',
                    { transaction }
                );

                // 5. Obtener la cita creada con información del paciente
                const [citaCreada] = await sequelize.query(`
                    SELECT 
                        c.*,
                        CONCAT(p.nombre, ' ', p.apellido) AS paciente_nombre,
                        p.telefono AS paciente_telefono,
                        u_bec.nombre AS becario_nombre
                    FROM citas c
                    JOIN pacientes p ON c.paciente_id = p.id
                    LEFT JOIN users u_bec ON c.becario_id = u_bec.id
                    WHERE c.id = :cita_id
                `, {
                    replacements: { cita_id: citaInsertada.id },
                    transaction
                });

                citasCreadas.push(citaCreada[0]);
            }

            // 6. Registrar en logs
            await sequelize.query(`
                INSERT INTO logs_sistema (
                    usuario_id, tipo_log, modulo, accion, descripcion, datos_despues, created_at
                ) VALUES (
                    :usuarioId, 'creacion', 'citas', 'nueva_cita', :descripcion, JSON_OBJECT('paciente_id', :pacienteId), NOW()
                )
            `, {
                replacements: {
                    usuarioId: datosCita.usuarioId,
                    pacienteId: paciente.id,
                    descripcion: `Nueva cita creada para ${datosCita.fecha} ${datosCita.hora} (sesiones: ${totalSesiones})`
                },
                transaction
            });

            await transaction.commit();
            console.log('✅ Cita creada exitosamente');

            return citasCreadas.length === 1 ? citasCreadas[0] : citasCreadas;

        } catch (error) {
            await transaction.rollback();
            console.error('❌ Error en crearNuevaCita:', error);
            console.error('Stack trace:', error.stack);
            throw error;
        }
    }


    /**
     * Reemplaza: sp_generar_reporte_mensual
     */
    static async generarReporteMensual(mes, anio, psicologoId = null) {
        try {
            let query = `
                SELECT 
                    p.id,
                    CONCAT(p.nombre, ' ', p.apellido) AS paciente,
                    COUNT(c.id) AS total_sesiones,
                    SUM(CASE WHEN c.estado = 'completada' THEN 1 ELSE 0 END) AS sesiones_completadas,
                    SUM(CASE WHEN c.estado = 'cancelada' THEN 1 ELSE 0 END) AS sesiones_canceladas,
                    SUM(CASE WHEN c.estado = 'programada' THEN 1 ELSE 0 END) AS sesiones_programadas,
                    MIN(c.fecha) AS primera_sesion_mes,
                    MAX(c.fecha) AS ultima_sesion_mes
                FROM pacientes p
                LEFT JOIN citas c ON p.id = c.paciente_id 
                    AND MONTH(c.fecha) = :mes 
                    AND YEAR(c.fecha) = :anio
            `;

            const params = { mes, anio };

            if (psicologoId !== null && psicologoId !== undefined) {
                query += ` AND c.psicologo_id = :psicologoId`;
                params.psicologoId = psicologoId;
            }

            query += `
                WHERE p.activo = TRUE
                GROUP BY p.id, p.nombre, p.apellido
                ORDER BY p.apellido, p.nombre
            `;

            const [results] = await sequelize.query(query, {
                replacements: params,
                type: sequelize.QueryTypes.SELECT
            });

            return results;

        } catch (error) {
            console.error('Error en generarReporteMensual:', error);
            throw error;
        }
    }

    /**
     * Reemplaza: tr_after_insert_alta
     * Realiza transacción atómica para dar de alta paciente
     */
    static async darAltaPaciente(pacienteId, tipoAlta, usuarioId, notas = null) {
        const transaction = await sequelize.transaction();

        try {
            // 1. Insertar en altas
            await sequelize.query(`
                INSERT INTO altas (paciente_id, tipo_alta, usuario_id, notas, created_at)
                VALUES (:pacienteId, :tipoAlta, :usuarioId, :notas, NOW())
            `, {
                replacements: { pacienteId, tipoAlta, usuarioId, notas },
                transaction
            });

            // 2. Actualizar paciente
            await sequelize.query(`
                UPDATE pacientes 
                SET estado = :tipoAlta,
                    activo = FALSE,
                    updated_at = NOW()
                WHERE id = :pacienteId
            `, {
                replacements: { tipoAlta, pacienteId },
                transaction
            });

            // 3. Cancelar citas futuras
            await sequelize.query(`
                UPDATE citas 
                SET estado = 'cancelada',
                    motivo_cancelacion = 'Paciente dado de alta',
                    updated_at = NOW()
                WHERE paciente_id = :pacienteId 
                AND fecha >= CURDATE()
                AND estado IN ('programada', 'confirmada')
            `, {
                replacements: { pacienteId },
                transaction
            });

            // 4. Registrar en logs
            await sequelize.query(`
                INSERT INTO logs_sistema (
                    usuario_id, tipo_log, modulo, accion, descripcion, datos_despues, created_at
                ) VALUES (
                    :usuarioId, 'modificacion', 'pacientes', 'alta_paciente', :descripcion, JSON_OBJECT('paciente_id', :pacienteId), NOW()
                )
            `, {
                replacements: {
                    usuarioId,
                    pacienteId,
                    descripcion: `Alta tipo: ${tipoAlta}`
                },
                transaction
            });

            // Commit de la transacción
            await transaction.commit();

            return true;

        } catch (error) {
            // Rollback en caso de error
            await transaction.rollback();
            console.error('Error en darAltaPaciente:', error);
            throw error;
        }
    }

    static async cancelarCitasFuturasPaciente(pacienteId, motivoCancelacion, usuarioId) {
        const transaction = await sequelize.transaction();

        try {
            const [result, metadata] = await sequelize.query(`
                UPDATE citas 
                SET estado = 'cancelada',
                    motivo_cancelacion = :motivoCancelacion,
                    updated_at = NOW()
                WHERE paciente_id = :pacienteId 
                AND fecha >= CURDATE()
                AND estado IN ('programada', 'confirmada')
            `, {
                replacements: { pacienteId, motivoCancelacion },
                transaction
            });

            const affectedRows = metadata?.affectedRows ?? result?.affectedRows ?? 0;

            await sequelize.query(`
                INSERT INTO logs_sistema (
                    usuario_id, tipo_log, modulo, accion, descripcion, datos_despues, created_at
                ) VALUES (
                    :usuarioId, 'modificacion', 'citas', 'cancelar_citas_futuras', :descripcion, JSON_OBJECT('paciente_id', :pacienteId, 'citas_canceladas', :citasCanceladas), NOW()
                )
            `, {
                replacements: {
                    usuarioId,
                    pacienteId,
                    citasCanceladas: affectedRows,
                    descripcion: `Cancelación de citas futuras por motivo: ${motivoCancelacion}`
                },
                transaction
            });

            await transaction.commit();

            return affectedRows;
        } catch (error) {
            await transaction.rollback();
            console.error('Error en cancelarCitasFuturasPaciente:', error);
            throw error;
        }
    }

    /**
     * Reemplaza: tr_after_update_cita
     * Actualiza cita y maneja notificaciones
     */
    static async actualizarCita(citaId, updates, usuarioId) {
        const transaction = await sequelize.transaction();

        try {
            // 1. Obtener datos actuales
            const [citaActual] = await sequelize.query(`
                SELECT * FROM citas WHERE id = :citaId
            `, {
                replacements: { citaId },
                type: sequelize.QueryTypes.SELECT,
                transaction
            });

            if (!citaActual) {
                throw new Error('Cita no encontrada');
            }

            const estadosQueCuentanSesion = new Set(['confirmada', 'cancelada', 'completada']);
            const estadoAnterior = citaActual.estado;
            const estadoNuevo = updates.estado;
            const debeSumarSesion =
                estadoNuevo &&
                estadosQueCuentanSesion.has(estadoNuevo) &&
                !estadosQueCuentanSesion.has(estadoAnterior);

            if (debeSumarSesion) {
                const totalSesiones = Number(citaActual.total_sesiones || 1);
                const numeroSesionActual = Number.isFinite(Number(citaActual.numero_sesion))
                    ? Number(citaActual.numero_sesion)
                    : 0;
                const numeroSesionNuevo = Math.min(
                    totalSesiones,
                    Math.max(0, numeroSesionActual + 1)
                );

                if (numeroSesionNuevo !== numeroSesionActual) {
                    updates.numero_sesion = numeroSesionNuevo;
                }
            }

            // 2. Construir query de actualización
            const setClauses = [];
            const params = { citaId };

            for (const [key, value] of Object.entries(updates)) {
                setClauses.push(`${key} = :${key}`);
                params[key] = value;
            }

            const updateQuery = `
                UPDATE citas 
                SET ${setClauses.join(', ')}, updated_at = NOW()
                WHERE id = :citaId
            `;

            // 3. Actualizar cita
            await sequelize.query(updateQuery, {
                replacements: params,
                transaction
            });

            // 4. Verificar cambios importantes para notificaciones
            const cambiosImportantes =
                (updates.fecha && updates.fecha !== citaActual.fecha) ||
                (updates.hora && updates.hora !== citaActual.hora) ||
                (updates.tipo_consulta && updates.tipo_consulta !== citaActual.tipo_consulta);

            // 5. Crear notificaciones si hay cambios importantes
            if (cambiosImportantes) {
                // Obtener paciente email si existe
                const [paciente] = await sequelize.query(`
                    SELECT email FROM pacientes WHERE id = :pacienteId
                `, {
                    replacements: { pacienteId: citaActual.paciente_id },
                    type: sequelize.QueryTypes.SELECT,
                    transaction
                });

                if (paciente && paciente.email) {
                    // Crear notificación para el paciente (si tuvieras tabla notificaciones)
                    // await sequelize.query(...)
                }

                // Notificar al psicólogo y becario si están asignados
                const usuariosNotificar = [];
                if (citaActual.psicologo_id) usuariosNotificar.push(citaActual.psicologo_id);
                if (citaActual.becario_id) usuariosNotificar.push(citaActual.becario_id);

                for (const userId of usuariosNotificar) {
                    await sequelize.query(`
                        INSERT INTO notificaciones (
                            usuario_id, tipo, titulo, mensaje, leido, created_at
                        ) VALUES (
                            :userId, 'cita_modificada', 'Cita modificada',
                            CONCAT('La cita del paciente ha sido modificada. Nueva fecha: ', 
                                   :nuevaFecha, ' ', :nuevaHora),
                            FALSE, NOW()
                        )
                    `, {
                        replacements: {
                            userId,
                            nuevaFecha: updates.fecha || citaActual.fecha,
                            nuevaHora: updates.hora || citaActual.hora
                        },
                        transaction
                    });
                }
            }

            // 6. Obtener la cita actualizada para devolverla y usar en logs
            const [citaActualizadaArray] = await sequelize.query(`
                SELECT 
                    c.*,
                    CONCAT(p.nombre, ' ', p.apellido) AS paciente_nombre,
                    p.telefono AS paciente_telefono,
                    u_bec.nombre AS becario_nombre
                FROM citas c
                JOIN pacientes p ON c.paciente_id = p.id
                LEFT JOIN users u_bec ON c.becario_id = u_bec.id
                WHERE c.id = :citaId
            `, {
                replacements: { citaId },
                transaction,
                type: sequelize.QueryTypes.SELECT
            });

            const citaActualizada = citaActualizadaArray && citaActualizadaArray.length ? citaActualizadaArray[0] : null;

            // 7. Registrar en logs si la cita fue cancelada
            if (updates.estado === 'cancelada') {
                await sequelize.query(`
                    INSERT INTO logs_sistema (
                        usuario_id, tipo_log, modulo, accion, descripcion, datos_despues, created_at
                    ) VALUES (
                        :usuarioId, 'modificacion', 'citas', 'cancelar_cita', :descripcion, JSON_OBJECT('cita_id', :citaId, 'estado', 'cancelada', 'motivo', :motivo), NOW()
                    )
                `, {
                    replacements: {
                        usuarioId,
                        citaId,
                        descripcion: `Cita cancelada para ${citaActual.fecha} ${citaActual.hora}`,
                        motivo: updates.motivo_cancelacion || null
                    },
                    transaction
                });
            }

            await transaction.commit();
            return citaActualizada;

        } catch (error) {
            await transaction.rollback();
            console.error('Error en actualizarCita:', error);
            throw error;
        }
    }

    /**
     * Obtener estadísticas generales
     */
    static async obtenerEstadisticas(fechaInicio, fechaFin, psicologoId = null) {
        try {
            let query = `
                SELECT 
                    COUNT(*) AS total_citas,
                    SUM(CASE WHEN estado = 'completada' THEN 1 ELSE 0 END) AS completadas,
                    SUM(CASE WHEN estado = 'cancelada' THEN 1 ELSE 0 END) AS canceladas,
                    SUM(CASE WHEN estado = 'programada' THEN 1 ELSE 0 END) AS programadas,
                    COUNT(DISTINCT paciente_id) AS pacientes_unicos,
                    COUNT(DISTINCT psicologo_id) AS psicologos_activos
                FROM citas
                WHERE fecha BETWEEN :fechaInicio AND :fechaFin
            `;

            const params = { fechaInicio, fechaFin };

            if (psicologoId !== null && psicologoId !== undefined) {
                query += ` AND psicologo_id = :psicologoId`;
                params.psicologoId = psicologoId;
            }

            const [result] = await sequelize.query(query, {
                replacements: params,
                type: sequelize.QueryTypes.SELECT
            });

            return result;

        } catch (error) {
            console.error('Error en obtenerEstadisticas:', error);
            throw error;
        }
    }
}

module.exports = DatabaseService;