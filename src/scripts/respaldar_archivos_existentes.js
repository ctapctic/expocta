/**
 * Respalda en la tabla `archivos` todos los archivos que hoy viven en `public/uploads`.
 *
 * Es idempotente: si un archivo ya está en la base, lo reemplaza (ON DUPLICATE KEY UPDATE).
 * No modifica ninguna otra tabla.
 *
 * Uso: node src/scripts/respaldar_archivos_existentes.js
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

const uploadsDir = path.join(__dirname, '..', '..', 'public', 'uploads');

const MIME_POR_EXTENSION = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.pdf': 'application/pdf'
};

function mimeDe(nombre) {
  const ext = path.extname(nombre).toLowerCase();
  return MIME_POR_EXTENSION[ext] || 'application/octet-stream';
}

(async () => {
  try {
    const entradas = fs.readdirSync(uploadsDir, { withFileTypes: true });
    const archivos = entradas.filter((e) => e.isFile()).map((e) => e.name);

    console.log(`Encontrados ${archivos.length} archivos en ${uploadsDir}`);

    let ok = 0;
    let fallidos = 0;
    for (const nombre of archivos) {
      try {
        const ruta = path.join(uploadsDir, nombre);
        const buffer = fs.readFileSync(ruta);
        const mime = mimeDe(nombre);

        await db.query(
          `INSERT INTO archivos (nombre, mime, tamano, datos)
           VALUES (?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE mime = VALUES(mime), tamano = VALUES(tamano), datos = VALUES(datos)`,
          [nombre, mime, buffer.length, buffer]
        );

        ok++;
        console.log(`✅ ${nombre} (${buffer.length} bytes, ${mime})`);
      } catch (err) {
        fallidos++;
        console.error(`❌ ${nombre}: ${err.message}`);
      }
    }

    const total = await db.query('SELECT COUNT(*) AS n FROM archivos');
    console.log(`\nResumen: ${ok} respaldados, ${fallidos} fallidos. Total en tabla archivos: ${total[0].n}.`);
    try { await db.pool.end(); } catch (_) {}
    process.exit(fallidos > 0 ? 1 : 0);
  } catch (err) {
    console.error('❌ Error general:', err.message);
    try { await db.pool.end(); } catch (_) {}
    process.exit(1);
  }
})();
