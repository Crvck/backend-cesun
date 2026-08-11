const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs').promises;
const path = require('path');

class ReporteService {
    
    static async generarExcel(datos, tipoReporte) {
        try {
            const workbook = new ExcelJS.Workbook();
            workbook.creator = 'Sistema de Gestión Psicológica';
            workbook.created = new Date();
            
            let worksheet;
            let columns = [];
            
            switch (tipoReporte) {
                case 'citas':
                    worksheet = workbook.addWorksheet('Reporte de Citas');
                    columns = [
                        { header: 'MES', key: 'MES', width: 10 },
                        { header: 'MODALIDAD', key: 'MODALIDAD', width: 15 },
                        { header: 'Empleado', key: 'Empleado', width: 20 },
                        { header: 'ESTUDIANTE', key: 'ESTUDIANTE', width: 25 },
                        { header: 'CARRERA', key: 'CARRERA', width: 20 },
                        { header: 'MATRICULA', key: 'MATRICULA', width: 15 },
                        { header: 'NOMBRE', key: 'NOMBRE', width: 25 },
                        { header: 'EDAD', key: 'EDAD', width: 8 },
                        { header: 'SEXO', key: 'SEXO', width: 10 },
                        { header: 'MOTIVO DE CONSULTA', key: 'MOTIVO_DE_CONSULTA', width: 30 },
                        { header: 'TELEFONO', key: 'TELEFONO', width: 15 },
                        { header: 'CORREO', key: 'CORREO', width: 25 },
                        { header: 'DIA', key: 'DIA', width: 12 },
                        { header: 'HORA', key: 'HORA', width: 10 },
                        { header: 'ESTATUS', key: 'ESTATUS', width: 12 },
                        { header: 'PRACTICANTE', key: 'PRACTICANTE', width: 20 },
                        { header: 'OBSERVACIONES', key: 'OBSERVACIONES', width: 30 },
                        { header: 'ATIENDE', key: 'ATIENDE', width: 20 }
                    ];
                    break;
                    
                case 'pacientes':
                    worksheet = workbook.addWorksheet('Reporte de Pacientes');
                    columns = [
                        { header: 'MES', key: 'MES', width: 10 },
                        { header: 'NOMBRE', key: 'NOMBRE', width: 25 },
                        { header: 'TELEFONO', key: 'TELEFONO', width: 15 },
                        { header: 'MATRICULA', key: 'MATRICULA', width: 15 },
                        { header: 'CUATRI', key: 'CUATRI', width: 10 },
                        { header: 'TIPO DE SERVICIO', key: 'TIPO_DE_SERVICIO', width: 20 },
                        { header: 'FECHA DE PRESENTACION', key: 'FECHA_DE_PRESENTACION', width: 20 },
                        { header: 'No. de sesiones terapéuticas personales', key: 'No_de_sesiones_terapeuticas_personales', width: 15 },
                        { header: 'FECHA DE ACEPTACION', key: 'FECHA_DE_ACEPTACION', width: 20 },
                        { header: 'MMPI-2 RF', key: 'MMPI_2_RF', width: 15 },
                        { header: 'FECHA DE TERMINO', key: 'FECHA_DE_TERMINO', width: 20 },
                        { header: 'CARTA DE LIBERACION', key: 'CARTA_DE_LIBERACION', width: 20 },
                        { header: 'HORAS OBJETIVO', key: 'HORAS_OBJETIVO', width: 15 },
                        { header: 'HORAS REALIZADAS', key: 'HORAS_REALIZADAS', width: 15 },
                        { header: 'HORAS FALTANTES', key: 'HORAS_FALTANTES', width: 15 },
                        { header: 'SERVICIO COMUNITARIO LIBERADO', key: 'SERVICIO_COMUNITARIO_LIBERADO', width: 20 },
                        { header: 'QUIEN ATIENDE', key: 'QUIEN_ATIENDE', width: 20 },
                        { header: 'OBSERVACIONES', key: 'OBSERVACIONES', width: 30 }
                    ];
                    break;
                    
                default:
                    worksheet = workbook.addWorksheet('Reporte');
                    columns = Object.keys(datos[0] || {}).map(key => ({
                        header: key.toUpperCase(),
                        key: key,
                        width: 20
                    }));
            }
            
            worksheet.columns = columns;
            
            // Agregar datos
            if (datos && datos.length > 0) {
                datos.forEach(row => {
                    worksheet.addRow(row);
                });
            }
            
            // Aplicar estilos a la cabecera
            worksheet.getRow(1).font = { bold: true };
            worksheet.getRow(1).fill = {
                type: 'pattern',
                pattern: 'solid',
                fgColor: { argb: 'FFE0E0E0' }
            };
            
            // Autoajustar columnas
            worksheet.columns.forEach(column => {
                let maxLength = 0;
                column.eachCell({ includeEmpty: true }, cell => {
                    const cellLength = cell.value ? cell.value.toString().length : 0;
                    if (cellLength > maxLength) {
                        maxLength = cellLength;
                    }
                });
                column.width = Math.min(maxLength + 2, 50);
            });
            
            // Generar buffer
            const buffer = await workbook.xlsx.writeBuffer();
            return buffer;
            
        } catch (error) {
            console.error('Error en generarExcel:', error);
            throw error;
        }
    }
    
