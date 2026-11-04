/**
 * EXPOTECNIA EFTP - MÓDULO DE ADMINISTRACIÓN CON CONTROL DE ACCESO (RBAC)
 */

document.addEventListener('DOMContentLoaded', () => {
  verifyAdminOrDocenteAccess();
});

/**
 * Verifica si el usuario en sesión tiene rol 'admin' o 'docente'.
 * Si no cuenta con el rol, despliega el modal de ingreso de credenciales.
 */
function verifyAdminOrDocenteAccess() {
  const u = getCurrentUser();

  if (u && (u.rol === 'admin' || u.rol === 'docente')) {
    initAdminDashboard(u);
  } else {
    Swal.fire({
      title: '🔒 Control de Acceso Requerido',
      text: 'El Panel de Gestión está reservado para Administradores Generales y Docentes Tutores. Por favor ingresa tus credenciales con PIN.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Ingresar como Admin / Docente',
      confirmButtonColor: '#ef4444',
      cancelButtonText: 'Ir a Inicio'
    }).then((res) => {
      if (res.isConfirmed) {
        showAuthModal('admin', (newAuthUser) => {
          if (newAuthUser && (newAuthUser.rol === 'admin' || newAuthUser.rol === 'docente')) {
            initAdminDashboard(newAuthUser);
          } else {
            Swal.fire('Acceso Denegado', `El rol '${newAuthUser.rol}' no posee permisos de administración.`, 'error').then(() => {
              window.location.href = 'index.html';
            });
          }
        });
      } else {
        window.location.href = 'index.html';
      }
    });
  }
}

/**
 * Inicializa los componentes del panel tras validar permisos
 */
function initAdminDashboard(user) {
  const badgeEl = document.getElementById('admin-user-badge');
  if (badgeEl) {
    badgeEl.innerHTML = `
      <span class="badge ${user.rol === 'admin' ? 'bg-danger' : 'bg-primary'} fs-6 me-2">${user.rol.toUpperCase()}</span>
      <strong>${user.nombre}</strong> (${user.email})
    `;
  }

  const btnConfig = document.getElementById('btn-config-sistema');
  if (btnConfig && user.rol === 'admin') btnConfig.classList.remove('d-none');

  const tabUsuarios = document.getElementById('nav-usuarios-item');
  if (tabUsuarios && user.rol === 'admin') tabUsuarios.classList.remove('d-none');

  loadAdminStats();
  loadAdminListings();
  setupFormListeners();

  if (user.rol === 'admin') {
    setupUsuariosForm();
    loadUsuarios();
  }
}

/**
 * Carga estadísticas y ranking top 5
 */
async function loadAdminStats() {
  const statsContainer = document.getElementById('admin-stats');
  if (!statsContainer) return;

  try {
    const res = await fetch('/api/valoraciones/stats');
    const data = await res.json();

    if (data.success) {
      const s = data.stats;
      statsContainer.innerHTML = `
        <div class="col-6 col-md-3 mb-3">
          <div class="p-3 bg-primary text-white rounded-4 text-center shadow-sm">
            <h2 class="fw-bold mb-0">${s.total_proyectos}</h2>
            <span class="small">Proyectos</span>
          </div>
        </div>
        <div class="col-6 col-md-3 mb-3">
          <div class="p-3 bg-info text-dark rounded-4 text-center shadow-sm">
            <h2 class="fw-bold mb-0">${s.total_charlas}</h2>
            <span class="small">Charlas</span>
          </div>
        </div>
        <div class="col-6 col-md-3 mb-3">
          <div class="p-3 bg-success text-white rounded-4 text-center shadow-sm">
            <h2 class="fw-bold mb-0">${s.total_ofertas}</h2>
            <span class="small">Ofertas EFTP</span>
          </div>
        </div>
        <div class="col-6 col-md-3 mb-3">
          <div class="p-3 bg-warning text-dark rounded-4 text-center shadow-sm">
            <h2 class="fw-bold mb-0">${s.total_evaluaciones}</h2>
            <span class="small">Valoraciones Totales</span>
          </div>
        </div>
      `;

      // Render Ranking Top 5
      const rankingContainer = document.getElementById('top-ranking-list');
      if (rankingContainer && data.topProyectos) {
        rankingContainer.innerHTML = data.topProyectos.map((p, index) => `
          <li class="list-group-item d-flex justify-content-between align-items-center py-3">
            <div>
              <span class="badge bg-dark rounded-circle me-2">#${index + 1}</span>
              <strong class="text-dark fs-6">${p.titulo}</strong>
              <span class="badge bg-secondary ms-2">${p.codigo_stand}</span>
              <div class="small text-muted">${p.especialidad}</div>
            </div>
            <div class="text-end">
              <span class="badge bg-warning text-dark fs-6"><i class="bi bi-star-fill me-1"></i>${p.promedio_general}</span>
              <div class="small text-muted">${p.total_votos} votos</div>
            </div>
          </li>
        `).join('');
      }
    }
  } catch (err) {
    console.error('Error al obtener estadísticas:', err);
  }
}

