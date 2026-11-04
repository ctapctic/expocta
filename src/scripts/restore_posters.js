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

async function restorePosters() {
  let conn;
  try {
    conn = await pool.getConnection();
    console.log('Conectado a MariaDB');
    
    await conn.query("UPDATE proyectos SET pdf_poster_url = '/uploads/poster-iot.pdf' WHERE codigo_stand = 'STAND-101'");
    await conn.query("UPDATE proyectos SET pdf_poster_url = '/uploads/poster-robot.pdf' WHERE codigo_stand = 'STAND-102'");
    await conn.query("UPDATE proyectos SET pdf_poster_url = '/uploads/poster-pwa.pdf' WHERE codigo_stand = 'STAND-103'");
    
    const result = await conn.query('SELECT codigo_stand, pdf_poster_url FROM proyectos');
    console.log('Restaurado:', result);
    
    console.log('✅ Referencias de posters restauradas en la BD');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    if (conn) conn.release();
    await pool.end();
  }
}

restorePosters();