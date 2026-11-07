/**
 * EXPOTECNIA EFTP - MÓDULO DE EVALUACIÓN DE STAND / PROYECTO
 */

let currentProyecto = null;
let miValoracion = null;

document.addEventListener('DOMContentLoaded', async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const standCodigo = urlParams.get('stand') || urlParams.get('codigo') || urlParams.get('id') || 'STAND-101';

  // Estado de la ventana de votación (si falla, se asume abierta).
  if (typeof Ventanas !== 'undefined') {
    try { await Ventanas.cargar(); } catch (_) { /* ignorar */ }
  }

  cargarProyectoParaEvaluacion(standCodigo);
});

/**
 * Carga la valoración propia del usuario para un proyecto (si existe)
 * para poder precargar estrellas y comentario y permitir actualizarla.
 */
async function cargarMiValoracion(proyectoId) {
  const user = getCurrentUser();
  if (!user) {
    miValoracion = null;
    return;
  }
  try {
    const res = await fetch(`/api/auth/resumen/${encodeURIComponent(user.id)}`, {
      headers: { 'x-usuario-id': user.id }
    });
    const data = await res.json();
    if (data.success && data.misProyectos) {
      const v = data.misProyectos.find(p => Number(p.proyecto_id) === Number(proyectoId));
      miValoracion = v || null;
    } else {
      miValoracion = null;
    }
  } catch (err) {
    console.warn('No se pudo cargar la valoración propia:', err);
    miValoracion = null;
  }
}

/**
 * Carga el proyecto desde el backend usando obtenerProyectoPorCodigo
 */
async function cargarProyectoParaEvaluacion(codigo) {
  const container = document.getElementById('evaluar-main-container');
  if (!container) return;

  try {
    const res = await fetch(`/api/proyectos/${encodeURIComponent(codigo)}`);
    const data = await res.json();

    if (!data.success) {
      container.innerHTML = `
        <div class="alert alert-warning text-center my-5 py-4 rounded-4 shadow-sm">
          <i class="bi bi-exclamation-triangle fs-1 d-block mb-2 text-warning"></i>
          <h4 class="fw-bold">Stand No Encontrado</h4>
          <p class="text-muted">${data.message}</p>
          <a href="proyectos.html" class="btn btn-primary rounded-pill mt-2">Volver al Catálogo</a>
        </div>
      `;
      return;
    }

    currentProyecto = data.proyecto;
    await cargarMiValoracion(currentProyecto.id);
    renderProyectoForm(currentProyecto, miValoracion);
  } catch (err) {
    console.error('Error al cargar proyecto:', err);
    container.innerHTML = `
      <div class="alert alert-danger text-center my-5 py-4 rounded-4">
        <i class="bi bi-x-circle fs-1 d-block mb-2"></i>
        <h4 class="fw-bold">Error de Conexión</h4>
        <p>No se pudo establecer comunicación con el servidor. Verifica tu conexión a internet.</p>
      </div>
    `;
  }
}

/**
 * Renderiza la interfaz responsiva de evaluación
 */
