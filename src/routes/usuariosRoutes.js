const express = require('express');
const router = express.Router();
const usuariosController = require('../controllers/usuarios.controller');
const { requireAdmin } = require('../middleware/authMiddleware');

// La gestión de usuarios es exclusiva del administrador general.
router.get('/', requireAdmin, usuariosController.getAllUsuarios);
router.post('/', requireAdmin, usuariosController.createUsuario);
router.put('/:id', requireAdmin, usuariosController.updateUsuario);

module.exports = router;
