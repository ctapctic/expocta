/**
 * URL base pública para generar enlaces absolutos (QR de posters, etc.)
 * Se configura con la variable de entorno PUBLIC_BASE_URL.
 * Fallback a localhost para desarrollo local.
 */
function getPublicBaseUrl() {
  const raw = (process.env.PUBLIC_BASE_URL || '').trim();
  const base = raw || `http://localhost:${process.env.PORT || 3000}`;
  return base.replace(/\/+$/, ''); // quita slash(es) al final
}

function buildStandUrl(codigo) {
  return `${getPublicBaseUrl()}/evaluar.html?stand=${encodeURIComponent(codigo)}`;
}

module.exports = { getPublicBaseUrl, buildStandUrl };
