/**
 * EXPOTECNIA EFTP - MÓDULO DE CHARLAS Y CONFERENCIAS
 */

document.addEventListener('DOMContentLoaded', () => {
  loadCharlas();
});

async function loadCharlas() {
  const container = document.getElementById('charlas-container');
  if (!container) return;

  container.innerHTML = `
    <div class="col-12 text-center py-5">
      <div class="spinner-border text-primary" role="status"></div>
      <p class="mt-2 text-muted">Cargando cronograma de charlas...</p>
    </div>
  `;

  try {
    const res = await fetch('/api/charlas');
    const data = await res.json();

    if (data.success) {
      renderCharlas(data.charlas);
    } else {
      container.innerHTML = `<div class="col-12 alert alert-danger">${data.message}</div>`;
    }
  } catch (err) {
    container.innerHTML = `
      <div class="col-12 alert alert-warning text-center py-4">
        <h5>Error de conexión con el cronograma de charlas</h5>
      </div>
    `;
  }
}

function renderCharlas(charlas) {
  const container = document.getElementById('charlas-container');
  if (!container) return;

  if (charlas.length === 0) {
    container.innerHTML = `<div class="col-12 text-center text-muted py-5">No hay charlas programadas.</div>`;
    return;
  }

  function fmtFechaHora(iso) {
    if (!iso) return '—';
    const s = String(iso).replace('T', ' ').replace('.000Z', '').replace('Z', '');
    const [fecha, hora] = s.split(' ');
    if (!fecha || !hora) return s;
    const [a, m, d] = fecha.split('-');
    const [h, min] = hora.split(':');
    return `${d}/${m}/${a} ${h}:${min}`;
  }

  container.innerHTML = charlas.map(c => {
    const fechaHora = fmtFechaHora(c.horario_str || c.horario);

    return `
      <div class="col-md-6 mb-4">
        <div class="card card-custom h-100">
          <div class="card-header bg-dark text-white d-flex justify-content-between align-items-center py-3">
            <span class="badge bg-primary fw-bold">${c.codigo_charla}</span>
            <span class="small text-info"><i class="bi bi-clock me-1"></i>${fechaHora}</span>
          </div>
          <div class="card-body d-flex flex-column">
            <span class="badge bg-secondary-subtle text-secondary align-self-start mb-2">${c.eje_tematico}</span>
            <h5 class="card-title fw-bold text-dark mb-2">${c.titulo}</h5>
            
            <div class="mb-3">
              <div class="d-flex align-items-center gap-3">
                ${c.foto_expositor_url
                  ? `<img src="${c.foto_expositor_url}" alt="Foto de ${c.expositor}" class="rounded-circle border flex-shrink-0" style="width:56px;height:56px;object-fit:cover;" onerror="this.style.display='none'">`
                  : '<i class="bi bi-person-circle fs-1 text-secondary flex-shrink-0"></i>'}
                <div>
                  <p class="small mb-1"><strong>Expositor:</strong> ${c.expositor}</p>
                  <p class="small text-muted mb-0">${c.biografia_expositor}</p>
                </div>
              </div>
              <p class="small mt-2 mb-0"><strong>Ubicación:</strong> <i class="bi bi-geo-alt me-1 text-danger"></i>${c.ubicacion}</p>
            </div>

            <div class="d-flex align-items-center justify-content-between border-top pt-3 mt-auto">
              <div class="small">
                ${c.diapositivas_pdf_url ? `<a href="${c.diapositivas_pdf_url}" target="_blank" class="btn btn-sm btn-outline-danger"><i class="bi bi-file-earmark-slides me-1"></i>Diapositivas PDF</a>` : ''}
              </div>
              <button onclick="openCharlaEvalModal(${c.id}, '${c.titulo.replace(/'/g, "\\'")}')" class="btn btn-primary btn-sm rounded-pill fw-bold">
                <i class="bi bi-star-fill me-1"></i>Evaluar Charla (${c.promedio_valoracion})
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Modal interactivo para evaluar Charla
 */
function openCharlaEvalModal(charlaId, charlaTitulo) {
  const user = getCurrentUser();

  Swal.fire({
    title: `🎤 Evaluar Charla`,
    html: `
      <p class="text-muted small mb-3">${charlaTitulo}</p>
      ${!user ? `
        <div class="alert alert-info py-2 d-flex align-items-center justify-content-between mb-3">
          <span class="small"><i class="bi bi-info-circle me-1"></i>Ingresa con tu email/PIN para votar.</span>
          <button class="btn btn-sm btn-primary" onclick="showAuthModal()">Ingresar</button>
        </div>
      ` : ''}

      <form id="charla-eval-form" class="text-start">
        <div class="row g-3 mb-3">
          <div class="col-6 text-center">
            <label class="form-label small fw-bold">Calidad del Contenido</label>
            <div class="star-rating justify-content-center">
              <input type="radio" id="ch-c5" name="nota_contenido" value="5"><label for="ch-c5"><i class="bi bi-star-fill"></i></label>
              <input type="radio" id="ch-c4" name="nota_contenido" value="4"><label for="ch-c4"><i class="bi bi-star-fill"></i></label>
              <input type="radio" id="ch-c3" name="nota_contenido" value="3" checked><label for="ch-c3"><i class="bi bi-star-fill"></i></label>
              <input type="radio" id="ch-c2" name="nota_contenido" value="2"><label for="ch-c2"><i class="bi bi-star-fill"></i></label>
              <input type="radio" id="ch-c1" name="nota_contenido" value="1"><label for="ch-c1"><i class="bi bi-star-fill"></i></label>
            </div>
          </div>
          <div class="col-6 text-center">
            <label class="form-label small fw-bold">Dominio del Expositor</label>
            <div class="star-rating justify-content-center">
              <input type="radio" id="ch-e5" name="nota_expositor" value="5"><label for="ch-e5"><i class="bi bi-star-fill"></i></label>
              <input type="radio" id="ch-e4" name="nota_expositor" value="4"><label for="ch-e4"><i class="bi bi-star-fill"></i></label>
              <input type="radio" id="ch-e3" name="nota_expositor" value="3" checked><label for="ch-e3"><i class="bi bi-star-fill"></i></label>
              <input type="radio" id="ch-e2" name="nota_expositor" value="2"><label for="ch-e2"><i class="bi bi-star-fill"></i></label>
              <input type="radio" id="ch-e1" name="nota_expositor" value="1"><label for="ch-e1"><i class="bi bi-star-fill"></i></label>
            </div>
          </div>
        </div>
        <div class="mb-2">
          <textarea id="charla-comentario" class="form-control" rows="2" placeholder="Comentario o sugerencias..."></textarea>
        </div>
      </form>
    `,
    showCancelButton: true,
    confirmButtonText: 'Enviar Calificación',
    confirmButtonColor: '#2563eb',
    cancelButtonText: 'Cancelar',
    preConfirm: () => {
      const u = getCurrentUser();
      if (!u) {
        showAuthModal();
        return false;
      }

      const getRadioVal = (name) => {
        const el = document.querySelector(`input[name="${name}"]:checked`);
        return el ? parseInt(el.value, 10) : 3;
      };

      const payload = {
        usuario_id: u.id,
        charla_id: charlaId,
        nota_contenido: getRadioVal('nota_contenido'),
        nota_expositor: getRadioVal('nota_expositor'),
        comentario: document.getElementById('charla-comentario').value
      };

      return sendCharlaRating(payload);
    }
  });
}

async function sendCharlaRating(payload) {
  try {
    const res = await fetch('/api/valoraciones/charla', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success) {
      Swal.fire({
        icon: 'success',
        title: '¡Gracias por tu opinión!',
        text: data.message,
        timer: 2000,
        showConfirmButton: false
      });
      loadCharlas();
      return true;
    } else {
      Swal.showValidationMessage(data.message);
      return false;
    }
  } catch (err) {
    console.warn('Error de red al enviar calificación:', err);
    Swal.fire({
      icon: 'error',
      title: 'Error de Conexión',
      text: 'No se pudo enviar la calificación. Verifica tu conexión a internet e intenta de nuevo.',
      confirmButtonColor: '#ef4444'
    });
    return false;
  }
}