/**
 * Motor CRUD genérico para las entidades de la expo (proyectos, ofertas, charlas, empresas)
 */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

const CRUD_ENTIDADES = {
  proyectos: {
    endpoint: '/api/proyectos',
    dataKey: 'proyectos',
    form: 'form-add-proyecto',
    lista: 'lista-proyectos',
    tituloForm: 'titulo-form-proyectos',
    textoNuevo: 'Nuevo Stand / Proyecto',
    iconoNuevo: 'bi-plus-circle-fill text-primary',
    textoBotonNuevo: '<i class="bi bi-cloud-upload me-1"></i>Guardar Proyecto',
    mensajeExitoTitulo: '¡Proyecto Registrado!',
    mensajeError: 'No se pudo registrar el proyecto.',
    etiqueta: (r) => `${r.codigo_stand} — ${r.titulo}`,
    textoEditando: (r) => `Editando: ${r.codigo_stand} — ${r.titulo}`,
    avisoBorrado: 'Las valoraciones recibidas por este proyecto también se eliminarán.',
    columnas: [
      { titulo: 'Código', campo: 'codigo_stand' },
      { titulo: 'Título', campo: 'titulo' },
      { titulo: 'Especialidad', campo: 'especialidad', badge: 'bg-secondary' },
      { titulo: 'Aplicación', campo: 'sector_aplicacion' },
      { titulo: 'Promedio', campo: 'promedio', badge: 'bg-warning text-dark' },
      {
        titulo: 'Foto',
        campo: 'imagen_ok',
        html: (r) => (r.imagen_ok
          ? '<span class="badge bg-success-subtle text-success border border-success-subtle"><i class="bi bi-check-lg me-1"></i>OK</span>'
          : '<span class="badge bg-danger-subtle text-danger border border-danger-subtle"><i class="bi bi-exclamation-triangle me-1"></i>Falta</span>')
      }
    ],
    campos: ['codigo_stand', 'titulo', 'especialidad', 'sector_aplicacion', 'impacto_ods', 'resumen_ejecutivo', 'problema_que_resuelve', 'trl_nivel', 'tecnologias_usadas', 'integrantes', 'docente_tutor', 'video_pitch_url', 'enlace_tecnico_url', 'requerimientos_exhibicion'],
    archivos: { imagen: (r) => r.imagen_url, pdf_poster: (r) => r.pdf_poster_url }
  },
  ofertas: {
    endpoint: '/api/oferta',
    dataKey: 'ofertas',
    form: 'form-add-oferta',
    lista: 'lista-ofertas',
    tituloForm: 'titulo-form-ofertas',
    textoNuevo: 'Nueva Oferta EFTP',
    iconoNuevo: 'bi-plus-circle-fill text-success',
    textoBotonNuevo: '<i class="bi bi-cloud-upload me-1"></i>Guardar Oferta',
    mensajeExitoTitulo: '¡Oferta Creada!',
    mensajeError: 'No se pudo crear la oferta formativa.',
    etiqueta: (r) => `${r.codigo_oferta} — ${r.nombre_carrera}`,
    textoEditando: (r) => `Editando: ${r.codigo_oferta} — ${r.nombre_carrera}`,
    avisoBorrado: 'Una oferta con prospectos registrados no puede eliminarse (se protegen los datos de interesados).',
    columnas: [
      { titulo: 'Código', campo: 'codigo_oferta' },
      { titulo: 'Carrera', campo: 'nombre_carrera' },
      { titulo: 'Modalidad', campo: 'modalidad', badge: 'bg-info text-dark' },
      { titulo: 'Horas', campo: 'duracion_horas' },
      { titulo: 'Prospectos', campo: 'total_prospectos', badge: 'bg-primary' }
    ],
    campos: ['codigo_oferta', 'nombre_carrera', 'duracion_horas', 'modalidad', 'perfil_egreso', 'requisitos_admision', 'video_lab_url', 'link_informacion_url'],
    archivos: { brochure_pdf: (r) => r.brochure_pdf_url }
  },
  charlas: {
    endpoint: '/api/charlas',
    dataKey: 'charlas',
    form: 'form-add-charla',
    lista: 'lista-charlas',
    tituloForm: 'titulo-form-charlas',
    textoNuevo: 'Agendar Charla',
    iconoNuevo: 'bi-plus-circle-fill text-info',
    textoBotonNuevo: '<i class="bi bi-calendar-plus me-1"></i>Agendar Charla',
    mensajeExitoTitulo: '¡Charla Agendada!',
    mensajeError: 'No se pudo agendar la charla.',
    etiqueta: (r) => `${r.codigo_charla} — ${r.titulo}`,
    textoEditando: (r) => `Editando: ${r.codigo_charla} — ${r.titulo}`,
    avisoBorrado: 'Las valoraciones recibidas por esta charla también se eliminarán.',
    columnas: [
      { titulo: 'Código', campo: 'codigo_charla' },
      { titulo: 'Título', campo: 'titulo' },
      { titulo: 'Expositor', campo: 'expositor' },
      { titulo: 'Horario', campo: 'horario_str', fmt: fmtHorario },
      { titulo: 'Ubicación', campo: 'ubicacion' }
    ],
    campos: ['codigo_charla', 'titulo', 'eje_tematico', 'expositor', 'biografia_expositor', 'horario', 'ubicacion'],
    transformIn: { horario: (v, row) => isoADatetimeLocal(row.horario_str || v) },
    archivos: { diapositivas_pdf: (r) => r.diapositivas_pdf_url, foto_expositor: (r) => r.foto_expositor_url }
  },
  empresas: {
    endpoint: '/api/empresas',
    dataKey: 'empresas',
    form: 'form-add-empresa',
    lista: 'lista-empresas',
    tituloForm: 'titulo-form-empresas',
    textoNuevo: 'Nueva Empresa',
    iconoNuevo: 'bi-plus-circle-fill text-dark',
    textoBotonNuevo: '<i class="bi bi-building-add me-1"></i>Guardar Empresa',
    mensajeExitoTitulo: '¡Empresa Registrada!',
    mensajeError: 'No se pudo registrar la empresa.',
    etiqueta: (r) => `${r.codigo_empresa} — ${r.nombre_corporativo}`,
    textoEditando: (r) => `Editando: ${r.codigo_empresa} — ${r.nombre_corporativo}`,
    avisoBorrado: '',
    columnas: [
      { titulo: 'Código', campo: 'codigo_empresa' },
      { titulo: 'Nombre Corporativo', campo: 'nombre_corporativo' },
      { titulo: 'Descripción', campo: 'descripcion', fmt: (v) => v && v.length > 80 ? v.slice(0, 80) + '…' : v }
    ],
    campos: ['codigo_empresa', 'nombre_corporativo', 'descripcion', 'ofertas_pasantia', 'requisitos_perfil'],
    archivos: { logo: (r) => r.logo_url, catalogo_pdf: (r) => r.catalogo_pdf_url }
  }
};

