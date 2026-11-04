/**
 * Crea la tabla `archivos`, usada como respaldo persistente de los uploads.
 *
 * Los archivos se siguen guardando en disco (comportamiento actual) y además
 * se copian acá. Si el contenedor de Render se reinicia y pierde el disco
 * efímero, los archivos se sirven desde MariaDB.
 *
 * Es una migración aditiva: no modifica ninguna tabla existente.
 *
 * Uso: node src/scripts/add_tabla_archivos.js
 */
require('dotenv').config();
const db = require('../config/db');

(async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS archivos (
        id        INT AUTO_INCREMENT PRIMARY KEY,
        nombre    VARCHAR(255) NOT NULL UNIQUE,
        mime      VARCHAR(100) NOT NULL,
        tamano    INT UNSIGNED NOT NULL,
        datos     LONGBLOB NOT NULL,
        creado_en TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
    `);

    const rows = await db.query(`
      SELECT COUNT(*) AS total FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'archivos'
    `);
    console.log(rows[0].total > 0 ? '✅ Tabla archivos disponible.' : '❌ No se pudo crear la tabla.');
    console.log('Migración completada.');
    try { await db.pool.end(); } catch (_) {}
    process.exit(0);
  } catch (err) {
    console.error('❌ Error en la migración:', err.message);
    try { await db.pool.end(); } catch (_) {}
    process.exit(1);
  }
})();
