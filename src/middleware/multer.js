const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { uploadsDir } = require('../config/uploads');
const archivosService = require('../services/archivosService');

/**
 * Genera un nombre único y seguro: base limpia + timestamp + aleatorio + extensión.
 * @param {string} originalname
 * @returns {string}
 */
function generarNombre(originalname) {
  const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
  const ext = path.extname(originalname).toLowerCase();
  const safeBaseName = path.basename(originalname, ext)
    .replace(/[^a-zA-Z0-9]/g, '_')
    .substring(0, 30);
  return `${safeBaseName}-${uniqueSuffix}${ext}`;
}

/**
 * Escritura doble: guarda el archivo en disco (comportamiento histórico) y
 * además lo respalda en MariaDB. Si el respaldo falla, la subida igual
 * funciona con el archivo en disco, así que no se rompe nada.
 */
const storage = {
  _handleFile(req, file, cb) {
    const nombre = generarNombre(file.originalname);
    const ruta = path.join(uploadsDir, nombre);
    const chunks = [];
    let tamano = 0;
    let terminado = false;

    const salida = fs.createWriteStream(ruta);

    const abortar = (err) => {
      if (terminado) return;
      terminado = true;
      salida.destroy();
      fs.unlink(ruta, () => cb(err));
    };

    file.stream.on('data', (chunk) => {
      tamano += chunk.length;
      chunks.push(chunk);
    });
    file.stream.on('error', abortar);
    salida.on('error', abortar);

    salida.on('finish', async () => {
      if (terminado) return;
      terminado = true;

      try {
        await archivosService.guardarArchivo({
          nombre,
          mimetype: file.mimetype,
          buffer: Buffer.concat(chunks, tamano)
        });
      } catch (err) {
        // El respaldo en base es opcional: la subida no debe fallar por esto.
        console.warn('⚠️ No se pudo respaldar el archivo en MariaDB (queda solo en disco):', err.message);
      }

      cb(null, { destination: uploadsDir, filename: nombre, path: ruta, size: tamano });
    });

    file.stream.pipe(salida);
  },

  _removeFile(req, file, cb) {
    if (file && file.path) {
      fs.unlink(file.path, () => {});
    }
    if (file && file.filename) {
      archivosService.eliminarArchivo(file.filename).catch(() => {});
    }
    cb(null);
  }
};

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
