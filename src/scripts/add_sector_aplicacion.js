require('dotenv').config();
const db = require('../config/db');

const MAP_ESPECIALIDAD = [
  ['Mecatrónica & IoT', 'MECATRÓNICA'],
  ['Automatización Industrial', 'MECATRÓNICA'],
  ['Desarrollo de Software', 'TIC']
];

(async () => {
  try {
    const col = await db.query(`
      SELECT COUNT(*) AS n
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = 'proyectos'
        AND COLUMN_NAME = 'sector_aplicacion'
    `);
    if (Number(col[0].n) === 0) {
      await db.query(`
        ALTER TABLE proyectos
        ADD COLUMN sector_aplicacion VARCHAR(255) NULL AFTER especialidad
      `);
      console.log('✅ Columna sector_aplicacion agregada a proyectos.');
    } else {
      console.log('ℹ️ La columna sector_aplicacion ya existe.');
    }

    for (const [desde, hacia] of MAP_ESPECIALIDAD) {
      const r = await db.query(
        'UPDATE proyectos SET especialidad = ? WHERE especialidad = ?',
        [hacia, desde]
      );
      if (r.affectedRows > 0) {
        console.log(`✅ especialidad '${desde}' -> '${hacia}': ${r.affectedRows} proyecto(s).`);
      }
    }

    const resumen = await db.query(`
      SELECT especialidad, COUNT(*) AS total
      FROM proyectos GROUP BY especialidad ORDER BY especialidad
    `);
    console.log('Resumen de especialidades:',
      JSON.stringify(resumen.map(r => ({ especialidad: r.especialidad, total: String(r.total) }))));
    console.log('Migración completada.');
    try { await db.pool.end(); } catch (_) {}
    process.exit(0);
  } catch (err) {
    console.error('❌ Error en la migración:', err.message);
    try { await db.pool.end(); } catch (_) {}
    process.exit(1);
  }
})();
