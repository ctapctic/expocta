/**
 * Migración: versionado por edición.
 * Ejecutar una sola vez: node src/scripts/add_edicion.js
 */
const db = require('../config/db');

const TABLAS = ['proyectos', 'charlas', 'empresas', 'oferta_formativa'];

async function columnaExiste(tabla, columna) {
  const rows = await db.query(
    `SELECT COUNT(*) AS c FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ?`,
    [tabla, columna]
  );
  return Number(rows[0].c) > 0;
}

async function run() {
  try {
    const cfgRows = await db.query("SELECT valor FROM configuracion_evento WHERE clave = 'anio_evento'");
    const edicionDefault = (cfgRows && cfgRows.length && cfgRows[0].valor) ? String(cfgRows[0].valor).trim() : '2026';

    for (const tabla of TABLAS) {
      if (!(await columnaExiste(tabla, 'edicion'))) {
        await db.query(`ALTER TABLE ${tabla} ADD COLUMN edicion VARCHAR(20) NULL`);
      }
      await db.query(`UPDATE ${tabla} SET edicion = ? WHERE edicion IS NULL OR edicion = ''`, [edicionDefault]);
      console.log(`✅ ${tabla}: columna edicion lista (default ${edicionDefault}).`);
    }

    await db.query(
      "INSERT IGNORE INTO configuracion_evento (clave, valor, descripcion) VALUES ('edicion_actual', ?, 'Edicion activa del evento (filtra listados, evaluaciones y leaderboard)')",
      [edicionDefault]
    );
    console.log(`✅ edicion_actual = ${edicionDefault}`);

    try { await db.pool.end(); } catch (_) {}
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    try { await db.pool.end(); } catch (_) {}
    process.exit(1);
  }
}

run();
