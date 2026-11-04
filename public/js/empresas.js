/**
 * EXPOTECNIA EFTP - MÓDULO DE EMPRESAS Y PASANTÍAS
 */

document.addEventListener('DOMContentLoaded', () => {
  loadEmpresas();
});

async function loadEmpresas() {
  const container = document.getElementById('empresas-container');
  if (!container) return;

  container.innerHTML = `
    <div class="col-12 text-center py-5">
      <div class="spinner-border text-primary" role="status"></div>
      <p class="mt-2 text-muted">Cargando empresas aliadas y ofertas de empleo/pasantía...</p>
    </div>
  `;

  try {
    const res = await fetch('/api/empresas');
    const data = await res.json();

    if (data.success) {
      renderEmpresas(data.empresas);
    } else {
      container.innerHTML = `<div class="col-12 alert alert-danger">${data.message}</div>`;
    }
  } catch (err) {
    container.innerHTML = `
      <div class="col-12 alert alert-warning text-center py-4">
        <h5>Error de conexión con el catálogo de empresas</h5>
      </div>
    `;
  }
}

function renderEmpresas(empresas) {
  const container = document.getElementById('empresas-container');
  if (!container) return;

  if (empresas.length === 0) {
    container.innerHTML = `<div class="col-12 text-center text-muted py-5">No hay empresas registradas aún.</div>`;
    return;
  }

  container.innerHTML = empresas.map(e => {
    const logoUrl = e.logo_url || 'https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=300&auto=format&fit=crop&q=80';

    return `
      <div class="col-md-6 col-lg-4 mb-4">
        <div class="card card-custom h-100">
          <div class="card-body d-flex flex-column text-center p-4">
            <div class="mx-auto mb-3" style="width: 80px; height: 80px; overflow: hidden; border-radius: 50%; border: 2px solid #e2e8f0;">
              <img src="${logoUrl}" alt="${e.nombre_corporativo}" class="w-100 h-100 object-fit-cover" onerror="this.src='https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=300&auto=format&fit=crop&q=80'">
            </div>
            <span class="badge bg-dark-subtle text-dark align-self-center mb-2 fw-bold">${e.codigo_empresa}</span>
            <h4 class="card-title fw-bold text-dark mb-2">${e.nombre_corporativo}</h4>
            <p class="small text-muted mb-3 flex-grow-1">${e.descripcion}</p>

            <div class="bg-light rounded p-3 text-start mb-3">
              <h6 class="fw-bold text-primary mb-1"><i class="bi bi-briefcase-fill me-1"></i>Ofertas de Pasantía / Empleo</h6>
              <p class="small text-dark mb-2">${e.ofertas_pasantia}</p>
              <h6 class="fw-bold text-secondary mb-1"><i class="bi bi-person-check-fill me-1"></i>Perfil Requerido</h6>
              <p class="small text-muted mb-0">${e.requisitos_perfil}</p>
            </div>

            <div class="d-grid mt-auto">
              ${e.catalogo_pdf_url ? `<a href="${e.catalogo_pdf_url}" target="_blank" class="btn btn-outline-primary btn-sm"><i class="bi bi-file-earmark-pdf me-1"></i>Descargar Catálogo / PDF</a>` : `<span class="btn btn-light btn-sm disabled">Catálogo no disponible</span>`}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}
