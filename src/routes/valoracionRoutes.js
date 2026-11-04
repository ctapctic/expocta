const express = require('express');
const router = express.Router();
const valoracionController = require('../controllers/valoracionController');

router.post('/proyecto', valoracionController.valorarProyecto);
router.post('/charla', valoracionController.valorarCharla);
router.post('/sync', valoracionController.syncBatchEvaluaciones);
router.get('/stats', valoracionController.getStatsAndRanking);
router.get('/actividad-evento', valoracionController.getLiveEventFeed);

module.exports = router;
