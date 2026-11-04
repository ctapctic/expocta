/**
 * Migración de seguridad: convierte los PINs almacenados en texto plano
 * a hashes bcrypt y amplía la columna para alojarlos (60 caracteres).
 *
 * Uso:  node src/scripts/hash_pins.js
 *
 * Es idempotente: solo toca filas cuyo valor aún no tiene prefijo bcrypt.
 */
const db = require('../config/db');
const bcrypt = require('bcryptjs');

const BCRYPT_ROUNDS = 10;

async function migrate() {
  await db.query('ALTER TABLE usuarios MODIFY codigo_pin VARCHAR(100) NULL');

  const pendientes = await db.query(`
    SELECT id FROM usuarios
    WHERE codigo_pin IS NOT NULL
      AND codigo_pin NOT LIKE '$2a$%'
      AND codigo_pin NOT LIKE '$2b$%'
  `);

  let actualizadas = 0;
  for (const fila of pendientes) {
    const [actual] = await db.query('SELECT codigo_pin FROM usuarios WHERE id = ?', [fila.id]);
    const hash = await bcrypt.hash(String(actual.codigo_pin), BCRYPT_ROUNDS);
    await db.query('UPDATE usuarios SET codigo_pin = ? WHERE id = ?', [hash, fila.id]);
    actualizadas++;
  }

  console.log(`Migración completada: ${actualizadas} PIN(s) convertidos a bcrypt.`);
  try { await db.pool.end(); } catch (_) {}
  process.exit(0);
}

migrate().catch(async (err) => {
  console.error('Error en la migración:', err.message);
  try { await db.pool.end(); } catch (_) {}
  process.exit(1);
});