function renderProyectoForm(p, miValoracion = null) {
  const container = document.getElementById('evaluar-main-container');
  const trlClass = p.trl_nivel <= 3 ? 'trl-low' : p.trl_nivel <= 6 ? 'trl-mid' : 'trl-high';
  const user = getCurrentUser();
  const yaEvaluo = !!miValoracion;
  const votacionCerrada = typeof Ventanas !== 'undefined' && !Ventanas.abierta('votacion');
  const disabledAttr = (yaEvaluo || votacionCerrada) ? 'disabled' : '';

  // Reproductor dinámico de video pitch o imagen
  let mediaHTML = '';
  if (p.video_pitch_url && p.video_pitch_url.includes('embed')) {
    mediaHTML = `
      <div class="ratio ratio-16x9 rounded-4 overflow-hidden shadow-sm mb-3">
        <iframe src="${p.video_pitch_url}" title="Video Pitch" allowfullscreen></iframe>
      </div>
    `;
  } else {
    const imgUrl = p.imagen_url || 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=80';
    mediaHTML = `
      <div class="rounded-4 overflow-hidden shadow-sm mb-3" style="max-height: 350px;">
        <img src="${imgUrl}" alt="${p.titulo}" class="w-100 h-100 object-fit-cover" onerror="this.src='https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=800&auto=format&fit=crop&q=80'">
      </div>
    `;
  }

  // Campos opcionales de ficha técnica (HTML separado para evitar ternarios dentro de template literal)
  let camposExtraHTML = '';
  if (p.problema_que_resuelve) {
    camposExtraHTML += `
      <div class="col-12 mt-3">
        <span class="small text-muted d-block">Problema que Resuelve:</span>
        <strong class="small text-dark">${p.problema_que_resuelve}</strong>
      </div>`;
  }
  if (p.impacto_ods) {
    camposExtraHTML += `
      <div class="col-12 mt-2">
        <span class="small text-muted d-block">Impacto / ODS Principal:</span>
        <span class="badge bg-primary-subtle text-primary fw-semibold">${p.impacto_ods}</span>
      </div>`;
  }
  if (p.enlace_tecnico_url) {
    camposExtraHTML += `
      <div class="col-12 mt-2">
        <span class="small text-muted d-block">Enlace Técnico / Demo:</span>
        <a href="${p.enlace_tecnico_url}" target="_blank" class="btn btn-sm btn-outline-primary">
          <i class="bi bi-box-arrow-up-right me-1"></i>Abrir enlace
        </a>
      </div>`;
  }
  if (p.requerimientos_exhibicion) {
    camposExtraHTML += `
      <div class="col-12 mt-2">
        <span class="small text-muted d-block">Requerimientos de Exhibición:</span>
        <strong class="small text-dark">${p.requerimientos_exhibicion}</strong>
      </div>`;
  }

  container.innerHTML = `
    <div class="row g-4">
      <!-- COLUMNA IZQUIERDA: INFORMACIÓN Y MEDIA -->
      <div class="col-lg-6">
        <div class="card card-custom p-4 h-100">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <span class="stand-badge position-static fs-6 px-3 py-1"><i class="bi bi-geo-alt-fill me-1"></i>${p.codigo_stand}</span>
            <span class="trl-badge ${trlClass}">TRL ${p.trl_nivel}</span>
          </div>

          <h3 class="fw-bold text-dark mb-2">${p.titulo}</h3>
          <p class="badge bg-primary-subtle text-primary align-self-start mb-3 fs-6">${p.especialidad}</p>

          ${mediaHTML}

          <!-- QR para móvil -->
          <div class="p-3 bg-light rounded-3 mb-3 text-center">
            <small class="text-muted d-block mb-2"><i class="bi bi-qr-code-scan me-1"></i>Escanea con tu móvil</small>
            <img src="https://chart.googleapis.com/chart?chs=120x120&chld=L|0&cht=qr&chl=${encodeURIComponent(window.location.origin + '/evaluar.html?stand=' + p.codigo_stand)}" alt="QR Stand" class="img-fluid" style="max-width: 120px;">
            <small class="text-muted d-block mt-1">${window.location.origin}/evaluar.html?stand=${p.codigo_stand}</small>
          </div>

          <div class="p-3 bg-light rounded-3 mb-3">
            <h6 class="fw-bold mb-1"><i class="bi bi-file-text me-1"></i>Resumen Ejecutivo</h6>
            <p class="small text-muted mb-0">${p.resumen_ejecutivo}</p>
          </div>

          <div class="row g-2 text-start mb-3">
            <div class="col-6">
              <span class="small text-muted d-block">Docente Tutor:</span>
              <strong class="small text-dark">${p.docente_tutor || 'No especificado'}</strong>
            </div>
            <div class="col-6">
              <span class="small text-muted d-block">Tecnologías:</span>
              <strong class="small text-dark">${p.tecnologias_usadas || 'Variadas'}</strong>
            </div>
            <div class="col-12 mt-2">
              <span class="small text-muted d-block">Integrantes:</span>
              <strong class="small text-dark">${p.integrantes || 'Alumnos del Centro'}</strong>
            </div>

            ${camposExtraHTML}
          </div>

          ${p.codigo_stand ? `
            <div class="mt-auto pt-3 border-top">
              <a href="/api/proyectos/poster/${encodeURIComponent(p.codigo_stand)}" target="_blank" class="btn btn-outline-danger btn-sm w-100 fw-bold">
                <i class="bi bi-file-earmark-pdf-fill me-1"></i>Descargar Poster / Ficha Técnica (PDF)
              </a>
            </div>
          ` : ''}
        </div>
      </div>

      <!-- COLUMNA DERECHA: FORMULARIO DE RÚBRICA DE EVALUACIÓN -->
      <div class="col-lg-6">
        <div class="card card-custom p-4 h-100 border-top border-4 border-primary">
          <div class="d-flex justify-content-between align-items-center mb-3">
            <h4 class="fw-bold mb-0 text-primary"><i class="bi bi-check2-circle me-2"></i>Rúbrica de Evaluación</h4>
            <span class="badge bg-warning text-dark"><i class="bi bi-star-fill me-1"></i>Promedio: ${p.promedio} / 5 (${p.total_votos} votos)</span>
          </div>

          ${votacionCerrada ? `
            <div class="alert alert-danger py-2 mb-3 small">
              <i class="bi bi-lock-fill me-1"></i><strong>${Ventanas.mensaje('votacion')}</strong>
              Las valoraciones ya emitidas siguen visibles en el ranking.
            </div>
          ` : ''}

          ${!user ? `
            <div class="alert alert-info py-2 d-flex align-items-center justify-content-between mb-3">
              <span class="small"><i class="bi bi-info-circle me-1"></i>Identifícate para emitir tu calificación oficial.</span>
              <button class="btn btn-sm btn-primary rounded-pill" onclick="showAuthModal()">Ingresar / PIN</button>
            </div>
          ` : `
            <div class="alert alert-light border py-2 mb-3 small d-flex justify-content-between align-items-center">
              <span><strong>Evaluador:</strong> ${user.nombre}</span>
              <span class="badge bg-secondary text-uppercase">${user.rol}</span>
            </div>
          `}

            ${yaEvaluo ? `
              <div class="alert alert-warning py-2 mb-3 d-flex align-items-center justify-content-between">
                <span class="small"><i class="bi bi-info-circle me-1"></i>Ya evaluaste este proyecto (promedio ${((miValoracion.innovacion + miValoracion.dominio_tecnico + miValoracion.presentacion + miValoracion.impacto) / 4).toFixed(1)} / 5). Cada visitante puede emitir una sola valoración por Stand.</span>
              </div>
            ` : ''}
          <form id="form-evaluacion-stand" onsubmit="procesarEvaluacion(event)">
            
            <!-- 1. INNOVACIÓN -->
            <div class="mb-4 p-3 bg-light rounded-3">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <label class="fw-bold text-dark mb-0">1. Nivel de Innovación</label>
                <span class="small text-muted">Originalidad y creatividad</span>
              </div>
              <div class="star-rating fs-3">
                <input type="radio" id="st-inn-5" name="innovacion" value="5"${miValoracion && miValoracion.innovacion == 5 ? ' checked' : ''} ${disabledAttr}><label for="st-inn-5"><i class="bi bi-star-fill"></i></label>
                <input type="radio" id="st-inn-4" name="innovacion" value="4"${miValoracion && miValoracion.innovacion == 4 ? ' checked' : ''} ${disabledAttr}><label for="st-inn-4"><i class="bi bi-star-fill"></i></label>
                <input type="radio" id="st-inn-3" name="innovacion" value="3"${miValoracion && miValoracion.innovacion == 3 ? ' checked' : ''} ${disabledAttr}><label for="st-inn-3"><i class="bi bi-star-fill"></i></label>
                <input type="radio" id="st-inn-2" name="innovacion" value="2"${miValoracion && miValoracion.innovacion == 2 ? ' checked' : ''} ${disabledAttr}><label for="st-inn-2"><i class="bi bi-star-fill"></i></label>
                <input type="radio" id="st-inn-1" name="innovacion" value="1"${miValoracion && miValoracion.innovacion == 1 ? ' checked' : ''} ${disabledAttr}><label for="st-inn-1"><i class="bi bi-star-fill"></i></label>
              </div>
            </div>

            <!-- 2. DOMINIO TÉCNICO -->
            <div class="mb-4 p-3 bg-light rounded-3">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <label class="fw-bold text-dark mb-0">2. Dominio Técnico</label>
                <span class="small text-muted">Manejo conceptual y práctico</span>
              </div>
              <div class="star-rating fs-3">
                <input type="radio" id="st-dom-5" name="dominio_tecnico" value="5"${miValoracion && miValoracion.dominio_tecnico == 5 ? ' checked' : ''} ${disabledAttr}><label for="st-dom-5"><i class="bi bi-star-fill"></i></label>
                <input type="radio" id="st-dom-4" name="dominio_tecnico" value="4"${miValoracion && miValoracion.dominio_tecnico == 4 ? ' checked' : ''} ${disabledAttr}><label for="st-dom-4"><i class="bi bi-star-fill"></i></label>
                <input type="radio" id="st-dom-3" name="dominio_tecnico" value="3"${miValoracion && miValoracion.dominio_tecnico == 3 ? ' checked' : ''} ${disabledAttr}><label for="st-dom-3"><i class="bi bi-star-fill"></i></label>
                <input type="radio" id="st-dom-2" name="dominio_tecnico" value="2"${miValoracion && miValoracion.dominio_tecnico == 2 ? ' checked' : ''} ${disabledAttr}><label for="st-dom-2"><i class="bi bi-star-fill"></i></label>
                <input type="radio" id="st-dom-1" name="dominio_tecnico" value="1"${miValoracion && miValoracion.dominio_tecnico == 1 ? ' checked' : ''} ${disabledAttr}><label for="st-dom-1"><i class="bi bi-star-fill"></i></label>
              </div>
            </div>

            <!-- 3. PRESENTACIÓN -->
            <div class="mb-4 p-3 bg-light rounded-3">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <label class="fw-bold text-dark mb-0">3. Presentación &amp; Pitch</label>
                <span class="small text-muted">Claridad en el Stand y expresión</span>
              </div>
              <div class="star-rating fs-3">
                <input type="radio" id="st-pre-5" name="presentacion" value="5"${miValoracion && miValoracion.presentacion == 5 ? ' checked' : ''} ${disabledAttr}><label for="st-pre-5"><i class="bi bi-star-fill"></i></label>
                <input type="radio" id="st-pre-4" name="presentacion" value="4"${miValoracion && miValoracion.presentacion == 4 ? ' checked' : ''} ${disabledAttr}><label for="st-pre-4"><i class="bi bi-star-fill"></i></label>
                <input type="radio" id="st-pre-3" name="presentacion" value="3"${miValoracion && miValoracion.presentacion == 3 ? ' checked' : ''} ${disabledAttr}><label for="st-pre-3"><i class="bi bi-star-fill"></i></label>
                <input type="radio" id="st-pre-2" name="presentacion" value="2"${miValoracion && miValoracion.presentacion == 2 ? ' checked' : ''} ${disabledAttr}><label for="st-pre-2"><i class="bi bi-star-fill"></i></label>
                <input type="radio" id="st-pre-1" name="presentacion" value="1"${miValoracion && miValoracion.presentacion == 1 ? ' checked' : ''} ${disabledAttr}><label for="st-pre-1"><i class="bi bi-star-fill"></i></label>
              </div>
            </div>

            <!-- 4. IMPACTO SOCIAL -->
            <div class="mb-4 p-3 bg-light rounded-3">
              <div class="d-flex justify-content-between align-items-center mb-2">
                <label class="fw-bold text-dark mb-0">4. Impacto Social &amp; Factibilidad</label>
                <span class="small text-muted">Aplicación productiva real</span>
              </div>
              <div class="star-rating fs-3">
                <input type="radio" id="st-imp-5" name="impacto" value="5"${miValoracion && miValoracion.impacto == 5 ? ' checked' : ''} ${disabledAttr}><label for="st-imp-5"><i class="bi bi-star-fill"></i></label>
                <input type="radio" id="st-imp-4" name="impacto" value="4"${miValoracion && miValoracion.impacto == 4 ? ' checked' : ''} ${disabledAttr}><label for="st-imp-4"><i class="bi bi-star-fill"></i></label>
                <input type="radio" id="st-imp-3" name="impacto" value="3"${miValoracion && miValoracion.impacto == 3 ? ' checked' : ''} ${disabledAttr}><label for="st-imp-3"><i class="bi bi-star-fill"></i></label>
                <input type="radio" id="st-imp-2" name="impacto" value="2"${miValoracion && miValoracion.impacto == 2 ? ' checked' : ''} ${disabledAttr}><label for="st-imp-2"><i class="bi bi-star-fill"></i></label>
                <input type="radio" id="st-imp-1" name="impacto" value="1"${miValoracion && miValoracion.impacto == 1 ? ' checked' : ''} ${disabledAttr}><label for="st-imp-1"><i class="bi bi-star-fill"></i></label>
              </div>
            </div>

            <!-- COMENTARIOS -->
            <div class="mb-4">
              <label class="form-label fw-bold">Comentarios o Feedback para el Equipo (Opcional)</label>
              <textarea id="eval-comentario" class="form-control" rows="3" placeholder="Felicidades por el prototipo..." ${disabledAttr}>${miValoracion && miValoracion.comentario ? miValoracion.comentario : ''}</textarea>
            </div>

            <div class="d-grid">
              <button type="submit" class="btn btn-primary btn-lg fw-bold rounded-pill" ${disabledAttr}>
                <i class="bi bi-send-fill me-2"></i>Enviar Evaluación Oficial
              </button>
            </div>
          </form>

        </div>
      </div>
    </div>
  `;
}

