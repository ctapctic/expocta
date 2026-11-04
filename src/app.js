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

// Primero los archivos subidos en runtime (disco persistente en Render).
// Si el archivo no está ahí, sigue el static de public/ (archivos versionados en git).
app.use('/uploads', express.static(uploadsDir));
app.use(express.static(path.join(__dirname, '../public')));

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
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    app: 'Expotecnia EFTP Web Platform',
    timestamp: new Date().toISOString()
  });
});

// Manejo de errores
app.use(notFoundHandler);
app.use(errorHandler);

// Inicialización del Servidor y verificación de MariaDB
app.listen(PORT, async () => {
  console.log(`=======================================================`);
  console.log(`🚀 Servidor Expotecnia EFTP corriendo en http://localhost:${PORT}`);
  console.log(`📁 Directorio de archivos estáticos: public/`);
  console.log(`=======================================================`);
  await db.testConnection();
});

module.exports = app;
