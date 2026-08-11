const crearNotificacionAlta = ({ paciente, fecha_alta, tipo_alta, recomendaciones, psicologo, obtenerDescripcionAlta }) => {
    return `
        <!DOCTYPE html>
        <html>
        <head>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #28a745; color: var(--white); padding: 20px; text-align: center; }
                .content { padding: 20px; background-color: #f9f9f9; }
                .footer { padding: 10px; text-align: center; font-size: 12px; color: #666; }
                .details { margin: 20px 0; padding: 15px; background-color: #fff; border-left: 4px solid #28a745; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Proceso de Alta Completado</h1>
                </div>
                <div class="content">
                    <p>Estimado/a <strong>${paciente.nombre} ${paciente.apellido}</strong>,</p>
                    
                    <p>Le informamos que se ha completado su proceso terapéutico en nuestro centro.</p>
                    
                    <div class="details">
                        <p><strong>Fecha de alta:</strong> ${fecha_alta}</p>
                        <p><strong>Tipo de alta:</strong> ${obtenerDescripcionAlta(tipo_alta)}</p>
                        <p><strong>Psicólogo/a responsable:</strong> ${psicologo.nombre} ${psicologo.apellido}</p>
                    </div>
                    
                    ${recomendaciones ? `
                    <h3>Recomendaciones:</h3>
                    <p>${recomendaciones}</p>
                    ` : ''}
                    
                    <p>Le agradecemos la confianza depositada en nosotros y le deseamos lo mejor en su continuo crecimiento personal.</p>
                    
                    <p>Si en el futuro requiere apoyo psicológico, no dude en contactarnos nuevamente.</p>
                </div>
                <div class="footer">
                    <p>Este es un mensaje automático del Sistema de Gestión Psicológica.</p>
                </div>
            </div>
        </body>
        </html>
    `;
};

module.exports = crearNotificacionAlta;
