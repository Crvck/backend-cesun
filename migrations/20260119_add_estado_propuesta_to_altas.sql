-- Migración: Agregar estado y campos de propuesta a tabla altas
-- Permite que psicólogos propongan altas para coordinadores

ALTER TABLE altas ADD COLUMN estado ENUM('propuesta', 'aprobada', 'rechazada') DEFAULT 'aprobada';
ALTER TABLE altas ADD COLUMN psicologo_id INT;
ALTER TABLE altas ADD COLUMN motivo_rechazo TEXT;
ALTER TABLE altas ADD COLUMN fecha_propuesta DATE;
ALTER TABLE altas ADD FOREIGN KEY (psicologo_id) REFERENCES users(id) ON DELETE SET NULL;

-- Actualizar registros existentes a 'aprobada'
UPDATE altas SET estado = 'aprobada', psicologo_id = usuario_id WHERE estado IS NULL;

-- Índices para mejora de performance
CREATE INDEX idx_estado ON altas(estado);
CREATE INDEX idx_psicologo_id ON altas(psicologo_id);
