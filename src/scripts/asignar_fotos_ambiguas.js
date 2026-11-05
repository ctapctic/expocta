/**
 * Asigna las 6 fotos ambiguas que el emparejamiento automático no pudo resolver.
 * Mapeo explícito confirmado por el usuario.
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

const MIME_POR_EXTENSION = {
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.pdf': 'application/pdf'
};

function mimeDe(nombre) {
  return MIME_POR_EXTENSION[path.extname(nombre).toLowerCase()] || 'application/octet-stream';
}

function generarNombre(originalname) {
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
  const ext = path.extname(originalname).toLowerCase();
  const safeBaseName = path.basename(originalname, ext).replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
  return `${safeBaseName}-${uniqueSuffix}${ext}`;
}

// Mapeo explícito: archivo -> código de stand
const MAPEO = [
  { archivo: 'bibliomart.jpeg', stand: 'STAND - 20' },
  { archivo: 'cgcpc.jpeg', stand: 'STAND - 12' },
  { archivo: 'cofee house.jpeg', stand: 'STAND - 30' },
  { archivo: 'cyberseguridad.jpeg', stand: 'STAND - 32' },
  { archivo: 'gymmanayer-ia.jpeg', stand: 'STAND - 19' },
  { archivo: 'sigsec.jpeg', stand: 'STAND - 11' }
];

(async () => {
  const carpeta = 'C:/Users/Usuario/Downloads/fotos_proyectos';
  try {
    for (const { archivo, stand } of MAPEO) {
      const ruta = path.join(carpeta, archivo);
      if (!fs.existsSync(ruta)) {
        console.log(`⏭️  ${archivo} — no existe, se salta.`);
        continue;
      }

      const buffer = fs.readFileSync(ruta);
      const mime = mimeDe(archivo);
      const nombreUnico = generarNombre(archivo);

      // 1) Respaldar en BD
      await db.query(
        `INSERT INTO archivos (nombre, mime, tamano, datos)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE mime = VALUES(mime), tamano = VALUES(tamano), datos = VALUES(datos)`,
        [nombreUnico, mime, buffer.length, buffer]
      );

      // 2) Actualizar proyecto
      const res = await db.query('UPDATE proyectos SET imagen_url = ? WHERE codigo_stand = ?', [`/uploads/${nombreUnico}`, stand]);
      console.log(`✅ ${archivo.padEnd(25)} -> ${stand} (filas actualizadas: ${res.affectedRows})`);
    }

    const total = await db.query('SELECT COUNT(*) AS n FROM archivos');
    console.log(`\nTotal archivos en tabla: ${total[0].n}`);
    console.log('Completado.');
    try { await db.pool.end(); } catch (_) {}
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    try { await db.pool.end(); } catch (_) {}
    process.exit(1);
  }
})();