    static async generarPDF(datos, tipoReporte, titulo) {
        return new Promise((resolve, reject) => {
            try {
                const doc = new PDFDocument({ margin: 50 });
                const chunks = [];
                
                doc.on('data', chunk => chunks.push(chunk));
                doc.on('end', () => {
                    const buffer = Buffer.concat(chunks);
                    resolve(buffer);
                });
                
                // Encabezado
                doc.fontSize(20).text(titulo || 'Reporte del Sistema', { align: 'center' });
                doc.moveDown();
                doc.fontSize(12).text(`Generado: ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString()}`, { align: 'center' });
                doc.moveDown(2);
                
                // Contenido según tipo de reporte
                switch (tipoReporte) {
                    case 'resumen':
                        this.generarPDFResumen(doc, datos);
                        break;
                    case 'paciente':
                        this.generarPDFPaciente(doc, datos);
                        break;
                    default:
                        this.generarPDFTabla(doc, datos);
                }
                
                doc.end();
                
            } catch (error) {
                reject(error);
            }
        });
    }
    
    static generarPDFResumen(doc, datos) {
        doc.fontSize(16).text('Resumen Estadístico', { underline: true });
        doc.moveDown();
        
        if (datos.estadisticas) {
            const stats = datos.estadisticas;
            doc.fontSize(12);
            doc.text(`Total de Pacientes: ${stats.total_pacientes || 0}`);
            doc.text(`Pacientes Activos: ${stats.pacientes_activos || 0}`);
            doc.text(`Citas del Mes: ${stats.total_citas_mes || 0}`);
            doc.text(`Citas Completadas: ${stats.citas_completadas || 0}`);
            doc.text(`Tasa de Completitud: ${stats.tasa_completitud || '0'}%`);
            doc.moveDown();
        }
        
        if (datos.evolucion_mensual && datos.evolucion_mensual.length > 0) {
            doc.fontSize(14).text('Evolución Mensual:', { underline: true });
            doc.moveDown();
            
            datos.evolucion_mensual.forEach(item => {
                doc.fontSize(10).text(`${item.mes}: ${item.total_citas} citas (${item.citas_completadas} completadas)`);
            });
        }
    }
    
    static generarPDFPaciente(doc, datos) {
        doc.fontSize(16).text(`Expediente de ${datos.paciente?.nombre || ''} ${datos.paciente?.apellido || ''}`, { underline: true });
        doc.moveDown();
        
        // Información básica
        doc.fontSize(12).text('Información Básica:', { underline: true });
        doc.fontSize(10);
        if (datos.paciente) {
            doc.text(`Nombre: ${datos.paciente.nombre} ${datos.paciente.apellido}`);
            doc.text(`Teléfono: ${datos.paciente.telefono || 'No especificado'}`);
            doc.text(`Email: ${datos.paciente.email || 'No especificado'}`);
            doc.text(`Fecha de Inscripción: ${datos.paciente.fecha_inscripcion || 'No especificado'}`);
        }
        doc.moveDown();
        
        // Historial de sesiones
        if (datos.sesiones && datos.sesiones.length > 0) {
            doc.fontSize(12).text('Historial de Sesiones:', { underline: true });
            doc.moveDown();
            
            datos.sesiones.forEach((sesion, index) => {
                doc.fontSize(10).text(`${index + 1}. ${sesion.fecha} - ${sesion.psicologo_nombre}`);
                if (sesion.conclusion) {
                    doc.fontSize(8).text(`   Conclusiones: ${sesion.conclusion.substring(0, 100)}...`);
                }
                doc.moveDown(0.5);
            });
        }
    }
    
