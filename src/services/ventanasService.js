/**
 * EXPOTECNIA EFTP - VENTANAS DE TIEMPO CONFIGURABLES
 *
 * Dos ventanas independientes guardadas en `configuracion_evento`:
 *   - registro: alta de visitantes/alumnos/empresas e interés en carreras.
 *   - votacion: proyectos, empresas y charlas.
 *
 * Reglas:
 *   - Valor vacío = sin límite (compatibilidad con instalaciones existentes).
 *   - Las fechas se guardan en ISO 8601 UTC (desde el panel admin).
 *   - La comparación SIEMPRE usa Date.now() del servidor (UTC correcto),
 *     nunca NOW() de la base (que puede estar desfasada).
 *   - Los gestores (admin/docente) pueden omitir la ventana de votación;
 *     el registro queda cerrado para todos.
 */
const db = require('../config/db');

const CLAVES = {
  registro: { inicio: 'registro_inicio', fin: 'registro_fin' },
  votacion: { inicio: 'votacion_inicio', fin: 'votacion_fin' }
};

const ETIQUETAS = {
  registro: 'El registro',
  votacion: 'La votación'
};

// Cache corto para no consultar la tabla en cada voto.
// Al guardar la configuración desde el admin se invalida explícitamente.
const CACHE_MS = 15000;
let cache = { at: 0, bounds: null };

function normalizar(valor) {
  const v = (valor == null ? '' : String(valor)).trim();
  return v || null;
}

function parseFechaMs(valor) {
  if (!valor) return null;
  const ms = Date.parse(valor);
  return Number.isFinite(ms) ? ms : null;
}

function formatearFecha(ms) {
  if (ms == null) return '';
  try {
    return new Intl.DateTimeFormat('es-PY', {
      dateStyle: 'short',
      timeStyle: 'short',
      timeZone: 'America/Asuncion'
    }).format(new Date(ms));
  } catch (_) {
    return new Date(ms).toISOString();
  }
}

/**
 * Lee (con cache) los límites absolutos de ambas ventanas.
 * Devuelve { registro: { inicio, fin, inicio_ms, fin_ms }, votacion: {...} }
 */
async function cargarBounds(force = false) {
  const ahora = Date.now();
  if (!force && cache.bounds && ahora - cache.at < CACHE_MS) {
    return cache.bounds;
  }

  const claves = Object.values(CLAVES).flatMap((c) => [c.inicio, c.fin]);
  const placeholders = claves.map(() => '?').join(', ');
  const rows = await db.query(
    `SELECT clave, valor FROM configuracion_evento WHERE clave IN (${placeholders})`,
    claves
  );

  const mapa = {};
  for (const row of rows) mapa[row.clave] = normalizar(row.valor);

  const bounds = {};
  for (const [tipo, clavesVentana] of Object.entries(CLAVES)) {
    bounds[tipo] = {
      inicio: mapa[clavesVentana.inicio] || null,
      fin: mapa[clavesVentana.fin] || null,
      inicio_ms: parseFechaMs(mapa[clavesVentana.inicio]),
      fin_ms: parseFechaMs(mapa[clavesVentana.fin])
    };
  }

  cache = { at: ahora, bounds };
  return bounds;
}

function evaluar(bound, ahoraMs) {
  if (!bound) return true;
  const okInicio = bound.inicio_ms == null || ahoraMs >= bound.inicio_ms;
  const okFin = bound.fin_ms == null || ahoraMs <= bound.fin_ms;
  return okInicio && okFin;
}

function serializar(bound, ahoraMs) {
  return {
    inicio: bound ? bound.inicio : null,
    fin: bound ? bound.fin : null,
    abierta: evaluar(bound, ahoraMs),
    ahora: new Date(ahoraMs).toISOString()
  };
}

/**
 * Estado público de ambas ventanas para el frontend.
 */
async function obtenerVentanas({ force = false, ahoraMs = Date.now() } = {}) {
  const bounds = await cargarBounds(force);
  const salida = {};
  for (const tipo of Object.keys(CLAVES)) {
    salida[tipo] = serializar(bounds[tipo], ahoraMs);
  }
  return salida;
}

async function estaAbierta(tipo, { force = false, ahoraMs = Date.now() } = {}) {
  const bounds = await cargarBounds(force);
  return evaluar(bounds[tipo], ahoraMs);
}

function mensajeCerrada(tipo, bound, ahoraMs = Date.now()) {
  const etiqueta = ETIQUETAS[tipo] || 'La acción';

  if (bound && bound.inicio_ms != null && ahoraMs < bound.inicio_ms) {
    return `${etiqueta} estará habilitada desde el ${formatearFecha(bound.inicio_ms)} (hora de Paraguay).`;
  }
  if (bound && bound.fin_ms != null && ahoraMs > bound.fin_ms) {
    return `${etiqueta} finalizó el ${formatearFecha(bound.fin_ms)} (hora de Paraguay).`;
  }
  return `${etiqueta} está cerrada en este momento.`;
}

/**
 * Indica si el usuario es admin/docente habilitado (puede omitir la ventana).
 */
async function esGestor(usuarioId) {
  const id = parseInt(usuarioId, 10);
  if (!Number.isInteger(id) || id <= 0) return false;
  try {
    const rows = await db.query('SELECT rol, estado FROM usuarios WHERE id = ?', [id]);
    if (!rows || rows.length === 0) return false;
    return rows[0].estado === 'habilitado' && (rows[0].rol === 'admin' || rows[0].rol === 'docente');
  } catch (_) {
    return false;
  }
}

/**
 * Verifica una acción contra su ventana.
 * Devuelve { permitido, abierta, bypass?, mensaje?, ventana }.
 */
async function verificarAccion(tipo, usuarioId, { ahoraMs = Date.now(), permitirGestor = true } = {}) {
  const bounds = await cargarBounds();
  const bound = bounds[tipo];
  const abierta = evaluar(bound, ahoraMs);
  const ventana = serializar(bound, ahoraMs);

  if (abierta) {
    return { permitido: true, abierta: true, ventana };
  }

  if (permitirGestor && (await esGestor(usuarioId))) {
    return { permitido: true, abierta: false, bypass: true, ventana };
  }

  return {
    permitido: false,
    abierta: false,
    mensaje: mensajeCerrada(tipo, bound, ahoraMs),
    ventana
  };
}

/** Invalida el cache (llamado al guardar la configuración desde el admin). */
function invalidarCache() {
  cache = { at: 0, bounds: null };
}

module.exports = {
  CLAVES,
  obtenerVentanas,
  estaAbierta,
  verificarAccion,
  mensajeCerrada,
  formatearFecha,
  esGestor,
  invalidarCache
};
