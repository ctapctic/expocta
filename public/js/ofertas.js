/**
 * EXPOTECNIA EFTP - MÓDULO DE OFERTA FORMATIVA Y CAPTACIÓN DE PROSPECTOS
 */

document.addEventListener('DOMContentLoaded', () => {
  loadOfertas();
});

async function loadOfertas() {
  const container = document.getElementById('ofertas-container');
  if (!container) return;

  container.innerHTML = `
    <div class="col-12 text-center py-5">
      <div class="spinner-border text-info" role="status"></div>
      <p class="mt-2 text-muted">Cargando carreras de EFTP...</p>
    </div>
  `;

  try {
    const res = await fetch('/api/oferta');
    const data = await res.json();

    if (data.success) {
      renderOfertas(data.ofertas);
    } else {
      container.innerHTML = `<div class="col-12 alert alert-danger">${data.message}</div>`;
    }
  } catch (err) {
    container.innerHTML = `
      <div class="col-12 alert alert-warning text-center py-4">
        <h5>Error de conexión con la oferta académica</h5>
        <p class="mb-0">Asegúrate de que la base de datos MariaDB esté activa.</p>
      </div>
    `;
  }
}

function renderOfertas(ofertas) {
  const container = document.getElementById('ofertas-container');
  if (!container) return;

  if (ofertas.length === 0) {
    container.innerHTML = `<div class="col-12 text-center text-muted py-5">No hay carreras registradas aún.</div>`;
    return;
  }

  container.innerHTML = ofertas.map(o => `
    <div class="col-lg-6 mb-4">
      <div class="card card-custom h-100 border-start border-4 border-info">
        <div class="card-body d-flex flex-column">
          <div class="d-flex justify-content-between align-items-start mb-2">
            <span class="badge bg-dark text-info fw-bold fs-6">${o.codigo_oferta}</span>
            <span class="badge bg-info-subtle text-info-emphasis fw-bold">${o.modalidad}</span>
          </div>
          <h4 class="card-title fw-bold text-dark mb-3">${o.nombre_carrera}</h4>
          
          <div class="mb-3">
            <p class="small mb-1"><strong>Duración:</strong> <i class="bi bi-clock me-1 text-primary"></i>${o.duracion_horas} horas lectivas</p>
            <p class="small mb-2"><strong>Perfil de Egreso:</strong> ${o.perfil_egreso}</p>
            <p class="small mb-0 text-muted"><strong>Requisitos:</strong> ${o.requisitos_admision}</p>
          </div>

          <div class="d-flex flex-wrap gap-2 align-items-center justify-content-between border-top pt-3 mt-auto">
            <div>
              ${o.brochure_pdf_url ? `<a href="${o.brochure_pdf_url}" target="_blank" class="btn btn-sm btn-outline-danger"><i class="bi bi-file-earmark-pdf me-1"></i>Brochure PDF</a>` : ''}
              ${o.video_lab_url ? `<a href="${o.video_lab_url}" target="_blank" class="btn btn-sm btn-outline-primary"><i class="bi bi-youtube me-1"></i>Recorrido Lab</a>` : ''}
              ${o.link_informacion_url ? `<a href="${o.link_informacion_url}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-info"><i class="bi bi-info-circle me-1"></i>Más información</a>` : ''}
            </div>
            <button onclick="openProspectoModal(${o.id}, '${o.nombre_carrera}')" class="btn btn-info text-white btn-sm fw-bold">
              <i class="bi bi-person-plus-fill me-1"></i>Solicitar Info / Inscribirme
            </button>
          </div>
        </div>
      </div>
    </div>
  `).join('');
}

/**
 * Modal interactivo para captar prospecto interesado en la carrera
 */
async function openProspectoModal(ofertaId, carreraNombre) {
  const user = getCurrentUser();

  if (typeof Ventanas !== 'undefined' && !(await Ventanas.bloquear('registro'))) {
    return;
  }

  Swal.fire({
    title: `🎓 Solicitar Información`,
    html: `
      <p class="text-muted small">Interés en: <strong>${carreraNombre}</strong></p>
      <form id="prospecto-form" class="text-start">
        ${!user ? `
          <div class="mb-3">
            <label class="form-label fw-bold">Tu Correo Electrónico</label>
            <input type="email" id="prospect-email" class="form-control" placeholder="tu@correo.com" required>
          </div>
          <div class="mb-3">
            <label class="form-label fw-bold">Tu Nombre</label>
            <input type="text" id="prospect-name" class="form-control" placeholder="Nombre completo" required>
          </div>
        ` : `
          <div class="alert alert-light border mb-3">
            <strong>Inscribiendo a:</strong> ${user.nombre} (${user.email})
          </div>
        `}
        <div class="mb-3">
          <label class="form-label fw-bold">Teléfono / WhatsApp de Contacto</label>
          <input type="tel" id="prospect-phone" class="form-control" placeholder="+54 9 11 1234 5678" required>
        </div>
        <div class="mb-3">
          <label class="form-label fw-bold">Comentarios o Preguntas (Opcional)</label>
          <textarea id="prospect-comment" class="form-control" rows="2" placeholder="Turno de preferencia, homologaciones..."></textarea>
        </div>
      </form>
    `,
    showCancelButton: true,
    confirmButtonText: 'Enviar Solicitud',
    confirmButtonColor: '#06b6d4',
    cancelButtonText: 'Cancelar',
    preConfirm: async () => {
      const phone = document.getElementById('prospect-phone').value;
      const comment = document.getElementById('prospect-comment').value;

      if (!phone) {
        Swal.showValidationMessage('El número de teléfono es obligatorio.');
        return false;
      }

      let userId;
      const u = getCurrentUser();

      if (u) {
        userId = u.id;
      } else {
        const email = document.getElementById('prospect-email').value;
        const nombre = document.getElementById('prospect-name').value;

        if (!email) {
          Swal.showValidationMessage('El email es requerido.');
          return false;
        }

        try {
          const authRes = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, nombre, rol: 'visitante' })
          });
          const authData = await authRes.json();

          if (!authData.success) throw new Error(authData.message);

          setCurrentUser(authData.usuario);
          userId = authData.usuario.id;
        } catch (err) {
          Swal.showValidationMessage(err.message);
          return false;
        }
      }

      try {
        const res = await fetch('/api/oferta/prospecto', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            usuario_id: userId,
            oferta_id: ofertaId,
            telefono: phone,
            comentario: comment
          })
        });

        const data = await res.json();
        if (!data.success) {
          throw new Error(data.message);
        }
        return data;
      } catch (err) {
        Swal.showValidationMessage(err.message);
        return false;
      }
    }
  }).then((res) => {
    if (res.isConfirmed && res.value) {
      Swal.fire({
        icon: 'success',
        title: '¡Solicitud Recibida!',
        text: res.value.message,
        confirmButtonColor: '#06b6d4'
      });
    }
  });
}
