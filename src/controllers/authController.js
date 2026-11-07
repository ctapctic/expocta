const db = require('../config/db');
const bcrypt = require('bcryptjs');
const ventanasService = require('../services/ventanasService');

const BCRYPT_ROUNDS = 10;

/**
 * Proyección pública del usuario: nunca incluye el PIN ni hashes.
 */
function publicUser(user) {
  return {
    id: Number(user.id),
    nombre: user.nombre,
    email: user.email,
    rol: user.rol,
    estado: user.estado,
    creado_en: user.creado_en
  };
}

// Roles que pueden auto-registrarse sin aprobación del administrador.
const ROLES_AUTO_REGISTRO = ['visitante', 'alumno', 'empresa'];

/**
 * Autenticación ligera o registro rápido para visitantes, alumnos y empresas.
 *
 * Reglas de seguridad:
 *  - El login SIEMPRE verifica el PIN contra el hash almacenado (bcrypt).
 *  - Las cuentas nuevas de visitante, alumno y empresa se crean habilitadas.
 *  - Los roles de gestión (docente/admin) los crea únicamente el administrador general.
 *  - Las cuentas pendientes o deshabilitadas no pueden iniciar sesión.
 *  - Las respuestas nunca devuelven el PIN; el PIN inicial generado se entrega
 *    una única vez en el campo `pin_inicial` del registro (201).
 */
