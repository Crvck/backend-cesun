const crearNotificacionObservacion = ({ becario, supervisor, fecha, calificacion, aspectos }) => {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #ffc107; color: #333; padding: 20px; text-align: center; }
                .content { padding: 20px; background-color: #f9f9f9; }
                .footer { padding: 10px; text-align: center; font-size: 12px; color: #666; }
                .details { margin: 20px 0; padding: 15px; background-color: #fff; border-left: 4px solid #ffc107; }
                .aspecto { margin: 10px 0; padding: 10px; background-color: #f8f9fa; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Nueva Observación de Supervisión</h1>
                </div>
                <div class="content">
                    <p>Estimado/a <strong>${becario.nombre} ${becario.apellido}</strong>,</p>
                    
                    <p>Su supervisor ${supervisor.nombre} ${supervisor.apellido} ha registrado una nueva observación sobre su desempeño.</p>
                    
                    <div class="details">
                        <p><strong>Fecha:</strong> ${fecha}</p>
                        <p><strong>Calificación general:</strong> ${calificacion}/10</p>
                    </div>
                    
                    ${aspectos && aspectos.length > 0 ? `
                    <h3>Aspectos evaluados:</h3>
                    ${aspectos.map(aspecto => `
                        <div class="aspecto">
                            <p><strong>${aspecto.nombre}:</strong> ${aspecto.calificacion}/10</p>
                            ${aspecto.comentario ? `<p><em>${aspecto.comentario}</em></p>` : ''}
                        </div>
                    `).join('')}
                    ` : ''}
                    
                    <p>Revise su panel para ver los detalles completos y las recomendaciones de mejora.</p>
                    
                    <p>Esta retroalimentación tiene como objetivo apoyar su desarrollo profesional.</p>
                </div>
                <div class="footer">
                    <p>Este es un mensaje automático del Sistema de Gestión Psicológica.</p>
                </div>
            </div>
        </body>
        </html>
    `;
};

module.exports = crearNotificacionObservacion;
