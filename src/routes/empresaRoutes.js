const express = require('express');
const router = express.Router();
const empresaController = require('../controllers/empresaController');
const upload = require('../middleware/multer');
const { requireAdminOrDocente } = require('../middleware/authMiddleware');

router.get('/', empresaController.getAllEmpresas);
router.get('/:identifier', empresaController.getEmpresaByIdOrCode);

// Alta de empresa (Requiere Admin/Docente)
router.post('/', requireAdminOrDocente, upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'catalogo_pdf', maxCount: 1 }
]), empresaController.createEmpresa);

// Actualizar empresa (Requiere Admin/Docente)
router.put('/:id', requireAdminOrDocente, upload.fields([
  { name: 'logo', maxCount: 1 },
  { name: 'catalogo_pdf', maxCount: 1 }
]), empresaController.updateEmpresa);

// Eliminar empresa (Requiere Admin/Docente)
router.delete('/:id', requireAdminOrDocente, empresaController.deleteEmpresa);

module.exports = router;
