// Plantilla de correo para bienvenida de usuario (Diseño Premium - Sin Emojis)
module.exports = function BienvenidaUsuarioTemplate({ nombreCompleto, email, passwordTemporal, rolTexto }) {
  
  // URL del sistema (puedes parametrizarla si prefieres)
  const systemUrl = "http://localhost:3001";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Bienvenido al Sistema</title>
      <style>
        /* Reset y estilos base */
        body { margin: 0; padding: 0; font-family: 'Segoe UI', Helvetica, Arial, sans-serif; background-color: #f4f7f6; color: #333333; line-height: 1.6; -webkit-font-smoothing: antialiased; }
        
        /* Contenedor principal */
        .wrapper { width: 100%; background-color: #f4f7f6; padding: 40px 0; }
        .main-content { background-color: #ffffff; margin: 0 auto; width: 100%; max-width: 600px; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
        
        /* Encabezado */
        .header { background-color: #4a6fa5; padding: 40px 30px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; }
        .header-subtitle { color: rgba(255,255,255,0.9); font-size: 14px; margin-top: 10px; font-weight: 400; }
        
        /* Cuerpo */
        .body-section { padding: 40px 40px; }
        .greeting { font-size: 18px; color: #1a1a1a; margin-bottom: 20px; }
        .text-content { color: #555555; margin-bottom: 25px; }
        
        /* Tarjeta de Credenciales */
        .credentials-card { background-color: #f8f9fa; border: 1px solid #e9ecef; border-left: 5px solid #4a6fa5; border-radius: 4px; padding: 25px; margin: 30px 0; }
        .credentials-title { font-size: 12px; text-transform: uppercase; color: #888; font-weight: bold; letter-spacing: 1px; margin-bottom: 15px; border-bottom: 1px solid #e9ecef; padding-bottom: 5px; }
        .credential-row { margin-bottom: 15px; }
        .credential-label { font-size: 13px; color: #666; font-weight: 600; display: block; margin-bottom: 5px; }
        .credential-value { font-size: 15px; color: #333; font-weight: 500; }
        
        /* Caja de Contraseña */
        .password-box { background-color: #ffffff; border: 1px dashed #4a6fa5; padding: 12px; font-family: 'Courier New', Courier, monospace; font-size: 18px; color: #4a6fa5; font-weight: bold; text-align: center; border-radius: 4px; letter-spacing: 2px; margin-top: 5px; user-select: all; }
        
        /* Alerta de Seguridad */
        .security-alert { background-color: #fff8e1; color: #b7791f; padding: 15px; border-radius: 4px; font-size: 13px; margin-bottom: 30px; border-left: 5px solid #ed8936; }
        
        /* Botón de Acción */
        .cta-button { display: block; width: fit-content; margin: 0 auto; background-color: #4a6fa5; color: #ffffff; padding: 14px 30px; text-decoration: none; border-radius: 6px; font-weight: 600; text-align: center; transition: background-color 0.3s; }
        
        /* Footer */
        .footer { background-color: #f4f7f6; padding: 20px; text-align: center; color: #999; font-size: 12px; border-top: 1px solid #e1e4e8; }
        
        /* Responsive */
        @media only screen and (max-width: 600px) {
            .body-section { padding: 25px; }
            .header { padding: 30px 20px; }
            .cta-button { width: 100%; box-sizing: border-box; }
        }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="main-content">
          
          <div class="header">
            <h1>Bienvenido</h1>
            <div class="header-subtitle">Sistema de Gestión Psicológica</div>
          </div>

          <div class="body-section">
            <div class="greeting">Estimado/a <strong>${nombreCompleto}</strong>,</div>
            
            <p class="text-content">
              Nos complace informarle que su cuenta ha sido creada exitosamente. Se le ha asignado el perfil de <strong style="color: #4a6fa5;">${rolTexto}</strong>.
            </p>

            <div class="credentials-card">
              <div class="credentials-title">INFORMACIÓN DE ACCESO</div>
              
              <div class="credential-row">
                <span class="credential-label">Correo Electrónico</span>
                <span class="credential-value">${email}</span>
              </div>
              
              <div class="credential-row" style="margin-bottom: 0;">
                <span class="credential-label">Contraseña Temporal</span>
                <div class="password-box">${passwordTemporal}</div>
              </div>
            </div>

            <div class="security-alert">
              <strong>IMPORTANTE:</strong> Por motivos de seguridad, el sistema le solicitará cambiar esta contraseña inmediatamente después de iniciar sesión por primera vez.
            </div>

            <a href="${systemUrl}" class="cta-button">Acceder al Sistema</a>
            
            <p style="text-align: center; font-size: 13px; color: #888; margin-top: 30px;">
              Si el botón no funciona, copie y pegue la siguiente URL en su navegador:<br>
              <span style="color: #4a6fa5;">${systemUrl}</span>
            </p>
          </div>
        </div>

        <div class="footer">
          <p>© ${new Date().getFullYear()} Sistema de Gestión Psicológica<br>
          Mensaje generado automáticamente, favor de no responder.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};