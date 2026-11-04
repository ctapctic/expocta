const db = require('../config/db');
const bcrypt = require('bcryptjs');

const BCRYPT_ROUNDS = 10;
const ROLES_VALIDOS = ['visitante', 'alumno', 'docente', 'empresa', 'admin'];
const ESTADOS_VALIDOS = ['pendiente', 'habilitado', 'deshabilitado'];

function usuarioPublico(u) {
  return {
    id: Number(u.id),
    nombre: u.nombre,
    email: u.email,
    rol: u.rol,
    estado: u.estado,
    creado_en: u.creado_en
  };
}

function normalizarRol(rol) {
  return String(rol || '').trim().toLowerCase();
}

function generarPin() {
  return Math.floor(1000 + Math.random() * 9000).toString();
}

async function contarAdminsHabilitados() {
  const rows = await db.query(
    `SELECT COUNT(*) AS total FROM usuarios WHERE rol = 'admin' AND estado = 'habilitado'`
  );
  return Number(rows[0].total || 0);
}

/**
 * Listado de usuarios para el panel de administración.
 * Nunca devuelve el PIN ni su hash.
 */
exports.getAllUsuarios = async (req, res, next) => {
  try {
    const filtros = [];
    const params = [];

    if (req.query.rol) {
      const rol = normalizarRol(req.query.rol);
      if (!ROLES_VALIDOS.includes(rol)) {
        return res.status(400).json({ success: false, message: 'Rol inválido para filtrar.' });
      }
      filtros.push('rol = ?');
      params.push(rol);
    }

    if (req.query.estado) {
      const estado = String(req.query.estado).trim().toLowerCase();
      if (!ESTADOS_VALIDOS.includes(estado)) {
        return res.status(400).json({ success: false, message: 'Estado inválido para filtrar.' });
      }
      filtros.push('estado = ?');
      params.push(estado);
    }

    const where = filtros.length ? `WHERE ${filtros.join(' AND ')}` : '';
    const rows = await db.query(
      `SELECT id, nombre, email, rol, estado, creado_en
       FROM usuarios
       ${where}
       ORDER BY creado_en DESC, id DESC`,
      params
    );

    res.json({ success: true, usuarios: rows.map(usuarioPublico) });
  } catch (err) {
    next(err);
  }
};

/**
 * Crear una cuenta desde el panel de administración (docentes, administradores u otros).
 * Si no se indica PIN, se genera uno inicial y se devuelve una única vez.
 */
exports.createUsuario = async (req, res, next) => {
  try {
    const nombre = String(req.body.nombre || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const rol = normalizarRol(req.body.rol || 'docente');
    const estado = String(req.body.estado || 'habilitado').trim().toLowerCase();
    const pinIngresado = req.body.codigo_pin ? String(req.body.codigo_pin).trim() : '';

    if (!nombre) {
      return res.status(400).json({ success: false, message: 'El nombre es obligatorio.' });
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ success: false, message: 'El correo electrónico no es válido.' });
    }
    if (!ROLES_VALIDOS.includes(rol)) {
      return res.status(400).json({ success: false, message: 'El rol seleccionado no es válido.' });
    }
    if (!ESTADOS_VALIDOS.includes(estado)) {
      return res.status(400).json({ success: false, message: 'El estado seleccionado no es válido.' });
    }
    if (pinIngresado && (pinIngresado.length < 4 || pinIngresado.length > 10)) {
      return res.status(400).json({ success: false, message: 'El PIN debe tener entre 4 y 10 caracteres.' });
    }

    const pinFinal = pinIngresado || generarPin();
    const hash = await bcrypt.hash(pinFinal, BCRYPT_ROUNDS);

    const result = await db.query(
      `INSERT INTO usuarios (nombre, email, rol, estado, codigo_pin) VALUES (?, ?, ?, ?, ?)`,
      [nombre, email, rol, estado, hash]
    );

    res.status(201).json({
      success: true,
      message: 'Usuario creado correctamente.',
      pin_inicial: pinIngresado ? undefined : pinFinal,
      usuario: {
        id: Number(result.insertId),
        nombre,
        email,
        rol,
        estado
      }
    });
  } catch (err) {
    if (err.code === 'ER_DUP_ENTRY') {
      return res.status(409).json({
        success: false,
        message: 'Ya existe un usuario registrado con ese correo electrónico.'
      });
    }
    next(err);
  }
};

