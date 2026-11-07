/**
 * Migración: agrega tipificación a empresas y crea tabla de valoraciones para empresas.
 *
 * - tipo: categoría de la empresa (tecnologia, servicios, industria, educacion, otro)
 * - stand_numero: número de stand en la expo (ej: E-01)
 * - valoraciones_empresas: tabla de valoración con 5 criterios
 *
 * Uso: node src/scripts/add_valoraciones_empresas.js
 */
require('dotenv').config();
const db = require('../config/db');

(async () => {
  try {
    // 1. Agregar columna tipo a empresas
    const colTipo = await db.query(`
      SELECT COUNT(*) AS n FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'empresas' AND COLUMN_NAME = 'tipo'
    `);
    if (Number(colTipo[0].n) === 0) {
      await db.query(`
        ALTER TABLE empresas
        ADD COLUMN tipo ENUM('tecnologia','servicios','industria','educacion','otro') NOT NULL DEFAULT 'servicios' AFTER nombre_corporativo
      `);
      console.log('✅ Columna tipo agregada a empresas.');
    } else {
      console.log('ℹ️ La columna tipo ya existe.');
    }

    // 2. Agregar columna stand_numero a empresas
    const colStand = await db.query(`
      SELECT COUNT(*) AS n FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'empresas' AND COLUMN_NAME = 'stand_numero'
    `);
    if (Number(colStand[0].n) === 0) {
      await db.query(`
        ALTER TABLE empresas
        ADD COLUMN stand_numero VARCHAR(20) NULL AFTER tipo
      `);
      console.log('✅ Columna stand_numero agregada a empresas.');
    } else {
      console.log('ℹ️ La columna stand_numero ya existe.');
    }

    // 3. Crear tabla valoraciones_empresas
    await db.query(`
      CREATE TABLE IF NOT EXISTS valoraciones_empresas (
        id INT AUTO_INCREMENT PRIMARY KEY,
        usuario_id INT NOT NULL,
        empresa_id INT NOT NULL,
        calidad_servicio TINYINT NOT NULL,
        atencion TINYINT NOT NULL,
        propuesta_valor TINYINT NOT NULL,
        innovacion TINYINT NOT NULL,
        impacto_social_economico TINYINT NOT NULL,
        comentario TEXT,
        creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE KEY (usuario_id, empresa_id),
        FOREIGN KEY (usuario_id) REFERENCES usuarios(id) ON DELETE CASCADE,
        FOREIGN KEY (empresa_id) REFERENCES empresas(id) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);
    console.log('✅ Tabla valoraciones_empresas disponible.');

    console.log('Migración completada.');
    try { await db.pool.end(); } catch (_) {}
    process.exit(0);
  } catch (err) {
    console.error('❌ Error en la migración:', err.message);
    try { await db.pool.end(); } catch (_) {}
    process.exit(1);
  }
})();
