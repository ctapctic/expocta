const db = require('../config/db');
const archivosService = require('../services/archivosService');
const PDFDocument = require('pdfkit');
const QRCode = require('qrcode');
const path = require('path');
const fs = require('fs');

/**
 * Obtener un proyecto específico por código de stand (ej: STAND-101) con promedio y total de votos
 */
exports.obtenerProyectoPorCodigo = async (req, res, next) => {
  try {
    const { codigo } = req.params;

    const sql = `
      SELECT 
        p.*,
        COALESCE(AVG((v.innovacion + v.dominio_tecnico + v.presentacion + v.impacto) / 4.0), 0) AS promedio,
        COALESCE(AVG(v.innovacion), 0) AS promedio_innovacion,
        COALESCE(AVG(v.dominio_tecnico), 0) AS promedio_dominio_tecnico,
        COALESCE(AVG(v.presentacion), 0) AS promedio_presentacion,
        COALESCE(AVG(v.impacto), 0) AS promedio_impacto,
        COUNT(v.id) AS total_votos
      FROM proyectos p
      LEFT JOIN valoraciones_proyectos v ON p.id = v.proyecto_id
      WHERE p.codigo_stand = ? OR p.id = ?
      GROUP BY p.id
    `;

    const rows = await db.query(sql, [codigo, codigo]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No se encontró ningún proyecto con el código o ID '${codigo}'.`
      });
    }

    const p = rows[0];

    // Saber si la foto existe realmente (en disco o en el respaldo de MariaDB)
    let imagenOk = false;
    try {
      const enDb = await archivosService.existenArchivos([archivosService.nombreDesdeUrl(p.imagen_url)]);
      imagenOk = archivosService.urlDisponible(p.imagen_url, enDb);
    } catch (_) {
      // Si falla la consulta, no bloqueamos el detalle del proyecto.
    }

    // Obtener comentarios de los evaluadores
    const comentarios = await db.query(`
      SELECT 
        v.comentario, v.innovacion, v.dominio_tecnico, v.presentacion, v.impacto, v.creado_en,
        u.nombre AS usuario_nombre, u.rol AS usuario_rol
      FROM valoraciones_proyectos v
      JOIN usuarios u ON v.usuario_id = u.id
      WHERE v.proyecto_id = ? AND v.comentario IS NOT NULL AND v.comentario != ''
      ORDER BY v.creado_en DESC
    `, [p.id]);

    res.json({
      success: true,
      proyecto: {
        ...p,
        id: Number(p.id),
        trl_nivel: Number(p.trl_nivel),
        promedio: Number(parseFloat(p.promedio || 0).toFixed(2)),
        promedio_innovacion: Number(parseFloat(p.promedio_innovacion || 0).toFixed(1)),
        promedio_dominio_tecnico: Number(parseFloat(p.promedio_dominio_tecnico || 0).toFixed(1)),
        promedio_presentacion: Number(parseFloat(p.promedio_presentacion || 0).toFixed(1)),
        promedio_impacto: Number(parseFloat(p.promedio_impacto || 0).toFixed(1)),
        total_votos: Number(p.total_votos || 0),
        imagen_ok: imagenOk,
        comentarios: comentarios.map(c => ({
          ...c,
          innovacion: Number(c.innovacion),
          dominio_tecnico: Number(c.dominio_tecnico),
          presentacion: Number(c.presentacion),
          impacto: Number(c.impacto)
        }))
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Evaluar un proyecto con la rúbrica de 4 ejes.
 * Solo se permite una evaluación por usuario y proyecto.
 * Si ya existe, responde 400 ("Ya has evaluado este proyecto").
 */
exports.evaluarProyecto = async (req, res, next) => {
  try {
    const { usuario_id, proyecto_id, innovacion, dominio_tecnico, presentacion, impacto, comentario } = req.body;

    if (!usuario_id || !proyecto_id || !innovacion || !dominio_tecnico || !presentacion || !impacto) {
      return res.status(400).json({
        success: false,
        message: 'Todos los criterios de evaluación (1 a 5) son obligatorios.'
      });
    }

    // Validar rango 1-5
    const scores = [innovacion, dominio_tecnico, presentacion, impacto];
    if (scores.some(s => s < 1 || s > 5)) {
      return res.status(400).json({
        success: false,
        message: 'Los puntajes de la rúbrica deben estar entre 1 y 5.'
      });
    }

    const sql = `
      INSERT INTO valoraciones_proyectos 
      (usuario_id, proyecto_id, innovacion, dominio_tecnico, presentacion, impacto, comentario)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `;

    await db.query(sql, [
      parseInt(usuario_id, 10),
      parseInt(proyecto_id, 10),
      parseInt(innovacion, 10),
      parseInt(dominio_tecnico, 10),
      parseInt(presentacion, 10),
      parseInt(impacto, 10),
      comentario ? comentario.trim() : null
    ]);

    res.status(201).json({
      success: true,
      message: '¡Evaluación registrada exitosamente!'
    });
  } catch (err) {
    // Control específico de llave duplicada
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(400).json({
        success: false,
        message: 'Ya has evaluado este proyecto anteriormente.'
      });
    }
    next(err);
  }
};

/**
 * Leaderboard top 5 de proyectos para pantallas gigantes / TVs de la Expotecnia
 */
exports.obtenerLeaderboard = async (req, res, next) => {
  try {
    const sql = `
      SELECT 
        p.id,
        p.codigo_stand,
        p.titulo,
        p.especialidad,
        p.trl_nivel,
        p.imagen_url,
        p.docente_tutor,
        COALESCE(AVG((v.innovacion + v.dominio_tecnico + v.presentacion + v.impacto) / 4.0), 0) AS promedio,
        COUNT(v.id) AS total_votos
      FROM proyectos p
      LEFT JOIN valoraciones_proyectos v ON p.id = v.proyecto_id
      GROUP BY p.id
      ORDER BY promedio DESC, total_votos DESC
      LIMIT 5
    `;

    const rawRows = await db.query(sql);

    const leaderboard = rawRows.map((row, index) => ({
      posicion: index + 1,
      id: Number(row.id),
      codigo_stand: row.codigo_stand,
      titulo: row.titulo,
      especialidad: row.especialidad,
      trl_nivel: Number(row.trl_nivel),
      imagen_url: row.imagen_url,
      docente_tutor: row.docente_tutor,
      promedio: Number(parseFloat(row.promedio || 0).toFixed(2)),
      total_votos: Number(row.total_votos || 0)
    }));

    // Métricas técnicas de telemetría en vivo
    const telemetriaData = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM usuarios) AS total_acreditaciones,
        (SELECT COUNT(*) FROM valoraciones_proyectos) + (SELECT COUNT(*) FROM valoraciones_charlas) AS total_evaluaciones,
        (SELECT COUNT(*) FROM prospectos_eftp) AS total_prospectos,
        (SELECT COUNT(*) FROM proyectos) AS total_stands
    `);

    // Ticker reciente (stands + charlas) para barra en movimiento en pantallas gigantes
    const tickerEvents = await db.query(`
      SELECT 
        u.nombre AS usuario,
        u.rol,
        'stand' AS tipo,
        p.codigo_stand AS codigo,
        p.titulo AS titulo,
        ROUND((v.innovacion + v.dominio_tecnico + v.presentacion + v.impacto)/4.0, 1) AS nota,
        v.creado_en AS fecha
      FROM valoraciones_proyectos v
      JOIN usuarios u ON v.usuario_id = u.id
      JOIN proyectos p ON v.proyecto_id = p.id
      UNION ALL
      SELECT 
        u.nombre,
        u.rol,
        'charla',
        c.codigo_charla,
        c.titulo,
        ROUND((vc.nota_contenido + vc.nota_expositor)/2.0, 1),
        vc.creado_en
      FROM valoraciones_charlas vc
      JOIN usuarios u ON vc.usuario_id = u.id
      JOIN charlas c ON vc.charla_id = c.id
      ORDER BY fecha DESC
      LIMIT 5
    `);

    // Próximas charlas por horario, con su valoración acumulada
    const charlasProximas = await db.query(`
      SELECT 
        c.id,
        c.codigo_charla,
        c.titulo,
        c.eje_tematico,
        c.expositor,
        c.foto_expositor_url,
        c.horario,
        DATE_FORMAT(c.horario, '%Y-%m-%d %H:%i:%s') AS horario_str,
        c.ubicacion,
        COALESCE(AVG((v.nota_contenido + v.nota_expositor)/2.0), 0) AS promedio,
        COUNT(v.id) AS total_votos
      FROM charlas c
      LEFT JOIN valoraciones_charlas v ON c.id = v.charla_id
      WHERE c.horario >= NOW()
      GROUP BY c.id
      ORDER BY c.horario ASC
      LIMIT 3
    `);

    // Charlas mejor puntuadas por la comunidad
    const charlasTop = await db.query(`
      SELECT 
        c.id,
        c.codigo_charla,
        c.titulo,
        c.expositor,
        c.foto_expositor_url,
        c.horario,
        DATE_FORMAT(c.horario, '%Y-%m-%d %H:%i:%s') AS horario_str,
        AVG((v.nota_contenido + v.nota_expositor)/2.0) AS promedio,
        COUNT(v.id) AS total_votos
      FROM charlas c
      JOIN valoraciones_charlas v ON c.id = v.charla_id
      GROUP BY c.id
      ORDER BY promedio DESC, total_votos DESC
      LIMIT 3
    `);

    // Ofertas formativas con mayor demanda real (prospectos registrados)
    const ofertasTop = await db.query(`
      SELECT 
        o.id,
        o.codigo_oferta,
        o.nombre_carrera,
        o.modalidad,
        o.duracion_horas,
        COUNT(pr.id) AS total_prospectos
      FROM oferta_formativa o
      LEFT JOIN prospectos_eftp pr ON o.id = pr.oferta_id
      GROUP BY o.id
      ORDER BY total_prospectos DESC, o.nombre_carrera ASC
      LIMIT 3
    `);

    // Empresas participantes presentes en la expo
    const empresasRows = await db.query(`
      SELECT 
        e.id,
        e.codigo_empresa,
        e.nombre_corporativo,
        e.logo_url,
        LEFT(e.descripcion, 180) AS descripcion
      FROM empresas e
      ORDER BY e.nombre_corporativo ASC
      LIMIT 6
    `);

    res.json({
      success: true,
      timestamp: new Date().toISOString(),
      telemetria: {
        total_acreditaciones: Number(telemetriaData[0].total_acreditaciones || 0),
        total_evaluaciones: Number(telemetriaData[0].total_evaluaciones || 0),
        tasa_captacion_prospectos: Number(telemetriaData[0].total_prospectos || 0),
        stands_activos: Number(telemetriaData[0].total_stands || 0)
      },
      ticker: tickerEvents.map((ev) => ({
        usuario: ev.usuario,
        rol: ev.rol,
        tipo: ev.tipo,
        codigo: ev.codigo,
        titulo: ev.titulo,
        nota: Number(parseFloat(ev.nota || 0).toFixed(1)),
        fecha: ev.fecha
      })),
      charlas_proximas: charlasProximas.map((c) => ({
        id: Number(c.id),
        codigo_charla: c.codigo_charla,
        titulo: c.titulo,
        eje_tematico: c.eje_tematico,
        expositor: c.expositor,
        foto_expositor_url: c.foto_expositor_url || '',
        horario: c.horario,
        horario_str: c.horario_str,
        ubicacion: c.ubicacion,
        promedio: Number(parseFloat(c.promedio || 0).toFixed(2)),
        total_votos: Number(c.total_votos || 0)
      })),
      charlas_top: charlasTop.map((c) => ({
        id: Number(c.id),
        codigo_charla: c.codigo_charla,
        titulo: c.titulo,
        expositor: c.expositor,
        foto_expositor_url: c.foto_expositor_url || '',
        horario: c.horario,
        horario_str: c.horario_str,
        promedio: Number(parseFloat(c.promedio || 0).toFixed(2)),
        total_votos: Number(c.total_votos || 0)
      })),
      ofertas_top: ofertasTop.map((o) => ({
        id: Number(o.id),
        codigo_oferta: o.codigo_oferta,
        nombre_carrera: o.nombre_carrera,
        modalidad: o.modalidad,
        duracion_horas: Number(o.duracion_horas || 0),
        total_prospectos: Number(o.total_prospectos || 0)
      })),
      empresas: empresasRows.map((e) => ({
        id: Number(e.id),
        codigo_empresa: e.codigo_empresa,
        nombre_corporativo: e.nombre_corporativo,
        logo_url: e.logo_url,
        descripcion: e.descripcion || ''
      })),
      leaderboard
    });
  } catch (err) {
    next(err);
  }
};


