-- SUPABASE / PostgreSQL
-- Ejecuta esto en el SQL Editor de Supabase (supabase.com → tu proyecto → SQL Editor)

CREATE TABLE IF NOT EXISTS leads (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    telefono VARCHAR(20) NOT NULL UNIQUE,
    cedula_encriptada VARCHAR(255),
    ultimo_mensaje TEXT,
    step_estado INT DEFAULT 0,
    ultimo_emisor VARCHAR(10) DEFAULT 'BOT' CHECK (ultimo_emisor IN ('BOT', 'CLIENTE', 'HUMANO')),
    fecha_actualizacion TIMESTAMP DEFAULT NOW(),
    estado_atencion VARCHAR(10) DEFAULT 'PENDIENTE' CHECK (estado_atencion IN ('PENDIENTE', 'EN_CURSO', 'RESUELTO'))
);

CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL
);

-- Usuario admin por defecto (contraseña: admin123 — cámbiala en producción)
INSERT INTO users (username, password_hash)
VALUES ('admin', '$2b$12$X6xAClAeausaP3EAeVy4/O6YGbRSlyjfUc6fDpp0aQOl2hZiGd6PC')
ON CONFLICT (username) DO NOTHING;
