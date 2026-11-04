const db = require('../config/db');

/**
 * Obtener listado de empresas participantes y sus ofertas de pasantía
 */
exports.getAllEmpresas = async (req, res, next) => {
  try {
    const rawRows = await db.query(`
      SELECT * FROM empresas ORDER BY nombre_corporativo ASC
    `);

    const empresas = rawRows.map(e => ({
      ...e,
      id: Number(e.id)
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
      SELECT * FROM empresas WHERE id = ? OR codigo_empresa = ?
    `, [identifier, identifier]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Empresa no encontrada.' });
    }

    const e = rows[0];
    res.json({
      success: true,
      empresa: {
        ...e,
        id: Number(e.id)
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
        codigo_empresa = ?, nombre_corporativo = ?, descripcion = ?,
        ofertas_pasantia = ?, requisitos_perfil = ?, logo_url = ?, catalogo_pdf_url = ?
      WHERE id = ?
    `, [
      codigo_empresa.toUpperCase().trim(),
      nombre_corporativo.trim(),
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
 * Eliminar una empresa por ID
 */
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
      (codigo_empresa, nombre_corporativo, descripcion, ofertas_pasantia, requisitos_perfil, logo_url, catalogo_pdf_url)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      codigo_empresa.toUpperCase().trim(),
      nombre_corporativo.trim(),
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