/**
 * Enviar evaluación mediante Fetch API y controlar respuestas
 */
async function procesarEvaluacion(event) {
  event.preventDefault();

  const user = getCurrentUser();
  if (!user) {
    showAuthModal();
    return;
  }

  if (typeof Ventanas !== 'undefined' && !(await Ventanas.bloquear('votacion'))) {
    return;
  }

  const getRadioScore = (name) => {
    const checked = document.querySelector(`input[name="${name}"]:checked`);
    return checked ? parseInt(checked.value, 10) : 3;
  };

  const payload = {
    usuario_id: user.id,
    proyecto_id: currentProyecto.id,
    innovacion: getRadioScore('innovacion'),
    dominio_tecnico: getRadioScore('dominio_tecnico'),
    presentacion: getRadioScore('presentacion'),
    impacto: getRadioScore('impacto'),
    comentario: document.getElementById('eval-comentario').value
  };

  try {
    const res = await fetch('/api/proyectos/evaluar', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (res.ok && data.success) {
      Swal.fire({
        icon: 'success',
        title: '¡Evaluación Registrada!',
        text: data.message,
        confirmButtonColor: '#2563eb'
      }).then(() => {
        cargarProyectoParaEvaluacion(currentProyecto.codigo_stand);
      });
    } else {
      // Manejo de error 400 u otro
      Swal.fire({
        icon: 'warning',
        title: 'Atención',
        text: data.message || 'No se pudo registrar la evaluación. Verifica tu conexión a internet.',
        confirmButtonColor: '#2563eb'
      });
    }
  } catch (err) {
    console.warn('Error de red al enviar evaluación:', err);
    Swal.fire({
      icon: 'error',
      title: 'Error de Conexión',
      text: 'No se pudo enviar la evaluación. Verifica tu conexión a internet e intenta de nuevo.',
      confirmButtonColor: '#ef4444'
    });
  }
}
