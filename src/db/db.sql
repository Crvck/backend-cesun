CREATE DATABASE IF NOT EXISTS psicogestion_db;
USE psicogestion_db;

CREATE TABLE fundaciones (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(255) NOT NULL UNIQUE,
    direccion TEXT,
    telefono VARCHAR(20),
    email VARCHAR(255),
    responsable VARCHAR(255),
    activo BOOLEAN DEFAULT TRUE,
    convenio_inicio DATE,
    convenio_fin DATE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE users (
    id INT PRIMARY KEY AUTO_INCREMENT,
    email VARCHAR(255) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    telefono VARCHAR(20),
    rol ENUM('coordinador', 'psicologo', 'becario') NOT NULL DEFAULT 'becario',
    especialidad VARCHAR(100),
    fundacion_id INT,
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (fundacion_id) REFERENCES fundaciones(id) ON DELETE SET NULL
);

CREATE TABLE pacientes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL,
    apellido VARCHAR(100) NOT NULL,
    email VARCHAR(255),
    telefono VARCHAR(20),
    fecha_inscripcion DATE,
    genero ENUM('masculino', 'femenino', 'otro', 'prefiero_no_decir'),
    direccion TEXT,
    es_estudiante BOOLEAN NOT NULL DEFAULT FALSE,
    matricula VARCHAR(50) NULL,
    institucion_educativa VARCHAR(255) NULL,
    carrera VARCHAR(255),
    disponibilidad JSON NULL,
    comentarios_disponibilidad TEXT NULL,
    edad_registro INT NULL,
    usuario_registro_id INT NULL,
    usuario_registro_nombre VARCHAR(255) NULL,
    usuario_registro_rol VARCHAR(50) NULL,
    estado VARCHAR(50) DEFAULT 'activo',
    activo BOOLEAN DEFAULT TRUE,
    notas TEXT,
    fundacion_id INT,
    ultimo_no_aprobado DATE NULL DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (fundacion_id) REFERENCES fundaciones(id) ON DELETE SET NULL,
    INDEX idx_activo (activo),
    INDEX idx_apellido_nombre (apellido, nombre),
    INDEX idx_ultimo_no_aprobado (ultimo_no_aprobado)
);

