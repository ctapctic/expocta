/**
 * Asigna fotos a proyectos por emparejamiento automático.
 *
 * Lee los archivos de una carpeta, los empareja con proyectos por coincidencia
 * parcial (subcadena + palabras) y, si hay coincidencia única, genera el nombre
 * único (como hace multer), inserta en `archivos` (respaldo en BD) y actualiza
 * `proyectos.imagen_url`.
 *
 * Uso: node src/scripts/asignar_fotos_proyectos.js "C:/ruta/a/la/carpeta"
 */
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const db = require('../config/db');
const archivosService = require('../services/archivosService');

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

function norm(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]/g, '');
}

function levenshtein(a, b) {
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
    }
    prev = cur;
  }
  return prev[b.length];
}

function generarNombre(originalname) {
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
  const ext = path.extname(originalname).toLowerCase();
  const safeBaseName = path.basename(originalname, ext).replace(/[^a-zA-Z0-9]/g, '_').substring(0, 30);
  return `${safeBaseName}-${uniqueSuffix}${ext}`;
}

function palabras(s) {
  return String(s).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').split(/[^a-z0-9]+/).filter(Boolean);
}

function puntuar(archivoNorm, archivoPalabras, proyecto) {
  const tituloNorm = norm(proyecto.titulo);
  const tituloPalabras = palabras(proyecto.titulo);
  let score = 0;

  // Subcadena fuerte
  if (archivoNorm.length >= 4 && tituloNorm.includes(archivoNorm)) score += 100;
  if (tituloNorm.length >= 4 && archivoNorm.includes(tituloNorm)) score += 50;

  // Palabras compartidas
  for (const w of archivoPalabras) {
    if (w.length >= 3 && tituloPalabras.includes(w)) score += 10;
  }

  // Levenshtein sobre el nombre completo (penaliza)
  score -= levenshtein(archivoNorm, tituloNorm.substring(0, Math.max(archivoNorm.length + 5, 20)));

  return score;
}

(async () => {
  const carpeta = process.argv[2];
  if (!carpeta) {
    console.error('Uso: node src/scripts/asignar_fotos_proyectos.js "C:/ruta/a/la/carpeta"');
    process.exit(1);
  }

  let c;
  try {
    c = await db.pool.getConnection();
    const proy = await db.query('SELECT id, codigo_stand, titulo, imagen_url FROM proyectos ORDER BY codigo_stand');

    const archivos = fs.readdirSync(carpeta).filter((f) => {
      try { return fs.statSync(path.join(carpeta, f)).isFile(); } catch (_) { return false; }
    });

    console.log(`\nEncontrados ${archivos.length} archivos en ${carpeta}\n`);

    const resultados = { asignados: [], sinCoincidencia: [], ambiguos: [] };

    for (const archivo of archivos) {
      const ruta = path.join(carpeta, archivo);
      const ext = path.extname(archivo).toLowerCase();
      if (!MIME_POR_EXTENSION[ext]) {
        console.log(`⏭️  ${archivo} — extensión no soportada, se salta.`);
        continue;
      }

      const archivoNorm = norm(path.basename(archivo, ext));
      const archivoPalabras = palabras(path.basename(archivo, ext));

      // Calcular puntuación para cada proyecto
      const candidatos = proy.map((p) => ({ proyecto: p, score: puntuar(archivoNorm, archivoPalabras, p) }));
      candidatos.sort((a, b) => b.score - a.score);

      const mejor = candidatos[0];
      const segundo = candidatos[1];

      // Si el mejor score es muy bajo o hay empate, es ambiguo
      if (mejor.score <= 0 || (segundo && mejor.score - segundo.score < 5)) {
        resultados.ambiguos.push({ archivo, mejor, segundo });
        console.log(`⚠️  ${archivo.padEnd(35)} -> AMBIGUO (mejor: ${mejor.proyecto.codigo_stand}, score=${mejor.score})`);
        continue;
      }

      const p = mejor.proyecto;
      const nombreUnico = generarNombre(archivo);
      const buffer = fs.readFileSync(ruta);
      const mime = mimeDe(archivo);

      // 1) Respaldar en BD
      await db.query(
        `INSERT INTO archivos (nombre, mime, tamano, datos)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE mime = VALUES(mime), tamano = VALUES(tamano), datos = VALUES(datos)`,
        [nombreUnico, mime, buffer.length, buffer]
      );

      // 2) Actualizar proyecto
      await db.query('UPDATE proyectos SET imagen_url = ? WHERE id = ?', [`/uploads/${nombreUnico}`, p.id]);

      resultados.asignados.push({ archivo, proyecto: p, nombreUnico });
      console.log(`✅ ${archivo.padEnd(35)} -> ${p.codigo_stand.padEnd(12)} ${p.titulo.split('\u2014')[0].trim()} (score=${mejor.score})`);
    }

    console.log('\n=== RESUMEN ===');
    console.log(`Asignados: ${resultados.asignados.length}`);
    console.log(`Ambiguos (no asignados): ${resultados.ambiguos.length}`);
    if (resultados.ambiguos.length > 0) {
      console.log('\nAmbiguos:');
      resultados.ambiguos.forEach((a) => {
        console.log(`  ${a.archivo} -> mejor candidato: ${a.mejor.proyecto.codigo_stand} (${a.mejor.proyecto.titulo.split('\u2014')[0].trim()}) score=${a.mejor.score}`);
      });
    }

    const total = await db.query('SELECT COUNT(*) AS n FROM archivos');
    console.log(`\nTotal archivos en tabla: ${total[0].n}`);
    console.log('Migración completada.');
    try { await db.pool.end(); } catch (_) {}
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    try { await db.pool.end(); } catch (_) {}
    process.exit(1);
  }
})();
