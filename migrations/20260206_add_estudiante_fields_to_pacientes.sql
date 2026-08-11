-- Migration: 20260206_add_estudiante_fields_to_pacientes.sql
-- Notes: Add student-related fields to the pacientes table.

ALTER TABLE pacientes
    ADD COLUMN es_estudiante BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN matricula VARCHAR(50) NULL,
    ADD COLUMN institucion_educativa VARCHAR(255) NULL,
    ADD COLUMN disponibilidad JSON NULL,
    ADD COLUMN comentarios_disponibilidad TEXT NULL,
    ADD COLUMN edad_registro INT NULL,
    ADD COLUMN usuario_registro_id INT NULL,
    ADD COLUMN usuario_registro_nombre VARCHAR(255) NULL,
    ADD COLUMN usuario_registro_rol VARCHAR(50) NULL;

ALTER TABLE pacientes
    MODIFY COLUMN carrera VARCHAR(255) NULL;