exports.loginOrRegister = async (req, res, next) => {
  try {
    const { nombre, email, codigo_pin } = req.body;

    if (!email) {
      return res.status(400).json({ success: false, message: 'El correo electrónico es requerido.' });
    }

    const existingUsers = await db.query('SELECT * FROM usuarios WHERE email = ?', [email]);

    if (existingUsers && existingUsers.length > 0) {
      const user = existingUsers[0];

      // Validar habilitación de la cuenta antes de cualquier otra comprobación.
      const estado = user.estado || 'habilitado';
      if (estado === 'pendiente') {
        return res.status(403).json({
          success: false,
          message: 'Tu cuenta está pendiente de habilitación por el administrador general.'
        });
      }
      if (estado === 'deshabilitado') {
        return res.status(403).json({
          success: false,
          message: 'Tu cuenta está deshabilitada. Contactá al administrador general.'
        });
      }

      if (user.codigo_pin) {
        if (!codigo_pin) {
          return res.status(401).json({
            success: false,
            requiere_pin: true,
            message: 'Este correo ya está registrado. Ingresá tu PIN personal para continuar.'
          });
        }
        const pinValido = await bcrypt.compare(String(codigo_pin), user.codigo_pin);
        if (!pinValido) {
          return res.status(401).json({
            success: false,
            requiere_pin: true,
            message: 'PIN incorrecto. Verificá tu PIN personal e intentá nuevamente.'
          });
        }
      } else if (codigo_pin) {
        // Cuenta legacy sin PIN: el primer ingreso con PIN lo deja establecido (hasheado).
        const hash = await bcrypt.hash(String(codigo_pin), BCRYPT_ROUNDS);
        await db.query('UPDATE usuarios SET codigo_pin = ? WHERE id = ?', [hash, user.id]);
        user.codigo_pin = hash;
      }

      return res.json({
        success: true,
        message: 'Bienvenido nuevamente a Expotecnia EFTP',
        usuario: publicUser(user)
      });
    }

    // Registro de cuenta nueva: visitantes, alumnos y empresas entran sin aprobación.
    // Los roles de gestión (docente/admin) solo los crea el administrador general.
    // El login de cuentas existentes (bloque anterior) NO se ve afectado por la ventana.
    const controlVentana = await ventanasService.verificarAccion('registro', null, { permitirGestor: false });
    if (!controlVentana.permitido) {
      return res.status(403).json({
        success: false,
        message: controlVentana.mensaje,
        ventana: controlVentana.ventana
      });
    }

    const rolSolicitado = String(req.body.rol || 'visitante').trim().toLowerCase();
    if (!ROLES_AUTO_REGISTRO.includes(rolSolicitado)) {
      return res.status(403).json({
        success: false,
        message: 'Los roles Docente y Administrador solo pueden ser creados por el administrador general.'
      });
    }

    const pinInicial = codigo_pin ? String(codigo_pin) : Math.floor(1000 + Math.random() * 9000).toString();
    const hash = await bcrypt.hash(pinInicial, BCRYPT_ROUNDS);
    const userName = nombre || email.split('@')[0];

    const insertResult = await db.query(
      'INSERT INTO usuarios (nombre, email, rol, estado, codigo_pin) VALUES (?, ?, ?, ?, ?)',
      [userName, email, rolSolicitado, 'habilitado', hash]
    );

    res.status(201).json({
      success: true,
      message: 'Registro rápido completado con éxito',
      pin_inicial: codigo_pin ? undefined : pinInicial,
      usuario: {
        id: Number(insertResult.insertId),
        nombre: userName,
        email: email,
        rol: rolSolicitado,
        estado: 'habilitado'
      }
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Resuelve el usuario que realiza la petición a partir del encabezado x-usuario-id.
 * Devuelve null si no hay identidad o no existe en la base.
 */
async function resolveCaller(req) {
  const callerId = req.headers['x-usuario-id'] || req.query.usuario_id;
  if (!callerId) return null;
  const rows = await db.query('SELECT id, nombre, rol, estado FROM usuarios WHERE id = ?', [callerId]);
  if (!rows || rows.length === 0) return null;
  return rows[0].estado === 'habilitado' ? rows[0] : null;
}

/**
 * Consulta de perfil de usuario por ID.
 * Solo el propio usuario o un administrador pueden consultarlo.
 */
exports.getProfile = async (req, res, next) => {
  try {
    const { id } = req.params;
    const caller = await resolveCaller(req);

    if (!caller) {
      return res.status(401).json({
        success: false,
        message: 'Autenticación requerida. Proporciona tu ID de usuario en el encabezado x-usuario-id.'
      });
    }
    if (String(caller.id) !== String(id) && caller.rol !== 'admin') {
      return res.status(403).json({ success: false, message: 'Solo podés consultar tu propio perfil.' });
    }

    const users = await db.query('SELECT id, nombre, email, rol, estado, creado_en FROM usuarios WHERE id = ?', [id]);

    if (!users || users.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    res.json({ success: true, usuario: publicUser(users[0]) });
  } catch (err) {
    next(err);
  }
};

/**
 * Resumen consolidado para la vista "Todo en Uno" del visitante.
 * Solo el propio usuario o un administrador pueden consultarlo.
 */
exports.getVisitorSummary = async (req, res, next) => {
  try {
    const { id } = req.params;
    const caller = await resolveCaller(req);

    if (!caller) {
      return res.status(401).json({
        success: false,
        message: 'Autenticación requerida. Proporciona tu ID de usuario en el encabezado x-usuario-id.'
      });
    }
    if (String(caller.id) !== String(id) && caller.rol !== 'admin') {
      return res.status(403).json({ success: false, message: 'Solo podés consultar tu propio resumen de actividad.' });
    }

    // 1. Proyectos evaluados por el usuario
    const misProyectos = await db.query(`
      SELECT 
        v.id AS valoracion_id, v.innovacion, v.dominio_tecnico, v.presentacion, v.impacto, v.comentario, v.creado_en,
        p.id AS proyecto_id, p.codigo_stand, p.titulo, p.especialidad, p.imagen_url
      FROM valoraciones_proyectos v
      JOIN proyectos p ON v.proyecto_id = p.id
      WHERE v.usuario_id = ?
      ORDER BY v.creado_en DESC
    `, [id]);

    // 2. Charlas evaluadas por el usuario
    const misCharlas = await db.query(`
      SELECT 
        v.id AS valoracion_id, v.nota_contenido, v.nota_expositor, v.comentario, v.creado_en,
        c.id AS charla_id, c.codigo_charla, c.titulo, c.expositor, c.ubicacion
      FROM valoraciones_charlas v
      JOIN charlas c ON v.charla_id = c.id
      WHERE v.usuario_id = ?
      ORDER BY v.creado_en DESC
    `, [id]);

    // 3. Intereses de carreras registradas (Prospectos)
    const misIntereses = await db.query(`
      SELECT 
        pr.id AS prospecto_id, pr.telefono, pr.comentario, pr.creado_en,
        o.id AS oferta_id, o.codigo_oferta, o.nombre_carrera, o.duracion_horas, o.modalidad
      FROM prospectos_eftp pr
      JOIN oferta_formativa o ON pr.oferta_id = o.id
      WHERE pr.usuario_id = ?
      ORDER BY pr.creado_en DESC
    `, [id]);

    res.json({
      success: true,
      misProyectos: misProyectos.map(item => ({
        ...item,
        valoracion_id: Number(item.valoracion_id),
        proyecto_id: Number(item.proyecto_id),
        promedio: Number(((item.innovacion + item.dominio_tecnico + item.presentacion + item.impacto) / 4).toFixed(1))
      })),
      misCharlas: misCharlas.map(item => ({
        ...item,
        valoracion_id: Number(item.valoracion_id),
        charla_id: Number(item.charla_id),
        promedio: Number(((item.nota_contenido + item.nota_expositor) / 2).toFixed(1))
      })),
      misIntereses: misIntereses.map(item => ({
        ...item,
        prospecto_id: Number(item.prospecto_id),
        oferta_id: Number(item.oferta_id)
      }))
    });
  } catch (err) {
    next(err);
  }
};
