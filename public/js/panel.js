/**
 * EXPOTECNIA EFTP - PORTAL DEL VISITANTE (TODO EN UNO) CON FEED EN VIVO
 */

document.addEventListener('DOMContentLoaded', () => {
  renderHeaderVisitorInfo();
  loadGlobalStats();
  loadLiveEventFeed();
  loadPanelProyectos();
  loadPanelCharlas();
  loadPanelOfertas();
  loadPanelEmpresas();
  cargarMiResumenPersonal();

  // Polling automático cada 12 segundos para mantener la actividad en vivo sincronizada
  setInterval(() => {
    loadLiveEventFeed();
    loadGlobalStats();
  }, 12000);
});

/**
 * Renderiza la credencial del visitante en el encabezado
 */
function renderHeaderVisitorInfo() {
  const u = getCurrentUser();
  const nameEl = document.getElementById('visitor-name');
  const emailEl = document.getElementById('visitor-email');
  const roleEl = document.getElementById('visitor-role-badge');
  const pinEl = document.getElementById('visitor-pin');

  if (u) {
    if (nameEl) nameEl.textContent = u.nombre;
    if (emailEl) emailEl.textContent = u.email;
    if (roleEl) roleEl.textContent = u.rol.toUpperCase();
    if (pinEl) pinEl.textContent = '••••';
  } else {
    if (nameEl) nameEl.textContent = 'Invitado Expotecnia';
    if (emailEl) emailEl.textContent = 'Presiona ingresar para guardar tu PIN de evaluador';
    if (roleEl) roleEl.textContent = 'VISITANTE';
    if (pinEl) pinEl.textContent = '----';
  }
}

/**
 * Cargar estadísticas globales del evento en vivo
 */
async function loadGlobalStats() {
  try {
    const res = await fetch('/api/valoraciones/stats');
    const data = await res.json();

    if (data.success && data.stats) {
      const s = data.stats;
      const elProy = document.getElementById('stat-proyectos');
      const elEval = document.getElementById('stat-evaluaciones');
      const elChar = document.getElementById('stat-charlas');
      const elOfer = document.getElementById('stat-ofertas');

      if (elProy) elProy.textContent = s.total_proyectos;
      if (elEval) elEval.textContent = s.total_evaluaciones;
      if (elChar) elChar.textContent = s.total_charlas;
      if (elOfer) elOfer.textContent = s.total_ofertas;
    }
  } catch (err) {
    console.error('Error cargando estadísticas globales:', err);
  }
}

/**
 * Cargar Feed dinámico de toda la Actividad del Evento en vivo
 */
async function loadLiveEventFeed() {
  const container = document.getElementById('event-feed-list');
  if (!container) return;

  try {
    const res = await fetch('/api/valoraciones/actividad-evento');
    const data = await res.json();

    if (data.success && data.feed) {
      if (data.feed.length === 0) {
        container.innerHTML = `<div class="p-4 text-center text-muted">Aún no hay actividad registrada en la feria. ¡Sé el primero en evaluar un Stand!</div>`;
        return;
      }

      container.innerHTML = data.feed.map(item => {
        const timeAgo = formatTimeAgo(new Date(item.fecha));
        let badgeIcon = 'bi-star-fill text-warning';
        let actionText = `evaluó el Stand <strong>${item.codigo_stand} - ${item.objeto_titulo}</strong>`;
        let tagColor = 'bg-primary';

        if (item.tipo === 'evaluacion_charla') {
          badgeIcon = 'bi-mic-fill text-info';
          actionText = `calificó la conferencia <strong>${item.objeto_titulo}</strong>`;
          tagColor = 'bg-info text-dark';
        } else if (item.tipo === 'interes_carrera') {
          badgeIcon = 'bi-mortarboard-fill text-success';
          actionText = `solicitó información sobre la carrera <strong>${item.objeto_titulo}</strong>`;
          tagColor = 'bg-success';
        }

        return `
          <div class="list-group-item p-3 d-flex justify-content-between align-items-center bg-white border-bottom">
            <div class="d-flex align-items-center gap-3">
              <div class="fs-4"><i class="bi ${badgeIcon}"></i></div>
              <div>
                <span class="badge ${tagColor} me-1">${item.usuario_rol.toUpperCase()}</span>
                <strong class="text-dark">${item.usuario_nombre}</strong>
                <span class="text-secondary small"> ${actionText}</span>
                <div class="small text-muted mt-1"><i class="bi bi-clock me-1"></i>${timeAgo}</div>
              </div>
            </div>
            ${item.tipo !== 'interes_carrera' ? `
              <span class="badge bg-warning-subtle text-dark border border-warning fw-bold fs-6">
                <i class="bi bi-star-fill text-warning me-1"></i>${item.puntaje} / 5
              </span>
            ` : ''}
          </div>
        `;
      }).join('');
    }
  } catch (err) {
    console.error('Error cargando feed de actividad:', err);
  }
}

