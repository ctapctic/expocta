const db = require('../config/db');

/**
 * Obtener listado de empresas participantes y sus ofertas de pasantía
 */
exports.getAllEmpresas = async (req, res, next) => {
  try {
    const rawRows = await db.query(`
      SELECT e.*,
        COALESCE(AVG((v.calidad_servicio + v.atencion + v.propuesta_valor + v.innovacion + v.impacto_social_economico) / 5.0), 0) AS promedio,
        COUNT(v.id) AS total_votos
      FROM empresas e
      LEFT JOIN valoraciones_empresas v ON e.id = v.empresa_id
      GROUP BY e.id
      ORDER BY nombre_corporativo ASC
    `);

    const empresas = rawRows.map(e => ({
      ...e,
      id: Number(e.id),
      promedio: Number(parseFloat(e.promedio || 0).toFixed(2)),
      total_votos: Number(e.total_votos || 0)
    }));

    res.json({
      success: true,
      total: empresas.length,
      empresas
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Obtener empresa por ID o Código
 */
exports.getEmpresaByIdOrCode = async (req, res, next) => {
  try {
    const { identifier } = req.params;
    const rows = await db.query(`
      SELECT e.*,
        COALESCE(AVG((v.calidad_servicio + v.atencion + v.propuesta_valor + v.innovacion + v.impacto_social_economico) / 5.0), 0) AS promedio,
        COALESCE(AVG(v.calidad_servicio), 0) AS promedio_calidad,
        COALESCE(AVG(v.atencion), 0) AS promedio_atencion,
        COALESCE(AVG(v.propuesta_valor), 0) AS promedio_propuesta,
        COALESCE(AVG(v.innovacion), 0) AS promedio_innovacion,
        COALESCE(AVG(v.impacto_social_economico), 0) AS promedio_impacto,
        COUNT(v.id) AS total_votos
      FROM empresas e
      LEFT JOIN valoraciones_empresas v ON e.id = v.empresa_id
      WHERE e.id = ? OR e.codigo_empresa = ?
      GROUP BY e.id
    `, [identifier, identifier]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Empresa no encontrada.' });
    }

    const e = rows[0];
    res.json({
      success: true,
      empresa: {
        ...e,
        id: Number(e.id),
        promedio: Number(parseFloat(e.promedio || 0).toFixed(2)),
        promedio_calidad: Number(parseFloat(e.promedio_calidad || 0).toFixed(1)),
        promedio_atencion: Number(parseFloat(e.promedio_atencion || 0).toFixed(1)),
        promedio_propuesta: Number(parseFloat(e.promedio_propuesta || 0).toFixed(1)),
        promedio_innovacion: Number(parseFloat(e.promedio_innovacion || 0).toFixed(1)),
        promedio_impacto: Number(parseFloat(e.promedio_impacto || 0).toFixed(1)),
        total_votos: Number(e.total_votos || 0)
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Actualizar una empresa por ID. Si no se suben nuevo logo/catálogo, se conservan los actuales.
 */
exports.updateEmpresa = async (req, res, next) => {
  try {
    const { id } = req.params;

    const rows = await db.query('SELECT * FROM empresas WHERE id = ?', [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Empresa no encontrada.' });
    }
    const actual = rows[0];

    const {
      codigo_empresa,
      nombre_corporativo,
      tipo,
      stand_numero,
      descripcion,
      ofertas_pasantia,
      requisitos_perfil
    } = req.body;

    if (!codigo_empresa || !nombre_corporativo || !descripcion) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos: codigo_empresa, nombre_corporativo, descripcion.'
      });
    }

    let logo_url = actual.logo_url;
    let catalogo_pdf_url = actual.catalogo_pdf_url;
    if (req.files) {
      if (req.files.logo && req.files.logo[0]) {
        logo_url = `/uploads/${req.files.logo[0].filename}`;
      }
      if (req.files.catalogo_pdf && req.files.catalogo_pdf[0]) {
        catalogo_pdf_url = `/uploads/${req.files.catalogo_pdf[0].filename}`;
      }
    }

    await db.query(`
      UPDATE empresas SET
        codigo_empresa = ?, nombre_corporativo = ?, tipo = ?, stand_numero = ?, descripcion = ?,
        ofertas_pasantia = ?, requisitos_perfil = ?, logo_url = ?, catalogo_pdf_url = ?
      WHERE id = ?
    `, [
      codigo_empresa.toUpperCase().trim(),
      nombre_corporativo.trim(),
      tipo || actual.tipo || 'servicios',
      stand_numero !== undefined ? (stand_numero ? stand_numero.trim() : null) : actual.stand_numero,
      descripcion.trim(),
      ofertas_pasantia ? ofertas_pasantia.trim() : '',
      requisitos_perfil ? requisitos_perfil.trim() : '',
      logo_url,
      catalogo_pdf_url,
      id
    ]);

    res.json({ success: true, message: 'Empresa actualizada correctamente.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'El código de empresa ya existe en otra empresa.' });
    }
    next(err);
  }
};

/**
 * Evaluar una empresa con la rúbrica de 5 ejes.
 * Solo se permite una evaluación por usuario y empresa.
 */
exports.evaluarEmpresa = async (req, res, next) => {
  try {
    const { usuario_id, empresa_id, calidad_servicio, atencion, propuesta_valor, innovacion, impacto_social_economico, comentario } = req.body;

    if (!usuario_id || !empresa_id || !calidad_servicio || !atencion || !propuesta_valor || !innovacion || !impacto_social_economico) {
      return res.status(400).json({
        success: false,
        message: 'Todos los criterios de evaluación (1 a 5) son obligatorios.'
      });
    }

    const scores = [calidad_servicio, atencion, propuesta_valor, innovacion, impacto_social_economico];
    if (scores.some(s => s < 1 || s > 5)) {
      return res.status(400).json({
        success: false,
        message: 'Los puntajes deben estar entre 1 y 5.'
      });
    }

    // Verificar que la empresa existe
    const emp = await db.query('SELECT id FROM empresas WHERE id = ?', [parseInt(empresa_id, 10)]);
    if (!emp || emp.length === 0) {
      return res.status(404).json({ success: false, message: 'Empresa no encontrada.' });
    }

    // Verificar si ya evaluó
    const existente = await db.query('SELECT id FROM valoraciones_empresas WHERE usuario_id = ? AND empresa_id = ?', [parseInt(usuario_id, 10), parseInt(empresa_id, 10)]);
    if (existente && existente.length > 0) {
      return res.status(400).json({ success: false, message: 'Ya has evaluado esta empresa.' });
    }

    await db.query(`
      INSERT INTO valoraciones_empresas
      (usuario_id, empresa_id, calidad_servicio, atencion, propuesta_valor, innovacion, impacto_social_economico, comentario)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      parseInt(usuario_id, 10),
      parseInt(empresa_id, 10),
      parseInt(calidad_servicio, 10),
      parseInt(atencion, 10),
      parseInt(propuesta_valor, 10),
      parseInt(innovacion, 10),
      parseInt(impacto_social_economico, 10),
      comentario ? comentario.trim() : null
    ]);

    res.status(201).json({
      success: true,
      message: '¡Evaluación registrada exitosamente!'
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({ success: false, message: 'Ya has evaluado esta empresa.' });
    }
    next(err);
  }
};

/**
 * Obtener estadísticas y ranking de empresas por valoración
 */
exports.getStatsAndRankingEmpresas = async (req, res, next) => {
  try {
    const topEmpresas = await db.query(`
      SELECT 
        e.id, e.codigo_empresa, e.nombre_corporativo, e.tipo, e.stand_numero, e.logo_url,
        COALESCE(AVG((v.calidad_servicio + v.atencion + v.propuesta_valor + v.innovacion + v.impacto_social_economico) / 5.0), 0) AS promedio,
        COUNT(v.id) AS total_votos
      FROM empresas e
      LEFT JOIN valoraciones_empresas v ON e.id = v.empresa_id
      GROUP BY e.id
      ORDER BY promedio DESC, total_votos DESC
      LIMIT 5
    `);

    const statsGenerales = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM empresas) AS total_empresas,
        (SELECT COUNT(*) FROM valoraciones_empresas) AS total_evaluaciones_empresas
    `);

    res.json({
      success: true,
      topEmpresas: topEmpresas.map(item => ({
        id: Number(item.id),
        codigo_empresa: item.codigo_empresa,
        nombre_corporativo: item.nombre_corporativo,
        tipo: item.tipo,
        stand_numero: item.stand_numero,
        logo_url: item.logo_url,
        promedio: Number(parseFloat(item.promedio || 0).toFixed(2)),
        total_votos: Number(item.total_votos || 0)
      })),
      stats: {
        total_empresas: Number(statsGenerales[0].total_empresas),
        total_evaluaciones_empresas: Number(statsGenerales[0].total_evaluaciones_empresas)
      }
    });
  } catch (err) {
    next(err);
  }
};
exports.deleteEmpresa = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM empresas WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Empresa no encontrada.' });
    }

    res.json({ success: true, message: 'Empresa eliminada exitosamente.' });
  } catch (err) {
    next(err);
  }
};

/**
 * Registrar nueva empresa con logo y catálogo PDF
 */
exports.createEmpresa = async (req, res, next) => {
  try {
    const {
      codigo_empresa,
      nombre_corporativo,
      tipo,
      stand_numero,
      descripcion,
      ofertas_pasantia,
      requisitos_perfil
    } = req.body;

    if (!codigo_empresa || !nombre_corporativo || !descripcion) {
      return res.status(400).json({
        success: false,
        message: 'Faltan campos requeridos: codigo_empresa, nombre_corporativo, descripcion.'
      });
    }

    let logo_url = null;
    let catalogo_pdf_url = null;

    if (req.files) {
      if (req.files.logo && req.files.logo[0]) {
        logo_url = `/uploads/${req.files.logo[0].filename}`;
      }
      if (req.files.catalogo_pdf && req.files.catalogo_pdf[0]) {
        catalogo_pdf_url = `/uploads/${req.files.catalogo_pdf[0].filename}`;
      }
    }

    const result = await db.query(`
      INSERT INTO empresas 
      (codigo_empresa, nombre_corporativo, tipo, stand_numero, descripcion, ofertas_pasantia, requisitos_perfil, logo_url, catalogo_pdf_url)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      codigo_empresa.toUpperCase().trim(),
      nombre_corporativo.trim(),
      tipo || 'servicios',
      stand_numero ? stand_numero.trim() : null,
      descripcion.trim(),
      ofertas_pasantia ? ofertas_pasantia.trim() : '',
      requisitos_perfil ? requisitos_perfil.trim() : '',
      logo_url,
      catalogo_pdf_url
    ]);

    res.status(201).json({
      success: true,
      message: 'Empresa participante registrada exitosamente',
      empresa_id: Number(result.insertId)
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({ success: false, message: 'El código de empresa ya existe.' });
    }
    next(err);
  }
};
