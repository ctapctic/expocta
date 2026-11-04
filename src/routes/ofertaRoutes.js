const express = require('express');
const router = express.Router();
const ofertaController = require('../controllers/oferta.controller');
const upload = require('../middleware/multer');
const { requireAdminOrDocente } = require('../middleware/authMiddleware');

router.get('/', ofertaController.getAllOfertas);
router.get('/:identifier', ofertaController.getOfertaByIdOrCode);

// Alta de oferta académica (Requiere Admin/Docente)
router.post('/', requireAdminOrDocente, upload.single('brochure_pdf'), ofertaController.createOferta);

// Actualizar oferta (Requiere Admin/Docente)
router.put('/:id', requireAdminOrDocente, upload.single('brochure_pdf'), ofertaController.updateOferta);

// Eliminar oferta (Requiere Admin/Docente; bloqueada si tiene prospectos)
router.delete('/:id', requireAdminOrDocente, ofertaController.deleteOferta);

// Captación de prospectos (Cualquier visitante)
router.post('/prospecto', ofertaController.registrarProspecto);

module.exports = router;
