-- Migración para crear perfil psicopedagógico y evoluciones
-- Fecha: 2026-02-05

USE psicogestion_db;

CREATE TABLE IF NOT EXISTS psicopedagogico_perfiles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    paciente_id INT NOT NULL,
    diagnostico TEXT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    CONSTRAINT fk_psicopedagogico_perfiles_paciente
        FOREIGN KEY (paciente_id) REFERENCES pacientes(id)
        ON DELETE CASCADE,
    UNIQUE KEY uniq_psicopedagogico_perfil_paciente (paciente_id)
);

CREATE TABLE IF NOT EXISTS psicopedagogico_evoluciones (
    id INT PRIMARY KEY AUTO_INCREMENT,
    perfil_id INT NOT NULL,
    fecha DATE NOT NULL,
    descripcion TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_psicopedagogico_evoluciones_perfil
        FOREIGN KEY (perfil_id) REFERENCES psicopedagogico_perfiles(id)
        ON DELETE CASCADE,
    INDEX idx_psicopedagogico_evoluciones_fecha (fecha)
);
