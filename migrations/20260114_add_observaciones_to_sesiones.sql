-- Migración para agregar campos de observaciones a la tabla sesiones
-- Fecha: 2026-01-14

ALTER TABLE sesiones
ADD COLUMN dificultades TEXT NULL COMMENT 'Dificultades encontradas durante la sesión',
ADD COLUMN logros TEXT NULL COMMENT 'Logros del paciente en la sesión',
ADD COLUMN preguntas_supervisor TEXT NULL COMMENT 'Preguntas para el supervisor';

-- Agregar índices si es necesario (opcional)
-- ALTER TABLE sesiones ADD INDEX idx_dificultades (dificultades(50));
-- ALTER TABLE sesiones ADD INDEX idx_logros (logros(50));