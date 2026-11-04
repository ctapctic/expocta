require('dotenv').config();
const db = require('../config/db');

(async () => {
  try {
    const cols = await db.query(`
      SELECT COLUMN_NAME
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'proyectos'
    `);
    const existentes = new Set(cols.map(c => c.COLUMN_NAME));

    const agregadas = [];

    if (!existentes.has('impacto_ods')) {
      await db.query(`ALTER TABLE proyectos ADD COLUMN impacto_ods VARCHAR(150) NULL AFTER sector_aplicacion`);
      agregadas.push('impacto_ods');
    }
    if (!existentes.has('problema_que_resuelve')) {
      await db.query(`ALTER TABLE proyectos ADD COLUMN problema_que_resuelve TEXT NULL AFTER resumen_ejecutivo`);
      agregadas.push('problema_que_resuelve');
    }
    if (!existentes.has('enlace_tecnico_url')) {
      await db.query(`ALTER TABLE proyectos ADD COLUMN enlace_tecnico_url VARCHAR(255) NULL AFTER video_pitch_url`);
      agregadas.push('enlace_tecnico_url');
    }
    if (!existentes.has('requerimientos_exhibicion')) {
      await db.query(`ALTER TABLE proyectos ADD COLUMN requerimientos_exhibicion TEXT NULL AFTER pdf_poster_url`);
      agregadas.push('requerimientos_exhibicion');
    }

    if (agregadas.length) {
      console.log('✅ Columnas agregadas a proyectos:', agregadas.join(', '));
    } else {
      console.log('ℹ️ Las 4 columnas ya existen en proyectos.');
    }
    console.log('Migración de campos de ficha técnica completada.');
    try { await db.pool.end(); } catch (_) {}
    process.exit(0);
  } catch (err) {
    console.error('❌ Error en la migración:', err.message);
    try { await db.pool.end(); } catch (_) {}
    process.exit(1);
  }
})();
