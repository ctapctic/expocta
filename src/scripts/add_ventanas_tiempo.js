/**
 * Migración: ventanas de tiempo para registro y votación.
 * Ejecutar una sola vez: node src/scripts/add_ventanas_tiempo.js
 *
 * Valor vacío = sin límite (la plataforma sigue funcionando como antes).
 */
const db = require('../config/db');

const CLAVES = [
  ['registro_inicio', '', 'Inicio de la ventana de registro de visitantes/alumnos/empresas e interés en carreras (ISO 8601 UTC, vacío = sin límite)'],
  ['registro_fin',    '', 'Fin de la ventana de registro de visitantes/alumnos/empresas e interés en carreras (ISO 8601 UTC, vacío = sin límite)'],
  ['votacion_inicio', '', 'Inicio de la ventana de votación de proyectos, empresas y charlas (ISO 8601 UTC, vacío = sin límite)'],
  ['votacion_fin',    '', 'Fin de la ventana de votación de proyectos, empresas y charlas (ISO 8601 UTC, vacío = sin límite)']
];

async function run() {
  try {
    for (const [clave, valor, descripcion] of CLAVES) {
      await db.query(
        'INSERT IGNORE INTO configuracion_evento (clave, valor, descripcion) VALUES (?, ?, ?)',
        [clave, valor, descripcion]
      );
    }

    const rows = await db.query(
      `SELECT clave, valor FROM configuracion_evento WHERE clave IN (${CLAVES.map(() => '?').join(', ')}) ORDER BY clave`,
      CLAVES.map(([clave]) => clave)
    );

    console.log('✅ Claves de ventanas de tiempo verificadas:');
    for (const row of rows) {
      console.log(`   - ${row.clave} = ${JSON.stringify(row.valor)}`);
    }
    console.log('🎉 Listo. Configuralas desde /config.html (admin).');
    try { await db.pool.end(); } catch (_) {}
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    try { await db.pool.end(); } catch (_) {}
    process.exit(1);
  }
}

run();
