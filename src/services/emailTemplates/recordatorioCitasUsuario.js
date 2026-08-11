// Plantilla de correo para recordatorio de citas programadas para usuario (Diseño Premium)
module.exports = function RecordatorioCitasUsuarioTemplate({ usuario, citas, rangoDias }) {
  
  // Lógica para generar las filas con mejor formato HTML
  const rows = citas.map((c, index) => {
    const totalSesiones = Number(c.total_sesiones || 1);
    const numeroSesion = Number(c.numero_sesion || 1);
    const restantes = Math.max(0, totalSesiones - numeroSesion);
    
    // Determinamos colores o estilos según el tipo (opcional, para darle variedad visual)
    const isVirtual = c.tipo_consulta === 'virtual';
    const rowBackground = index % 2 === 0 ? '#ffffff' : '#f8f9fa'; // Alternar fondo filas

    return `
      <tr style="border-bottom: 1px solid #eef2f5;">
        <td style="padding: 15px 10px; font-weight: bold; color: #4a6fa5;">
            ${c.fecha}<br>
            <span style="font-weight: normal; color: #666; font-size: 12px;">${c.hora?.substring(0, 5) || '--:--'}</span>
        </td>
        <td style="padding: 15px 10px;">
            <div style="font-weight: 600; color: #333;">${c.Paciente ? `${c.Paciente.nombre} ${c.Paciente.apellido}` : 'Paciente'}</div>
        </td>
        <td style="padding: 15px 10px;">
            <span style="background-color: ${isVirtual ? '#e3f2fd' : '#e8f5e9'}; color: ${isVirtual ? '#1565c0' : '#2e7d32'}; padding: 4px 8px; border-radius: 12px; font-size: 11px; font-weight: bold; text-transform: uppercase; letter-spacing: 0.5px;">
                ${isVirtual ? 'Virtual' : 'Presencial'}
            </span>
        </td>
        <td style="padding: 15px 10px; color: #555; font-size: 13px;">
            ${c.estado || '-'}
        </td>
        <td style="padding: 15px 10px; text-align: center;">
            <div style="background-color: #4a6fa5; color: white; width: 35px; height: 35px; line-height: 35px; border-radius: 50%; margin: 0 auto; font-size: 12px; font-weight: bold;">
                ${numeroSesion}
            </div>
            <div style="font-size: 10px; color: #888; margin-top: 4px;">de ${totalSesiones}</div>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Recordatorio de Citas</title>
      <style>
        /* Reset y estilos base */
        body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f7f6; -webkit-font-smoothing: antialiased; }
        table { border-collapse: collapse; width: 100%; }
        
        /* Contenedor principal estilo tarjeta */
        .wrapper { width: 100%; table-layout: fixed; background-color: #f4f7f6; padding-bottom: 40px; }
        .main-content { background-color: #ffffff; margin: 0 auto; width: 100%; max-width: 700px; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
        
        /* Encabezado */
        .header { background-color: #4a6fa5; padding: 30px 40px; text-align: center; background-image: linear-gradient(135deg, #4a6fa5 0%, #3b5b8c 100%); }
        .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: 0.5px; }
        .header-icon { font-size: 40px; margin-bottom: 10px; display: block; color: rgba(255,255,255,0.9); }
        
        /* Cuerpo del mensaje */
        .body-section { padding: 40px; }
        .welcome-text { font-size: 16px; color: #333; margin-bottom: 25px; line-height: 1.6; }
        
        /* Tabla de datos */
        .data-table-container { overflow-x: auto; border: 1px solid #eef2f5; border-radius: 6px; }
        .data-table th { background-color: #f8f9fa; color: #666; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; padding: 12px 10px; text-align: left; border-bottom: 2px solid #eef2f5; }
        
        /* Footer */
        .footer { background-color: #f4f7f6; padding: 20px; text-align: center; color: #999; font-size: 12px; }
        .footer a { color: #4a6fa5; text-decoration: none; }
        
        /* Utilidades móvil */
        @media only screen and (max-width: 600px) {
            .body-section { padding: 20px; }
            .header { padding: 20px; }
            .data-table th, .data-table td { font-size: 12px; padding: 8px 4px; }
        }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <br>
        <div class="main-content">
          
          <div class="header">
            <span class="header-icon">📅</span>
            <h1>Agenda de Citas</h1>
            <p style="color: rgba(255,255,255,0.8); margin: 5px 0 0 0; font-size: 14px;">Próximos ${rangoDias} días</p>
          </div>

          <div class="body-section">
            <p class="welcome-text">
              Hola <strong>${usuario.nombre}</strong>,<br>
              A continuación encontrarás el detalle de tus sesiones programadas. Por favor, verifica el estado y la modalidad de cada una.
            </p>

            <div class="data-table-container">
              <table class="data-table">
                <thead>
                  <tr>
                    <th width="20%">Fecha / Hora</th>
                    <th width="25%">Paciente</th>
                    <th width="20%">Modalidad</th>
                    <th width="15%">Estado</th>
                    <th width="15%" style="text-align: center;">Progreso</th>
                  </tr>
                </thead>
                <tbody>
                  ${rows}
                </tbody>
              </table>
            </div>
            
            <p style="margin-top: 30px; font-size: 13px; color: #888; text-align: center; border-top: 1px solid #eee; padding-top: 20px;">
                <em>Recuerda confirmar asistencia si es necesario.</em>
            </p>
          </div>
        </div>

        <div class="footer">
          <p>© ${new Date().getFullYear()} Sistema de Gestión Psicológica<br>
          Este es un mensaje automático, por favor no responder.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};