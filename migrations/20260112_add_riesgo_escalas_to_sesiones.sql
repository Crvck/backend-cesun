-- Migration: 20260112_add_riesgo_escalas_to_sesiones.sql
-- Adds riesgo_suicida ENUM and escalas_aplicadas JSON to sesiones table

ALTER TABLE `sesiones`
  ADD COLUMN `riesgo_suicida` ENUM('ninguno','bajo','moderado','alto') NOT NULL DEFAULT 'ninguno',
  ADD COLUMN `escalas_aplicadas` JSON NULL;

-- Rollback:
-- To remove the columns, run:
-- ALTER TABLE `sesiones` DROP COLUMN `escalas_aplicadas`, DROP COLUMN `riesgo_suicida`;

-- Notes: Run this migration on the MySQL server that hosts the application's database.
-- Example: mysql -u <user> -p <database_name> < 20260112_add_riesgo_escalas_to_sesiones.sql