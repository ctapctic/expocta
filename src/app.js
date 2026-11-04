const express = require('express');
const path = require('path');
const cors = require('cors');
require('dotenv').config();

const db = require('./config/db');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Rutas
const authRoutes = require('./routes/authRoutes');
const proyectoRoutes = require('./routes/proyectoRoutes');
const ofertaRoutes = require('./routes/ofertaRoutes');
const charlaRoutes = require('./routes/charlaRoutes');
const empresaRoutes = require('./routes/empresaRoutes');
const valoracionRoutes = require('./routes/valoracionRoutes');
const configRoutes = require('./routes/configRoutes');
const usuariosRoutes = require('./routes/usuariosRoutes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middlewares globales
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir archivos estáticos del Frontend y descargas/uploads
const { uploadsDir } = require('./config/uploads');
const archivosService = require('./services/archivosService');

// Primero los archivos subidos en runtime (disco persistente en Render).
// Si el archivo no está ahí, sigue el static de public/ (archivos versionados en git).
app.use('/uploads', express.static(uploadsDir));
app.use(express.static(path.join(__dirname, '../public')));

// Último recurso: archivos respaldados en MariaDB.
// Solo se consulta la base cuando el archivo no existe en disco, así que los
// archivos actuales se siguen sirviendo igual y sin consultas extra.
app.get('/uploads/:nombre', async (req, res, next) => {
  try {
    const nombre = path.basename(req.params.nombre);
    const archivo = await archivosService.obtenerArchivo(nombre);
    if (!archivo) return next();

    res.set({
      'Content-Type': archivo.mime || 'application/octet-stream',
      'Content-Length': String(archivo.tamano),
      'Cache-Control': 'public, max-age=31536000, immutable'
    });
    res.end(archivo.datos);
  } catch (err) {
    // Si la base no responde, no bloqueamos la app: el archivo simplemente no se encuentra.
    console.warn('⚠️ No se pudo leer el archivo desde MariaDB:', err.message);
    next();
  }
});

// Montar Endpoints de API REST
app.use('/api/auth', authRoutes);
app.use('/api/proyectos', proyectoRoutes);
app.use('/api/oferta', ofertaRoutes);
app.use('/api/charlas', charlaRoutes);
app.use('/api/empresas', empresaRoutes);
app.use('/api/valoraciones', valoracionRoutes);
app.use('/api/config', configRoutes);
app.use('/api/usuarios', usuariosRoutes);

// Endpoint de diagnóstico de salud del servidor
app.get('/api/health', async (req, res) => {
  const uploads = {
    modo: 'disco + MariaDB (escritura doble)',
    directorio: uploadsDir,
    persistente_en_disco: Boolean(process.env.UPLOADS_DIR) &&
      path.resolve(process.env.UPLOADS_DIR) !== path.join(__dirname, '..', 'public', 'uploads'),
    archivos_disco: archivosService.contarArchivosEnDisco(),
    archivos_db: null,
    bd_disponible: true
  };

  try {
    uploads.archivos_db = await archivosService.contarArchivos();
  } catch (err) {
    uploads.bd_disponible = false;
  }

  res.json({
    status: 'OK',
    app: 'Expotecnia EFTP Web Platform',
    timestamp: new Date().toISOString(),
    uploads
  });
});

// Manejo de errores
app.use(notFoundHandler);
app.use(errorHandler);

// Inicialización del Servidor y verificación de MariaDB
app.listen(PORT, async () => {
  console.log(`=======================================================`);
  console.log(`🚀 Servidor Expotecnia EFTP corriendo en http://localhost:${PORT}`);
  console.log(`📁 Archivos subidos: ${uploadsDir} (con respaldo en MariaDB)`);
  console.log(`=======================================================`);
  await db.testConnection();
});

module.exports = app;
