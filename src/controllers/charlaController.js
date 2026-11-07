const db = require('../config/db');
const edicionService = require('../services/edicionService');

/**
 * Normaliza el valor de un input datetime-local ("YYYY-MM-DDTHH:MM")
 * al formato DATETIME de MariaDB ("YYYY-MM-DD HH:MM:SS"), sin conversión de zona.
 */
function normalizarHorario(valor) {
  if (!valor) return valor;
  const s = String(valor).trim().replace('T', ' ').replace('Z', '');
  return s.length === 16 ? `${s}:00` : s.slice(0, 19);
}

/**
 * Obtener listado de charlas y conferencias técnicas
 */
exports.getAllCharlas = async (req, res, next) => {
  try {
    const edicionActiva = await edicionService.cargar();
    const rawRows = await db.query(`
      SELECT 
        c.*,
        DATE_FORMAT(c.horario, '%Y-%m-%d %H:%i:%s') AS horario_str,
        COALESCE(AVG((v.nota_contenido + v.nota_expositor) / 2.0), 0) AS promedio_valoracion,
        COUNT(v.id) AS total_valoraciones
      FROM charlas c
      LEFT JOIN valoraciones_charlas v ON c.id = v.charla_id
      WHERE c.edicion = ?
      GROUP BY c.id
      ORDER BY c.horario ASC
    `, [edicionActiva]);

    const charlas = rawRows.map(row => ({
      ...row,
      id: Number(row.id),
      promedio_valoracion: Number(parseFloat(row.promedio_valoracion || 0).toFixed(1)),
      total_valoraciones: Number(row.total_valoraciones || 0)
    }));

    res.json({
      success: true,
      total: charlas.length,
      charlas
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Obtener una charla por ID o Código de Charla
 */
exports.getCharlaByIdOrCode = async (req, res, next) => {
  try {
    const { identifier } = req.params;
    const edicionActiva = await edicionService.cargar();

    const rows = await db.query(`
      SELECT 
        c.*,
        DATE_FORMAT(c.horario, '%Y-%m-%d %H:%i:%s') AS horario_str,
        COALESCE(AVG((v.nota_contenido + v.nota_expositor) / 2.0), 0) AS promedio_valoracion,
        COALESCE(AVG(v.nota_contenido), 0) AS avg_contenido,
        COALESCE(AVG(v.nota_expositor), 0) AS avg_expositor,
        COUNT(v.id) AS total_valoraciones
      FROM charlas c
      LEFT JOIN valoraciones_charlas v ON c.id = v.charla_id
      WHERE (c.id = ? OR c.codigo_charla = ?) AND c.edicion = ?
      GROUP BY c.id
    `, [identifier, identifier, edicionActiva]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Charla o conferencia no encontrada.' });
    }

    const c = rows[0];

    // Obtener comentarios de asistentes
    const comentarios = await db.query(`
      SELECT 
        v.comentario, v.nota_contenido, v.nota_expositor, v.creado_en,
        u.nombre AS usuario_nombre, u.rol AS usuario_rol
      FROM valoraciones_charlas v
      JOIN usuarios u ON v.usuario_id = u.id
      WHERE v.charla_id = ? AND v.comentario IS NOT NULL AND v.comentario != ''
      ORDER BY v.creado_en DESC
    `, [c.id]);

    res.json({
      success: true,
      charla: {
        ...c,
        id: Number(c.id),
        promedio_valoracion: Number(parseFloat(c.promedio_valoracion || 0).toFixed(1)),
        avg_contenido: Number(parseFloat(c.avg_contenido || 0).toFixed(1)),
        avg_expositor: Number(parseFloat(c.avg_expositor || 0).toFixed(1)),
        total_valoraciones: Number(c.total_valoraciones || 0),
        comentarios: comentarios.map(item => ({
          ...item,
          nota_contenido: Number(item.nota_contenido),
          nota_expositor: Number(item.nota_expositor)
        }))
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Actualizar una charla por ID. Si no se sube nuevo PDF, se conserva el actual.
 */
exports.updateCharla = async (req, res, next) => {
  try {
    const { id } = req.params;

    const rows = await db.query('SELECT * FROM charlas WHERE id = ?', [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Charla no encontrada.' });
    }
    const actual = rows[0];

    const {
      codigo_charla,
      titulo,
      eje_tematico,
      expositor,
      biografia_expositor,
      horario,
      ubicacion
    } = req.body;

    if (!codigo_charla || !titulo || !expositor || !horario || !ubicacion) {
      return res.status(400).json({
        success: false,
        message: 'Campos requeridos faltantes: codigo_charla, titulo, expositor, horario, ubicacion.'
      });
    }

    const diapositivas_pdf_url = req.files?.diapositivas_pdf?.[0]
      ? `/uploads/${req.files.diapositivas_pdf[0].filename}`
      : actual.diapositivas_pdf_url;

    const foto_expositor_url = req.files?.foto_expositor?.[0]
      ? `/uploads/${req.files.foto_expositor[0].filename}`
      : actual.foto_expositor_url;

    await db.query(`
      UPDATE charlas SET
        codigo_charla = ?, titulo = ?, eje_tematico = ?, expositor = ?,
        biografia_expositor = ?, foto_expositor_url = ?, horario = ?, ubicacion = ?, diapositivas_pdf_url = ?
      WHERE id = ?
    `, [
      codigo_charla.toUpperCase().trim(),
      titulo.trim(),
      eje_tematico ? eje_tematico.trim() : 'General',
      expositor.trim(),
      biografia_expositor ? biografia_expositor.trim() : '',
      foto_expositor_url,
      normalizarHorario(horario),
      ubicacion.trim(),
      diapositivas_pdf_url,
      id
    ]);

    res.json({ success: true, message: 'Charla actualizada correctamente.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'El código de charla ya existe en otra charla.' });
    }
    next(err);
  }
};

/**
 * Eliminar una charla por ID (las valoraciones asociadas se borran por cascade)
 */
exports.deleteCharla = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM charlas WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Charla no encontrada.' });
    }

    res.json({ success: true, message: 'Charla eliminada exitosamente.' });
  } catch (err) {
    next(err);
  }
};

/**
 * Crear nueva charla o taller técnico
 */
exports.createCharla = async (req, res, next) => {
  try {
    const {
      codigo_charla,
      titulo,
      eje_tematico,
      expositor,
      biografia_expositor,
      horario,
      ubicacion
    } = req.body;

    if (!codigo_charla || !titulo || !expositor || !horario || !ubicacion) {
      return res.status(400).json({
        success: false,
        message: 'Campos requeridos faltantes: codigo_charla, titulo, expositor, horario, ubicacion.'
      });
    }

    let diapositivas_pdf_url = null;
    if (req.files?.diapositivas_pdf?.[0]) {
      diapositivas_pdf_url = `/uploads/${req.files.diapositivas_pdf[0].filename}`;
    }

    let foto_expositor_url = '';
    if (req.files?.foto_expositor?.[0]) {
      foto_expositor_url = `/uploads/${req.files.foto_expositor[0].filename}`;
    }

    const edicionActiva = await edicionService.cargar();
    const result = await db.query(`
      INSERT INTO charlas
      (codigo_charla, titulo, eje_tematico, expositor, biografia_expositor, foto_expositor_url, horario, ubicacion, diapositivas_pdf_url, edicion)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      codigo_charla.toUpperCase().trim(),
      titulo.trim(),
      eje_tematico ? eje_tematico.trim() : 'General',
      expositor.trim(),
      biografia_expositor ? biografia_expositor.trim() : '',
      foto_expositor_url,
      normalizarHorario(horario),
      ubicacion.trim(),
      diapositivas_pdf_url,
      edicionActiva
    ]);

    res.status(201).json({
      success: true,
      message: 'Charla o taller agendado correctamente',
      charla_id: Number(result.insertId)
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'El código de charla ya existe.' });
    }
    next(err);
  }
};
