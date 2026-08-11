ALTER TABLE citas
    ADD COLUMN total_sesiones INT NOT NULL DEFAULT 1,
    ADD COLUMN numero_sesion INT NOT NULL DEFAULT 1,
    ADD COLUMN serie_id VARCHAR(64) NULL;

CREATE INDEX idx_citas_serie_id ON citas (serie_id);