CREATE TABLE expedientes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    paciente_id INT NOT NULL UNIQUE,
    psicologo_id INT,
    motivo_consulta TEXT,
    motivo_consulta_especial ENUM('No aplica', 'Por canalizacion', 'Por Crisis') NOT NULL DEFAULT 'No aplica',
    historia_personal TEXT,
    historia_familiar TEXT,
    antecedentes_medicos TEXT,
    antecedentes_psiquiatricos TEXT,
    diagnostico_presuntivo VARCHAR(500),
    diagnostico_definitivo VARCHAR(500),
    tratamiento_actual TEXT,
    medicamentos JSON,
    alergias TEXT,
    factores_riesgo JSON,
    -- Riesgo suicida: actualizado por el trigger tr_after_insert_sesion al insertar sesiones
    riesgo_suicida ENUM('ninguno','bajo','moderado','alto') DEFAULT 'ninguno',
    redes_apoyo TEXT,
    emergencia_contacto VARCHAR(255),
    emergencia_telefono VARCHAR(20),
    consentimiento_informado BOOLEAN DEFAULT FALSE,
    fecha_consentimiento DATE,
    restricciones_acceso JSON,
    notas_confidenciales TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
    FOREIGN KEY (psicologo_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE asignaciones (
    id INT PRIMARY KEY AUTO_INCREMENT,
    paciente_id INT NOT NULL,
    psicologo_id INT NOT NULL,
    becario_id INT,
    fecha_inicio DATE NOT NULL DEFAULT (CURRENT_DATE),
    fecha_fin DATE,
    motivo_fin VARCHAR(255),
    estado ENUM('activa', 'finalizada', 'suspendida') DEFAULT 'activa',
    notas TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
    FOREIGN KEY (psicologo_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (becario_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_paciente_estado (paciente_id, estado),
    INDEX idx_psicologo_estado (psicologo_id, estado),
    INDEX idx_becario (becario_id)
);

CREATE TABLE citas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    paciente_id INT NOT NULL,
    titulo VARCHAR(255) NULL,
    psicologo_id INT,
    becario_id INT,
    fecha DATE NOT NULL,
    hora TIME NOT NULL,
    tipo_consulta ENUM('presencial', 'virtual') DEFAULT 'presencial',
    departamento ENUM('DEPAC', 'Psicopedagogico') NOT NULL DEFAULT 'DEPAC',
    estado ENUM('programada', 'confirmada', 'completada', 'cancelada') DEFAULT 'programada',
    notas TEXT,
    motivo_cancelacion VARCHAR(255),
    duracion INT DEFAULT 50,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
    FOREIGN KEY (psicologo_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (becario_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_fecha_estado (fecha, estado),
    INDEX idx_psicologo_fecha (psicologo_id, fecha),
    INDEX idx_becario (becario_id),
    INDEX idx_paciente_id (paciente_id)
);

CREATE TABLE sesiones (
    id INT PRIMARY KEY AUTO_INCREMENT,
    cita_id INT NOT NULL UNIQUE,
    psicologo_id INT NOT NULL,
    fecha DATE NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    tipo_sesion ENUM('evaluacion', 'terapia', 'seguimiento', 'crisis') DEFAULT 'terapia',
    objetivo TEXT,
    desarrollo TEXT,
    conclusion TEXT,
    tareas_asignadas TEXT,
    emocion_predominante VARCHAR(100),
    riesgo_suicida ENUM('ninguno', 'bajo', 'moderado', 'alto') DEFAULT 'ninguno',
    escalas_aplicadas JSON COMMENT 'JSON con escalas aplicadas y puntajes',
    siguiente_cita DATE,
    privado BOOLEAN DEFAULT FALSE COMMENT 'Si solo psicólogo puede ver',
    dificultades TEXT COMMENT 'Dificultades encontradas durante la sesión',
    logros TEXT COMMENT 'Logros del paciente en la sesión',
    preguntas_supervisor TEXT COMMENT 'Preguntas para el supervisor',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (cita_id) REFERENCES citas(id) ON DELETE CASCADE,
    FOREIGN KEY (psicologo_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_cita_id (cita_id),
    INDEX idx_psicologo_fecha (psicologo_id, fecha),
    INDEX idx_fecha (fecha)
);

CREATE TABLE notificaciones (
    id INT PRIMARY KEY AUTO_INCREMENT,
    usuario_id INT NOT NULL,
    tipo ENUM('cita_programada', 'cita_modificada', 'cita_cancelada', 'asignacion_nueva', 'observacion_nueva', 'alerta_sistema', 'reporte_generado') NOT NULL,
    titulo VARCHAR(255) NOT NULL,
    mensaje TEXT NOT NULL,
    leido BOOLEAN DEFAULT FALSE,
    leido_at TIMESTAMP NULL,
    accion_url VARCHAR(500),
    prioridad ENUM('baja', 'media', 'alta', 'urgente') DEFAULT 'media',
    datos_extra JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_usuario_leido (usuario_id, leido),
    INDEX idx_created_at (created_at),
    INDEX idx_tipo (tipo)
);

CREATE TABLE altas (
    id INT PRIMARY KEY AUTO_INCREMENT,
    paciente_id INT NOT NULL,
    usuario_id INT NOT NULL,
    tipo_alta ENUM('terapeutica', 'abandono', 'traslado', 'graduacion', 'no_continua', 'otro', 'no_aprobado') NOT NULL,
    fecha_alta DATE NOT NULL DEFAULT (CURRENT_DATE),
    motivo_detallado TEXT,
    recomendaciones TEXT,
    sesiones_totales INT,
    evaluacion_final ENUM('excelente', 'buena', 'regular', 'mala'),
    seguimiento_recomendado BOOLEAN DEFAULT FALSE,
    fecha_seguimiento DATE,
    -- Campos para sistema de propuestas (psicólogo propone, coordinador aprueba)
    estado ENUM('propuesta', 'aprobada', 'rechazada') DEFAULT 'aprobada',
    psicologo_id INT COMMENT 'Psicólogo que propone el alta',
    motivo_rechazo TEXT COMMENT 'Razón del rechazo por parte del coordinador',
    fecha_propuesta DATE COMMENT 'Fecha en que se propuso el alta',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (paciente_id) REFERENCES pacientes(id) ON DELETE CASCADE,
    FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (psicologo_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_paciente_id (paciente_id),
    INDEX idx_fecha_alta (fecha_alta),
    INDEX idx_tipo_alta (tipo_alta),
    INDEX idx_estado (estado),
    INDEX idx_psicologo_id (psicologo_id)
);

CREATE TABLE reportes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    usuario_id INT NOT NULL,
    tipo_reporte ENUM('mensual', 'trimestral', 'semestral', 'anual', 'personalizado', 'paciente', 'becario', 'psicologo') NOT NULL,
    nombre VARCHAR(255) NOT NULL,
    descripcion TEXT,
    parametros JSON,
    fecha_inicio DATE,
    fecha_fin DATE,
    formato ENUM('pdf', 'excel', 'csv', 'html') DEFAULT 'pdf',
    archivo_url VARCHAR(500),
    archivo_tamano INT,
    estado ENUM('pendiente', 'generando', 'completado', 'error') DEFAULT 'pendiente',
    compartido_con JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_usuario_id (usuario_id),
    INDEX idx_tipo_reporte_estado (tipo_reporte, estado),
    INDEX idx_created_at (created_at)
);

CREATE TABLE observaciones_becarios (
    id INT PRIMARY KEY AUTO_INCREMENT,
    becario_id INT NOT NULL,
    supervisor_id INT NOT NULL,
    cita_id INT,
    fecha DATE NOT NULL DEFAULT (CURRENT_DATE),
    tipo_observacion ENUM('sesion_observada', 'retroalimentacion', 'evaluacion_periodica', 'incidencia', 'reconocimiento') DEFAULT 'sesion_observada',
    aspecto_evaluado ENUM('empatia', 'tecnicas', 'documentacion', 'puntualidad', 'profesionalismo', 'etica') NOT NULL,
    calificacion INT NOT NULL CHECK (calificacion BETWEEN 1 AND 10),
    fortalezas TEXT,
    areas_mejora TEXT,
    recomendaciones TEXT,
    plan_accion TEXT,
    fecha_seguimiento DATE,
    privada BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (becario_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (supervisor_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (cita_id) REFERENCES citas(id) ON DELETE SET NULL,
    INDEX idx_becario_fecha (becario_id, fecha),
    INDEX idx_supervisor (supervisor_id),
    INDEX idx_tipo_observacion (tipo_observacion)
);

CREATE TABLE disponibilidades (
    id INT PRIMARY KEY AUTO_INCREMENT,
    usuario_id INT NOT NULL,
    dia_semana ENUM('lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo') NOT NULL,
    hora_inicio TIME NOT NULL,
    hora_fin TIME NOT NULL,
    tipo_disponibilidad ENUM('regular', 'extraordinaria', 'limitada') DEFAULT 'regular',
    activo BOOLEAN DEFAULT TRUE,
    fecha_inicio_vigencia DATE NOT NULL DEFAULT (CURRENT_DATE),
    fecha_fin_vigencia DATE,
    notas TEXT,
    max_citas_dia INT DEFAULT 8,
    intervalo_citas INT DEFAULT 50,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE CASCADE,
    INDEX idx_usuario_dia_activo (usuario_id, dia_semana, activo),
    INDEX idx_fecha_vigencia (fecha_inicio_vigencia, fecha_fin_vigencia)
);

CREATE TABLE logs_sistema (
    id INT PRIMARY KEY AUTO_INCREMENT,
    usuario_id INT,
    tipo_log ENUM('login', 'logout', 'creacion', 'modificacion', 'eliminacion', 'error', 'seguridad', 'backup', 'reporte', 'sistema') NOT NULL,
    modulo VARCHAR(100) NOT NULL,
    accion VARCHAR(255) NOT NULL,
    descripcion TEXT,
    datos_antes JSON,
    datos_despues JSON,
    ip_address VARCHAR(45),
    user_agent TEXT,
    severidad ENUM('info', 'advertencia', 'error', 'critico') DEFAULT 'info',
    resuelto BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_tipo_log_fecha (tipo_log, created_at),
    INDEX idx_usuario_id (usuario_id),
    INDEX idx_modulo (modulo),
    INDEX idx_severidad_resuelto (severidad, resuelto)
);

CREATE TABLE permisos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    categoria ENUM('administracion', 'pacientes', 'citas', 'reportes', 'configuracion', 'usuarios') NOT NULL,
    nivel_requerido ENUM('basico', 'intermedio', 'avanzado', 'administrador') DEFAULT 'basico',
    activo BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

CREATE TABLE usuario_permisos (
    id INT PRIMARY KEY AUTO_INCREMENT,
    usuario_id INT NOT NULL,
    permiso_id INT NOT NULL,
    concedido BOOLEAN DEFAULT FALSE,
    concedido_por INT,
    fecha_concesion TIMESTAMP NULL,
    fecha_expiracion TIMESTAMP NULL,
    motivo TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (usuario_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (permiso_id) REFERENCES permisos(id) ON DELETE CASCADE,
    FOREIGN KEY (concedido_por) REFERENCES users(id) ON DELETE SET NULL,
    UNIQUE KEY idx_usuario_permiso (usuario_id, permiso_id)
);

CREATE TABLE backups (
    id INT PRIMARY KEY AUTO_INCREMENT,
    tipo ENUM('completo', 'incremental') NOT NULL,
    ruta VARCHAR(500) NOT NULL,
    tamano BIGINT,
    base_backup_id INT,
    cambios INT DEFAULT 0,
    estado ENUM('pendiente', 'generando', 'completado', 'error', 'eliminado') DEFAULT 'pendiente',
    ultima_restauracion TIMESTAMP NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (base_backup_id) REFERENCES backups(id) ON DELETE SET NULL
);

INSERT INTO permisos (nombre, descripcion, categoria, nivel_requerido) VALUES
('ver_panel_coordinacion', 'Ver panel de coordinación', 'administracion', 'avanzado'),
('gestionar_usuarios', 'Gestionar usuarios (alta/baja/edición)', 'usuarios', 'avanzado'),
('gestionar_fundaciones', 'Gestionar fundaciones', 'administracion', 'avanzado'),
('gestionar_pacientes', 'Gestionar pacientes', 'pacientes', 'intermedio'),
('gestionar_asignaciones', 'Asignar pacientes a psicólogos/becarios', 'pacientes', 'intermedio'),
('ver_agenda_global', 'Ver agenda global completa', 'citas', 'intermedio'),
('generar_reportes', 'Generar reportes estadísticos', 'reportes', 'avanzado'),
('gestionar_altas', 'Gestionar altas de pacientes', 'pacientes', 'intermedio'),
('ver_expedientes_completos', 'Ver expedientes completos de pacientes', 'pacientes', 'avanzado'),
('configurar_sistema', 'Configurar parámetros del sistema', 'configuracion', 'administrador'),
('ver_panel_psicologo', 'Ver panel principal de psicólogo', 'administracion', 'basico'),
('ver_mis_pacientes', 'Ver pacientes asignados', 'pacientes', 'basico'),
('gestionar_mis_citas', 'Gestionar mis propias citas', 'citas', 'basico'),
('registrar_sesiones', 'Registrar contenido de sesiones', 'citas', 'intermedio'),
('supervisar_becarios', 'Supervisar becarios asignados', 'usuarios', 'intermedio'),
('crear_observaciones', 'Crear observaciones de becarios', 'usuarios', 'intermedio'),
('ver_expedientes_asignados', 'Ver expedientes de pacientes asignados', 'pacientes', 'intermedio'),
('dar_altas_pacientes', 'Dar de alta a pacientes', 'pacientes', 'intermedio'),
('ver_panel_becario', 'Ver panel principal de becario', 'administracion', 'basico'),
('ver_citas_dia', 'Ver citas del día', 'citas', 'basico'),
('gestionar_citas_asignadas', 'Gestionar citas asignadas', 'citas', 'basico'),
('ver_pacientes_asignados', 'Ver pacientes asignados', 'pacientes', 'basico'),
('ver_observaciones_propias', 'Ver observaciones propias', 'usuarios', 'basico'),
('configurar_disponibilidad', 'Configurar disponibilidad personal', 'configuracion', 'basico');

INSERT INTO fundaciones (nombre, telefono, email, responsable) VALUES
('Fundación Salud Mental Comunitaria', '555-1234', 'contacto@fsmc.org', 'Dra. María González'),
('Asociación de Psicología Aplicada', '555-5678', 'info@asocpsicologia.edu', 'Lic. Carlos Rodríguez');

INSERT INTO users (email, password, nombre, apellido, telefono, rol, especialidad, fundacion_id) VALUES
('coordinador@psicogestion.com', '$2b$12$hae1TqJNVYIumXT7aPXKCO/lVf418E5.nXUCem30mFsG5itFuLDjq', 'Ana', 'Martínez', '555-1111', 'coordinador', 'Coordinación Clínica', 1),
('psicologo1@psicogestion.com', '$2b$12$hae1TqJNVYIumXT7aPXKCO/lVf418E5.nXUCem30mFsG5itFuLDjq', 'Luis', 'Fernández', '555-2222', 'psicologo', 'Terapia Cognitivo-Conductual', 1),
('becario1@psicogestion.com', '$2b$12$hae1TqJNVYIumXT7aPXKCO/lVf418E5.nXUCem30mFsG5itFuLDjq', 'Juan', 'Pérez', '555-3333', 'becario', 'Practicante de Psicología', 1),
('becario2@psicogestion.com', '$2b$12$hae1TqJNVYIumXT7aPXKCO/lVf418E5.nXUCem30mFsG5itFuLDjq', 'Sofía', 'Ramírez', '555-4444', 'becario', 'Practicante de Psicología', 2),
('psicologo2@psicogestion.com', '$2b$12$hae1TqJNVYIumXT7aPXKCO/lVf418E5.nXUCem30mFsG5itFuLDjq', 'Laura', 'Gutiérrez', '555-5555', 'psicologo', 'Terapia Familiar', 1),
('becario3@psicogestion.com', '$2b$12$hae1TqJNVYIumXT7aPXKCO/lVf418E5.nXUCem30mFsG5itFuLDjq', 'Pedro', 'Hernández', '555-6666', 'becario', 'Practicante de Psicología', 1),
('alan@psicogestion.com', '$2b$12$hae1TqJNVYIumXT7aPXKCO/lVf418E5.nXUCem30mFsG5itFuLDjq', 'Alan', 'Jassiel', '555-666', 'psicologo', 'Terapia Familiar', 1),
('ale@psicogestion.com', '$2b$12$hae1TqJNVYIumXT7aPXKCO/lVf418E5.nXUCem30mFsG5itFuLDjq', 'Ale', 'Jandro', '555-333', 'becario', 'Practicante de Psicología', 1),
('emanuel@psicogestion.com', '$2b$12$hae1TqJNVYIumXT7aPXKCO/lVf418E5.nXUCem30mFsG5itFuLDjq', 'Emanuel', 'Iribe', '555-777', 'coordinador', 'Coordinación Clínica', 1);

INSERT INTO pacientes (nombre, apellido, fecha_inscripcion, genero, telefono, email) VALUES
('Carlos', 'Gómez', '1998-05-15', 'masculino', '555-0011', 'carlos@gmail.com'),
('Mariana', 'López', '1995-08-22', 'femenino', '555-0022', 'mariana@hotmail.com'),
('Roberto', 'Sánchez', '2000-02-10', 'masculino', '555-0033', 'roberto@yahoo.com');

INSERT INTO expedientes (paciente_id, psicologo_id, motivo_consulta) VALUES
(1, 2, 'Ansiedad académica con síntomas de estrés elevado'),
(2, 2, 'Estrés laboral crónico con afectación del sueño'),
(3, 2, 'Dificultades de adaptación al entorno universitario');

INSERT INTO asignaciones (paciente_id, psicologo_id, becario_id, fecha_inicio) VALUES
(1, 2, 3, CURDATE()),
(2, 2, 4, CURDATE()),
(3, 2, NULL, CURDATE());

INSERT INTO citas (paciente_id, psicologo_id, becario_id, fecha, hora, estado, tipo_consulta, notas) VALUES
(1, 2, 3, DATE_ADD(CURDATE(), INTERVAL 1 DAY), '10:00:00', 'programada', 'presencial', 'Primera consulta'),
(2, 2, 4, DATE_ADD(CURDATE(), INTERVAL 2 DAY), '11:00:00', 'confirmada', 'virtual', 'Seguimiento'),
(3, 2, NULL, DATE_ADD(CURDATE(), INTERVAL 3 DAY), '09:00:00', 'programada', 'presencial', 'Evaluación inicial');

INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje) VALUES
(3, 'cita_programada', 'Nueva cita asignada', 'Tienes una nueva cita con Carlos Gómez para mañana a las 10:00 AM'),
(4, 'cita_modificada', 'Cita modificada', 'La cita con Mariana López ha sido cambiada a modalidad virtual');

INSERT INTO usuario_permisos (usuario_id, permiso_id, concedido, concedido_por, fecha_concesion)
SELECT u.id, p.id, TRUE, 1, NOW()
FROM users u
CROSS JOIN permisos p
WHERE u.rol = 'coordinador'
AND p.nivel_requerido IN ('basico', 'intermedio', 'avanzado', 'administrador');

INSERT INTO usuario_permisos (usuario_id, permiso_id, concedido, concedido_por, fecha_concesion)
SELECT u.id, p.id, TRUE, 1, NOW()
FROM users u
CROSS JOIN permisos p
WHERE u.rol = 'psicologo'
AND p.nivel_requerido IN ('basico', 'intermedio');

INSERT INTO usuario_permisos (usuario_id, permiso_id, concedido, concedido_por, fecha_concesion)
SELECT u.id, p.id, TRUE, 1, NOW()
FROM users u
CROSS JOIN permisos p
WHERE u.rol = 'becario'
AND p.nivel_requerido = 'basico';

CREATE VIEW vista_citas_hoy AS
SELECT 
    c.id,
    CONCAT(p.nombre, ' ', p.apellido) AS paciente,
    c.fecha,
    TIME_FORMAT(c.hora, '%H:%i') AS hora,
    c.estado,
    c.tipo_consulta,
    u_psi.nombre AS psicologo_nombre,
    u_bec.nombre AS becario_nombre
FROM citas c
JOIN pacientes p ON c.paciente_id = p.id
JOIN users u_psi ON c.psicologo_id = u_psi.id
LEFT JOIN users u_bec ON c.becario_id = u_bec.id
WHERE c.fecha = CURDATE()
AND c.estado IN ('programada', 'confirmada')
ORDER BY c.hora;

CREATE VIEW vista_pacientes_asignados AS
SELECT 
    a.id,
    CONCAT(p.nombre, ' ', p.apellido) AS paciente,
    p.telefono,
    p.email,
    CONCAT(u.nombre, ' ', u.apellido) AS psicologo,
    CONCAT(ub.nombre, ' ', ub.apellido) AS becario,
    a.fecha_inicio,
    a.estado AS estado_asignacion,
    (SELECT COUNT(*) FROM citas WHERE paciente_id = p.id AND estado = 'completada') AS sesiones_completadas,
    (SELECT COUNT(*) FROM citas WHERE paciente_id = p.id AND estado IN ('programada', 'confirmada') AND fecha >= CURDATE()) AS citas_pendientes
FROM asignaciones a
JOIN pacientes p ON a.paciente_id = p.id
JOIN users u ON a.psicologo_id = u.id
LEFT JOIN users ub ON a.becario_id = ub.id
WHERE p.activo = TRUE AND a.estado = 'activa';

CREATE VIEW vista_resumen_coordinacion AS
SELECT 
    (SELECT COUNT(*) FROM users WHERE rol = 'becario' AND activo = TRUE) AS becarios_activos,
    (SELECT COUNT(*) FROM users WHERE rol = 'psicologo' AND activo = TRUE) AS psicologos_activos,
    (SELECT COUNT(*) FROM pacientes WHERE activo = TRUE) AS pacientes_activos,
    (SELECT COUNT(*) FROM citas WHERE fecha = CURDATE() AND estado IN ('programada', 'confirmada')) AS citas_hoy,
    (SELECT COUNT(*) FROM citas WHERE fecha = CURDATE() AND estado = 'completada') AS citas_completadas_hoy,
    (SELECT COUNT(*) FROM altas WHERE MONTH(fecha_alta) = MONTH(CURDATE())) AS altas_mes_actual;

CREATE VIEW vista_historial_sesiones AS
SELECT 
    s.id,
    s.fecha,
    CONCAT(p.nombre, ' ', p.apellido) AS paciente,
    CONCAT(u.nombre, ' ', u.apellido) AS psicologo,
    s.desarrollo AS contenido_sesion,
    s.conclusion AS observaciones,
    s.tareas_asignadas,
    s.siguiente_cita AS proxima_sesion
FROM sesiones s
JOIN citas c ON s.cita_id = c.id
JOIN pacientes p ON c.paciente_id = p.id
JOIN users u ON s.psicologo_id = u.id
ORDER BY s.fecha DESC;

CREATE VIEW vista_estadisticas_psicologos AS
SELECT 
    u.id,
    CONCAT(u.nombre, ' ', u.apellido) AS psicologo,
    COUNT(DISTINCT a.paciente_id) AS pacientes_asignados,
    COUNT(c.id) AS total_citas,
    SUM(CASE WHEN c.estado = 'completada' THEN 1 ELSE 0 END) AS citas_completadas,
    ROUND(AVG(CASE WHEN c.estado = 'completada' THEN c.duracion END), 1) AS duracion_promedio,
    COUNT(DISTINCT a.becario_id) AS becarios_supervisados
FROM users u
LEFT JOIN asignaciones a ON u.id = a.psicologo_id AND a.estado = 'activa'
LEFT JOIN citas c ON u.id = c.psicologo_id AND c.fecha >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)
WHERE u.rol = 'psicologo' AND u.activo = TRUE
GROUP BY u.id, u.nombre, u.apellido;

CREATE VIEW vista_disponibilidad_semanal AS
SELECT 
    u.id,
    CONCAT(u.nombre, ' ', u.apellido) AS profesional,
    u.rol,
    d.dia_semana,
    TIME_FORMAT(d.hora_inicio, '%H:%i') AS hora_inicio,
    TIME_FORMAT(d.hora_fin, '%H:%i') AS hora_fin,
    d.max_citas_dia,
    (SELECT COUNT(*) FROM citas c 
     WHERE (c.psicologo_id = u.id OR c.becario_id = u.id)
     AND c.fecha = CURDATE()
     AND c.estado IN ('programada', 'confirmada')) AS citas_hoy
FROM users u
LEFT JOIN disponibilidades d ON u.id = d.usuario_id AND d.activo = TRUE
WHERE u.rol IN ('psicologo', 'becario') AND u.activo = TRUE
ORDER BY u.rol, u.apellido, FIELD(d.dia_semana, 'lunes', 'martes', 'miercoles', 'jueves', 'viernes', 'sabado', 'domingo');

DELIMITER $$
CREATE PROCEDURE sp_obtener_citas_por_fecha_becario(
    IN p_fecha DATE,
    IN p_becario_id INT
)
BEGIN
    SELECT 
        c.*,
        CONCAT(p.nombre, ' ', p.apellido) AS paciente_nombre,
        p.telefono AS paciente_telefono,
        p.email AS paciente_email,
        u_psi.nombre AS psicologo_nombre,
        u_bec.nombre AS becario_nombre,
        c.duracion AS duracion_minutos,
        c.notas AS motivo
    FROM citas c
    JOIN pacientes p ON c.paciente_id = p.id
    LEFT JOIN users u_psi ON c.psicologo_id = u_psi.id
    LEFT JOIN users u_bec ON c.becario_id = u_bec.id
    WHERE c.fecha = p_fecha
    AND (c.becario_id = p_becario_id OR p_becario_id IS NULL)
    ORDER BY c.hora;
END$$
DELIMITER ;

DELIMITER $$
CREATE PROCEDURE sp_generar_reporte_mensual(
    IN p_mes INT,
    IN p_anio INT,
    IN p_psicologo_id INT
)
BEGIN
    SELECT 
        p.id,
        CONCAT(p.nombre, ' ', p.apellido) AS paciente,
        COUNT(c.id) AS total_sesiones,
        SUM(CASE WHEN c.estado = 'completada' THEN 1 ELSE 0 END) AS sesiones_completadas,
        SUM(CASE WHEN c.estado = 'cancelada' THEN 1 ELSE 0 END) AS sesiones_canceladas,
        SUM(CASE WHEN c.estado = 'programada' THEN 1 ELSE 0 END) AS sesiones_programadas,
        MIN(c.fecha) AS primera_sesion_mes,
        MAX(c.fecha) AS ultima_sesion_mes
    FROM pacientes p
    LEFT JOIN citas c ON p.id = c.paciente_id 
        AND MONTH(c.fecha) = p_mes 
        AND YEAR(c.fecha) = p_anio
        AND (c.psicologo_id = p_psicologo_id OR p_psicologo_id IS NULL)
    WHERE p.activo = TRUE
    GROUP BY p.id, p.nombre, p.apellido
    ORDER BY p.apellido, p.nombre;
END$$
DELIMITER ;

DELIMITER $$
CREATE TRIGGER tr_after_insert_alta
AFTER INSERT ON altas
FOR EACH ROW
BEGIN
    UPDATE pacientes 
    SET estado = CONCAT('alta_', NEW.tipo_alta),
        activo = FALSE,
        updated_at = NOW()
    WHERE id = NEW.paciente_id;
    
    UPDATE citas 
    SET estado = 'cancelada',
        motivo_cancelacion = CONCAT('Paciente dado de alta (', NEW.tipo_alta, ')'),
        updated_at = NOW()
    WHERE paciente_id = NEW.paciente_id 
    AND fecha >= CURDATE()
    AND estado IN ('programada', 'confirmada');
    
    UPDATE asignaciones 
    SET estado = 'finalizada',
        fecha_fin = CURDATE(),
        motivo_fin = CONCAT('Paciente dado de alta (', NEW.tipo_alta, ')')
    WHERE paciente_id = NEW.paciente_id 
    AND estado = 'activa';
END$$
DELIMITER ;

DELIMITER $$
CREATE TRIGGER tr_after_update_cita
AFTER UPDATE ON citas
FOR EACH ROW
BEGIN
    DECLARE paciente_nombre VARCHAR(200);
    DECLARE paciente_email VARCHAR(255);
    
    IF OLD.fecha != NEW.fecha OR OLD.hora != NEW.hora OR OLD.tipo_consulta != NEW.tipo_consulta THEN
        
        SELECT CONCAT(nombre, ' ', apellido), email INTO paciente_nombre, paciente_email
        FROM pacientes WHERE id = NEW.paciente_id;
        
        IF NEW.psicologo_id IS NOT NULL THEN
            INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, created_at)
            VALUES (
                NEW.psicologo_id,
                'cita_modificada',
                'Cita modificada',
                CONCAT('La cita con ', paciente_nombre, ' ha sido modificada. Nueva fecha: ', NEW.fecha, ' ', TIME_FORMAT(NEW.hora, '%H:%i')),
                NOW()
            );
        END IF;
        
        IF NEW.becario_id IS NOT NULL THEN
            INSERT INTO notificaciones (usuario_id, tipo, titulo, mensaje, created_at)
            VALUES (
                NEW.becario_id,
                'cita_modificada',
                'Cita modificada',
                CONCAT('La cita con ', paciente_nombre, ' ha sido modificada. Nueva fecha: ', NEW.fecha, ' ', TIME_FORMAT(NEW.hora, '%H:%i')),
                NOW()
            );
        END IF;
        
        INSERT INTO logs_sistema (usuario_id, tipo_log, modulo, accion, descripcion, created_at)
        VALUES (
            NEW.psicologo_id,
            'modificacion',
            'citas',
            'Actualizar cita',
            CONCAT('Cita ', NEW.id, ' modificada para paciente ', paciente_nombre),
            NOW()
        );
    END IF;
END$$
DELIMITER ;

DELIMITER $$
CREATE TRIGGER tr_after_insert_sesion
AFTER INSERT ON sesiones
FOR EACH ROW
BEGIN
    UPDATE expedientes 
    SET riesgo_suicida = NEW.riesgo_suicida,
        updated_at = NOW()
    WHERE paciente_id = (SELECT paciente_id FROM citas WHERE id = NEW.cita_id);
END$$
DELIMITER ;

-- NOTE: If you apply this schema to an existing database, make sure the following columns exist
-- because the trigger 'tr_after_insert_sesion' expects 'expedientes.riesgo_suicida' to be present.
-- To add them manually run (once) on your DB:
-- ALTER TABLE expedientes ADD COLUMN riesgo_suicida ENUM('ninguno','bajo','moderado','alto') DEFAULT 'ninguno';
-- If your MySQL/MariaDB version does not support JSON, consider updating to MySQL 5.7+ / MariaDB 10.2+ or change the column type.

CREATE INDEX idx_pacientes_activo ON pacientes(activo);
CREATE INDEX idx_citas_psicologo_fecha ON citas(psicologo_id, fecha, estado);
CREATE INDEX idx_sesiones_cita ON sesiones(cita_id);
CREATE INDEX idx_asignaciones_psicologo ON asignaciones(psicologo_id, fecha_fin);
CREATE INDEX idx_users_rol_activo ON users(rol, activo);
CREATE INDEX idx_expediente_paciente ON expedientes(paciente_id);
CREATE INDEX idx_expediente_psicologo ON expedientes(psicologo_id);
CREATE INDEX idx_reportes_usuario ON reportes(usuario_id, estado);
CREATE INDEX idx_reportes_tipo ON reportes(tipo_reporte, created_at);
CREATE INDEX idx_disponibilidades_vigencia ON disponibilidades(fecha_inicio_vigencia, fecha_fin_vigencia);
CREATE INDEX idx_logs_severidad ON logs_sistema(severidad, resuelto);
CREATE INDEX idx_observaciones_fecha_seguimiento ON observaciones_becarios(fecha_seguimiento);

CREATE USER IF NOT EXISTS 'psicogestion_user'@'localhost' IDENTIFIED BY 'SecurePass123!';
GRANT ALL PRIVILEGES ON psicogestion_db.* TO 'psicogestion_user'@'localhost';
GRANT EXECUTE ON PROCEDURE psicogestion_db.sp_obtener_citas_por_fecha_becario TO 'psicogestion_user'@'localhost';
GRANT EXECUTE ON PROCEDURE psicogestion_db.sp_generar_reporte_mensual TO 'psicogestion_user'@'localhost';
FLUSH PRIVILEGES;