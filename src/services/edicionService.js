/**
 * EXPOTECNIA EFTP - EDICIÓN ACTIVA DEL EVENTO
 *
 * Permite diferenciar ediciones: los listados públicos (proyectos, charlas,
 * empresas, ofertas, leaderboard) se filtran por la edición activa.
 * El historial se conserva en la base de datos.
 */
const db = require('../config/db');

const CACHE_MS = 15000;
let cache = { at: 0, valor: null };

async function cargar(force = false) {
  const ahora = Date.now();
  if (!force && cache.valor && ahora - cache.at < CACHE_MS) {
    return cache.valor;
  }

  // Prioridad: edicion_actual, luego anio_evento, luego '2026'
  const rows = await db.query(
    "SELECT clave, valor FROM configuracion_evento WHERE clave IN ('edicion_actual', 'anio_evento')"
  );
  const mapa = {};
  for (const r of rows) mapa[r.clave] = (r.valor || '').trim();

  const valor = mapa.edicion_actual || mapa.anio_evento || '2026';
  cache = { at: ahora, valor };
  return valor;
}

function invalidarCache() {
  cache = { at: 0, valor: null };
}

async function setEdicionActiva(valor) {
  const v = String(valor || '').trim();
  if (!v) return;
  await db.query(
    "INSERT INTO configuracion_evento (clave, valor, descripcion) VALUES ('edicion_actual', ?, 'Edicion activa del evento') ON DUPLICATE KEY UPDATE valor = VALUES(valor)",
    [v]
  );
  invalidarCache();
}

module.exports = { cargar, invalidarCache, setEdicionActiva };