    static generarPDFTabla(doc, datos) {
        if (!datos || datos.length === 0) {
            doc.text('No hay datos para mostrar');
            return;
        }
        
        // Obtener columnas
        const columnas = Object.keys(datos[0]);
        const anchoColumna = 500 / columnas.length;
        
        // Encabezado de tabla
        doc.fontSize(10).font('Helvetica-Bold');
        let xPos = 50;
        
        columnas.forEach(columna => {
            doc.text(columna.toUpperCase(), xPos, doc.y, { width: anchoColumna });
            xPos += anchoColumna;
        });
        
        doc.moveDown();
        doc.font('Helvetica');
        
        // Línea separadora
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
        doc.moveDown();
        
        // Filas de datos
        datos.forEach(fila => {
            xPos = 50;
            columnas.forEach(columna => {
                const valor = fila[columna] !== null && fila[columna] !== undefined ? 
                            fila[columna].toString() : '';
                doc.fontSize(8).text(valor.substring(0, 30), xPos, doc.y, { width: anchoColumna });
                xPos += anchoColumna;
            });
            doc.moveDown();
        });
    }
    
    static async generarCSV(datos, delimitador = ',') {
        if (!datos || datos.length === 0) {
            return '';
        }
        
        const columnas = Object.keys(datos[0]);
        let csv = columnas.join(delimitador) + '\n';
        
        datos.forEach(fila => {
            const valores = columnas.map(columna => {
                const valor = fila[columna];
                if (valor === null || valor === undefined) {
                    return '';
                }
                // Escapar comillas y delimitadores
                const valorStr = valor.toString();
                if (valorStr.includes(delimitador) || valorStr.includes('"') || valorStr.includes('\n')) {
                    return `"${valorStr.replace(/"/g, '""')}"`;
                }
                return valorStr;
            });
            csv += valores.join(delimitador) + '\n';
        });
        
        return csv;
    }
    
    static async guardarReporteArchivo(buffer, formato, nombreBase) {
        try {
            const timestamp = new Date().getTime();
            const nombreArchivo = `${nombreBase}_${timestamp}.${formato}`;
            const rutaArchivo = path.join(__dirname, '..', '..', 'reports', nombreArchivo);
            
            // Crear directorio si no existe
            await fs.mkdir(path.dirname(rutaArchivo), { recursive: true });
            
            // Guardar archivo
            await fs.writeFile(rutaArchivo, buffer);
            
            return {
                nombre: nombreArchivo,
                ruta: `/reports/${nombreArchivo}`,
                tamano: buffer.length
            };
            
        } catch (error) {
            console.error('Error al guardar reporte:', error);
            throw error;
        }
    }
    
    static async eliminarReporteAntiguos(dias = 30) {
        try {
            const directorio = path.join(__dirname, '..', '..', 'reports');
            const fechaLimite = new Date(Date.now() - dias * 24 * 60 * 60 * 1000);
            
            const archivos = await fs.readdir(directorio);
            
            for (const archivo of archivos) {
                const rutaArchivo = path.join(directorio, archivo);
                const stats = await fs.stat(rutaArchivo);
                
                if (stats.mtime < fechaLimite) {
                    await fs.unlink(rutaArchivo);
                    console.log(`Eliminado archivo antiguo: ${archivo}`);
                }
            }
            
            return true;
        } catch (error) {
            console.error('Error al eliminar reportes antiguos:', error);
            return false;
        }
    }
}

module.exports = ReporteService;