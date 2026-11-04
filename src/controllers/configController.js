const db = require('../config/db');

/**
 * GET /api/config
 * Retorna toda la configuración del evento como objeto clave-valor.
 * Público (necesario para que el leaderboard y otras páginas puedan leerlo).
 */
exports.getConfig = async (req, res, next) => {
  try {
    const rows = await db.query('SELECT clave, valor, descripcion FROM configuracion_evento ORDER BY clave ASC');
    const config = {};
    for (const row of rows) {
      config[row.clave] = { valor: row.valor, descripcion: row.descripcion };
    }
    res.json({ success: true, config });
  } catch (err) {
    next(err);
  }
};

/**
 * PUT /api/config
 * Actualiza uno o varios pares clave-valor.
 * Solo admin. Body esperado: { clave: valor, clave2: valor2, ... }
 */
exports.updateConfig = async (req, res, next) => {
  try {
    const updates = { ...req.body };

    // Logos subidos como archivos: la ruta /uploads del archivo reemplaza a la URL guardada
    if (req.files && req.files.logo_ministerio && req.files.logo_ministerio[0]) {
      updates.logo_ministerio_url = `/uploads/${req.files.logo_ministerio[0].filename}`;
    }
    if (req.files && req.files.logo_institucion && req.files.logo_institucion[0]) {
      updates.logo_institucion_url = `/uploads/${req.files.logo_institucion[0].filename}`;
    }

    if (!updates || typeof updates !== 'object' || Array.isArray(updates)) {
      return res.status(400).json({ success: false, message: 'Se esperaba un objeto { clave: valor }.' });
    }

    const entries = Object.entries(updates).filter(([k]) => k && typeof k === 'string');
    if (entries.length === 0) {
      return res.status(400).json({ success: false, message: 'No se proporcionaron valores a actualizar.' });
    }

    let updated = 0;
    for (const [clave, valor] of entries) {
      const result = await db.query(
        'UPDATE configuracion_evento SET valor = ? WHERE clave = ?',
        [valor === null ? null : String(valor), clave]
      );
      if (result.affectedRows > 0) updated++;
    }

    res.json({
      success: true,
      message: `Configuración actualizada: ${updated} de ${entries.length} claves guardadas.`,
      updated
    });
  } catch (err) {
    next(err);
  }
};
