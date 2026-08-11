-- Migration: 20260112_add_riesgo_to_expedientes.sql
-- Adds riesgo_suicida ENUM to expedientes table

ALTER TABLE `expedientes`
  ADD COLUMN `riesgo_suicida` ENUM('ninguno','bajo','moderado','alto') NOT NULL DEFAULT 'ninguno';

-- Rollback:
-- ALTER TABLE `expedientes` DROP COLUMN `riesgo_suicida`;

-- Notes: Run this migration on the MySQL server that hosts the application's database.
-- Example: mysql -u <user> -p <database_name> < 20260112_add_riesgo_to_expedientes.sql