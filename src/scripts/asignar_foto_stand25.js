require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../config/db');

const carpeta = 'C:/Users/Usuario/Downloads/fotos_proyectos';
const archivo = 'Sitio web de presentación de productos y simulación de pedidos de comida rápida.jpeg';
const stand = 'STAND - 25';

(async () => {
  try {
    const ruta = path.join(carpeta, archivo);
    const buffer = fs.readFileSync(ruta);
    const ext = path.extname(archivo).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'application/octet-stream';
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const safeBaseName = path.basename(archivo, ext).replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
    const nombreUnico = `${safeBaseName}-${uniqueSuffix}${ext}`;

    await db.query(
      `INSERT INTO archivos (nombre, mime, tamano, datos) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE mime = VALUES(mime), tamano = VALUES(tamano), datos = VALUES(datos)`,
      [nombreUnico, mime, buffer.length, buffer]
    );

    const res = await db.query('UPDATE proyectos SET imagen_url = ? WHERE codigo_stand = ?', [`/uploads/${nombreUnico}`, stand]);
    console.log(`✅ ${archivo} -> ${stand} (filas actualizadas: ${res.affectedRows})`);
    console.log(`   nombre guardado: ${nombreUnico}`);

    const total = await db.query('SELECT COUNT(*) AS n FROM archivos');
    console.log(`Total archivos en tabla: ${total[0].n}`);
    try { await db.pool.end(); } catch (_) {}
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    try { await db.pool.end(); } catch (_) {}
    process.exit(1);
  }
})();