/**
 * Obtener todos los proyectos con filtrado opcional
 */
exports.getAllProyectos = async (req, res, next) => {
  try {
    const { search, especialidad, trl } = req.query;

    let sql = `
      SELECT 
        p.*,
        COALESCE(AVG((v.innovacion + v.dominio_tecnico + v.presentacion + v.impacto) / 4.0), 0) AS promedio,
        COUNT(v.id) AS total_votos
      FROM proyectos p
      LEFT JOIN valoraciones_proyectos v ON p.id = v.proyecto_id
      WHERE 1=1
    `;
    const params = [];

    if (search) {
      sql += ` AND (p.titulo LIKE ? OR p.codigo_stand LIKE ? OR p.tecnologias_usadas LIKE ?)`;
      const pattern = `%${search}%`;
      params.push(pattern, pattern, pattern);
    }
    if (especialidad) {
      sql += ` AND p.especialidad = ?`;
      params.push(especialidad);
    }
    if (trl) {
      sql += ` AND p.trl_nivel = ?`;
      params.push(parseInt(trl, 10));
    }

    sql += ` GROUP BY p.id ORDER BY p.codigo_stand ASC`;

    const rawRows = await db.query(sql, params);

    // Marcar qué proyectos tienen la foto realmente disponible (disco o MariaDB)
    let enDb = new Set();
    try {
      enDb = await archivosService.existenArchivos(
        rawRows.map((row) => archivosService.nombreDesdeUrl(row.imagen_url))
      );
    } catch (_) {
      // Si falla el respaldo, el listado igual se devuelve.
    }

    const proyectos = rawRows.map(row => ({
      ...row,
      id: Number(row.id),
      trl_nivel: Number(row.trl_nivel),
      promedio: Number(parseFloat(row.promedio || 0).toFixed(2)),
      total_votos: Number(row.total_votos || 0),
      imagen_ok: archivosService.urlDisponible(row.imagen_url, enDb)
    }));

    res.json({
      success: true,
      total: proyectos.length,
      proyectos
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Crear proyecto con imágenes y poster PDF via Multer
 */
exports.createProyecto = async (req, res, next) => {
  try {
    const {
      codigo_stand,
      titulo,
      especialidad,
      sector_aplicacion,
      impacto_ods,
      resumen_ejecutivo,
      problema_que_resuelve,
      trl_nivel,
      tecnologias_usadas,
      integrantes,
      docente_tutor,
      video_pitch_url,
      enlace_tecnico_url,
      requerimientos_exhibicion
    } = req.body;

    if (!codigo_stand || !titulo || !especialidad || !resumen_ejecutivo || !trl_nivel) {
      return res.status(400).json({
        success: false,
        message: 'Campos requeridos faltantes.'
      });
    }

    let imagen_url = null;
    let pdf_poster_url = null;

    if (req.files) {
      if (req.files.imagen && req.files.imagen[0]) {
        imagen_url = `/uploads/${req.files.imagen[0].filename}`;
      }
      if (req.files.pdf_poster && req.files.pdf_poster[0]) {
        pdf_poster_url = `/uploads/${req.files.pdf_poster[0].filename}`;
      }
    }

    // Normalizar campos opcionales
    const impactoOds = impacto_ods ? String(impacto_ods).trim() : null;
    const enlaceTecnicoUrl = enlace_tecnico_url ? String(enlace_tecnico_url).trim() : null;
    const problemaQueResuelve = problema_que_resuelve ? String(problema_que_resuelve).trim() : null;

    let requerimientosExhibicion = requerimientos_exhibicion;
    if (Array.isArray(requerimientosExhibicion)) {
      requerimientosExhibicion = requerimientosExhibicion.join(', ');
    }
    if (requerimientosExhibicion === '' || requerimientosExhibicion === null || requerimientosExhibicion === undefined) {
      requerimientosExhibicion = null;
    } else {
      requerimientosExhibicion = String(requerimientosExhibicion).trim();
    }

    const insertResult = await db.query(`
      INSERT INTO proyectos
      (codigo_stand, titulo, especialidad, sector_aplicacion, impacto_ods, resumen_ejecutivo, problema_que_resuelve, trl_nivel, tecnologias_usadas, integrantes, docente_tutor, imagen_url, video_pitch_url, enlace_tecnico_url, pdf_poster_url, requerimientos_exhibicion)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      codigo_stand.toUpperCase().trim(),
      titulo.trim(),
      especialidad.trim(),
      sector_aplicacion ? sector_aplicacion.trim() : null,
      impactoOds,
      resumen_ejecutivo.trim(),
      problemaQueResuelve,
      parseInt(trl_nivel, 10),
      tecnologias_usadas || '',
      integrantes || '',
      docente_tutor || '',
      imagen_url,
      video_pitch_url || null,
      enlaceTecnicoUrl,
      pdf_poster_url,
      requerimientosExhibicion
    ]);

    res.status(201).json({
      success: true,
      message: 'Proyecto registrado correctamente',
      proyecto_id: Number(insertResult.insertId)
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: `El código de Stand '${req.body.codigo_stand}' ya está registrado.`
      });
    }
    next(err);
  }
};

/**
 * Actualizar un proyecto por ID. Si no se sube nueva imagen/poster, se conserva el archivo actual.
 */
exports.updateProyecto = async (req, res, next) => {
  try {
    const { id } = req.params;

    const rows = await db.query('SELECT * FROM proyectos WHERE id = ?', [id]);
    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Proyecto no encontrado.' });
    }
    const actual = rows[0];

    const {
      codigo_stand,
      titulo,
      especialidad,
      sector_aplicacion,
      impacto_ods,
      resumen_ejecutivo,
      problema_que_resuelve,
      trl_nivel,
      tecnologias_usadas,
      integrantes,
      docente_tutor,
      video_pitch_url,
      enlace_tecnico_url,
      requerimientos_exhibicion
    } = req.body;

    if (!codigo_stand || !titulo || !especialidad || !resumen_ejecutivo || !trl_nivel) {
      return res.status(400).json({ success: false, message: 'Campos requeridos faltantes.' });
    }

    let imagen_url = actual.imagen_url;
    let pdf_poster_url = actual.pdf_poster_url;
    if (req.files) {
      if (req.files.imagen && req.files.imagen[0]) {
        imagen_url = `/uploads/${req.files.imagen[0].filename}`;
      }
      if (req.files.pdf_poster && req.files.pdf_poster[0]) {
        pdf_poster_url = `/uploads/${req.files.pdf_poster[0].filename}`;
      }
    }

    // Normalizar campos opcionales
    const impactoOds = impacto_ods ? String(impacto_ods).trim() : null;
    const enlaceTecnicoUrl = enlace_tecnico_url ? String(enlace_tecnico_url).trim() : null;
    const problemaQueResuelve = problema_que_resuelve ? String(problema_que_resuelve).trim() : null;

    let requerimientosExhibicion = requerimientos_exhibicion;
    if (Array.isArray(requerimientosExhibicion)) {
      requerimientosExhibicion = requerimientosExhibicion.join(', ');
    }
    if (requerimientosExhibicion === '' || requerimientosExhibicion === null || requerimientosExhibicion === undefined) {
      requerimientosExhibicion = null;
    } else {
      requerimientosExhibicion = String(requerimientosExhibicion).trim();
    }

    await db.query(`
      UPDATE proyectos SET
        codigo_stand = ?, titulo = ?, especialidad = ?, sector_aplicacion = ?,
        impacto_ods = ?, resumen_ejecutivo = ?, problema_que_resuelve = ?,
        trl_nivel = ?, tecnologias_usadas = ?, integrantes = ?,
        docente_tutor = ?, imagen_url = ?, video_pitch_url = ?,
        enlace_tecnico_url = ?, pdf_poster_url = ?,
        requerimientos_exhibicion = ?
      WHERE id = ?
    `, [
      codigo_stand.toUpperCase().trim(),
      titulo.trim(),
      especialidad.trim(),
      sector_aplicacion ? sector_aplicacion.trim() : null,
      impactoOds,
      resumen_ejecutivo.trim(),
      problemaQueResuelve,
      parseInt(trl_nivel, 10),
      tecnologias_usadas || '',
      integrantes || '',
      docente_tutor || '',
      imagen_url,
      video_pitch_url || null,
      enlaceTecnicoUrl,
      pdf_poster_url,
      requerimientosExhibicion,
      id
    ]);

    res.json({ success: true, message: 'Proyecto actualizado correctamente.' });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: `El código de Stand '${req.body.codigo_stand}' ya está registrado en otro proyecto.`
      });
    }
    next(err);
  }
};

/**
 * Eliminar un proyecto por ID
 */
exports.deleteProyecto = async (req, res, next) => {
  try {
    const { id } = req.params;
    const result = await db.query('DELETE FROM proyectos WHERE id = ?', [id]);

    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Proyecto no encontrado.' });
    }

    res.json({ success: true, message: 'Proyecto eliminado exitosamente.' });
  } catch (err) {
    next(err);
  }
};

// Aliases de compatibilidad
exports.getProyectoByIdOrStand = exports.obtenerProyectoPorCodigo;

/**
 * Generar poster PDF dinámicamente (una sola hoja A4)
 * Se regenera en cada request con los datos actuales de la BD
 */
exports.generarPosterPDF = async (req, res, next) => {
  try {
    const { codigo } = req.params;

    const sql = `
      SELECT 
        p.*,
        COALESCE(AVG((v.innovacion + v.dominio_tecnico + v.presentacion + v.impacto) / 4.0), 0) AS promedio,
        COALESCE(AVG(v.innovacion), 0) AS promedio_innovacion,
        COALESCE(AVG(v.dominio_tecnico), 0) AS promedio_dominio_tecnico,
        COALESCE(AVG(v.presentacion), 0) AS promedio_presentacion,
        COALESCE(AVG(v.impacto), 0) AS promedio_impacto,
        COUNT(v.id) AS total_votos
      FROM proyectos p
      LEFT JOIN valoraciones_proyectos v ON p.id = v.proyecto_id
      WHERE p.codigo_stand = ? OR p.id = ?
      GROUP BY p.id
    `;

    const rows = await db.query(sql, [codigo, codigo]);

    if (!rows || rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: `No se encontró ningún proyecto con el código o ID '${codigo}'.`
      });
    }

    const p = rows[0];

    const proyecto = {
      ...p,
      id: Number(p.id),
      trl_nivel: Number(p.trl_nivel),
      promedio: Number(parseFloat(p.promedio || 0).toFixed(2)),
      promedio_innovacion: Number(parseFloat(p.promedio_innovacion || 0).toFixed(1)),
      promedio_dominio_tecnico: Number(parseFloat(p.promedio_dominio_tecnico || 0).toFixed(1)),
      promedio_presentacion: Number(parseFloat(p.promedio_presentacion || 0).toFixed(1)),
      promedio_impacto: Number(parseFloat(p.promedio_impacto || 0).toFixed(1)),
      total_votos: Number(p.total_votos || 0),
    };

    /* Servir el poster estático ya generado (con QR) si existe en public/uploads */
    const posterStaticPath = path.join(__dirname, '..', '..', 'public', 'uploads', `poster-${proyecto.codigo_stand.toLowerCase()}.pdf`);
    if (fs.existsSync(posterStaticPath)) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `inline; filename="poster-${proyecto.codigo_stand.toLowerCase()}.pdf"`);
      return res.sendFile(posterStaticPath);
    }

    /* ----------------------------- Colores ----------------------------- */
    const C = {
      azulOscuro: '#0f172a',
      azulMedio: '#1e3a8a',
      azulClaro: '#3b82f6',
      celeste: '#e0f2fe',
      celesteMedio: '#7dd3fc',
      textoOscuro: '#1e293b',
      textoGris: '#64748b',
      blanco: '#ffffff',
      textoBlanco: '#f8fafc',
      textoBlancoSuave: '#cbd5e1',
      amber: '#f59e0b',
      emerald: '#10b981',
      rose: '#ef4444',
      linea: '#e2e8f0',
    };

    const TRL_STYLE = {
      1: { color: C.rose, bg: '#fee2e2' },
      2: { color: C.rose, bg: '#fee2e2' },
      3: { color: '#f97316', bg: '#ffedd5' },
      4: { color: '#f97316', bg: '#ffedd5' },
      5: { color: C.amber, bg: '#fef3c7' },
      6: { color: C.amber, bg: '#fef3c7' },
      7: { color: C.emerald, bg: '#d1fae5' },
      8: { color: C.emerald, bg: '#d1fae5' },
      9: { color: C.emerald, bg: '#d1fae5' },
    };

    const PW = 595.28;   // A4 width
    const PH = 841.89;   // A4 height
    const M = 30;        // margen lateral
    const CW = PW - M * 2;

    const doc = new PDFDocument({
      size: 'A4',
      layout: 'portrait',
      margins: { top: 0, bottom: 0, left: 0, right: 0 },
      autoFirstPage: true,
    });

    // Headers para descarga/visualización en línea
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="poster-${proyecto.codigo_stand.toLowerCase()}.pdf"`);
    doc.pipe(res);

    /* Helpers locales */
    function block(x, y, w, h, color) {
      doc.rect(x, y, w, h).fill(color);
    }

    function roundedBlock(x, y, w, h, r, color) {
      doc.roundedRect(x, y, w, h, r).fill(color);
    }

    function texto(x, y, texto_, opts = {}) {
      const { font = 'Helvetica', size = 9, color = C.textoOscuro, width, align = 'left', lineGap = 2, bold = false, italic = false } = opts;
      const f = bold ? (italic ? 'Helvetica-BoldOblique' : 'Helvetica-Bold') : (italic ? 'Helvetica-Oblique' : font);
      doc.font(f).fontSize(size).fillColor(color);
      if (width) doc.text(texto_, x, y, { width, align, lineGap });
      else doc.text(texto_, x, y, { align });
    }

    function chip(x, y, w, h, label, opts = {}) {
      const { fill = C.azulClaro, textColor = C.blanco, fontSize = 7.5 } = opts;
      roundedBlock(x, y, w, h, h / 2, fill);
      doc.font('Helvetica-Bold').fontSize(fontSize).fillColor(textColor).text(label, x, y + h / 2 - fontSize / 2.2, { width: w, align: 'center' });
    }

    function seccionTitulo(x, y, label, fondoOscuro = false) {
      const colorTexto = fondoOscuro ? C.blanco : C.azulMedio;
      doc.font('Helvetica-Bold').fontSize(10).fillColor(colorTexto).text(label, x, y, { width: 200 });
      doc.rect(x, y + 14, 50, 2).fill(fondoOscuro ? C.blanco : C.azulClaro);
    }

    function campo(x, y, w, label, valor, opts = {}) {
      const { lblSz = 7, valSz = 9.5, lblColor = C.textoGris, valColor = C.textoOscuro, fondoOscuro = false, valBold = true } = opts;
      const cLbl = fondoOscuro ? C.textoBlancoSuave : lblColor;
      const cVal = fondoOscuro ? C.blanco : valColor;
      doc.font('Helvetica').fontSize(lblSz).fillColor(cLbl).text(label.toUpperCase(), x, y, { width: w * 0.3 });
      doc.font(valBold ? 'Helvetica-Bold' : 'Helvetica').fontSize(valSz).fillColor(cVal).text(valor, x + w * 0.32, y, { width: w * 0.66 });
    }

    function barraProgreso(x, y, w, pct, color = C.azulClaro, fondoOscuro = false) {
      const h = 7;
      const cFondo = fondoOscuro ? 'rgba(255,255,255,0.15)' : C.linea;
      const cBarra = fondoOscuro ? C.azulClaro : color;
      roundedBlock(x, y, w, h, h / 2, cFondo);
      roundedBlock(x, y, Math.max(2, w * pct), h, h / 2, cBarra);
    }

    function estrellas(x, y, rating, size = 9, fondoOscuro = false) {
      doc.fontSize(size);
      for (let i = 1; i <= 5; i++) {
        const c = fondoOscuro ? (i <= Math.round(rating) ? C.amber : 'rgba(255,255,255,0.25)') : (i <= Math.round(rating) ? C.amber : C.linea);
        doc.fillColor(c).text('★', x + (i - 1) * (size + 1.5), y);
      }
    }

    // Generar QR para el proyecto (se usa en la imagen del header y footer)
    const { buildStandUrl } = require('../config/publicUrl');
    const qrUrl = buildStandUrl(proyecto.codigo_stand);
    const qrDataUrl = await QRCode.toDataURL(qrUrl, { width: 120, margin: 1, color: { dark: '#0f172a', light: '#ffffff' } });

    /* ============================================================
       BLOQUE 1: HEADER CON IMAGEN - Azul oscuro, texto blanco
       ============================================================ */
    const h1 = 170;
    block(0, 0, PW, h1, C.azulOscuro);
    block(0, 0, 6, h1, C.azulClaro);

    // Título grande
    doc.font('Helvetica-Bold').fontSize(18).fillColor(C.blanco).text(proyecto.titulo, M, 24, { width: CW - 140, lineGap: 2 });
    const titleH = doc.heightOfString(proyecto.titulo, { width: CW - 140, lineGap: 2 });

    // Badge código stand
    const bw = 100, bh = 28;
    roundedBlock(M, 24 + titleH + 10, bw, bh, 14, C.azulMedio);
    doc.font('Helvetica-Bold').fontSize(9).fillColor(C.blanco).text(proyecto.codigo_stand, M, 24 + titleH + 10 + 7, { width: bw, align: 'center' });

    // Badge TRL
    const trlS = TRL_STYLE[proyecto.trl_nivel] || TRL_STYLE[5];
    const tw = 60;
    roundedBlock(PW - M - tw, 24 + titleH + 10, tw, bh, 14, trlS.bg);
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(trlS.color).text(`TRL ${proyecto.trl_nivel}`, PW - M - tw, 24 + titleH + 10 + 7, { width: tw, align: 'center' });

    // Imagen del proyecto y QR lado a lado en el header
    let imgX = PW - M - 160;
    if (proyecto.imagen_url) {
      const imgPath = path.join(__dirname, '..', '..', 'public', proyecto.imagen_url);
      if (fs.existsSync(imgPath)) {
        const iw = 140, ih = 90;
        const ix = PW - M - iw - 45; // espacio para QR a la derecha
        const iy = 35;
        roundedBlock(ix - 3, iy - 3, iw + 6, ih + 6, 8, C.blanco);
        doc.save();
        doc.roundedRect(ix, iy, iw, ih, 5);
        doc.clip();
        doc.image(imgPath, ix, iy, { width: iw, height: ih });
        doc.restore();
        imgX = ix - 10;
      }
    }

    // QR al lado de la imagen
    if (qrDataUrl) {
      const qrImgSize = 45;
      const qrX = imgX - qrImgSize;
      const qrY = 45;
      roundedBlock(qrX - 3, qrY - 3, qrImgSize + 6, qrImgSize + 6, 6, C.blanco);
      const qrImgBuf = Buffer.from(qrDataUrl.split(',')[1], 'base64');
      doc.image(qrImgBuf, qrX, qrY, { width: qrImgSize, height: qrImgSize });
      texto(qrX, qrY + qrImgSize + 4, 'ESCANEA', { size: 6, color: C.blanco, width: qrImgSize, align: 'center' });
    }

    // Etiquetas especialidad y sector
    const tags = [proyecto.especialidad];
    if (proyecto.sector_aplicacion) tags.push(proyecto.sector_aplicacion);
    let tx = M;
    const ty = 24 + titleH + 55;
    tags.forEach((tag, i) => {
      const tw2 = Math.min(150, doc.widthOfString(tag) + 22);
      const fondo = i === 0 ? C.azulMedio : C.celesteMedio;
      roundedBlock(tx, ty, tw2, 20, 10, fondo);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.blanco).text(tag, tx, ty + 4, { width: tw2, align: 'center' });
      tx += tw2 + 8;
    });

    /* ============================================================
       BLOQUE 2: FICHA TÉCNICA HORIZONTAL (mitad de la hoja)
       ============================================================ */
    const bodyY = h1 + 20;
    const gap = 16;
    const colW = (CW - gap) / 2;
    const leftX = M;
    const rightX = M + colW + gap;

    const fichaAltura = 220;

    // Fondo de la ficha técnica
    block(leftX, bodyY, CW, fichaAltura, C.celeste);
    block(leftX, bodyY, 5, fichaAltura, C.azulClaro); // línea lateral

    let fy = bodyY + 14;
    texto(leftX + 10, fy, 'FICHA TÉCNICA', { size: 11, color: C.azulMedio, bold: true });
    fy += 16;

    // Badge Impacto / ODS Principal (destacado)
    if (proyecto.impacto_ods) {
      const badgeW = 150;
      roundedBlock(leftX + 10, fy, badgeW, 24, 12, C.azulMedio);
      doc.font('Helvetica-Bold').fontSize(7.5).fillColor(C.blanco).text('IMPACTO / ODS', leftX + 10, fy + 4, { width: badgeW, align: 'center' });
      doc.font('Helvetica-Bold').fontSize(8.5).fillColor(C.blanco).text(proyecto.impacto_ods, leftX + 10, fy + 12, { width: badgeW, align: 'center' });
      fy += 34;
    }

    // Dos columnas de campos
    const camposIzq = [
      { label: 'Código de Stand', val: proyecto.codigo_stand },
      { label: 'Especialidad', val: proyecto.especialidad },
      { label: 'Sector de Aplicación', val: proyecto.sector_aplicacion || 'No especificado' },
      { label: 'Autores (Alumnos)', val: proyecto.integrantes || 'No asignados' },
    ];
    const camposDer = [
      { label: 'Título del Proyecto', val: proyecto.titulo },
      { label: 'Nivel TRL (1-9)', val: `TRL ${proyecto.trl_nivel}` },
      { label: 'Docente Tutor', val: proyecto.docente_tutor },
      { label: 'Contacto', val: 'Vía institucional' },
    ];

    camposIzq.forEach((f, i) => {
      const yy = fy + i * 32;
      texto(leftX + 10, yy, f.label.toUpperCase(), { width: 80, size: 7, color: C.textoGris, bold: true });
      texto(leftX + 95, yy, f.val, { width: colW - 105, size: 9, color: C.textoOscuro, bold: true });
    });

    camposDer.forEach((f, i) => {
      const yy = fy + i * 32;
      texto(rightX + 10, yy, f.label.toUpperCase(), { width: 100, size: 7, color: C.textoGris, bold: true });
      texto(rightX + 115, yy, f.val, { width: colW - 125, size: 9, color: C.textoOscuro, bold: true });
    });

    // Tecnologías Usadas - fila de ancho completo
    const tyTec = fy + 4 * 32 + 12;
    texto(leftX + 10, tyTec, 'Tecnologías Usadas', { width: 120, size: 7, color: C.textoGris, bold: true });
    texto(leftX + 130, tyTec, proyecto.tecnologias_usadas || 'No especificado', {
      width: CW - 140, size: 8.5, color: C.textoOscuro, bold: true
    });

    // Requerimientos de Exhibición - fila de ancho completo (si existen)
    if (proyecto.requerimientos_exhibicion) {
      const tyReq = tyTec + 22;
      texto(leftX + 10, tyReq, 'Requerimientos de Exhibición', { width: 150, size: 7, color: C.textoGris, bold: true });
      texto(leftX + 160, tyReq, proyecto.requerimientos_exhibicion, {
        width: CW - 170, size: 8.5, color: C.textoOscuro, bold: true
      });
    }

    // Línea separadora entre ficha y resumen
    block(leftX, bodyY + fichaAltura - 1, CW, 1, C.linea);

    /* ============================================================
       BLOQUE 2.5: PROBLEMA QUE RESUELVE (ancho completo)
       ============================================================ */
    const problemaY = bodyY + fichaAltura + 12;
    let textoAbajoY = problemaY + 60; // valor por defecto si no hay problema

    if (proyecto.problema_que_resuelve) {
      texto(leftX, problemaY, 'PROBLEMA QUE RESUELVE', { size: 11, color: C.azulMedio, bold: true });
      block(leftX, problemaY + 14, CW, 1, C.linea);

      const problemaH = 50;
      block(leftX, problemaY + 16, CW, problemaH, C.blanco);
      texto(leftX + 10, problemaY + 24, proyecto.problema_que_resuelve, {
        width: CW - 20, size: 8.6, color: C.textoOscuro, lineGap: 3, align: 'justify'
      });
      textoAbajoY = problemaY + 16 + problemaH + 14;
    }

    /* ============================================================
       BLOQUE 3: RESUMEN EJECUTIVO (ancho completo)
       ============================================================ */
    const resumenY = textoAbajoY;
    texto(leftX, resumenY, 'RESUMEN EJECUTIVO', { size: 11, color: C.azulMedio, bold: true });
    block(leftX, resumenY + 14, CW, 1, C.linea);

    // Resumen ejecutivo con altura dinámica según el texto
    const resumenLineHeight = 3;
    const resumenAlturaTexto = doc.heightOfString(proyecto.resumen_ejecutivo, {
      width: CW - 20, lineGap: resumenLineHeight
    });
    const resumenH = Math.max(56, resumenAlturaTexto + 20);

    block(leftX, resumenY + 16, CW, resumenH, C.blanco);
    texto(leftX + 10, resumenY + 24, proyecto.resumen_ejecutivo, {
      width: CW - 20, size: 8.6, color: C.textoOscuro, lineGap: resumenLineHeight, align: 'justify'
    });

    /* ============================================================
       BLOQUE 4: RECURSOS ADICIONALES
       ============================================================ */
    const recursosY = resumenY + resumenH + 20;
    texto(leftX, recursosY, 'RECURSOS ADICIONALES', { size: 11, color: C.azulMedio, bold: true });
    block(leftX, recursosY + 14, CW, 1, C.linea);

    const resAltura = 62;
    const resW = (CW - gap) / 2;
    let resY = recursosY + 16;

    // Video Pitch
    if (proyecto.video_pitch_url) {
      roundedBlock(leftX, resY, resW, resAltura, 8, '#fef3c7');
      texto(leftX + 12, resY + 8, '🎬  Video Pitch', { size: 8.5, color: '#b45309', bold: true });
      texto(leftX + 12, resY + 20, proyecto.video_pitch_url.replace('https://www.youtube.com/embed/', ''), {
        width: resW - 24, size: 7, color: '#92400e'
      });
      resY += resAltura + 10;
    }

    // Enlace Técnico / Demo (Nuevo)
    if (proyecto.enlace_tecnico_url) {
      roundedBlock(leftX, resY, resW, resAltura, 8, '#f0f9ff');
      texto(leftX + 12, resY + 8, '🔗  Enlace Técnico / Demo', { size: 8.5, color: '#0369a1', bold: true });
      texto(leftX + 12, resY + 20, proyecto.enlace_tecnico_url, {
        width: resW - 24, size: 7, color: '#0c4a6e'
      });
      resY += resAltura + 10;
    }

    // Poster PDF (derecha)
    if (proyecto.pdf_poster_url) {
      roundedBlock(rightX, recursosY + 16, resW, resAltura, 8, '#fef2f2');
      texto(rightX + 12, recursosY + 24, '📄  Poster Técnico PDF', { size: 8.5, color: '#dc2626', bold: true });
      texto(rightX + 12, recursosY + 36, 'Descargar ficha técnica completa', { width: resW - 24, size: 7, color: '#991b1b' });
    }

    // Requerimientos de Exhibición ya están en la ficha técnica; no se duplican aquí.

    /* ============================================================
       FOOTER - Azul oscuro, texto blanco
       ============================================================ */
    const footerY = PH - 60;
    const footerH = 60;
    block(0, footerY, PW, footerH, C.azulOscuro);
    block(0, footerY, PW, 1, C.azulClaro);

    texto(M, footerY + 8, 'EXPOTECNIA EFTP 2026', { size: 10, color: C.blanco, bold: true, width: 170 });
    texto(M, footerY + 20, 'Plataforma de Innovación Tecnológica Educativa', { size: 7.5, color: C.textoBlancoSuave, width: 220 });

    texto(PW - M - 170, footerY + 30, 'Generado automáticamente por Expotecnia EFTP', { size: 7, color: C.textoBlancoSuave, width: 170, align: 'right' });

    doc.end();
  } catch (err) {
    next(err);
  }
};

