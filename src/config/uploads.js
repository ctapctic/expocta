const path = require('path');
const fs = require('fs');

// Directorio donde se guardan los archivos subidos.
// En Render se apunta UPLOADS_DIR al disco persistente (ej: /var/data/uploads).
// En local, por defecto, sigue siendo public/uploads.
const uploadsDir = process.env.UPLOADS_DIR
  ? path.resolve(process.env.UPLOADS_DIR)
  : path.join(__dirname, '..', '..', 'public', 'uploads');

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

module.exports = { uploadsDir };
