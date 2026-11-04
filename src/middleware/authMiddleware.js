const db = require('../config/db');

/**
 * Middleware para restringir la creación y modificación de proyectos, charlas, ofertas y empresas
 * únicamente a usuarios con rol 'admin' o 'docente'.
 */
async function requireAdminOrDocente(req, res, next) {
  try {
    // Obtener usuario_id desde headers, query o body
    const usuario_id = req.headers['x-usuario-id'] || req.body.usuario_id || req.query.usuario_id;

    if (!usuario_id) {
      return res.status(401).json({
        success: false,
        message: 'Autenticación requerida. Proporciona tu ID de usuario en el encabezado x-usuario-id.'
      });
    }

    const users = await db.query('SELECT id, nombre, rol, estado FROM usuarios WHERE id = ?', [usuario_id]);

    if (!users || users.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Usuario no autenticado o no encontrado.'
      });
    }

    const user = users[0];

    if (user.estado !== 'habilitado') {
      return res.status(403).json({
        success: false,
        message: 'Tu cuenta no está habilitada. Contactá al administrador general.'
      });
    }

    if (user.rol !== 'admin' && user.rol !== 'docente') {
      return res.status(403).json({
        success: false,
        message: `Acceso Denegado. Tu rol de '${user.rol}' no tiene permisos para realizar esta acción de gestión.`
      });
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Middleware que permite acceso ÚNICAMENTE a usuarios con rol 'admin'.
 * Usado para rutas de configuración institucional del evento.
 */
async function requireAdmin(req, res, next) {
  try {
    const usuario_id = req.headers['x-usuario-id'] || req.body.usuario_id || req.query.usuario_id;

    if (!usuario_id) {
      return res.status(401).json({
        success: false,
        message: 'Autenticación requerida. Proporciona tu ID de usuario en el encabezado x-usuario-id.'
      });
    }

    const users = await db.query('SELECT id, nombre, rol, estado FROM usuarios WHERE id = ?', [usuario_id]);

    if (!users || users.length === 0) {
      return res.status(401).json({ success: false, message: 'Usuario no encontrado.' });
    }

    if (users[0].estado !== 'habilitado') {
      return res.status(403).json({
        success: false,
        message: 'Tu cuenta no está habilitada. Contactá al administrador general.'
      });
    }

    if (users[0].rol !== 'admin') {
      return res.status(403).json({
        success: false,
        message: `Acceso Denegado. Solo los administradores pueden modificar la configuración del evento.`
      });
    }

    req.user = users[0];
    next();
  } catch (err) {
    next(err);
  }
}

module.exports = {
  requireAdminOrDocente,
  requireAdmin
};
