const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);
const { QueryTypes } = require('sequelize');
const sequelize = require('../config/db');

class BackupService {
    
    static async realizarBackupCompleto() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupDir = path.join(__dirname, '..', '..', 'backups', timestamp);
            
            // Crear directorio de backup
            await fs.mkdir(backupDir, { recursive: true });
            
            console.log(`🔄 Iniciando backup completo: ${timestamp}`);
            
            // 1. Backup de base de datos
            const dbBackup = await this.realizarBackupBaseDatos(backupDir);
            
            // 2. Backup de archivos subidos
            const filesBackup = await this.realizarBackupArchivos(backupDir);
            
            // 3. Backup de configuración
            const configBackup = await this.realizarBackupConfiguracion(backupDir);
            
            // 4. Generar archivo de metadatos
            await this.generarMetadataBackup(backupDir, {
                timestamp,
                dbBackup,
                filesBackup,
                configBackup,
                sistema: 'PsicoGestión',
                version: '1.0.0'
            });
            
            // 5. Comprimir backup
            const compressedPath = await this.comprimirBackup(backupDir);
            
            // 6. Limpiar backup sin comprimir
            await fs.rm(backupDir, { recursive: true, force: true });
            
            // 7. Registrar en base de datos
            await this.registrarBackupEnBD({
                tipo: 'completo',
                ruta: compressedPath,
                tamano: (await fs.stat(compressedPath)).size,
                estado: 'completado'
            });
            
