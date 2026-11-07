/**
 * EXPOTECNIA EFTP - MÓDULO DE EMPRESAS Y PASANTÍAS
 */

let allEmpresas = [];

document.addEventListener('DOMContentLoaded', () => {
  loadEmpresas();
  setupEmpresaFilters();
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
      allEmpresas = data.empresas || [];
      populateTipoFilter(allEmpresas);
      renderEmpresas(allEmpresas);
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

function populateTipoFilter(empresas) {
  const sel = document.getElementById('tipo-filter-empresas');
  if (!sel) return;
  const tipos = [...new Set(empresas.map(e => e.tipo).filter(Boolean))];
  tipos.forEach(t => {
    const opt = document.createElement('option');
    opt.value = t;
    opt.textContent = t.charAt(0).toUpperCase() + t.slice(1);
    sel.appendChild(opt);
  });
}

function setupEmpresaFilters() {
  const search = document.getElementById('search-empresas');
  const tipo = document.getElementById('tipo-filter-empresas');
  if (search) search.addEventListener('input', applyEmpresaFilters);
  if (tipo) tipo.addEventListener('change', applyEmpresaFilters);
}

function applyEmpresaFilters() {
  const term = (document.getElementById('search-empresas')?.value || '').toLowerCase();
  const tipo = document.getElementById('tipo-filter-empresas')?.value || '';
  const filtered = allEmpresas.filter(e => {
    const matchTerm = !term ||
      (e.nombre_corporativo || '').toLowerCase().includes(term) ||
      (e.codigo_empresa || '').toLowerCase().includes(term) ||
      (e.descripcion || '').toLowerCase().includes(term);
    const matchTipo = !tipo || e.tipo === tipo;
    return matchTerm && matchTipo;
  });
  renderEmpresas(filtered);
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
    const promedio = Number(e.promedio || 0);
    const totalVotos = Number(e.total_votos || 0);
    const estrellas = '★'.repeat(Math.round(promedio)) + '☆'.repeat(5 - Math.round(promedio));

    return `
      <div class="col-md-6 col-lg-4 mb-4">
        <div class="card card-custom h-100">
          <div class="card-body d-flex flex-column text-center p-4">
            <div class="mx-auto mb-3" style="width: 80px; height: 80px; overflow: hidden; border-radius: 50%; border: 2px solid #e2e8f0;">
              <img src="${logoUrl}" alt="${e.nombre_corporativo}" class="w-100 h-100 object-fit-cover" onerror="this.src='https://images.unsplash.com/photo-1560179707-f14e90ef3623?w=300&auto=format&fit=crop&q=80'">
            </div>
            <span class="badge bg-dark-subtle text-dark align-self-center mb-2 fw-bold">${e.codigo_empresa}</span>
            ${e.stand_numero ? `<span class="badge bg-info text-dark align-self-center mb-2"><i class="bi bi-geo-alt-fill me-1"></i>Stand ${e.stand_numero}</span>` : ''}
            ${e.tipo ? `<span class="badge bg-secondary align-self-center mb-2">${e.tipo.charAt(0).toUpperCase() + e.tipo.slice(1)}</span>` : ''}
            <h4 class="card-title fw-bold text-dark mb-2">${e.nombre_corporativo}</h4>
            <p class="small text-muted mb-3 flex-grow-1">${e.descripcion}</p>

            ${totalVotos > 0 ? `
            <div class="mb-3">
              <div class="text-warning fs-5">${estrellas}</div>
              <small class="text-muted">${promedio.toFixed(1)} / 5 · ${totalVotos} evaluación${totalVotos === 1 ? '' : 'es'}</small>
            </div>` : ''}

            <div class="bg-light rounded p-3 text-start mb-3">
              <h6 class="fw-bold text-primary mb-1"><i class="bi bi-briefcase-fill me-1"></i>Ofertas de Pasantía / Empleo</h6>
              <p class="small text-dark mb-2">${e.ofertas_pasantia}</p>
              <h6 class="fw-bold text-secondary mb-1"><i class="bi bi-person-check-fill me-1"></i>Perfil Requerido</h6>
              <p class="small text-muted mb-0">${e.requisitos_perfil}</p>
            </div>

            <div class="d-grid gap-2 mt-auto">
              ${e.catalogo_pdf_url ? `<a href="${e.catalogo_pdf_url}" target="_blank" class="btn btn-outline-primary btn-sm"><i class="bi bi-file-earmark-pdf me-1"></i>Descargar Catálogo / PDF</a>` : `<span class="btn btn-light btn-sm disabled">Catálogo no disponible</span>`}
              <button class="btn btn-primary btn-sm" onclick="evaluarEmpresaModal(${e.id}, '${e.nombre_corporativo.replace(/'/g, "\\'")}')">
                <i class="bi bi-star-fill me-1"></i>Evaluar esta Empresa
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Modal de evaluación de empresa
async function evaluarEmpresaModal(empresaId, nombreEmpresa) {
  const usuario = getCurrentUser();
  if (!usuario) {
    Swal.fire('Inicia sesión', 'Debes ingresar para evaluar.', 'warning');
    return;
  }

  const { value: formValues } = await Swal.fire({
    title: `Evaluar: ${nombreEmpresa}`,
    html: `
      <div class="text-start">
        <div class="mb-3">
          <label class="form-label small fw-bold">Calidad del Servicio</label>
          <select id="swal-calidad" class="form-select form-select-sm">
            <option value="">Seleccionar...</option>
            <option value="1">1 - Deficiente</option>
            <option value="2">2 - Regular</option>
            <option value="3">3 - Bueno</option>
            <option value="4">4 - Muy bueno</option>
            <option value="5">5 - Excelente</option>
          </select>
        </div>
        <div class="mb-3">
          <label class="form-label small fw-bold">Atención</label>
          <select id="swal-atencion" class="form-select form-select-sm">
            <option value="">Seleccionar...</option>
            <option value="1">1 - Deficiente</option>
            <option value="2">2 - Regular</option>
            <option value="3">3 - Bueno</option>
            <option value="4">4 - Muy bueno</option>
            <option value="5">5 - Excelente</option>
          </select>
        </div>
        <div class="mb-3">
          <label class="form-label small fw-bold">Propuesta de Valor</label>
          <select id="swal-propuesta" class="form-select form-select-sm">
            <option value="">Seleccionar...</option>
            <option value="1">1 - Deficiente</option>
            <option value="2">2 - Regular</option>
            <option value="3">3 - Bueno</option>
            <option value="4">4 - Muy bueno</option>
            <option value="5">5 - Excelente</option>
          </select>
        </div>
        <div class="mb-3">
          <label class="form-label small fw-bold">Innovación</label>
          <select id="swal-innovacion" class="form-select form-select-sm">
            <option value="">Seleccionar...</option>
            <option value="1">1 - Deficiente</option>
            <option value="2">2 - Regular</option>
            <option value="3">3 - Bueno</option>
            <option value="4">4 - Muy bueno</option>
            <option value="5">5 - Excelente</option>
          </select>
        </div>
        <div class="mb-3">
          <label class="form-label small fw-bold">Impacto Social y Económico</label>
          <select id="swal-impacto" class="form-select form-select-sm">
            <option value="">Seleccionar...</option>
            <option value="1">1 - Deficiente</option>
            <option value="2">2 - Regular</option>
            <option value="3">3 - Bueno</option>
            <option value="4">4 - Muy bueno</option>
            <option value="5">5 - Excelente</option>
          </select>
        </div>
        <div class="mb-3">
          <label class="form-label small fw-bold">Comentario (opcional)</label>
          <textarea id="swal-comentario" class="form-control form-control-sm" rows="2" placeholder="Tu opinión..."></textarea>
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'Enviar Evaluación',
    cancelButtonText: 'Cancelar',
    preConfirm: () => {
      const calidad = document.getElementById('swal-calidad').value;
      const atencion = document.getElementById('swal-atencion').value;
      const propuesta = document.getElementById('swal-propuesta').value;
      const innovacion = document.getElementById('swal-innovacion').value;
      const impacto = document.getElementById('swal-impacto').value;
      const comentario = document.getElementById('swal-comentario').value;

      if (!calidad || !atencion || !propuesta || !innovacion || !impacto) {
        Swal.showValidationMessage('Todos los criterios son obligatorios.');
        return false;
      }

      return { calidad, atencion, propuesta, innovacion, impacto, comentario };
    }
  });

  if (!formValues) return;

  try {
    const res = await fetch('/api/empresas/evaluar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        usuario_id: usuario.id,
        empresa_id: empresaId,
        calidad_servicio: formValues.calidad,
        atencion: formValues.atencion,
        propuesta_valor: formValues.propuesta,
        innovacion: formValues.innovacion,
        impacto_social_economico: formValues.impacto,
        comentario: formValues.comentario
      })
    });

    const data = await res.json();
    if (data.success) {
      Swal.fire('¡Gracias!', 'Tu evaluación fue registrada.', 'success');
      loadEmpresas();
    } else {
      Swal.fire('Error', data.message, 'error');
    }
  } catch (err) {
    Swal.fire('Error', 'No se pudo registrar la evaluación.', 'error');
  }
}

// getCurrentUser() is provided by app.js (localStorage key: 'expotecnia_user')
