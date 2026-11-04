const multer = require('multer');
const path = require('path');
const { uploadsDir } = require('../config/uploads');

// El directorio lo crea/valida src/config/uploads.js

// Configuración de almacenamiento en disco
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generar nombre de archivo único: timestamp + hash aleatorio + extensión limpia
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname).toLowerCase();
    const safeBaseName = path.basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9]/g, '_')
      .substring(0, 30);
    cb(null, `${safeBaseName}-${uniqueSuffix}${ext}`);
  }
});

// Filtro de tipos de archivos permitidos (Imágenes JPG/PNG y Documentos PDF)
const fileFilter = (req, file, cb) => {
  const allowedMimeTypes = [
    'image/jpeg',
    'image/jpg',
    'image/png',
    'image/webp',
    'application/pdf'
  ];

  if (allowedMimeTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Tipo de archivo no permitido. Solo se aceptan imágenes (JPG, PNG, WEBP) y documentos PDF.'), false);
  }
};

// Middleware configurado con límite de 10 MB
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024 // 10 Megabytes
  }
});

module.exports = upload;
