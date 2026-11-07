/**
 * Script de inicialización de la tabla configuracion_evento
 * Ejecutar una sola vez: node src/scripts/init_config.js
 */
const db = require('../config/db');

const SQL_CREATE = `
  CREATE TABLE IF NOT EXISTS configuracion_evento (
    clave            VARCHAR(80)  NOT NULL PRIMARY KEY,
    valor            TEXT         NULL,
    descripcion      VARCHAR(255) NULL,
    actualizado_en   DATETIME     DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
`;

const DEFAULTS = [
  ['institucion_organizadora', 'Instituto de Educación Superior N° 1',  'Nombre de la institución organizadora del evento'],
  ['institucion_padre',        'Dirección General de EFTP',              'Organismo superior / Ministerio de referencia'],
  ['sede',                     'Sede Central – Auditorio Principal',     'Nombre y ubicación de la sede del evento'],
  ['nombre_evento',            'Expotecnia EFTP 2026',                   'Nombre completo del evento'],
  ['anio_evento',              '2026',                                   'Año de edición del evento'],
  ['logo_ministerio_url',      '',                                       'URL del logo del ministerio (subida o externa)'],
  ['logo_institucion_url',     '',                                       'URL del logo de la institución organizadora'],
  ['color_primario',           '#38bdf8',                               'Color primario del branding del evento (hex)'],
  ['mensaje_bienvenida',       'Bienvenidos a la Expotecnia EFTP',      'Mensaje de bienvenida en pantallas públicas'],
  ['registro_inicio',          '',                                       'Inicio de la ventana de registro (ISO 8601 UTC, vacío = sin límite)'],
  ['registro_fin',             '',                                       'Fin de la ventana de registro (ISO 8601 UTC, vacío = sin límite)'],
  ['votacion_inicio',          '',                                       'Inicio de la ventana de votación (ISO 8601 UTC, vacío = sin límite)'],
  ['votacion_fin',             '',                                       'Fin de la ventana de votación (ISO 8601 UTC, vacío = sin límite)']
];

async function run() {
  try {
    await db.query(SQL_CREATE);
    console.log('✅ Tabla configuracion_evento creada (o ya existía).');

    for (const [clave, valor, descripcion] of DEFAULTS) {
      await db.query(
        'INSERT IGNORE INTO configuracion_evento (clave, valor, descripcion) VALUES (?, ?, ?)',
        [clave, valor, descripcion]
      );
    }

    console.log('✅ Valores por defecto insertados (INSERT IGNORE, no sobreescribe existentes).');
    console.log('🎉 Listo. Puedes editar la configuración desde /config.html (admin).');
    try { await db.pool.end(); } catch (_) {}
    process.exit(0);
  } catch (err) {
    console.error('❌ Error:', err.message);
    try { await db.pool.end(); } catch (_) {}
    process.exit(1);
  }
}

run();
