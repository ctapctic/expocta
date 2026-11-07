const db = require('../config/db');
const ventanasService = require('../services/ventanasService');

/**
 * Responda 403 si la votación está cerrada para este usuario.
 * Devuelve true cuando la petición ya fue respondida (debe cortar el handler).
 */
async function bloqueadaPorVentana(req, res, usuarioId) {
  const control = await ventanasService.verificarAccion('votacion', usuarioId);
  if (control.permitido) return false;
  res.status(403).json({
    success: false,
    message: control.mensaje,
    ventana: control.ventana
  });
  return true;
}

/**
 * Registrar o actualizar valoración individual de proyecto
 */
exports.valorarProyecto = async (req, res, next) => {
  try {
    const { usuario_id, proyecto_id, innovacion, dominio_tecnico, presentacion, impacto, comentario } = req.body;

    if (!usuario_id || !proyecto_id || !innovacion || !dominio_tecnico || !presentacion || !impacto) {
      return res.status(400).json({
        success: false,
        message: 'Todos los criterios de evaluación (1 a 5) son obligatorios.'
      });
    }

    // Validar rango 1 a 5
    const scoreCheck = [innovacion, dominio_tecnico, presentacion, impacto].every(val => val >= 1 && val <= 5);
    if (!scoreCheck) {
      return res.status(400).json({
        success: false,
        message: 'Los puntajes de evaluación deben estar comprendidos entre 1 y 5.'
      });
    }

    if (await bloqueadaPorVentana(req, res, usuario_id)) return;

    // Insertar o actualizar si ya fue valorado por el mismo usuario
    const sql = `
      INSERT INTO valoraciones_proyectos 
      (usuario_id, proyecto_id, innovacion, dominio_tecnico, presentacion, impacto, comentario)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        innovacion = VALUES(innovacion),
        dominio_tecnico = VALUES(dominio_tecnico),
        presentacion = VALUES(presentacion),
        impacto = VALUES(impacto),
        comentario = VALUES(comentario),
        creado_en = CURRENT_TIMESTAMP
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

    res.json({
      success: true,
      message: '¡Valoración del proyecto guardada exitosamente en el servidor!'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Registrar o actualizar valoración individual de charla
 */
exports.valorarCharla = async (req, res, next) => {
  try {
    const { usuario_id, charla_id, nota_contenido, nota_expositor, comentario } = req.body;

    if (!usuario_id || !charla_id || !nota_contenido || !nota_expositor) {
      return res.status(400).json({
        success: false,
        message: 'Nota de contenido y nota de expositor son requeridas (1-5).'
      });
    }

    if (nota_contenido < 1 || nota_contenido > 5 || nota_expositor < 1 || nota_expositor > 5) {
      return res.status(400).json({
        success: false,
        message: 'Las calificaciones deben estar entre 1 y 5.'
      });
    }

    if (await bloqueadaPorVentana(req, res, usuario_id)) return;

    const sql = `
      INSERT INTO valoraciones_charlas 
      (usuario_id, charla_id, nota_contenido, nota_expositor, comentario)
      VALUES (?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        nota_contenido = VALUES(nota_contenido),
        nota_expositor = VALUES(nota_expositor),
        comentario = VALUES(comentario),
        creado_en = CURRENT_TIMESTAMP
    `;

    await db.query(sql, [
      parseInt(usuario_id, 10),
      parseInt(charla_id, 10),
      parseInt(nota_contenido, 10),
      parseInt(nota_expositor, 10),
      comentario ? comentario.trim() : null
    ]);

    res.json({
      success: true,
      message: '¡Valoración de la charla registrada exitosamente!'
    });
  } catch (err) {
    next(err);
  }
};

/**
 * MODO CONTINGENCIA (OFFLINE-FIRST):
 * Sincronización en lote de evaluaciones almacenadas en localStorage durante pérdidas de conectividad.
 */
exports.syncBatchEvaluaciones = async (req, res, next) => {
  let conn;
  try {
    const { usuario_id, valoraciones_proyectos = [], valoraciones_charlas = [] } = req.body;

    if (!usuario_id) {
      return res.status(400).json({ success: false, message: 'Se requiere el usuario_id para sincronizar.' });
    }

    if (await bloqueadaPorVentana(req, res, usuario_id)) return;

    conn = await db.pool.getConnection();
    await conn.beginTransaction();

    let procesadasProyectos = 0;
    let procesadasCharlas = 0;

    // Procesar lote de proyectos
    for (const vp of valoraciones_proyectos) {
      if (vp.proyecto_id && vp.innovacion && vp.dominio_tecnico && vp.presentacion && vp.impacto) {
        await conn.query(`
          INSERT INTO valoraciones_proyectos 
          (usuario_id, proyecto_id, innovacion, dominio_tecnico, presentacion, impacto, comentario)
          VALUES (?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            innovacion = VALUES(innovacion),
            dominio_tecnico = VALUES(dominio_tecnico),
            presentacion = VALUES(presentacion),
            impacto = VALUES(impacto),
            comentario = VALUES(comentario)
        `, [
          parseInt(usuario_id, 10),
          parseInt(vp.proyecto_id, 10),
          parseInt(vp.innovacion, 10),
          parseInt(vp.dominio_tecnico, 10),
          parseInt(vp.presentacion, 10),
          parseInt(vp.impacto, 10),
          vp.comentario ? vp.comentario.trim() : null
        ]);
        procesadasProyectos++;
      }
    }

    // Procesar lote de charlas
    for (const vc of valoraciones_charlas) {
      if (vc.charla_id && vc.nota_contenido && vc.nota_expositor) {
        await conn.query(`
          INSERT INTO valoraciones_charlas 
          (usuario_id, charla_id, nota_contenido, nota_expositor, comentario)
          VALUES (?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            nota_contenido = VALUES(nota_contenido),
            nota_expositor = VALUES(nota_expositor),
            comentario = VALUES(comentario)
        `, [
          parseInt(usuario_id, 10),
          parseInt(vc.charla_id, 10),
          parseInt(vc.nota_contenido, 10),
          parseInt(vc.nota_expositor, 10),
          vc.comentario ? vc.comentario.trim() : null
        ]);
        procesadasCharlas++;
      }
    }

    await conn.commit();

    console.log(`🌐 Sync offline completado: ${procesadasProyectos} proyectos y ${procesadasCharlas} charlas sincronizadas para usuario ${usuario_id}`);

    res.json({
      success: true,
      message: 'Sincronización fuera de línea completada exitosamente.',
      sincronizados: {
        proyectos: procesadasProyectos,
        charlas: procesadasCharlas
      }
    });
  } catch (err) {
    if (conn) await conn.rollback();
    next(err);
  } finally {
    if (conn) conn.release();
  }
};

/**
 * Obtener Ranking / Estadísticas generales de la Expotecnia
 */
exports.getStatsAndRanking = async (req, res, next) => {
  try {
    const topProyectos = await db.query(`
      SELECT 
        p.id, p.codigo_stand, p.titulo, p.especialidad, p.imagen_url,
        COALESCE(AVG((v.innovacion + v.dominio_tecnico + v.presentacion + v.impacto) / 4.0), 0) AS promedio_general,
        COUNT(v.id) AS total_votos
      FROM proyectos p
      LEFT JOIN valoraciones_proyectos v ON p.id = v.proyecto_id
      GROUP BY p.id
      ORDER BY promedio_general DESC, total_votos DESC
      LIMIT 5
    `);

    const statsGenerales = await db.query(`
      SELECT
        (SELECT COUNT(*) FROM proyectos) AS total_proyectos,
        (SELECT COUNT(*) FROM charlas) AS total_charlas,
        (SELECT COUNT(*) FROM oferta_formativa) AS total_ofertas,
        (SELECT COUNT(*) FROM usuarios) AS total_usuarios,
        (SELECT COUNT(*) FROM valoraciones_proyectos) AS total_evaluaciones_proyectos,
        (SELECT COUNT(*) FROM valoraciones_charlas) AS total_evaluaciones_charlas
    `);

    res.json({
      success: true,
      topProyectos: topProyectos.map(item => ({
        ...item,
        id: Number(item.id),
        promedio_general: Number(parseFloat(item.promedio_general || 0).toFixed(2)),
        total_votos: Number(item.total_votos || 0)
      })),
      stats: {
        total_proyectos: Number(statsGenerales[0].total_proyectos),
        total_charlas: Number(statsGenerales[0].total_charlas),
        total_ofertas: Number(statsGenerales[0].total_ofertas),
        total_usuarios: Number(statsGenerales[0].total_usuarios),
        total_evaluaciones: Number(statsGenerales[0].total_evaluaciones_proyectos) + Number(statsGenerales[0].total_evaluaciones_charlas)
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Feed dinámico de Toda la Actividad del Evento en vivo
 */
exports.getLiveEventFeed = async (req, res, next) => {
  try {
    const actividadesProyectos = await db.query(`
      SELECT 
        'evaluacion_proyecto' AS tipo,
        v.creado_en AS fecha,
        u.nombre AS usuario_nombre,
        u.rol AS usuario_rol,
        p.codigo_stand,
        p.titulo AS objeto_titulo,
        ROUND((v.innovacion + v.dominio_tecnico + v.presentacion + v.impacto)/4.0, 1) AS puntaje,
        TIMESTAMPDIFF(SECOND, v.creado_en, NOW()) AS segundos_hace
      FROM valoraciones_proyectos v
      JOIN usuarios u ON v.usuario_id = u.id
      JOIN proyectos p ON v.proyecto_id = p.id
      ORDER BY v.creado_en DESC
      LIMIT 10
    `);

    const actividadesCharlas = await db.query(`
      SELECT 
        'evaluacion_charla' AS tipo,
        v.creado_en AS fecha,
        u.nombre AS usuario_nombre,
        u.rol AS usuario_rol,
        c.codigo_charla AS codigo_stand,
        c.titulo AS objeto_titulo,
        ROUND((v.nota_contenido + v.nota_expositor)/2.0, 1) AS puntaje,
        TIMESTAMPDIFF(SECOND, v.creado_en, NOW()) AS segundos_hace
      FROM valoraciones_charlas v
      JOIN usuarios u ON v.usuario_id = u.id
      JOIN charlas c ON v.charla_id = c.id
      ORDER BY v.creado_en DESC
      LIMIT 10
    `);

    const actividadesProspectos = await db.query(`
      SELECT 
        'interes_carrera' AS tipo,
        pr.creado_en AS fecha,
        u.nombre AS usuario_nombre,
        u.rol AS usuario_rol,
        o.codigo_oferta AS codigo_stand,
        o.nombre_carrera AS objeto_titulo,
        5.0 AS puntaje,
        TIMESTAMPDIFF(SECOND, pr.creado_en, NOW()) AS segundos_hace
      FROM prospectos_eftp pr
      JOIN usuarios u ON pr.usuario_id = u.id
      JOIN oferta_formativa o ON pr.oferta_id = o.id
      ORDER BY pr.creado_en DESC
      LIMIT 10
    `);

    const actividadesEmpresas = await db.query(`
      SELECT 
        'evaluacion_empresa' AS tipo,
        v.creado_en AS fecha,
        u.nombre AS usuario_nombre,
        u.rol AS usuario_rol,
        e.codigo_empresa AS codigo_stand,
        e.nombre_corporativo AS objeto_titulo,
        ROUND((v.calidad_servicio + v.atencion + v.propuesta_valor + v.innovacion + v.impacto_social_economico)/5.0, 1) AS puntaje,
        TIMESTAMPDIFF(SECOND, v.creado_en, NOW()) AS segundos_hace
      FROM valoraciones_empresas v
      JOIN usuarios u ON v.usuario_id = u.id
      JOIN empresas e ON v.empresa_id = e.id
      ORDER BY v.creado_en DESC
      LIMIT 10
    `);

    // Combinar y ordenar por fecha descendente
    const feed = [...actividadesProyectos, ...actividadesCharlas, ...actividadesProspectos, ...actividadesEmpresas]
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha))
      .slice(0, 15)
      .map((item) => ({ ...item, segundos_hace: Math.max(0, Number(item.segundos_hace || 0)) }));

    res.json({
      success: true,
      total: feed.length,
      feed
    });
  } catch (err) {
    next(err);
  }
};

