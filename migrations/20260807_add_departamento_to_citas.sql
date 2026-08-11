ALTER TABLE citas
    ADD COLUMN departamento ENUM('DEPAC', 'Psicopedagogico') NOT NULL DEFAULT 'DEPAC' AFTER tipo_consulta;
