const db = require('../config/db');

/**
 * Valida y normaliza el link externo de información de una oferta.
 * Devuelve { ok, value } o { ok: false, message }.
 */
function parseLinkInformacion(value) {
  if (value === undefined || value === null) return { ok: true, value: null };
  const texto = String(value).trim();
  if (!texto) return { ok: true, value: null };
  try {
    const url = new URL(texto);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { ok: false, message: 'El link de información debe comenzar con http:// o https://.' };
    }
    return { ok: true, value: texto };
  } catch (err) {
    return { ok: false, message: 'El link de información no es una URL válida.' };
  }
}

/**
 * Retorna las carreras y cursos del Centro con datos descriptivos y URLs multimedia
 */
exports.obtenerOfertas = async (req, res, next) => {
  try {
    const rawRows = await db.query(`
      SELECT 
        o.*,
        COUNT(p.id) AS total_prospectos
      FROM oferta_formativa o
      LEFT JOIN prospectos_eftp p ON o.id = p.oferta_id
      GROUP BY o.id
      ORDER BY o.nombre_carrera ASC
    `);

    const ofertas = rawRows.map(row => ({
      ...row,
      id: Number(row.id),
      duracion_horas: Number(row.duracion_horas),
      total_prospectos: Number(row.total_prospectos || 0)
    }));

    res.json({
      success: true,
      total: ofertas.length,
      ofertas
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Alias de compatibilidad para getAllOfertas
 */
exports.getAllOfertas = exports.obtenerOfertas;


/**
 * Inserta en prospectos_eftp la solicitud de información de un asistente
 */
exports.registrarProspecto = async (req, res, next) => {
  try {
    const { usuario_id, oferta_id, telefono, comentario } = req.body;

    if (!usuario_id || !oferta_id || !telefono) {
      return res.status(400).json({
        success: false,
        message: 'Campos requeridos faltantes: usuario_id, oferta_id, teléfono.'
      });
    }

    const result = await db.query(`
      INSERT INTO prospectos_eftp (usuario_id, oferta_id, telefono, comentario)
      VALUES (?, ?, ?, ?)
    `, [
      parseInt(usuario_id, 10),
      parseInt(oferta_id, 10),
      telefono.trim(),
      comentario ? comentario.trim() : null
    ]);

    res.status(201).json({
      success: true,
      message: '¡Gracias por tu interés! Tu solicitud de información ha sido registrada exitosamente.',
      prospecto_id: Number(result.insertId)
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: 'Ya has registrado tu solicitud de información para esta carrera anteriormente.'
      });
    }
    next(err);
  }
};

/**
 * Obtener una Oferta por ID o Código
 */
exports.getOfertaByIdOrCode = async (req, res, next) => {
  try {
    const { identifier } = req.params;
    const rows = await db.query(`
      SELECT o.* FROM oferta_formativa o
      WHERE o.id = ? OR o.codigo_oferta = ?
    `, [identifier, identifier]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Oferta formativa no encontrada.' });
    }

    const o = rows[0];
    res.json({
      success: true,
      oferta: {
        ...o,
        id: Number(o.id),
        duracion_horas: Number(o.duracion_horas)
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Actualizar una oferta formativa por ID. Si no se sube nuevo PDF, se conserva el actual.
 */
exports.updateOferta = async (req, res, next) => {
  try {
    const { id } = req.params;

    const rows = await db.query('SELECT * FROM oferta_formativa WHERE id = ?', [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Oferta formativa no encontrada.' });
    }
    const actual = rows[0];

    const {
      codigo_oferta,
      nombre_carrera,
      duracion_horas,
      modalidad,
      perfil_egreso,
      requisitos_admision,
      video_lab_url,
      link_informacion_url
    } = req.body;

    if (!codigo_oferta || !nombre_carrera || !duracion_horas || !perfil_egreso) {
      return res.status(400).json({
        success: false,
        message: 'Campos requeridos faltantes: codigo_oferta, nombre_carrera, duracion_horas, perfil_egreso.'
      });
    }

    const link = parseLinkInformacion(link_informacion_url);
    if (!link.ok) {
      return res.status(400).json({ success: false, message: link.message });
    }

    // Si el campo no se envía, se conserva el link actual; si llega vacío, se borra.
    const linkFinal = link_informacion_url === undefined ? actual.link_informacion_url : link.value;

    const brochure_pdf_url = req.file
      ? `/uploads/${req.file.filename}`
      : actual.brochure_pdf_url;

    await db.query(`
      UPDATE oferta_formativa SET
        codigo_oferta = ?, nombre_carrera = ?, duracion_horas = ?, modalidad = ?,
        perfil_egreso = ?, requisitos_admision = ?, brochure_pdf_url = ?, video_lab_url = ?,
        link_informacion_url = ?
      WHERE id = ?
    `, [
      codigo_oferta.toUpperCase().trim(),
      nombre_carrera.trim(),
      parseInt(duracion_horas, 10),
      modalidad || 'Presencial',
      perfil_egreso.trim(),
      requisitos_admision || '',
      brochure_pdf_url,
      video_lab_url || null,
      linkFinal,
      id
    ]);

    res.json({ success: true, message: 'Oferta formativa actualizada correctamente.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'El código de oferta ya existe en otra oferta.' });
    }
    next(err);
  }
};

/**
 * Eliminar una oferta formativa por ID.
 * Bloqueado si tiene prospectos registrados: son datos de contacto de interesados que no deben perderse.
 */
exports.deleteOferta = async (req, res, next) => {
  try {
    const { id } = req.params;

    const [oferta] = await db.query('SELECT id FROM oferta_formativa WHERE id = ?', [id]);
    if (!oferta) {
      return res.status(404).json({ success: false, message: 'Oferta formativa no encontrada.' });
    }

    const [{ total }] = await db.query(
      'SELECT COUNT(*) AS total FROM prospectos_eftp WHERE oferta_id = ?',
      [id]
    );

    if (Number(total) > 0) {
      return res.status(409).json({
        success: false,
        message: `No se puede eliminar: la oferta tiene ${Number(total)} prospecto(s) registrado(s). Contactá al administrador de la base si realmente debiera eliminarse.`
      });
    }

    await db.query('DELETE FROM oferta_formativa WHERE id = ?', [id]);
    res.json({ success: true, message: 'Oferta formativa eliminada exitosamente.' });
  } catch (err) {
    next(err);
  }
};

/**
 * Crear nueva oferta formativa
 */
exports.createOferta = async (req, res, next) => {
  try {
    const {
      codigo_oferta,
      nombre_carrera,
      duracion_horas,
      modalidad,
      perfil_egreso,
      requisitos_admision,
      video_lab_url,
      link_informacion_url
    } = req.body;

    const link = parseLinkInformacion(link_informacion_url);
    if (!link.ok) {
      return res.status(400).json({ success: false, message: link.message });
    }

    let brochure_pdf_url = null;
    if (req.file) {
      brochure_pdf_url = `/uploads/${req.file.filename}`;
    }

    const result = await db.query(`
      INSERT INTO oferta_formativa 
      (codigo_oferta, nombre_carrera, duracion_horas, modalidad, perfil_egreso, requisitos_admision, brochure_pdf_url, video_lab_url, link_informacion_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      codigo_oferta.toUpperCase().trim(),
      nombre_carrera.trim(),
      parseInt(duracion_horas, 10),
      modalidad || 'Presencial',
      perfil_egreso.trim(),
      requisitos_admision || '',
      brochure_pdf_url,
      video_lab_url || null,
      link.value
    ]);

    res.status(201).json({
      success: true,
      message: 'Oferta formativa creada exitosamente',
      oferta_id: Number(result.insertId)
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'El código de oferta ya existe.' });
    }
    next(err);
  }
};
