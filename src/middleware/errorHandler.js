/**
 * Middleware centralizado para el manejo de errores HTTP y de backend
 */
function errorHandler(err, req, res, next) {
  console.error('🔥 Central Error Handler:', err);

  const statusCode = err.statusCode || (res.statusCode !== 200 ? res.statusCode : 500);

  res.status(statusCode).json({
    success: false,
    message: err.message || 'Error interno del servidor en la plataforma Expotecnia EFTP',
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
}

/**
 * Middleware para rutas 404 No Encontrado
 */
function notFoundHandler(req, res, next) {
  res.status(404).json({
    success: false,
    message: `Ruta de API no encontrada: ${req.method} ${req.originalUrl}`
  });
}

module.exports = {
  errorHandler,
  notFoundHandler
};
