ALTER TABLE expedientes
    ADD COLUMN motivo_consulta_especial ENUM('No aplica', 'Por canalizacion', 'Por Crisis') NOT NULL DEFAULT 'No aplica' AFTER motivo_consulta;
