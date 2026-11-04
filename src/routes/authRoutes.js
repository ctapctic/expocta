const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');

router.post('/login', authController.loginOrRegister);
router.get('/perfil/:id', authController.getProfile);
router.get('/resumen/:id', authController.getVisitorSummary);

module.exports = router;