const estadoEdicion = { proyectos: null, ofertas: null, charlas: null, empresas: null };
const datosActuales = { proyectos: [], ofertas: [], charlas: [], empresas: [] };

function fmtHorario(value) {
  if (!value) return '—';
  const s = String(value);
  // Las charlas llegan como "YYYY-MM-DD HH:MM:SS" (hora tal cual se guardó):
  // se formatean sin pasar por Date para no desplazar la zona horaria.
  const m = s.endsWith('Z') ? null : s.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (m) return `${m[3]}/${m[2]}/${m[1].slice(2)} ${m[4]}:${m[5]}`;
  const d = new Date(s);
  if (isNaN(d.getTime())) return s;
  return d.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function isoADatetimeLocal(value) {
  if (!value) return '';
  // Si ya viene como "YYYY-MM-DD HH:MM:SS", usar esos valores sin conversión de zona.
  const m = String(value).endsWith('Z')
    ? null
    : String(value).match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}`;
  const d = new Date(value);
  if (isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function getAuthHeaders() {
  const u = getCurrentUser();
  return u ? { 'x-usuario-id': u.id } : {};
}

/**
 * Carga los 4 listados de gestión
 */
async function loadAdminListings() {
  for (const [entidad, cfg] of Object.entries(CRUD_ENTIDADES)) {
    const cont = document.getElementById(cfg.lista);
    if (!cont) continue;
    try {
      const res = await fetch(cfg.endpoint);
      const data = await res.json();
      if (!data.success) throw new Error(data.message || 'respuesta inválida');
      datosActuales[entidad] = data[cfg.dataKey] || [];
      renderListado(entidad, cfg, datosActuales[entidad]);
    } catch (err) {
      cont.innerHTML = `<div class="p-3 text-center text-danger small">Error cargando ${esc(entidad)}: ${esc(err.message)}</div>`;
    }
  }
}

window.refreshAdminListings = loadAdminListings;

function renderListado(entidad, cfg, registros) {
  const cont = document.getElementById(cfg.lista);
  if (!cont) return;

  if (!registros.length) {
    cont.innerHTML = '<div class="p-3 text-center text-muted small">No hay registros aún. Creá el primero con el formulario de abajo.</div>';
    return;
  }

  const ths = cfg.columnas.map((c) => `<th>${esc(c.titulo)}</th>`).join('') + '<th class="text-end">Acciones</th>';
  const filas = registros.map((r) => `
    <tr>
      ${cfg.columnas.map((c) => {
        if (typeof c.html === 'function') return `<td>${c.html(r)}</td>`;
        const v = typeof c.fmt === 'function' ? c.fmt(r[c.campo], r) : r[c.campo];
        const texto = (v === null || v === undefined || v === '') ? '—' : esc(v);
        return c.badge
          ? `<td><span class="badge ${c.badge}">${texto}</span></td>`
          : `<td>${texto}</td>`;
      }).join('')}
      <td class="text-end text-nowrap">
        <button class="btn btn-sm btn-outline-primary me-1" onclick="editarEntidad('${entidad}', ${r.id})" title="Editar"><i class="bi bi-pencil"></i></button>
        <button class="btn btn-sm btn-outline-danger" onclick="eliminarEntidad('${entidad}', ${r.id})" title="Eliminar"><i class="bi bi-trash"></i></button>
      </td>
    </tr>
  `).join('');

  // Aviso de fotos faltantes en el listado de proyectos
  let resumen = '';
  if (entidad === 'proyectos' && registros.some((r) => 'imagen_ok' in r)) {
    const faltan = registros.filter((r) => !r.imagen_ok).length;
    resumen = faltan > 0
      ? `<div class="alert alert-warning d-flex align-items-center gap-2 py-2 px-3 small mb-0">
           <i class="bi bi-exclamation-triangle-fill"></i>
           <span>${faltan} proyecto(s) sin foto disponible. Editá cada uno y volvé a subir la imagen.</span>
         </div>`
      : `<div class="alert alert-success py-2 px-3 small mb-0">
           <i class="bi bi-check-circle-fill me-1"></i>Todas las fotos están disponibles.
         </div>`;
  }

  cont.innerHTML = `
    ${resumen}
    <table class="table table-hover align-middle mb-0 small">
      <thead class="table-light"><tr>${ths}</tr></thead>
      <tbody>${filas}</tbody>
    </table>
  `;
}

function limpiarHints(entidad) {
  document.querySelectorAll(`[id^="hint-"][id$="-${entidad}"]`).forEach((el) => {
    el.textContent = '';
    el.classList.add('d-none');
  });
}

window.editarEntidad = function (entidad, id) {
  const cfg = CRUD_ENTIDADES[entidad];
  const r = datosActuales[entidad].find((x) => x.id === id);
  if (!r) return;

  estadoEdicion[entidad] = r;
  const form = document.getElementById(cfg.form);

  cfg.campos.forEach((campo) => {
    const input = form.elements[campo];
    if (!input) return;
    const valor = cfg.transformIn && cfg.transformIn[campo] ? cfg.transformIn[campo](r[campo], r) : r[campo];

    // Checkboxes múltiples (requerimientos_exhibicion): marcar los que coincidan con el valor guardado
    if (campo === 'requerimientos_exhibicion' && input.length !== undefined) {
      const valores = new Set((valor || '').split(',').map((v) => v.trim()).filter(Boolean));
      input.forEach((chk) => {
        chk.checked = valores.has(chk.value);
      });
      return;
    }

    input.value = valor ?? '';
  });

  Object.entries(cfg.archivos || {}).forEach(([nombreInput, getter]) => {
    const input = form.elements[nombreInput];
    if (input) input.value = '';
    const hint = document.getElementById(`hint-${nombreInput}-${entidad}`);
    if (!hint) return;
    const url = getter(r);
    if (url) {
      hint.innerHTML = `Archivo actual: <a href="${esc(url)}" target="_blank">${esc(url.split('/').pop())}</a> — dejá el campo vacío para conservarlo`;
      hint.classList.remove('d-none');
    } else {
      hint.textContent = '';
      hint.classList.add('d-none');
    }
  });

  document.getElementById(cfg.tituloForm).innerHTML = `<i class="bi bi-pencil-square text-warning me-1"></i>${esc(cfg.textoEditando(r))}`;
  document.getElementById(`btn-cancel-${entidad}`).classList.remove('d-none');
  document.getElementById(`btn-submit-${entidad}`).innerHTML = '<i class="bi bi-save me-1"></i>Actualizar';
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
};

window.cancelarEdicion = function (entidad) {
  const cfg = CRUD_ENTIDADES[entidad];
  estadoEdicion[entidad] = null;
  document.getElementById(cfg.form).reset();
  limpiarHints(entidad);
  document.getElementById(cfg.tituloForm).innerHTML = `<i class="bi ${cfg.iconoNuevo} me-1"></i>${esc(cfg.textoNuevo)}`;
  document.getElementById(`btn-cancel-${entidad}`).classList.add('d-none');
  document.getElementById(`btn-submit-${entidad}`).innerHTML = cfg.textoBotonNuevo;
};

window.eliminarEntidad = function (entidad, id) {
  const cfg = CRUD_ENTIDADES[entidad];
  const r = datosActuales[entidad].find((x) => x.id === id);
  if (!r) return;

  Swal.fire({
    title: '¿Eliminar registro?',
    text: `Se eliminará "${cfg.etiqueta(r)}".${cfg.avisoBorrado ? ' ' + cfg.avisoBorrado : ''}`,
    icon: 'warning',
    showCancelButton: true,
    confirmButtonText: 'Sí, eliminar',
    confirmButtonColor: '#dc3545',
    cancelButtonText: 'Cancelar'
  }).then(async (res) => {
    if (!res.isConfirmed) return;
    try {
      const resp = await fetch(`${cfg.endpoint}/${id}`, {
        method: 'DELETE',
        headers: getAuthHeaders()
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        Swal.fire('Eliminado', data.message, 'success');
        if (estadoEdicion[entidad] && estadoEdicion[entidad].id === id) cancelarEdicion(entidad);
        loadAdminListings();
        loadAdminStats();
      } else {
        Swal.fire('No se pudo eliminar', data.message, 'error');
      }
    } catch (err) {
      Swal.fire('Error', 'Fallo de conexión al eliminar.', 'error');
    }
  });
};

/**
 * Configura los formularios de alta/edición con envío de header x-usuario-id
 */
function setupFormListeners() {
  for (const [entidad, cfg] of Object.entries(CRUD_ENTIDADES)) {
    const form = document.getElementById(cfg.form);
    if (!form) continue;

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const editando = estadoEdicion[entidad];
      const formData = new FormData(form);
      const url = editando ? `${cfg.endpoint}/${editando.id}` : cfg.endpoint;

      try {
        const res = await fetch(url, {
          method: editando ? 'PUT' : 'POST',
          headers: getAuthHeaders(),
          body: formData
        });
        const data = await res.json();

        if (res.ok && data.success) {
          Swal.fire(editando ? '¡Registro Actualizado!' : cfg.mensajeExitoTitulo, data.message, 'success');
          cancelarEdicion(entidad);
          loadAdminListings();
          loadAdminStats();
        } else {
          Swal.fire('Error', data.message, 'error');
        }
      } catch (err) {
        Swal.fire('Error', cfg.mensajeError, 'error');
      }
    });
  }
}

/* =========================================================================
 * GESTIÓN DE USUARIOS (exclusiva del Administrador General)
 * ========================================================================= */

const ROLES_ETIQUETA = {
  visitante: 'Visitante / Evaluador',
  alumno: 'Alumno / Estudiante',
  empresa: 'Empresa',
  docente: 'Docente / Tutor',
  admin: 'Administrador General'
};

const ESTADOS_ETIQUETA = {
  habilitado: { texto: 'Habilitado', clase: 'bg-success' },
  pendiente: { texto: 'Pendiente', clase: 'bg-warning text-dark' },
  deshabilitado: { texto: 'Deshabilitado', clase: 'bg-secondary' }
};

let usuariosActuales = [];

function setupUsuariosForm() {
  const form = document.getElementById('form-usuarios');
  if (!form || form.dataset.listenerReady === '1') return;
  form.dataset.listenerReady = '1';

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const payload = Object.fromEntries(new FormData(form).entries());

    try {
      const res = await fetch('/api/usuarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        body: JSON.stringify(payload)
      });
      const data = await res.json();

      if (res.ok && data.success) {
        form.reset();
        let html = `<p class="mb-0">${esc(data.message)}</p>`;
        if (data.pin_inicial) {
          html += `<p class="mt-2 mb-0">PIN inicial: <code class="fs-4 fw-bold">${esc(data.pin_inicial)}</code></p>
                   <p class="small text-muted mb-0">Guardalo: no volverá a mostrarse.</p>`;
        }
        Swal.fire({ icon: 'success', title: '¡Usuario Creado!', html });
        loadUsuarios();
      } else {
        Swal.fire('Error', data.message || 'No se pudo crear el usuario.', 'error');
      }
    } catch (err) {
      Swal.fire('Error', 'Fallo de conexión al crear el usuario.', 'error');
    }
  });
}

async function loadUsuarios() {
  const cont = document.getElementById('lista-usuarios');
  if (!cont) return;

  try {
    const res = await fetch('/api/usuarios', { headers: getAuthHeaders() });
    const data = await res.json();
    if (!res.ok || !data.success) throw new Error(data.message || 'respuesta inválida');
    usuariosActuales = data.usuarios || [];
    renderUsuarios();
  } catch (err) {
    cont.innerHTML = `<div class="p-3 text-center text-danger small">Error cargando usuarios: ${esc(err.message)}</div>`;
  }
}

function renderUsuarios() {
  const cont = document.getElementById('lista-usuarios');
  if (!cont) return;

  const texto = (document.getElementById('filtro-usuarios-texto')?.value || '').trim().toLowerCase();
  const rolFiltro = document.getElementById('filtro-usuarios-rol')?.value || '';
  const estadoFiltro = document.getElementById('filtro-usuarios-estado')?.value || '';

  const filtrados = usuariosActuales.filter((u) => {
    const coincideTexto = !texto
      || String(u.nombre || '').toLowerCase().includes(texto)
      || String(u.email || '').toLowerCase().includes(texto);
    const coincideRol = !rolFiltro || u.rol === rolFiltro;
    const coincideEstado = !estadoFiltro || u.estado === estadoFiltro;
    return coincideTexto && coincideRol && coincideEstado;
  });

  if (!filtrados.length) {
    cont.innerHTML = '<div class="p-3 text-center text-muted small">No hay usuarios que coincidan con el filtro.</div>';
    return;
  }

  const actual = getCurrentUser();
  const filas = filtrados.map((u) => {
    const estado = ESTADOS_ETIQUETA[u.estado] || { texto: u.estado, clase: 'bg-light text-dark' };
    const esPropia = actual && Number(actual.id) === Number(u.id);
    const esUltimoAdmin = u.rol === 'admin' && u.estado === 'habilitado'
      && usuariosActuales.filter((x) => x.rol === 'admin' && x.estado === 'habilitado').length <= 1;
    const bloquear = esPropia || esUltimoAdmin;

    const botonEstado = u.estado === 'habilitado'
      ? `<button class="btn btn-sm btn-outline-warning me-1" onclick="toggleUsuarioEstado(${u.id})" title="Deshabilitar" ${bloquear ? 'disabled' : ''}><i class="bi bi-pause-circle"></i></button>`
      : `<button class="btn btn-sm btn-outline-success me-1" onclick="toggleUsuarioEstado(${u.id})" title="Habilitar"><i class="bi bi-check-circle"></i></button>`;

    return `
      <tr>
        <td>${esc(u.nombre)}${esPropia ? ' <span class="badge bg-primary">vos</span>' : ''}</td>
        <td class="small">${esc(u.email)}</td>
        <td><span class="badge bg-dark">${esc(ROLES_ETIQUETA[u.rol] || u.rol)}</span></td>
        <td><span class="badge ${estado.clase}">${esc(estado.texto)}</span></td>
        <td class="small text-muted">${u.creado_en ? esc(new Date(u.creado_en).toLocaleDateString()) : '—'}</td>
        <td class="text-end text-nowrap">
          ${botonEstado}
          <button class="btn btn-sm btn-outline-primary" onclick="editarUsuario(${u.id})" title="Editar usuario"><i class="bi bi-pencil-square"></i></button>
        </td>
      </tr>
    `;
  }).join('');

  cont.innerHTML = `
    <table class="table table-sm table-hover align-middle mb-0">
      <thead class="table-light">
        <tr>
          <th>Nombre</th>
          <th>Email</th>
          <th>Rol</th>
          <th>Estado</th>
          <th>Creado</th>
          <th class="text-end">Acciones</th>
        </tr>
      </thead>
      <tbody>${filas}</tbody>
    </table>
  `;
}

function buscarUsuario(id) {
  return usuariosActuales.find((u) => Number(u.id) === Number(id));
}

async function actualizarUsuario(id, cambios, mensajeExito) {
  try {
    const res = await fetch(`/api/usuarios/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      body: JSON.stringify(cambios)
    });
    const data = await res.json();

    if (res.ok && data.success) {
      Swal.fire('Listo', mensajeExito || data.message, 'success');
      loadUsuarios();
      return true;
    }
    Swal.fire('No se pudo actualizar', data.message || 'Error desconocido.', 'error');
    return false;
  } catch (err) {
    Swal.fire('Error', 'Fallo de conexión al actualizar el usuario.', 'error');
    return false;
  }
}