/**
 * Actualizar nombre, email, rol, estado o PIN de un usuario.
 * Protege al último administrador habilitado y evita que el admin se bloquee a sí mismo.
 */
exports.updateUsuario = async (req, res, next) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ success: false, message: 'ID de usuario inválido.' });
    }

    const rows = await db.query(
      `SELECT id, nombre, email, rol, estado FROM usuarios WHERE id = ?`,
      [id]
    );

    if (!rows || rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado.' });
    }

    const actual = rows[0];
    const cambios = [];
    const params = [];

    if (req.body.rol !== undefined) {
      const rol = normalizarRol(req.body.rol);
      if (!ROLES_VALIDOS.includes(rol)) {
        return res.status(400).json({ success: false, message: 'El rol seleccionado no es válido.' });
      }
      cambios.push('rol = ?');
      params.push(rol);
    }

    if (req.body.estado !== undefined) {
      const estado = String(req.body.estado).trim().toLowerCase();
      if (!ESTADOS_VALIDOS.includes(estado)) {
        return res.status(400).json({ success: false, message: 'El estado seleccionado no es válido.' });
      }
      cambios.push('estado = ?');
      params.push(estado);
    }

    if (req.body.nombre !== undefined) {
      const nombre = String(req.body.nombre).trim();
      if (!nombre) {
        return res.status(400).json({ success: false, message: 'El nombre no puede quedar vacío.' });
      }
      cambios.push('nombre = ?');
      params.push(nombre);
    }

    if (req.body.email !== undefined) {
      const email = String(req.body.email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        return res.status(400).json({ success: false, message: 'El correo electrónico no es válido.' });
      }
      const duplicados = await db.query(
        'SELECT id FROM usuarios WHERE email = ? AND id <> ?',
        [email, id]
      );
      if (duplicados && duplicados.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Ya existe otro usuario con ese correo electrónico.'
        });
      }
      cambios.push('email = ?');
      params.push(email);
    }

    if (req.body.codigo_pin !== undefined && String(req.body.codigo_pin).trim() !== '') {
      const pin = String(req.body.codigo_pin).trim();
      if (pin.length < 4 || pin.length > 10) {
        return res.status(400).json({ success: false, message: 'El PIN debe tener entre 4 y 10 caracteres.' });
      }
      const hash = await bcrypt.hash(pin, BCRYPT_ROUNDS);
      cambios.push('codigo_pin = ?');
      params.push(hash);
    }

    if (cambios.length === 0) {
      return res.status(400).json({ success: false, message: 'No se enviaron cambios para actualizar.' });
    }

    const nuevoRol = req.body.rol !== undefined ? normalizarRol(req.body.rol) : actual.rol;
    const nuevoEstado = req.body.estado !== undefined
      ? String(req.body.estado).trim().toLowerCase()
      : actual.estado;

    const esPropiaCuenta = Number(req.user && req.user.id) === id;

    if (esPropiaCuenta && nuevoEstado !== 'habilitado') {
      return res.status(400).json({
        success: false,
        message: 'No podés deshabilitar tu propia cuenta de administrador.'
      });
    }

    if (esPropiaCuenta && nuevoRol !== 'admin') {
      return res.status(400).json({
        success: false,
        message: 'No podés quitarte a vos mismo el rol de administrador.'
      });
    }

    const quitaAdminActivo = actual.rol === 'admin'
      && actual.estado === 'habilitado'
      && (nuevoRol !== 'admin' || nuevoEstado !== 'habilitado');

    if (quitaAdminActivo) {
      const admins = await contarAdminsHabilitados();
      if (admins <= 1) {
        return res.status(400).json({
          success: false,
          message: 'No se puede deshabilitar ni cambiar de rol al último administrador habilitado.'
        });
      }
    }

    params.push(id);
    await db.query(`UPDATE usuarios SET ${cambios.join(', ')} WHERE id = ?`, params);

    const actualizados = await db.query(
      `SELECT id, nombre, email, rol, estado, creado_en FROM usuarios WHERE id = ?`,
      [id]
    );

    res.json({
      success: true,
      message: 'Usuario actualizado correctamente.',
      usuario: usuarioPublico(actualizados[0])
    });
  } catch (err) {
    next(err);
  }
};
