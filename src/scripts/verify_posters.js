require('dotenv').config();
const mariadb = require('mariadb');

const pool = mariadb.createPool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT, 10) || 3306,
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || 'root',
  database: process.env.DB_NAME || 'expotecnia_eftp',
  connectionLimit: 5,
});

async function verify() {
  let conn;
  try {
    conn = await pool.getConnection();
    const result = await conn.query('SELECT codigo_stand, pdf_poster_url FROM proyectos');
    console.log('BD actualizada:');
    result.forEach(r => console.log(`  ${r.codigo_stand}: ${r.pdf_poster_url}`));
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    if (conn) conn.release();
    await pool.end();
  }
}

verify();