async function toggleUsuarioEstado(id) {
  const u = buscarUsuario(id);
  if (!u) return;

  if (u.estado === 'habilitado') {
    const confirm = await Swal.fire({
      title: '¿Deshabilitar usuario?',
      text: `${u.nombre} no podrá iniciar sesión ni usar el panel hasta que lo habilites nuevamente.`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonText: 'Sí, deshabilitar',
      confirmButtonColor: '#ef4444',
      cancelButtonText: 'Cancelar'
    });
    if (!confirm.isConfirmed) return;
    await actualizarUsuario(id, { estado: 'deshabilitado' }, 'Usuario deshabilitado.');
  } else {
    await actualizarUsuario(id, { estado: 'habilitado' }, 'Usuario habilitado.');
  }
}

async function editarUsuario(id) {
  const u = buscarUsuario(id);
  if (!u) return;

  const actual = getCurrentUser();
  const esPropia = actual && Number(actual.id) === Number(u.id);
  const esUltimoAdmin = u.rol === 'admin' && u.estado === 'habilitado'
    && usuariosActuales.filter((x) => x.rol === 'admin' && x.estado === 'habilitado').length <= 1;

  const opcionesRol = Object.entries(ROLES_ETIQUETA)
    .map(([valor, etiqueta]) => `<option value="${valor}" ${u.rol === valor ? 'selected' : ''}>${etiqueta}</option>`)
    .join('');

  const opcionesEstado = Object.entries(ESTADOS_ETIQUETA)
    .map(([valor, cfg]) => `<option value="${valor}" ${u.estado === valor ? 'selected' : ''}>${cfg.texto}</option>`)
    .join('');

  const { isConfirmed, value } = await Swal.fire({
    title: 'Editar usuario',
    width: 560,
    html: `
      <div class="text-start">
        <div class="mb-2">
          <label class="form-label fw-bold mb-1">Nombre Completo</label>
          <input id="edit-u-nombre" class="form-control" value="${esc(u.nombre)}" maxlength="150">
        </div>
        <div class="mb-2">
          <label class="form-label fw-bold mb-1">Correo Electrónico</label>
          <input id="edit-u-email" type="email" class="form-control" value="${esc(u.email)}" maxlength="150">
        </div>
        <div class="row g-2">
          <div class="col-6">
            <label class="form-label fw-bold mb-1">Rol</label>
            <select id="edit-u-rol" class="form-select" ${esPropia || esUltimoAdmin ? 'disabled' : ''}>${opcionesRol}</select>
            ${esPropia ? '<div class="form-text">No podés cambiarte el rol a vos mismo.</div>' : ''}
          </div>
          <div class="col-6">
            <label class="form-label fw-bold mb-1">Estado</label>
            <select id="edit-u-estado" class="form-select" ${esPropia || esUltimoAdmin ? 'disabled' : ''}>${opcionesEstado}</select>
            ${esPropia ? '<div class="form-text">No podés deshabilitar tu propia cuenta.</div>' : ''}
          </div>
        </div>
        ${esUltimoAdmin ? '<div class="alert alert-warning small py-2 mt-2 mb-0"><i class="bi bi-exclamation-triangle me-1"></i>Es el último administrador habilitado: no se puede deshabilitar ni cambiar de rol.</div>' : ''}
        <div class="mt-2">
          <label class="form-label fw-bold mb-1">Nuevo PIN <span class="text-muted fw-normal">(opcional)</span></label>
          <input id="edit-u-pin" type="text" class="form-control" maxlength="10" placeholder="Dejar vacío para conservar el PIN actual">
        </div>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'Guardar cambios',
    cancelButtonText: 'Cancelar',
    preConfirm: () => {
      const nombre = document.getElementById('edit-u-nombre').value.trim();
      const email = document.getElementById('edit-u-email').value.trim();
      const rol = document.getElementById('edit-u-rol').value;
      const estado = document.getElementById('edit-u-estado').value;
      const pin = document.getElementById('edit-u-pin').value.trim();

      if (!nombre) {
        Swal.showValidationMessage('El nombre no puede quedar vacío.');
        return false;
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        Swal.showValidationMessage('Ingresá un correo electrónico válido.');
        return false;
      }
      if (pin && (pin.length < 4 || pin.length > 10)) {
        Swal.showValidationMessage('El PIN debe tener entre 4 y 10 caracteres.');
        return false;
      }

      const cambios = { nombre, email };
      if (!esPropia && !esUltimoAdmin) {
        cambios.rol = rol;
        cambios.estado = estado;
      }
      if (pin) cambios.codigo_pin = pin;
      return cambios;
    }
  });

  if (!isConfirmed || !value) return;

  const ok = await actualizarUsuario(id, value, 'Usuario actualizado correctamente.');
  if (!ok) return;

  // Si el admin editó su propia cuenta, sincronizar la sesión local.
  if (esPropia) {
    const actualizado = buscarUsuario(id) || {};
    setCurrentUser({
      ...actual,
      nombre: value.nombre,
      email: value.email,
      rol: actualizado.rol || actual.rol,
      estado: actualizado.estado || actual.estado
    });
    const badgeEl = document.getElementById('admin-user-badge');
    if (badgeEl) {
      badgeEl.innerHTML = `
        <span class="badge bg-danger fs-6 me-2">ADMIN</span>
        <strong>${esc(value.nombre)}</strong> (${esc(value.email)})
      `;
    }
  }
}
