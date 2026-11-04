const express = require('express');
const router = express.Router();
const proyectosController = require('../controllers/proyectos.controller');
const upload = require('../middleware/multer');
const { requireAdminOrDocente } = require('../middleware/authMiddleware');

// Leaderboard Top 5
router.get('/leaderboard', proyectosController.obtenerLeaderboard);

// Obtener todos los proyectos
router.get('/', proyectosController.getAllProyectos);

// Obtener por código de Stand o ID
router.get('/:codigo', proyectosController.obtenerProyectoPorCodigo);

// Generar poster PDF dinámico (una sola hoja A4)
router.get('/poster/:codigo', proyectosController.generarPosterPDF);

// Evaluar un proyecto (Cualquier visitante/evaluador)
router.post('/evaluar', proyectosController.evaluarProyecto);

// Crear un proyecto (Requiere permisos de Admin o Docente Tutor)
router.post('/', requireAdminOrDocente, upload.fields([
  { name: 'imagen', maxCount: 1 },
  { name: 'pdf_poster', maxCount: 1 }
]), proyectosController.createProyecto);

// Actualizar un proyecto (Requiere permisos de Admin o Docente Tutor)
router.put('/:id', requireAdminOrDocente, upload.fields([
  { name: 'imagen', maxCount: 1 },
  { name: 'pdf_poster', maxCount: 1 }
]), proyectosController.updateProyecto);

// Eliminar un proyecto (Requiere permisos de Admin o Docente Tutor)
router.delete('/:id', requireAdminOrDocente, proyectosController.deleteProyecto);

module.exports = router;
