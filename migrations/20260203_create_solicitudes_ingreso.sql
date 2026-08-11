-- Migración para crear la tabla solicitudes_ingreso
-- Fecha: 2026-02-03

USE psicogestion_db;

CREATE TABLE IF NOT EXISTS solicitudes_ingreso (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre_completo VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    telefono VARCHAR(20) NOT NULL,
    origen ENUM('CESUN', 'EXTERNO') DEFAULT 'CESUN',
    matricula VARCHAR(50) NULL,
    institucion_procedencia VARCHAR(255) NULL,
    horas_a_liberar INT NOT NULL,
    motivo TEXT,
    estado ENUM('PENDIENTE', 'APROBADO', 'RECHAZADO') DEFAULT 'PENDIENTE',
    disponibilidad_horaria JSON NULL COMMENT 'JSON con días y horarios disponibles del solicitante',
    fecha_solicitud TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Índices para mejorar rendimiento
CREATE INDEX idx_solicitudes_estado ON solicitudes_ingreso(estado);
CREATE INDEX idx_solicitudes_fecha ON solicitudes_ingreso(fecha_solicitud);