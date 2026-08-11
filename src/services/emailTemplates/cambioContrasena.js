// Plantilla de correo para notificación de cambio de contraseña (Diseño Premium - Sin Emojis)
module.exports = function CambioContrasenaTemplate({ nombreCompleto, email, passwordNueva }) {
  
  // URL del sistema
  const systemUrl = "http://localhost:3001";

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Cambio de Contraseña</title>
      <style>
        /* Estilos Base */
        body { margin: 0; padding: 0; font-family: 'Segoe UI', Helvetica, Arial, sans-serif; background-color: #f4f7f6; color: #333333; line-height: 1.6; -webkit-font-smoothing: antialiased; }
        
        /* Contenedor */
        .wrapper { width: 100%; background-color: #f4f7f6; padding: 40px 0; }
        .main-content { background-color: #ffffff; margin: 0 auto; width: 100%; max-width: 600px; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05); }
        
        /* Encabezado */
        .header { background-color: #4a6fa5; padding: 35px 30px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 22px; font-weight: 600; letter-spacing: 0.5px; text-transform: uppercase; }
        
        /* Cuerpo */
        .body-section { padding: 40px 40px; }
        .greeting { font-size: 18px; color: #1a1a1a; margin-bottom: 20px; font-weight: 600; }
        
        /* Caja de Éxito (Sin Emojis) */
        .success-banner { background-color: #e8f5e9; color: #2e7d32; padding: 15px; border-radius: 4px; margin-bottom: 25px; border-left: 5px solid #2e7d32; font-size: 14px; font-weight: 600; }
        
        /* Tarjeta de Credenciales */
        .credentials-card { background-color: #f8f9fa; border: 1px solid #e9ecef; border-radius: 6px; padding: 25px; margin: 25px 0; }
        .credential-label { font-size: 12px; color: #888; text-transform: uppercase; letter-spacing: 1px; font-weight: bold; display: block; margin-bottom: 8px; }
        .credential-value { font-size: 15px; color: #333; font-weight: 500; margin-bottom: 20px; display: block; }
        
        /* Caja de Contraseña */
        .password-box { background-color: #ffffff; border: 1px dashed #4a6fa5; padding: 15px; font-family: 'Courier New', Courier, monospace; font-size: 18px; color: #4a6fa5; font-weight: bold; text-align: center; border-radius: 4px; letter-spacing: 1px; user-select: all; }
        
        /* Botón */
        .cta-button { display: block; width: fit-content; margin: 30px auto; background-color: #4a6fa5; color: #ffffff; padding: 12px 30px; text-decoration: none; border-radius: 4px; font-weight: 600; text-align: center; font-size: 14px; }
        
        /* Advertencia de Seguridad */
        .security-note { font-size: 13px; color: #666; background-color: #fff3cd; padding: 15px; border-radius: 4px; border: 1px solid #ffeeba; margin-top: 30px; }
        
        /* Footer */
        .footer { background-color: #f4f7f6; padding: 20px; text-align: center; color: #999; font-size: 12px; border-top: 1px solid #e1e4e8; }
        .footer p { margin: 5px 0; }

        /* Responsive */
        @media only screen and (max-width: 600px) {
            .body-section { padding: 25px; }
            .header { padding: 25px 20px; }
            .cta-button { width: 100%; box-sizing: border-box; }
        }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="main-content">
          
          <div class="header">
            <h1>Actualización de Seguridad</h1>
          </div>

          <div class="body-section">
            <div class="greeting">Hola, ${nombreCompleto}</div>
            
            <div class="success-banner">
              La contraseña de su cuenta ha sido actualizada correctamente.
            </div>

            <p style="color: #555; font-size: 14px;">
              El equipo de coordinación ha establecido una nueva contraseña temporal para su acceso al Sistema de Gestión Psicológica.
            </p>

            <div class="credentials-card">
              <span class="credential-label">Correo Registrado</span>
              <span class="credential-value">${email}</span>
              
              <span class="credential-label">Nueva Contraseña</span>
              <div class="password-box">${passwordNueva}</div>
            </div>

            <a href="${systemUrl}" class="cta-button">Iniciar Sesión Ahora</a>
            
            <div class="security-note">
              <strong style="color: #856404;">IMPORTANTE:</strong> Por su seguridad, le recomendamos cambiar esta contraseña inmediatamente después de ingresar al sistema. Si usted no solicitó este cambio, contacte al administrador.
            </div>
          </div>
        </div>

        <div class="footer">
          <p>© ${new Date().getFullYear()} Sistema de Gestión Psicológica</p>
          <p>Mensaje automático, favor de no responder.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};