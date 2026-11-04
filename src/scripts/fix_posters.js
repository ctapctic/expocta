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

async function fixPosters() {
  let conn;
  try {
    conn = await pool.getConnection();
    console.log('Conectado a MariaDB');
    
    // Verificar estado actual
    const before = await conn.query('SELECT codigo_stand, pdf_poster_url FROM proyectos');
    console.log('Antes:', before);
    
    // Actualizar a NULL
    await conn.query("UPDATE proyectos SET pdf_poster_url = NULL WHERE pdf_poster_url LIKE '/uploads/poster-%'");
    
    // Verificar resultado
    const after = await conn.query('SELECT codigo_stand, pdf_poster_url FROM proyectos');
    console.log('Después:', after);
    
    console.log('✅ PDFs de posters eliminados de la BD');
  } catch (err) {
    console.error('❌ Error:', err.message);
  } finally {
    if (conn) conn.release();
    await pool.end();
  }
}

fixPosters();