const crearNotificacionCita = ({ paciente, fecha, hora, tipo_consulta, ubicacion, psicologo }) => {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #4a6fa5; color: var(--white); padding: 20px; text-align: center; }
                .content { padding: 20px; background-color: #f9f9f9; }
                .footer { padding: 10px; text-align: center; font-size: 12px; color: #666; }
                .details { margin: 20px 0; padding: 15px; background-color: #fff; border-left: 4px solid #4a6fa5; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Recordatorio de Cita</h1>
                </div>
                <div class="content">
                    <p>Estimado/a <strong>${paciente.nombre}</strong>,</p>
                    
                    <p>Le recordamos que tiene programada una cita de terapia psicológica:</p>
                    
                    <div class="details">
                        <p><strong>Fecha:</strong> ${fecha}</p>
                        <p><strong>Hora:</strong> ${hora}</p>
                        <p><strong>Modalidad:</strong> ${tipo_consulta === 'virtual' ? 'Virtual' : 'Presencial'}</p>
                        ${tipo_consulta === 'presencial' ? `<p><strong>Ubicación:</strong> ${ubicacion || 'Consultorio asignado'}</p>` : ''}
                        <p><strong>Psicólogo/a:</strong> ${psicologo.nombre} ${psicologo.apellido}</p>
                    </div>
                    
                    ${tipo_consulta === 'virtual' ? `
                    <p><strong>Enlace para la sesión virtual:</strong> <a href="${ubicacion}">${ubicacion}</a></p>
                    ` : ''}
                    
                    <p>Por favor, confirme su asistencia respondiendo a este correo o contactando a su terapeuta.</p>
                    
                    <p>Si necesita reprogramar o cancelar su cita, hágalo con al menos 24 horas de anticipación.</p>
                </div>
                <div class="footer">
                    <p>Este es un mensaje automático del Sistema de Gestión Psicológica.</p>
                    <p>Por favor, no responda a este correo.</p>
                </div>
            </div>
        </body>
        </html>
    `;
};

module.exports = crearNotificacionCita;
