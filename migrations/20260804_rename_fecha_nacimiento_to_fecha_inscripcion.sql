-- Migration: 20260804_rename_fecha_nacimiento_to_fecha_inscripcion.sql
-- Rename paciente field fecha_nacimiento to fecha_inscripcion

ALTER TABLE pacientes
    CHANGE COLUMN fecha_nacimiento fecha_inscripcion DATE NULL;
