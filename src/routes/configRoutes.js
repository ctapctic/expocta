const express = require('express');
const router = express.Router();
const configController = require('../controllers/configController');
const upload = require('../middleware/multer');
const { requireAdmin } = require('../middleware/authMiddleware');

// GET /api/config  — Público: leaderboard, index, etc. lo consumen para mostrar datos institucionales
router.get('/', configController.getConfig);

// GET /api/config/ventanas  — Público: estado de las ventanas de registro y votación
router.get('/ventanas', configController.getVentanas);

// PUT /api/config  — Solo admin: actualiza campos de configuración (acepta logos como archivos o URL)
router.put('/', requireAdmin, upload.fields([
  { name: 'logo_ministerio', maxCount: 1 },
  { name: 'logo_institucion', maxCount: 1 }
]), configController.updateConfig);

module.exports = router;