            console.log(`✅ Backup completado: ${compressedPath}`);
            return {
                success: true,
                ruta: compressedPath,
                tamano: (await fs.stat(compressedPath)).size
            };
            
        } catch (error) {
            console.error('❌ Error en backup completo:', error);
            throw error;
        }
    }
    
    static async realizarBackupBaseDatos(backupDir) {
        try {
            const dbConfig = {
                host: process.env.DB_HOST,
                user: process.env.DB_USER,
                password: process.env.DB_PASSWORD,
                database: process.env.DB_NAME
            };
            
            const dumpFile = path.join(backupDir, 'database.sql');
            
            // Comando mysqldump
            const command = `mysqldump --host=${dbConfig.host} --user=${dbConfig.user} --password=${dbConfig.password} ${dbConfig.database} > "${dumpFile}"`;
            
            await execPromise(command);
            
            // Verificar que el archivo se creó
            const stats = await fs.stat(dumpFile);
            
            console.log(`✅ Backup de base de datos creado: ${dumpFile} (${stats.size} bytes)`);
            
            return {
                archivo: dumpFile,
                tamano: stats.size,
                tablas: await this.obtenerInfoTablas()
            };
            
        } catch (error) {
            console.error('❌ Error en backup de base de datos:', error);
            throw error;
        }
    }
    
    static async realizarBackupArchivos(backupDir) {
        try {
            const archivosDir = path.join(__dirname, '..', '..', 'uploads');
            const backupArchivosDir = path.join(backupDir, 'archivos');
            
            // Verificar si existe el directorio de archivos
            try {
                await fs.access(archivosDir);
            } catch {
                console.log('⚠️  No hay archivos subidos para backup');
                return { archivos: 0, tamano: 0 };
            }
            
            // Copiar archivos recursivamente
            await this.copiarDirectorioRecursivo(archivosDir, backupArchivosDir);
            
            // Calcular estadísticas
            const { totalArchivos, totalTamano } = await this.calcularEstadisticasArchivos(backupArchivosDir);
            
            console.log(`✅ Backup de archivos creado: ${totalArchivos} archivos (${totalTamano} bytes)`);
            
            return {
                directorio: backupArchivosDir,
                archivos: totalArchivos,
                tamano: totalTamano
            };
            
        } catch (error) {
            console.error('❌ Error en backup de archivos:', error);
            throw error;
        }
    }
    
    static async realizarBackupConfiguracion(backupDir) {
        try {
            const configDir = path.join(backupDir, 'configuracion');
            await fs.mkdir(configDir, { recursive: true });
            
            // Archivos de configuración importantes
            const archivosConfig = [
                '.env',
                'package.json',
                'package-lock.json',
                'server.js'
            ];
            
            let archivosCopiados = 0;
            
            for (const archivo of archivosConfig) {
                const sourcePath = path.join(__dirname, '..', '..', archivo);
                const destPath = path.join(configDir, archivo);
                
                try {
                    await fs.copyFile(sourcePath, destPath);
                    archivosCopiados++;
                } catch (error) {
                    console.warn(`⚠️  No se pudo copiar ${archivo}: ${error.message}`);
                }
            }
            
            // Crear archivo con información del sistema
            const systemInfo = {
                node_version: process.version,
                platform: process.platform,
                arch: process.arch,
                memory: process.memoryUsage(),
                uptime: process.uptime(),
                fecha: new Date().toISOString()
            };
            
            await fs.writeFile(
                path.join(configDir, 'system-info.json'),
                JSON.stringify(systemInfo, null, 2)
            );
            
            console.log(`✅ Backup de configuración creado: ${archivosCopiados} archivos`);
            
            return {
                directorio: configDir,
                archivos: archivosCopiados + 1, // +1 por system-info.json
                tamano: await this.calcularTamanoDirectorio(configDir)
            };
            
        } catch (error) {
            console.error('❌ Error en backup de configuración:', error);
            throw error;
        }
    }
    
    static async realizarBackupIncremental() {
        try {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const backupDir = path.join(__dirname, '..', '..', 'backups', `incremental-${timestamp}`);
            
            await fs.mkdir(backupDir, { recursive: true });
            
            console.log(`🔄 Iniciando backup incremental: ${timestamp}`);
            
            // Obtener último backup completo
            const ultimoBackup = await this.obtenerUltimoBackup('completo');
            
            // Backup solo de cambios desde el último backup completo
            const cambios = await this.obtenerCambiosDesdeUltimoBackup(ultimoBackup?.fecha);
            
            // Guardar cambios
            const cambiosFile = path.join(backupDir, 'cambios.json');
            await fs.writeFile(cambiosFile, JSON.stringify(cambios, null, 2));
            
            // Backup de nuevos archivos
            const nuevosArchivos = await this.realizarBackupArchivosNuevos(backupDir, cambios.archivos_nuevos);
            
            // Comprimir backup incremental
            const compressedPath = await this.comprimirBackup(backupDir);
            
            // Limpiar
            await fs.rm(backupDir, { recursive: true, force: true });
            
            // Registrar en BD
            await this.registrarBackupEnBD({
                tipo: 'incremental',
                ruta: compressedPath,
                tamano: (await fs.stat(compressedPath)).size,
                base_backup_id: ultimoBackup?.id,
                cambios: cambios.cantidad_cambios,
                estado: 'completado'
            });
            
            console.log(`✅ Backup incremental completado: ${compressedPath}`);
            return {
                success: true,
                ruta: compressedPath,
                cambios: cambios.cantidad_cambios
            };
            
        } catch (error) {
            console.error('❌ Error en backup incremental:', error);
            throw error;
        }
    }
    
    static async restaurarBackup(backupId) {
        try {
            // Obtener información del backup
            const [backupInfo] = await sequelize.query(
                'SELECT * FROM backups WHERE id = ? AND estado = "completado"',
                { replacements: [backupId], type: QueryTypes.SELECT }
            );
            
            if (!backupInfo) {
                throw new Error('Backup no encontrado o incompleto');
            }
            
            console.log(`🔄 Iniciando restauración del backup: ${backupInfo.ruta}`);
            
            // 1. Descomprimir backup
            const tempDir = await this.descomprimirBackup(backupInfo.ruta);
            
            // 2. Verificar integridad
            await this.verificarIntegridadBackup(tempDir);
            
            // 3. Restaurar base de datos
            if (backupInfo.tipo === 'completo') {
                await this.restaurarBaseDatosCompleta(tempDir);
                await this.restaurarArchivosCompletos(tempDir);
                await this.restaurarConfiguracion(tempDir);
            } else {
                // Restaurar incremental sobre último backup completo
                await this.restaurarBackupIncremental(tempDir, backupInfo.base_backup_id);
            }
            
            // 4. Limpiar directorio temporal
            await fs.rm(tempDir, { recursive: true, force: true });
            
            // 5. Actualizar estado del backup
            await sequelize.query(
                'UPDATE backups SET ultima_restauracion = NOW() WHERE id = ?',
                { replacements: [backupId] }
            );
            
            console.log('✅ Restauración completada exitosamente');
            return { success: true };
            
        } catch (error) {
            console.error('❌ Error en restauración:', error);
            throw error;
        }
    }
    
    static async verificarBackups() {
        try {
            const backupsDir = path.join(__dirname, '..', '..', 'backups');
            
            // Verificar que exista el directorio
            await fs.access(backupsDir);
            
            // Obtener lista de backups
            const archivos = await fs.readdir(backupsDir);
            const backups = archivos.filter(archivo => archivo.endsWith('.zip'));
            
            // Verificar integridad de cada backup
            const resultados = [];
            
            for (const backup of backups) {
                const backupPath = path.join(backupsDir, backup);
                const stats = await fs.stat(backupPath);
                
                const resultado = {
                    archivo: backup,
                    tamano: stats.size,
                    modificado: stats.mtime,
                    valido: await this.verificarIntegridadArchivo(backupPath)
                };
                
                resultados.push(resultado);
            }
            
            // Verificar en base de datos
            const [backupsDB] = await sequelize.query(
                'SELECT COUNT(*) as total, SUM(tamano) as total_tamano FROM backups WHERE estado = "completado"',
                { type: QueryTypes.SELECT }
            );
            
            return {
                backups_fs: resultados,
                backups_db: backupsDB,
                espacio_total: await this.calcularEspacioDisco(backupsDir),
                recomendaciones: this.generarRecomendacionesBackup(resultados)
            };
            
        } catch (error) {
            console.error('❌ Error al verificar backups:', error);
            throw error;
        }
    }
    
    static async limpiarBackupsAntiguos(dias = 30) {
        try {
            const backupsDir = path.join(__dirname, '..', '..', 'backups');
            const fechaLimite = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
            
            const archivos = await fs.readdir(backupsDir);
            let eliminados = 0;
            let espacioLiberado = 0;
            
            for (const archivo of archivos) {
                if (archivo.endsWith('.zip')) {
                    const archivoPath = path.join(backupsDir, archivo);
                    const stats = await fs.stat(archivoPath);
                    
                    if (stats.mtime < fechaLimite) {
                        await fs.unlink(archivoPath);
                        eliminados++;
                        espacioLiberado += stats.size;
                        
                        // Actualizar estado en BD
                        await sequelize.query(
                            'UPDATE backups SET estado = "eliminado" WHERE ruta LIKE ?',
                            { replacements: [`%${archivo}%`] }
                        );
                    }
                }
            }
            
            console.log(`🧹 Limpieza de backups: ${eliminados} eliminados, ${this.formatearBytes(espacioLiberado)} liberados`);
            
            return {
                eliminados,
                espacio_liberado: espacioLiberado,
                espacio_formateado: this.formatearBytes(espacioLiberado)
            };
            
        } catch (error) {
            console.error('❌ Error al limpiar backups antiguos:', error);
            throw error;
        }
    }
    
    // Métodos auxiliares
    static async obtenerInfoTablas() {
        const [tablas] = await sequelize.query(`
            SELECT 
                TABLE_NAME as tabla,
                TABLE_ROWS as filas,
                DATA_LENGTH as tamano_datos,
                INDEX_LENGTH as tamano_indices,
                CREATE_TIME as creada,
                UPDATE_TIME as actualizada
            FROM information_schema.TABLES
            WHERE TABLE_SCHEMA = ?
            ORDER BY TABLE_NAME
        `, {
            replacements: [process.env.DB_NAME],
            type: QueryTypes.SELECT
        });
        
        return tablas;
    }
    
    static async copiarDirectorioRecursivo(origen, destino) {
        await fs.mkdir(destino, { recursive: true });
        
        const elementos = await fs.readdir(origen, { withFileTypes: true });
        
        for (const elemento of elementos) {
            const sourcePath = path.join(origen, elemento.name);
            const destPath = path.join(destino, elemento.name);
            
            if (elemento.isDirectory()) {
                await this.copiarDirectorioRecursivo(sourcePath, destPath);
            } else {
                await fs.copyFile(sourcePath, destPath);
            }
        }
    }
    
    static async calcularEstadisticasArchivos(directorio) {
        let totalArchivos = 0;
        let totalTamano = 0;
        
        async function calcularRecursivo(dir) {
            const elementos = await fs.readdir(dir, { withFileTypes: true });
            
            for (const elemento of elementos) {
                const elementoPath = path.join(dir, elemento.name);
                
                if (elemento.isDirectory()) {
                    await calcularRecursivo(elementoPath);
                } else {
                    const stats = await fs.stat(elementoPath);
                    totalArchivos++;
                    totalTamano += stats.size;
                }
            }
        }
        
        await calcularRecursivo(directorio);
        return { totalArchivos, totalTamano };
    }
    
    static async calcularTamanoDirectorio(directorio) {
        const { totalTamano } = await this.calcularEstadisticasArchivos(directorio);
        return totalTamano;
    }
    
    static async generarMetadataBackup(backupDir, metadata) {
        const metadataFile = path.join(backupDir, 'metadata.json');
        await fs.writeFile(metadataFile, JSON.stringify(metadata, null, 2));
    }
    
    static async comprimirBackup(directorio) {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const zipFile = path.join(path.dirname(directorio), `backup-${timestamp}.zip`);
        
        const command = `cd "${path.dirname(directorio)}" && zip -r "${zipFile}" "${path.basename(directorio)}"`;
        
        await execPromise(command);
        return zipFile;
    }
    
    static async registrarBackupEnBD(datos) {
        await sequelize.query(`
            INSERT INTO backups (tipo, ruta, tamano, base_backup_id, cambios, estado, created_at)
            VALUES (?, ?, ?, ?, ?, ?, NOW())
        `, {
            replacements: [
                datos.tipo,
                datos.ruta,
                datos.tamano,
                datos.base_backup_id || null,
                datos.cambios || 0,
                datos.estado
            ]
        });
    }
    
    static async obtenerUltimoBackup(tipo) {
        const [backup] = await sequelize.query(`
            SELECT * FROM backups 
            WHERE tipo = ? AND estado = 'completado'
            ORDER BY created_at DESC 
            LIMIT 1
        `, {
            replacements: [tipo],
            type: QueryTypes.SELECT
        });
        
        return backup;
    }
    
    static async obtenerCambiosDesdeUltimoBackup(fechaUltimoBackup) {
        if (!fechaUltimoBackup) {
            return { cantidad_cambios: 0, archivos_nuevos: [] };
        }
        
        // Obtener citas nuevas/modificadas
        const [citasCambiadas] = await sequelize.query(`
            SELECT COUNT(*) as cantidad FROM citas 
            WHERE created_at > ? OR updated_at > ?
        `, {
            replacements: [fechaUltimoBackup, fechaUltimoBackup],
            type: QueryTypes.SELECT
        });
        
        // Obtener pacientes nuevos/modificados
        const [pacientesCambiados] = await sequelize.query(`
            SELECT COUNT(*) as cantidad FROM pacientes 
            WHERE created_at > ? OR updated_at > ?
        `, {
            replacements: [fechaUltimoBackup, fechaUltimoBackup],
            type: QueryTypes.SELECT
        });
        
        // Obtener archivos nuevos (simplificado)
        const archivosNuevos = await this.obtenerArchivosNuevosDesde(fechaUltimoBackup);
        
        return {
            cantidad_cambios: (citasCambiadas?.cantidad || 0) + (pacientesCambiados?.cantidad || 0),
            citas_nuevas: citasCambiadas?.cantidad || 0,
            pacientes_nuevos: pacientesCambiados?.cantidad || 0,
            archivos_nuevos: archivosNuevos
        };
    }
    
    static async obtenerArchivosNuevosDesde(fecha) {
        // Esta función necesitaría un sistema de tracking de archivos
        // Por ahora retorna array vacío
        return [];
    }
    
    static async realizarBackupArchivosNuevos(backupDir, archivosNuevos) {
        if (!archivosNuevos || archivosNuevos.length === 0) {
            return { archivos: 0, tamano: 0 };
        }
        
        const archivosDir = path.join(backupDir, 'archivos_nuevos');
        await fs.mkdir(archivosDir, { recursive: true });
        
        let totalCopiados = 0;
        
        for (const archivo of archivosNuevos) {
            try {
                const sourcePath = path.join(__dirname, '..', '..', 'uploads', archivo);
                const destPath = path.join(archivosDir, archivo);
                
                await fs.copyFile(sourcePath, destPath);
                totalCopiados++;
            } catch (error) {
                console.warn(`⚠️  No se pudo copiar archivo ${archivo}: ${error.message}`);
            }
        }
        
        return {
            directorio: archivosDir,
            archivos: totalCopiados,
            tamano: await this.calcularTamanoDirectorio(archivosDir)
        };
    }
    
    static async descomprimirBackup(backupPath) {
        const tempDir = path.join(__dirname, '..', '..', 'temp-restore', Date.now().toString());
        await fs.mkdir(tempDir, { recursive: true });
        
        const command = `unzip "${backupPath}" -d "${tempDir}"`;
        await execPromise(command);
        
        // Buscar el directorio descomprimido
        const elementos = await fs.readdir(tempDir, { withFileTypes: true });
        const directorioDescomprimido = elementos.find(e => e.isDirectory())?.name;
        
        if (!directorioDescomprimido) {
            throw new Error('No se encontró directorio descomprimido');
        }
        
        return path.join(tempDir, directorioDescomprimido);
    }
    
    static async verificarIntegridadBackup(directorio) {
        // Verificar archivos esenciales
        const archivosEsenciales = ['database.sql', 'metadata.json'];
        
        for (const archivo of archivosEsenciales) {
            const archivoPath = path.join(directorio, archivo);
            try {
                await fs.access(archivoPath);
            } catch {
                throw new Error(`Archivo esencial faltante: ${archivo}`);
            }
        }
        
        // Verificar metadata
        const metadataPath = path.join(directorio, 'metadata.json');
        const metadataContent = await fs.readFile(metadataPath, 'utf8');
        const metadata = JSON.parse(metadataContent);
        
        if (!metadata.sistema || !metadata.version) {
            throw new Error('Metadata inválida');
        }
        
        console.log('✅ Integridad del backup verificada');
        return true;
    }
    
    static async verificarIntegridadArchivo(backupPath) {
        try {
            // Verificar que el archivo existe y es legible
            await fs.access(backupPath);
            
            // Verificar estructura ZIP básica
            const command = `unzip -t "${backupPath}"`;
            await execPromise(command);
            
            return true;
        } catch (error) {
            return false;
        }
    }
    
    static async restaurarBaseDatosCompleta(directorioBackup) {
        const dbFile = path.join(directorioBackup, 'database.sql');
        
        if (!await fs.access(dbFile).then(() => true).catch(() => false)) {
            throw new Error('Archivo de base de datos no encontrado en backup');
        }
        
        const dbConfig = {
            host: process.env.DB_HOST,
            user: process.env.DB_USER,
            password: process.env.DB_PASSWORD,
            database: process.env.DB_NAME
        };
        
        // Primero crear una copia de seguridad actual (por si acaso)
        const backupActual = await this.realizarBackupBaseDatos(path.join(__dirname, '..', '..', 'temp'));
        
        try {
            // Restaurar base de datos
            const command = `mysql --host=${dbConfig.host} --user=${dbConfig.user} --password=${dbConfig.password} ${dbConfig.database} < "${dbFile}"`;
            await execPromise(command);
            
            console.log('✅ Base de datos restaurada');
        } catch (error) {
            // Restaurar backup actual en caso de error
            console.error('❌ Error al restaurar base de datos, restaurando backup anterior...');
            const restoreCommand = `mysql --host=${dbConfig.host} --user=${dbConfig.user} --password=${dbConfig.password} ${dbConfig.database} < "${backupActual.archivo}"`;
            await execPromise(restoreCommand);
            throw error;
        }
    }
    
    static async restaurarArchivosCompletos(directorioBackup) {
        const archivosDir = path.join(directorioBackup, 'archivos');
        
        if (await fs.access(archivosDir).then(() => true).catch(() => false)) {
            const uploadsDir = path.join(__dirname, '..', '..', 'uploads');
            
            // Crear backup de archivos actuales
            await fs.rename(uploadsDir, `${uploadsDir}.backup.${Date.now()}`);
            
            // Restaurar archivos del backup
            await this.copiarDirectorioRecursivo(archivosDir, uploadsDir);
            
            console.log('✅ Archivos restaurados');
        }
    }
    
    static async restaurarConfiguracion(directorioBackup) {
        const configDir = path.join(directorioBackup, 'configuracion');
        
        if (await fs.access(configDir).then(() => true).catch(() => false)) {
            // Solo restaurar archivos específicos si es necesario
            console.log('⚠️  Configuración disponible para restauración manual');
        }
    }
    
    static async restaurarBackupIncremental(directorioBackup, baseBackupId) {
        // Implementación de restauración incremental
        // Requiere lógica más compleja de aplicación de cambios
        console.log('🔄 Restaurando backup incremental...');
        // Por ahora, solo log
    }
    
    static async calcularEspacioDisco(directorio) {
        const command = `df -h "${directorio}" | tail -1 | awk '{print $4}'`;
        try {
            const { stdout } = await execPromise(command);
            return stdout.trim();
        } catch {
            return 'Desconocido';
        }
    }
    
    static generarRecomendacionesBackup(backups) {
        const recomendaciones = [];
        
        if (backups.length === 0) {
            recomendaciones.push('No hay backups existentes. Se recomienda crear un backup completo inmediatamente.');
        }
        
        if (backups.length > 10) {
            recomendaciones.push('Muchos backups almacenados. Considere eliminar los más antiguos.');
        }
        
        const backupsInvalidos = backups.filter(b => !b.valido);
        if (backupsInvalidos.length > 0) {
            recomendaciones.push(`Hay ${backupsInvalidos.length} backups inválidos. Considere eliminarlos.`);
        }
        
        return recomendaciones;
    }
    
    static formatearBytes(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

module.exports = BackupService;