/**
 * Ir a evaluar stand rápido por código tipeado
 */
function irAEvaluarStandRapido() {
  const input = document.getElementById('visitor-quick-stand');
  if (!input) return;

  const codigo = input.value.trim().toUpperCase();
  if (!codigo) {
    Swal.fire('Atención', 'Ingresa un código de Stand válido (ej: STAND-101).', 'warning');
    return;
  }

  window.location.href = `evaluar.html?stand=${encodeURIComponent(codigo)}`;
}

/**
 * Cargar listado dinámico de Proyectos para el panel Todo en Uno
 */
async function loadPanelProyectos() {
  const container = document.getElementById('panel-proyectos-container');
  if (!container) return;

  try {
    const res = await fetch('/api/proyectos');
    const data = await res.json();

    if (data.success && data.proyectos) {
      container.innerHTML = data.proyectos.map(p => `
        <div class="col-md-6 col-lg-4 mb-3">
          <div class="card card-custom h-100">
            <div class="card-img-wrapper" style="height: 140px;">
              <img src="${p.imagen_url || 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=500&auto=format&fit=crop&q=80'}" alt="${p.titulo}">
              <span class="stand-badge">${p.codigo_stand}</span>
            </div>
            <div class="card-body p-3 d-flex flex-column">
              <span class="badge bg-primary-subtle text-primary align-self-start mb-1 small">${p.especialidad}</span>
              <h6 class="fw-bold text-dark mb-1">${p.titulo}</h6>
              <div class="mt-auto pt-2 border-top">
                <div class="mb-2">
                  <span class="badge bg-warning text-dark"><i class="bi bi-star-fill me-1"></i>${p.promedio} / 5</span>
                </div>
                <div class="d-flex gap-2">
                  <button onclick="openProyectoDetailModal('${p.codigo_stand}')" class="btn btn-sm btn-outline-primary rounded-pill fw-bold flex-fill" title="Ver ficha completa del proyecto">
                    <i class="bi bi-info-circle me-1"></i>Detalles
                  </button>
                  <a href="evaluar.html?stand=${encodeURIComponent(p.codigo_stand)}" class="btn btn-sm btn-primary rounded-pill fw-bold flex-fill">
                    <i class="bi bi-clipboard-check me-1"></i>Evaluar
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    container.innerHTML = `<div class="col-12 alert alert-warning">No se pudieron cargar los proyectos.</div>`;
  }
}

/**
 * Cargar Charlas para el panel Todo en Uno
 */
async function loadPanelCharlas() {
  const container = document.getElementById('panel-charlas-container');
  if (!container) return;

  try {
    const res = await fetch('/api/charlas');
    const data = await res.json();

    if (data.success && data.charlas) {
      container.innerHTML = data.charlas.map(c => `
        <div class="col-md-6 mb-3">
          <div class="p-3 bg-white rounded-3 border shadow-sm h-100 d-flex flex-column">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <span class="badge bg-dark">${c.codigo_charla}</span>
              <span class="small text-info"><i class="bi bi-clock me-1"></i>${(c.horario_str || '').slice(11, 16) || new Date(c.horario).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</span>
            </div>
            <h6 class="fw-bold text-dark mb-1">${c.titulo}</h6>
            <div class="d-flex align-items-center gap-2 mb-2">
              ${c.foto_expositor_url
                ? `<img src="${c.foto_expositor_url}" alt="Foto de ${c.expositor}" class="rounded-circle flex-shrink-0" style="width:40px;height:40px;object-fit:cover;" onerror="this.style.display='none'">`
                : '<i class="bi bi-person-circle fs-3 text-secondary flex-shrink-0"></i>'}
              <p class="small text-muted mb-0" style="min-width:0;">
                <strong class="text-dark">${c.expositor}</strong> &bull; ${c.ubicacion}
              </p>
            </div>
            <div class="mt-auto pt-2 d-flex justify-content-between align-items-center border-top">
              ${c.diapositivas_pdf_url ? `<a href="${c.diapositivas_pdf_url}" target="_blank" class="btn btn-sm btn-outline-danger py-0 fs-7"><i class="bi bi-file-pdf me-1"></i>Filminas</a>` : '<span></span>'}
              <button onclick="openCharlaEvalModal(${c.id}, '${c.titulo.replace(/'/g, "\\'")}')" class="btn btn-sm btn-outline-primary rounded-pill py-0 fs-7">
                <i class="bi bi-star-fill me-1"></i>Evaluar (${c.promedio_valoracion})
              </button>
            </div>
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    container.innerHTML = `<div class="col-12 alert alert-warning">Error al cargar cronograma de charlas.</div>`;
  }
}

/**
 * Cargar Ofertas Académicas para el panel Todo en Uno
 */
async function loadPanelOfertas() {
  const container = document.getElementById('panel-ofertas-container');
  if (!container) return;

  try {
    const res = await fetch('/api/oferta');
    const data = await res.json();

    if (data.success && data.ofertas) {
      container.innerHTML = data.ofertas.map(o => `
        <div class="col-md-6 mb-3">
          <div class="p-3 bg-white rounded-3 border shadow-sm h-100 d-flex flex-column">
            <div class="d-flex justify-content-between align-items-center mb-1">
              <span class="badge bg-success">${o.codigo_oferta}</span>
              <span class="badge bg-light text-dark border">${o.modalidad}</span>
            </div>
            <h6 class="fw-bold text-dark mb-1">${o.nombre_carrera}</h6>
            <p class="small text-muted mb-2"><i class="bi bi-clock me-1"></i>${o.duracion_horas} horas lectivas</p>
            <div class="mt-auto pt-2 d-flex justify-content-between align-items-center border-top">
              <div class="d-flex flex-wrap gap-1">
                ${o.brochure_pdf_url ? `<a href="${o.brochure_pdf_url}" target="_blank" class="btn btn-sm btn-outline-danger py-0 fs-7"><i class="bi bi-file-pdf me-1"></i>Brochure</a>` : ''}
                ${o.link_informacion_url ? `<a href="${o.link_informacion_url}" target="_blank" rel="noopener noreferrer" class="btn btn-sm btn-outline-info py-0 fs-7"><i class="bi bi-info-circle me-1"></i>Más info</a>` : ''}
              </div>
              <button onclick="openProspectoModal(${o.id}, '${o.nombre_carrera}')" class="btn btn-sm btn-success text-white rounded-pill py-0 fs-7 fw-bold">
                <i class="bi bi-person-plus-fill me-1"></i>Solicitar Info
              </button>
            </div>
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    container.innerHTML = `<div class="col-12 alert alert-warning">Error al cargar la oferta formativa.</div>`;
  }
}

/**
 * Cargar Empresas para el panel Todo en Uno
 */
async function loadPanelEmpresas() {
  const container = document.getElementById('panel-empresas-container');
  if (!container) return;

  try {
    const res = await fetch('/api/empresas');
    const data = await res.json();

    if (data.success && data.empresas) {
      container.innerHTML = data.empresas.map(e => `
        <div class="col-md-6 col-lg-4 mb-3">
          <div class="p-3 bg-white rounded-3 border shadow-sm h-100 d-flex flex-column text-center">
            <h6 class="fw-bold text-dark mb-1">${e.nombre_corporativo}</h6>
            <p class="small text-muted mb-2 flex-grow-1">${e.descripcion.substring(0, 90)}...</p>
            <div class="mt-auto">
              ${e.catalogo_pdf_url ? `<a href="${e.catalogo_pdf_url}" target="_blank" class="btn btn-sm btn-outline-dark w-100"><i class="bi bi-file-pdf me-1"></i>Ver Catálogo PDF</a>` : ''}
            </div>
          </div>
        </div>
      `).join('');
    }
  } catch (err) {
    container.innerHTML = `<div class="col-12 alert alert-warning">Error al cargar catálogo de empresas.</div>`;
  }
}

/**
 * Cargar el resumen personal del visitante autenticado
 */
async function cargarMiResumenPersonal() {
  const container = document.getElementById('panel-actividad-container');
  if (!container) return;

  const u = getCurrentUser();
  if (!u) {
    container.innerHTML = `
      <div class="alert alert-info text-center py-4 rounded-4">
        <i class="bi bi-person-lock fs-2 d-block mb-2"></i>
        <h5>Inicia Sesión para ver tu Historial Personal</h5>
        <p class="small text-muted mb-3">Podrás ver los proyectos que has calificado, tus charlas evaluadas y solicitudes de admisión.</p>
        <button onclick="showAuthModal()" class="btn btn-primary rounded-pill btn-sm fw-bold">Ingresar con Email / PIN</button>
      </div>
    `;
    return;
  }

  try {
    const res = await fetch(`/api/auth/resumen/${u.id}`, { headers: { 'x-usuario-id': u.id } });
    const data = await res.json();

    if (!data.success) {
      container.innerHTML = `<div class="alert alert-danger">${data.message}</div>`;
      return;
    }

    const { misProyectos, misCharlas, misIntereses } = data;

    let proyectosHTML = misProyectos.length === 0 ? '<p class="small text-muted mb-0">No has evaluado ningún proyecto todavía.</p>' :
      misProyectos.map(p => `
        <div class="d-flex justify-content-between align-items-center p-2 bg-light rounded mb-2">
          <div>
            <strong class="small text-dark">${p.codigo_stand} - ${p.titulo}</strong>
            <div class="small text-muted">${p.especialidad}</div>
          </div>
          <span class="badge bg-warning text-dark"><i class="bi bi-star-fill me-1"></i>Mi Nota: ${p.promedio}</span>
        </div>
      `).join('');

    let charlasHTML = misCharlas.length === 0 ? '<p class="small text-muted mb-0">No has calificado ninguna charla.</p>' :
      misCharlas.map(c => `
        <div class="d-flex justify-content-between align-items-center p-2 bg-light rounded mb-2">
          <div>
            <strong class="small text-dark">${c.codigo_charla} - ${c.titulo}</strong>
            <div class="small text-muted">Expositor: ${c.expositor}</div>
          </div>
          <span class="badge bg-info text-dark"><i class="bi bi-star-fill me-1"></i>Nota: ${c.promedio}</span>
        </div>
      `).join('');

    let interesesHTML = misIntereses.length === 0 ? '<p class="small text-muted mb-0">No has solicitado información de carreras aún.</p>' :
      misIntereses.map(i => `
        <div class="d-flex justify-content-between align-items-center p-2 bg-light rounded mb-2">
          <div>
            <strong class="small text-dark">${i.codigo_oferta} - ${i.nombre_carrera}</strong>
            <div class="small text-muted">Contacto: ${i.telefono}</div>
          </div>
          <span class="badge bg-success">Solicitado</span>
        </div>
      `).join('');

    container.innerHTML = `
      <div class="row g-4">
        <div class="col-md-4">
          <div class="p-3 bg-white rounded-3 border h-100 shadow-sm">
            <h6 class="fw-bold text-primary mb-3"><i class="bi bi-diagram-3 me-2"></i>Mis Proyectos Evaluados (${misProyectos.length})</h6>
            ${proyectosHTML}
          </div>
        </div>
        <div class="col-md-4">
          <div class="p-3 bg-white rounded-3 border h-100 shadow-sm">
            <h6 class="fw-bold text-info mb-3"><i class="bi bi-mic me-2"></i>Mis Charlas Calificadas (${misCharlas.length})</h6>
            ${charlasHTML}
          </div>
        </div>
        <div class="col-md-4">
          <div class="p-3 bg-white rounded-3 border h-100 shadow-sm">
            <h6 class="fw-bold text-success mb-3"><i class="bi bi-mortarboard me-2"></i>Mis Solicitudes de Carrera (${misIntereses.length})</h6>
            ${interesesHTML}
          </div>
        </div>
      </div>
    `;

  } catch (err) {
    container.innerHTML = `<div class="alert alert-warning">No se pudo cargar el historial personal.</div>`;
  }
}

/**
 * Helper para formatear tiempo transcurrido (hace X minutos)
 */
function formatTimeAgo(date) {
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return 'Hace un momento';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `Hace ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `Hace ${hours} h`;
  return date.toLocaleDateString();
}
