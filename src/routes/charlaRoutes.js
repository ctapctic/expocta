const express = require('express');
const router = express.Router();
const charlaController = require('../controllers/charlaController');
const upload = require('../middleware/multer');
const { requireAdminOrDocente } = require('../middleware/authMiddleware');

router.get('/', charlaController.getAllCharlas);
router.get('/:identifier', charlaController.getCharlaByIdOrCode);

// Agendar charla (Requiere Admin/Docente)
router.post('/', requireAdminOrDocente, upload.fields([
  { name: 'diapositivas_pdf', maxCount: 1 },
  { name: 'foto_expositor', maxCount: 1 }
]), charlaController.createCharla);

// Actualizar charla (Requiere Admin/Docente)
router.put('/:id', requireAdminOrDocente, upload.fields([
  { name: 'diapositivas_pdf', maxCount: 1 },
  { name: 'foto_expositor', maxCount: 1 }
]), charlaController.updateCharla);

// Eliminar charla (Requiere Admin/Docente)
router.delete('/:id', requireAdminOrDocente, charlaController.deleteCharla);

module.exports = router;
