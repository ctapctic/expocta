const mariadb = require('mariadb');
require('dotenv').config();

// Pool de conexiones optimizado para MariaDB (Sin ORM)
const pool = mariadb.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'expotecnia_eftp',
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT, 10) || 10,
  allowPublicKeyRetrieval: true,
  acquireTimeout: 10000
});

/**
 * Función auxiliar para ejecutar consultas SQL con manejo automático de conexión
 * @param {string} sqlText - Consulta SQL parametrizada
 * @param {Array} params - Parámetros de la consulta
 * @returns {Promise<Array|Object>} Resultado de la consulta
 */
async function query(sqlText, params = []) {
  let conn;
  try {
    conn = await pool.getConnection();
    const rows = await conn.query(sqlText, params);
    return rows;
  } catch (err) {
    console.error('❌ Error ejecutando SQL Query en MariaDB:', err.message);
    throw err;
  } finally {
    if (conn) conn.release();
  }
}

/**
 * Prueba inicial de la conexión a MariaDB al levantar la app
 */
async function testConnection() {
  try {
    const conn = await pool.getConnection();
    console.log('✅ Conexión exitosa a MariaDB Pool en la base de datos:', process.env.DB_NAME);
    conn.release();
  } catch (err) {
    console.warn('⚠️ No se pudo conectar a MariaDB inmediatamente:', err.message);
    console.warn('💡 Asegúrate de tener MariaDB corriendo y haber ejecutado database.sql');
  }
}

module.exports = {
  pool,
  query,
  testConnection
};
