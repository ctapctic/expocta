const path = require('path');
const fs = require('fs');
const db = require('../config/db');
const { uploadsDir } = require('../config/uploads');

// Carpeta versionada en git con los archivos históricos del proyecto.
const publicUploadsDir = path.join(__dirname, '..', '..', 'public', 'uploads');

/**
 * Convierte una URL pública (`/uploads/foto.png?...`) al nombre del archivo.
 * @param {string} url
 * @returns {string|null}
 */
function nombreDesdeUrl(url) {
  if (!url) return null;
  const limpio = String(url).split('?')[0].split('#')[0];
  const nombre = path.basename(limpio);
  return nombre && nombre !== '.' && nombre !== '/' ? nombre : null;
}

/**
 * Indica si el archivo existe en alguno de los directorios de disco.
 * @param {string} nombre
 * @returns {boolean}
 */
function existeEnDisco(nombre) {
  if (!nombre) return false;
  const candidatos = new Set([
    path.join(uploadsDir, nombre),
    path.join(publicUploadsDir, nombre)
  ]);
  for (const ruta of candidatos) {
    try {
      if (fs.existsSync(ruta)) return true;
    } catch (_) {
      // Si el disco no responde, seguimos con el siguiente candidato.
    }
  }
  return false;
}

/**
 * Guarda (o reemplaza) un archivo en MariaDB.
 * @param {{ nombre: string, mimetype: string, buffer: Buffer }} archivo
 */
async function guardarArchivo({ nombre, mimetype, buffer }) {
  await db.query(
    `INSERT INTO archivos (nombre, mime, tamano, datos)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE mime = VALUES(mime), tamano = VALUES(tamano), datos = VALUES(datos)`,
    [nombre, mimetype, buffer.length, buffer]
  );
  return nombre;
}

/**
 * Recupera un archivo desde MariaDB.
 * @param {string} nombre
 * @returns {Promise<{nombre: string, mime: string, tamano: number, datos: Buffer}|null>}
 */
async function obtenerArchivo(nombre) {
  if (!nombre) return null;
  const rows = await db.query(
    'SELECT nombre, mime, tamano, datos FROM archivos WHERE nombre = ? LIMIT 1',
    [nombre]
  );
  return rows && rows[0] ? rows[0] : null;
}

/**
 * Consulta en un solo viaje cuáles de los nombres indicados están en MariaDB.
 * @param {string[]} nombres
 * @returns {Promise<Set<string>>}
 */
async function existenArchivos(nombres) {
  const lista = [...new Set((nombres || []).filter(Boolean))];
  if (lista.length === 0) return new Set();

  const placeholders = lista.map(() => '?').join(',');
  const rows = await db.query(
    `SELECT nombre FROM archivos WHERE nombre IN (${placeholders})`,
    lista
  );
  return new Set(rows.map((r) => r.nombre));
}

/**
 * Elimina un archivo de MariaDB (usado si el controller falla tras la subida).
 * @param {string} nombre
 */
async function eliminarArchivo(nombre) {
  if (!nombre) return;
  await db.query('DELETE FROM archivos WHERE nombre = ?', [nombre]);
}

/**
 * Cantidad de archivos respaldados en MariaDB.
 * @returns {Promise<number>}
 */
async function contarArchivos() {
  const rows = await db.query('SELECT COUNT(*) AS total FROM archivos');
  return Number(rows[0] ? rows[0].total : 0);
}

/**
 * Cantidad de archivos en el directorio de escritura (puede no existir).
 * @returns {number}
 */
function contarArchivosEnDisco() {
  try {
    return fs.readdirSync(uploadsDir).length;
  } catch (_) {
    return 0;
  }
}

/**
 * Indica si una URL de archivo tiene contenido disponible (disco o MariaDB).
 * @param {string} url
 * @param {Set<string>} enBaseDeDatos
 * @returns {boolean}
 */
function urlDisponible(url, enBaseDeDatos) {
  const nombre = nombreDesdeUrl(url);
  if (!nombre) return false;
  if (enBaseDeDatos && enBaseDeDatos.has(nombre)) return true;
  return existeEnDisco(nombre);
}

module.exports = {
  nombreDesdeUrl,
  existeEnDisco,
  guardarArchivo,
  obtenerArchivo,
  existenArchivos,
  eliminarArchivo,
  contarArchivos,
  contarArchivosEnDisco,
  urlDisponible
};
