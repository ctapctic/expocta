-- =============================================================================
-- ESQUEMA DE BASE DE DATOS MARIADB - EXPOTECNIA EFTP
-- =============================================================================

CREATE DATABASE IF NOT EXISTS `expotecnia_eftp` 
  CHARACTER SET utf8mb4 
  COLLATE utf8mb4_unicode_ci;

USE `expotecnia_eftp`;

-- -----------------------------------------------------------------------------
-- 1. TABLA: usuarios
-- -----------------------------------------------------------------------------
DROP TABLE IF EXISTS `valoraciones_proyectos`;
DROP TABLE IF EXISTS `valoraciones_charlas`;
DROP TABLE IF EXISTS `prospectos_eftp`;
DROP TABLE IF EXISTS `proyectos`;
DROP TABLE IF EXISTS `oferta_formativa`;
DROP TABLE IF EXISTS `charlas`;
DROP TABLE IF EXISTS `empresas`;
DROP TABLE IF EXISTS `usuarios`;
DROP TABLE IF EXISTS `configuracion_evento`;

CREATE TABLE `usuarios` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `nombre` VARCHAR(150) NOT NULL,
  `email` VARCHAR(150) NOT NULL UNIQUE,
  `rol` ENUM('visitante', 'alumno', 'docente', 'empresa', 'admin') NOT NULL DEFAULT 'visitante',
  `estado` ENUM('pendiente', 'habilitado', 'deshabilitado') NOT NULL DEFAULT 'pendiente' COMMENT 'Habilitación de la cuenta por el administrador',
  `codigo_pin` VARCHAR(100) NULL COMMENT 'Hash bcrypt del PIN de acceso rápido para autenticación ligera en stand',
  `creado_en` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_usuarios_email` (`email`),
  INDEX `idx_usuarios_rol` (`rol`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 2. TABLA: proyectos
-- -----------------------------------------------------------------------------
CREATE TABLE `proyectos` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `codigo_stand` VARCHAR(50) NOT NULL UNIQUE,
  `titulo` VARCHAR(255) NOT NULL,
  `especialidad` VARCHAR(100) NOT NULL,
  `sector_aplicacion` VARCHAR(255) DEFAULT NULL,
  `impacto_ods` VARCHAR(150) DEFAULT NULL,
  `resumen_ejecutivo` TEXT NOT NULL,
  `problema_que_resuelve` TEXT DEFAULT NULL,
  `trl_nivel` TINYINT UNSIGNED NOT NULL CHECK (`trl_nivel` BETWEEN 1 AND 9),
  `tecnologias_usadas` TEXT NOT NULL,
  `integrantes` TEXT NOT NULL,
  `docente_tutor` VARCHAR(150) NOT NULL,
  `imagen_url` VARCHAR(255) DEFAULT NULL,
  `video_pitch_url` VARCHAR(255) DEFAULT NULL,
  `enlace_tecnico_url` VARCHAR(255) DEFAULT NULL,
  `pdf_poster_url` VARCHAR(255) DEFAULT NULL,
  `requerimientos_exhibicion` TEXT DEFAULT NULL,
  `creado_en` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_proyectos_codigo_stand` (`codigo_stand`),
  INDEX `idx_proyectos_especialidad` (`especialidad`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 3. TABLA: oferta_formativa
-- -----------------------------------------------------------------------------
CREATE TABLE `oferta_formativa` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `codigo_oferta` VARCHAR(50) NOT NULL UNIQUE,
  `nombre_carrera` VARCHAR(200) NOT NULL,
  `duracion_horas` INT NOT NULL,
  `modalidad` VARCHAR(50) NOT NULL DEFAULT 'Presencial',
  `perfil_egreso` TEXT NOT NULL,
  `requisitos_admision` TEXT NOT NULL,
  `brochure_pdf_url` VARCHAR(255) DEFAULT NULL,
  `video_lab_url` VARCHAR(255) DEFAULT NULL,
  `link_informacion_url` VARCHAR(500) DEFAULT NULL COMMENT 'Enlace externo con información ampliada de la oferta',
  `creado_en` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_oferta_codigo` (`codigo_oferta`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 4. TABLA: prospectos_eftp
-- -----------------------------------------------------------------------------
CREATE TABLE `prospectos_eftp` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `usuario_id` INT NOT NULL,
  `oferta_id` INT NOT NULL,
  `telefono` VARCHAR(30) NOT NULL,
  `comentario` TEXT NULL,
  `creado_en` DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_prospectos_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_prospectos_oferta` FOREIGN KEY (`oferta_id`) REFERENCES `oferta_formativa` (`id`) ON DELETE CASCADE,
  UNIQUE KEY `uk_usuario_oferta` (`usuario_id`, `oferta_id`),
  INDEX `idx_prospectos_oferta_id` (`oferta_id`),
  INDEX `idx_prospectos_usuario_id` (`usuario_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 5. TABLA: charlas
-- -----------------------------------------------------------------------------
CREATE TABLE `charlas` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `codigo_charla` VARCHAR(50) NOT NULL UNIQUE,
  `titulo` VARCHAR(255) NOT NULL,
  `eje_tematico` VARCHAR(150) NOT NULL,
  `expositor` VARCHAR(150) NOT NULL,
  `biografia_expositor` TEXT NOT NULL,
  `foto_expositor_url` VARCHAR(255) NOT NULL DEFAULT '',
  `horario` DATETIME NOT NULL,
  `ubicacion` VARCHAR(150) NOT NULL,
  `diapositivas_pdf_url` VARCHAR(255) DEFAULT NULL,
  `creado_en` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_charlas_codigo` (`codigo_charla`),
  INDEX `idx_charlas_horario` (`horario`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 6. TABLA: empresas
-- -----------------------------------------------------------------------------
CREATE TABLE `empresas` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `codigo_empresa` VARCHAR(50) NOT NULL UNIQUE,
  `nombre_corporativo` VARCHAR(200) NOT NULL,
  `descripcion` TEXT NOT NULL,
  `ofertas_pasantia` TEXT NOT NULL,
  `requisitos_perfil` TEXT NOT NULL,
  `logo_url` VARCHAR(255) DEFAULT NULL,
  `catalogo_pdf_url` VARCHAR(255) DEFAULT NULL,
  `creado_en` DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX `idx_empresas_codigo` (`codigo_empresa`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 7. TABLA: valoraciones_proyectos
-- -----------------------------------------------------------------------------
CREATE TABLE `valoraciones_proyectos` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `usuario_id` INT NOT NULL,
  `proyecto_id` INT NOT NULL,
  `innovacion` TINYINT UNSIGNED NOT NULL CHECK (`innovacion` BETWEEN 1 AND 5),
  `dominio_tecnico` TINYINT UNSIGNED NOT NULL CHECK (`dominio_tecnico` BETWEEN 1 AND 5),
  `presentacion` TINYINT UNSIGNED NOT NULL CHECK (`presentacion` BETWEEN 1 AND 5),
  `impacto` TINYINT UNSIGNED NOT NULL CHECK (`impacto` BETWEEN 1 AND 5),
  `comentario` TEXT NULL,
  `creado_en` DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_val_proy_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_val_proy_proyecto` FOREIGN KEY (`proyecto_id`) REFERENCES `proyectos` (`id`) ON DELETE CASCADE,
  UNIQUE KEY `uk_val_usuario_proyecto` (`usuario_id`, `proyecto_id`),
  INDEX `idx_val_proy_proyecto_id` (`proyecto_id`),
  INDEX `idx_val_proy_usuario_id` (`usuario_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- -----------------------------------------------------------------------------
-- 8. TABLA: valoraciones_charlas
-- -----------------------------------------------------------------------------
CREATE TABLE `valoraciones_charlas` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `usuario_id` INT NOT NULL,
  `charla_id` INT NOT NULL,
  `nota_contenido` TINYINT UNSIGNED NOT NULL CHECK (`nota_contenido` BETWEEN 1 AND 5),
  `nota_expositor` TINYINT UNSIGNED NOT NULL CHECK (`nota_expositor` BETWEEN 1 AND 5),
  `comentario` TEXT NULL,
  `creado_en` DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT `fk_val_char_usuario` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_val_char_charla` FOREIGN KEY (`charla_id`) REFERENCES `charlas` (`id`) ON DELETE CASCADE,
  UNIQUE KEY `uk_val_usuario_charla` (`usuario_id`, `charla_id`),
  INDEX `idx_val_char_charla_id` (`charla_id`),
  INDEX `idx_val_char_usuario_id` (`usuario_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;


-- -----------------------------------------------------------------------------
-- 9. TABLA: configuracion_evento (configuración global del evento por admin)
-- -----------------------------------------------------------------------------
CREATE TABLE `configuracion_evento` (
  `clave`          VARCHAR(80)  NOT NULL PRIMARY KEY,
  `valor`          TEXT         NULL,
  `descripcion`    VARCHAR(255) NULL,
  `actualizado_en` DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO `configuracion_evento` (`clave`, `valor`, `descripcion`) VALUES
('institucion_organizadora', 'Instituto de Educación Superior N° 1',   'Nombre de la institución que organiza el evento'),
('institucion_padre',        'Dirección General de EFTP',               'Organismo superior / ministerio de referencia'),
('sede',                     'Sede Central – Auditorio Principal',      'Nombre y ubicación de la sede del evento'),
('nombre_evento',            'Expotecnia EFTP 2026',                    'Nombre completo del evento'),
('anio_evento',              '2026',                                    'Año de edición del evento'),
('logo_ministerio_url',      '',                                        'URL del logo del ministerio (subida o externa)'),
('logo_institucion_url',     '',                                        'URL del logo de la institución organizadora'),
('color_primario',           '#38bdf8',                                'Color primario del branding del evento (hex)'),
('mensaje_bienvenida',       'Bienvenidos a la Expotecnia EFTP',       'Mensaje de bienvenida en pantallas públicas');


-- =============================================================================
-- DATOS DE PRUEBA / SEMILLA (SEED DATA)
-- =============================================================================

-- Los PINs se almacenan como hash bcrypt. Valores en claro de la semilla:
-- admin 9999 / visitante 1234 / docente 4321 / alumno 1111 / empresa 5555
INSERT INTO `usuarios` (`id`, `nombre`, `email`, `rol`, `estado`, `codigo_pin`) VALUES
(1, 'Administrador General', 'admin@expotecnia.edu', 'admin', 'habilitado', '$2b$10$6wxYYA1nJ1pywXyxzKzKWuiEbgfzbXn5GfYq5bw4AJMDNn.MhmgL6'),
(2, 'Carlos Evaluador', 'carlos.evaluador@tech.com', 'visitante', 'habilitado', '$2b$10$bfQGIJtho8McUnAyn1t5OOUMchYffctJwkjOXUL7VitG0bBOFgO6a'),
(3, 'María Docente', 'm.docente@instituto.edu', 'docente', 'habilitado', '$2b$10$KeUkpguEyp.YUQz4FKegF.hrgX8EctonQIGWXZU2lxtBnBCWIs9xi'),
(4, 'Juan Alumno', 'juan.alumno@estudiantes.edu', 'alumno', 'habilitado', '$2b$10$wKevncEVF01KPyv3vR75V.8bSNNiKJAI4.REvdufiwmqiv9FOa8Fi'),
(5, 'Empresa Innovatech HR', 'contacto@innovatech.com', 'empresa', 'habilitado', '$2b$10$lkMbDBRFQtMt9h5FmLLqA.QZT4Vue/xkIwb0lOu0TcJH5TuFmR1uC');

INSERT INTO `proyectos` (`id`, `codigo_stand`, `titulo`, `especialidad`, `resumen_ejecutivo`, `trl_nivel`, `tecnologias_usadas`, `integrantes`, `docente_tutor`, `imagen_url`, `video_pitch_url`, `pdf_poster_url`) VALUES
(1, 'STAND-101', 'Sistema de Monitoreo Agro-IoT con Energías Renovables', 'Mecatrónica & IoT', 'Plataforma IoT de sensores de humedad y nutrientes para cultivos hidropónicos impulsada por paneles solares y alertas por Telegram.', 6, 'ESP32, Node.js, MQTT, MariaDB, Paneles Solares 100W', 'Ana Torres, Mateo Gómez, Lucas Silva', 'Ing. Roberto Fernández', '/uploads/proyecto-iot.jpg', 'https://www.youtube.com/embed/dQw4w9WgXcQ', '/uploads/poster-iot.pdf'),
(2, 'STAND-102', 'Bazo Robótico Didáctico con Control por Visión Artificial', 'Automatización Industrial', 'Brazo mecánico 5 DOF impreso en 3D optimizado para clasificación automatizada de piezas reciclables mediante cámara OpenCV.', 5, 'Python, OpenCV, Arduino Mega, Motores PAP, Servos MG996R', 'Sofía Ramírez, Diego Morales', 'Ing. Patricia Benítez', '/uploads/proyecto-robot.jpg', 'https://www.youtube.com/embed/dQw4w9WgXcQ', '/uploads/poster-robot.pdf'),
(3, 'STAND-103', 'Plataforma PWA para Telemedicina Técnica y Triaje', 'Desarrollo de Software', 'Web App progresiva offline-first para asistencias sanitarias primarias en zonas rurales con sincronización automática de expedientes.', 7, 'Node.js, MariaDB, Progressive Web App, Service Worker, Bootstrap 5', 'Esteban Quito, Javier Pérez, Valeria Ruiz', 'Lic. Marcelo Rossi', '/uploads/proyecto-pwa.jpg', 'https://www.youtube.com/embed/dQw4w9WgXcQ', '/uploads/poster-pwa.pdf');

INSERT INTO `oferta_formativa` (`id`, `codigo_oferta`, `nombre_carrera`, `duracion_horas`, `modalidad`, `perfil_egreso`, `requisitos_admision`, `brochure_pdf_url`, `video_lab_url`) VALUES
(1, 'OFERTA-TIC', 'Tecnicatura Superior en Mecatrónica e Industria 4.0', 2400, 'Presencial / Dual', 'Profesional capacitado para integrar sistemas mecánicos, electrónicos y de computación en líneas de producción automatizadas.', 'Título secundario técnico o bachiller completo, entrevista de admisión.', '/uploads/brochure-mecatronica.pdf', 'https://www.youtube.com/embed/dQw4w9WgXcQ'),
(2, 'OFERTA-SOFT', 'Tecnicatura en Desarrollo de Software y Sistemas Nube', 2200, 'Híbrida', 'Desarrollador Full-Stack capaz de diseñar, construir y desplegar aplicaciones web resilientes, APIs RESTful y arquitecturas de bases de datos.', 'Secundario completo y evaluación diagnóstica de lógica.', '/uploads/brochure-software.pdf', 'https://www.youtube.com/embed/dQw4w9WgXcQ');

INSERT INTO `charlas` (`id`, `codigo_charla`, `titulo`, `eje_tematico`, `expositor`, `biografia_expositor`, `horario`, `ubicacion`, `diapositivas_pdf_url`) VALUES
(1, 'CHARLA-01', 'Industria 5.0 y Colaboración Hombre-Máquina', 'Tendencias Tecnológicas', 'Dra. Elena Rostova', 'Especialista internacional en robótica colaborativa y gemelos digitales con 15 años de experiencia en automatización europea.', '2026-10-15 10:00:00', 'Auditorio Principal - Planta Alta', '/uploads/charla-industria5.pdf'),
(2, 'CHARLA-02', 'Ciberseguridad y Resiliencia Operativa en EFTP', 'Seguridad Digital', 'Ing. Martín Zabaleta', 'Chief Information Security Officer en SecureTech Sudamérica y docente invitado.', '2026-10-15 14:30:00', 'Aula Magna B', '/uploads/charla-ciberseguridad.pdf');

INSERT INTO `empresas` (`id`, `codigo_empresa`, `nombre_corporativo`, `descripcion`, `ofertas_pasantia`, `requisitos_perfil`, `logo_url`, `catalogo_pdf_url`) VALUES
(1, 'EMP-01', 'TechAutomation SA', 'Líder en soluciones de automatización de procesos industriales y robótica pesada.', '3 vacantes de Pasantía Técnica en Mecatrónica y Programación PLC.', 'Estudiantes del último año con conocimientos en PLC Siemens y electrónica de potencia.', '/uploads/logo-techautomation.png', '/uploads/catalogo-techautomation.pdf'),
(2, 'EMP-02', 'CloudScale Technologies', 'Empresa de desarrollo de software a medida y consultoría en infraestructura en la nube.', '5 vacantes para Desarrolladores Junior Node.js / DB Administrators.', 'Conocimiento comprobable en JavaScript/Node.js, SQL MariaDB y control de versiones Git.', '/uploads/logo-cloudscale.png', '/uploads/catalogo-cloudscale.pdf');

INSERT INTO `valoraciones_proyectos` (`id`, `usuario_id`, `proyecto_id`, `innovacion`, `dominio_tecnico`, `presentacion`, `impacto`, `comentario`) VALUES
(1, 2, 1, 5, 5, 4, 5, 'Excelente integración de hardware IoT y solución sustentable real.');

INSERT INTO `valoraciones_charlas` (`id`, `usuario_id`, `charla_id`, `nota_contenido`, `nota_expositor`, `comentario`) VALUES
(1, 2, 1, 5, 5, 'Magistral disertación sobre cobots.');
