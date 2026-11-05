/**
 * EXPOTECNIA EFTP - MÓDULO DE PROYECTOS Y EVALUACIONES
 */

let allProyectos = [];

document.addEventListener('DOMContentLoaded', () => {
  loadProyectos();

  // Escuchar filtros
  const searchInput = document.getElementById('search-input');
  const specialtyFilter = document.getElementById('specialty-filter');
  const trlFilter = document.getElementById('trl-filter');

  if (searchInput) searchInput.addEventListener('input', applyFilters);
  if (specialtyFilter) specialtyFilter.addEventListener('change', applyFilters);
  if (trlFilter) trlFilter.addEventListener('change', applyFilters);

  // Verificar si viene con parámetro de Stand desde QR (?stand=STAND-101)
  const urlParams = new URLSearchParams(window.location.search);
  const standParam = urlParams.get('stand');
  const idParam = urlParams.get('id');

  if (standParam || idParam) {
    openProyectoDetailModal(standParam || idParam);
  }
});

/**
 * Cargar listado de proyectos desde API MariaDB
 */
async function loadProyectos() {
  const container = document.getElementById('proyectos-container');
  if (!container) return;

  container.innerHTML = `
    <div class="col-12 text-center py-5">
      <div class="spinner-border text-primary" role="status"></div>
      <p class="mt-2 text-muted">Cargando proyectos de la Expotecnia...</p>
    </div>
  `;

  try {
    const res = await fetch('/api/proyectos');
    const data = await res.json();

    if (data.success) {
      allProyectos = data.proyectos;
      renderProyectos(allProyectos);
      populateSpecialtyFilter(allProyectos);
    } else {
      container.innerHTML = `<div class="col-12 alert alert-danger">${data.message}</div>`;
    }
  } catch (err) {
    console.error('Error al cargar proyectos:', err);
    container.innerHTML = `
      <div class="col-12 alert alert-warning text-center">
        <i class="bi bi-x-circle fs-3 d-block mb-2"></i>
        <h5>Error de Conexión</h5>
        <p>No se pudo conectar al servidor. Verifica tu conexión a internet y que el servidor Express y MariaDB estén en ejecución.</p>
      </div>
    `;
  }
}

/**
 * Renderizar tarjetas de proyectos tipo BANNER (horizontal)
 */
function renderProyectos(proyectos) {
  const container = document.getElementById('proyectos-container');
  if (!container) return;

  if (proyectos.length === 0) {
    container.innerHTML = `
      <div class="col-12 text-center py-5 text-muted">
        <i class="bi bi-journal-x fs-1 d-block mb-2"></i>
        <h5>No se encontraron proyectos</h5>
        <p>Prueba ajustando los criterios de búsqueda o filtros.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = proyectos.map(p => {
    const trlClass = p.trl_nivel <= 3 ? 'trl-low' : p.trl_nivel <= 6 ? 'trl-mid' : 'trl-high';
    const imgUrl = p.imagen_url || 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=400&auto=format&fit=crop&q=80';

    return `
      <div class="col-12 col-sm-6 col-md-4 col-lg-3 mb-3">
        <div class="card card-catalogo h-100 border-0 shadow-sm overflow-hidden">
          <div class="position-relative">
            <img src="${imgUrl}" alt="${p.titulo}" class="w-100 catalogo-img" 
                 onerror="this.src='https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=400&auto=format&fit=crop&q=80'">
            <div class="position-absolute top-0 end-0 p-2">
              <span class="stand-badge fs-7 px-2 py-1"><i class="bi bi-geo-alt-fill me-1"></i>${p.codigo_stand}</span>
            </div>
          </div>
          <div class="card-body p-3 d-flex flex-column">
            <div class="d-flex flex-wrap gap-1 mb-2">
              <span class="badge bg-primary-subtle text-primary fw-semibold small">${p.especialidad}</span>
              ${p.sector_aplicacion ? `<span class="badge bg-info-subtle text-info small">${p.sector_aplicacion}</span>` : ''}
            </div>
            <h6 class="fw-bold text-dark mb-1">${p.titulo}</h6>
            <span class="trl-badge ${trlClass} small">TRL ${p.trl_nivel}</span>

            <div class="mt-auto d-flex flex-wrap gap-2">
              <a href="evaluar.html?stand=${encodeURIComponent(p.codigo_stand)}" class="btn btn-primary btn-sm flex-sm-fill text-truncate" title="Evaluar este proyecto">
                <i class="bi bi-clipboard-check me-1"></i>Evaluar
              </a>
              <button onclick="openProyectoDetailModal('${p.codigo_stand}')" class="btn btn-outline-primary btn-sm flex-sm-fill text-truncate" title="Ver detalles">
                <i class="bi bi-info-circle me-1"></i>Detalles
              </button>
              ${p.codigo_stand ? `
                <a href="/api/proyectos/poster/${encodeURIComponent(p.codigo_stand)}" target="_blank" class="btn btn-outline-danger btn-sm flex-sm-fill text-truncate" title="Descargar Poster PDF">
                  <i class="bi bi-file-earmark-pdf-fill me-1"></i>Poster
                </a>
              ` : ''}
            </div>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Llenar selector de especialidades dinámicamente
 */
function populateSpecialtyFilter(proyectos) {
  const specialtyFilter = document.getElementById('specialty-filter');
  if (!specialtyFilter || specialtyFilter.options.length > 1) return;

  const specialties = [...new Set(proyectos.map(p => p.especialidad))];
  specialties.forEach(spec => {
    const opt = document.createElement('option');
    opt.value = spec;
    opt.textContent = spec;
    specialtyFilter.appendChild(opt);
  });
}

/**
 * Aplicar filtros combinados
 */
function applyFilters() {
  const search = document.getElementById('search-input')?.value.toLowerCase() || '';
  const spec = document.getElementById('specialty-filter')?.value || '';
  const trl = document.getElementById('trl-filter')?.value || '';

  const filtered = allProyectos.filter(p => {
    const matchesSearch = !search || 
      p.titulo.toLowerCase().includes(search) || 
      p.codigo_stand.toLowerCase().includes(search) ||
      p.tecnologias_usadas.toLowerCase().includes(search);
    
    const matchesSpec = !spec || p.especialidad === spec;
    const matchesTrl = !trl || p.trl_nivel == trl;

    return matchesSearch && matchesSpec && matchesTrl;
  });

  renderProyectos(filtered);
}

/**
 * Recuadro que reemplaza a la foto cuando no hay archivo disponible.
 * @param {string} mensaje
 * @returns {string}
 */
function fotoPlaceholderHTML(mensaje) {
  return `
    <div class="d-flex flex-column align-items-center justify-content-center rounded bg-light border text-muted" style="height: 240px;">
      <i class="bi bi-image" style="font-size: 2.5rem;"></i>
      <p class="small mb-0 mt-2 px-3 text-center">${mensaje}</p>
    </div>`;
}

/**
 * Si el navegador no puede cargar la imagen (archivo perdido), muestra el aviso
 * en lugar de dejar el hueco vacío.
 */
function reemplazarFotoPorPlaceholder(img) {
  const cont = img.closest('[data-foto-detalle]');
  if (cont) {
    cont.innerHTML = fotoPlaceholderHTML('Foto no disponible — subila de nuevo desde el panel');
  }
}

/**
 * HTML del bloque de foto del modal de detalle.
 * Usa `imagen_ok` que devuelve la API; si no viene, el onerror cubre el caso.
 */
function bloqueFotoHTML(p) {
  let contenido;

  if (!p.imagen_url) {
    contenido = fotoPlaceholderHTML('Sin foto cargada');
  } else if (p.imagen_ok === false) {
    contenido = fotoPlaceholderHTML('Foto no disponible — subila de nuevo desde el panel');
  } else {
    contenido = `<img src="${p.imagen_url}" alt="${p.titulo}" class="img-fluid rounded w-100" style="max-height: 200px; object-fit: contain;" onerror="reemplazarFotoPorPlaceholder(this)">`;
  }

  return `<div class="mb-3" data-foto-detalle>${contenido}</div>`;
}

// Variable global para la ficha a imprimir
let proyectoActual = null;

/**
 * Imprime la ficha técnica del proyecto en una hoja A4
 */
function imprimirFichaProyecto() {
  if (!proyectoActual) return;

  const p = proyectoActual;
  const promedioGeneral = Number(p.promedio || 0).toFixed(1);
  const totalVotos = Number(p.total_votos || 0);
  const fechaRegistro = p.creado_en
    ? new Date(p.creado_en).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' })
    : 'No disponible';

  const contenidoImprimible = `
    <!DOCTYPE html>
    <html lang="es">
    <head>
      <meta charset="UTF-8">
      <title>Ficha Técnica - ${p.codigo_stand}</title>
      <style>
        @page { size: A4; margin: 15mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Segoe UI', Arial, sans-serif; color: #1e293b; font-size: 11px; line-height: 1.4; }
        .header { background: linear-gradient(135deg, #0f172a, #1e3a8a); color: white; padding: 15px 20px; border-radius: 8px; margin-bottom: 15px; display: flex; align-items: center; gap: 15px; }
        .header img { width: 120px; height: 80px; object-fit: cover; border-radius: 6px; border: 2px solid white; }
        .header h1 { font-size: 18px; margin-bottom: 4px; }
        .header .badge { display: inline-block; padding: 4px 12px; border-radius: 12px; font-size: 10px; font-weight: bold; margin-right: 6px; }
        .badge-primary { background: #1e3a8a; color: white; }
        .badge-trl { background: #d1fae5; color: #10b981; }
        .badge-ods { background: #1e3a8a; color: white; padding: 6px 14px; }
        .section { margin-bottom: 12px; }
        .section-title { font-size: 12px; font-weight: bold; color: #1e3a8a; border-bottom: 2px solid #3b82f6; padding-bottom: 4px; margin-bottom: 8px; }
        .ficha { background: #e0f2fe; border-left: 4px solid #3b82f6; padding: 12px; border-radius: 4px; margin-bottom: 12px; }
        .ficha-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px 16px; }
        .ficha-item { }
        .ficha-label { font-size: 8px; color: #64748b; text-transform: uppercase; font-weight: bold; }
        .ficha-value { font-size: 10px; font-weight: bold; color: #1e293b; }
        .tags { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px; }
        .tag { background: #1e3a8a; color: white; padding: 3px 10px; border-radius: 10px; font-size: 9px; font-weight: bold; }
        .tag-sector { background: #7dd3fc; color: #0f172a; }
        .ods-badge { background: #1e3a8a; color: white; padding: 6px 14px; border-radius: 12px; font-size: 9px; font-weight: bold; display: inline-block; margin-bottom: 8px; }
        .text-block { background: white; border: 1px solid #e2e8f0; padding: 10px; border-radius: 4px; margin-bottom: 8px; }
        .text-block h6 { font-size: 10px; font-weight: bold; color: #1e3a8a; margin-bottom: 4px; }
        .text-block p { font-size: 10px; color: #334155; white-space: pre-line; text-align: justify; }
        .eval { background: white; border: 1px solid #e2e8f0; padding: 10px; border-radius: 4px; margin-bottom: 8px; }
        .eval-stars { color: #f59e0b; font-size: 14px; }
        .eval-bar { height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; margin: 2px 0; }
        .eval-bar-fill { height: 100%; border-radius: 3px; }
        .eval-row { display: flex; align-items: center; gap: 8px; margin: 3px 0; font-size: 9px; }
        .eval-label { width: 100px; color: #64748b; }
        .eval-value { width: 30px; text-align: right; font-weight: bold; }
        .recursos { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 8px; }
        .recurso { padding: 8px; border-radius: 4px; font-size: 9px; }
        .recurso-video { background: #fef3c7; color: #b45309; }
        .recurso-enlace { background: #f0f9ff; color: #0369a1; }
        .recurso-poster { background: #fef2f2; color: #dc2626; }
        .qr-section { text-align: center; padding: 10px; border: 1px solid #e2e8f0; border-radius: 4px; margin-bottom: 8px; }
        .footer { background: linear-gradient(135deg, #1e3a8a, #0f172a); color: white; padding: 10px 20px; border-radius: 4px; display: flex; justify-content: space-between; align-items: center; font-size: 8px; margin-top: 10px; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style>
    </head>
    <body>
      <div class="header">
        ${p.imagen_url ? `<img src="${p.imagen_url}" alt="${p.titulo}">` : ''}
        <div>
          <h1>${p.titulo}</h1>
          <div>
            <span class="badge badge-primary">${p.codigo_stand}</span>
            <span class="badge badge-trl">TRL ${p.trl_nivel}</span>
          </div>
          <div class="tags" style="margin-top:6px;">
            <span class="tag">${p.especialidad}</span>
            ${p.sector_aplicacion ? `<span class="tag tag-sector">${p.sector_aplicacion}</span>` : ''}
          </div>
        </div>
      </div>

      ${p.impacto_ods ? `<div class="ods-badge">${p.impacto_ods}</div>` : ''}

      <div class="ficha">
        <div class="ficha-grid">
          <div class="ficha-item"><div class="ficha-label">Código de Stand</div><div class="ficha-value">${p.codigo_stand}</div></div>
          <div class="ficha-item"><div class="ficha-label">Especialidad</div><div class="ficha-value">${p.especialidad}</div></div>
          <div class="ficha-item"><div class="ficha-label">Sector de Aplicación</div><div class="ficha-value">${p.sector_aplicacion || 'No especificado'}</div></div>
          <div class="ficha-item"><div class="ficha-label">Autores (Alumnos)</div><div class="ficha-value">${p.integrantes || 'No asignados'}</div></div>
          <div class="ficha-item"><div class="ficha-label">Nivel TRL</div><div class="ficha-value">TRL ${p.trl_nivel}</div></div>
          <div class="ficha-item"><div class="ficha-label">Docente Tutor</div><div class="ficha-value">${p.docente_tutor || 'No asignado'}</div></div>
          <div class="ficha-item"><div class="ficha-label">Fecha de Registro</div><div class="ficha-value">${fechaRegistro}</div></div>
          <div class="ficha-item"><div class="ficha-label">Contacto</div><div class="ficha-value">${p.enlace_tecnico_url || 'Vía institucional'}</div></div>
        </div>
        <div style="margin-top:8px;">
          <div class="ficha-label">Tecnologías Usadas</div>
          <div class="ficha-value">${p.tecnologias_usadas || 'No especificado'}</div>
        </div>
        ${p.requerimientos_exhibicion ? `<div style="margin-top:8px;"><div class="ficha-label">Requerimientos de Exhibición</div><div class="ficha-value">${p.requerimientos_exhibicion}</div></div>` : ''}
      </div>

      ${p.problema_que_resuelve ? `
      <div class="section">
        <div class="section-title">PROBLEMA QUE RESUELVE</div>
        <div class="text-block"><p>${p.problema_que_resuelve}</p></div>
      </div>` : ''}

      <div class="section">
        <div class="section-title">RESUMEN EJECUTIVO</div>
        <div class="text-block"><p>${p.resumen_ejecutivo || 'Sin resumen registrado.'}</p></div>
      </div>

      ${p.total_votos > 0 ? `
      <div class="section">
        <div class="section-title">EVALUACIÓN DEL PROYECTO</div>
        <div class="eval">
          <div style="display:flex; align-items:center; gap:10px; margin-bottom:8px;">
            <span style="font-size:20px; color:#f59e0b;">${'★'.repeat(Math.round(p.promedio))}${'☆'.repeat(5 - Math.round(p.promedio))}</span>
            <span style="font-size:14px; font-weight:bold; color:#f59e0b;">${promedioGeneral} / 5</span>
            <span style="font-size:9px; color:#64748b;">(${totalVotos} evaluación${totalVotos === 1 ? '' : 'es'})</span>
          </div>
          <div class="eval-row"><span class="eval-label">Innovación</span><div class="eval-bar" style="flex:1;"><div class="eval-bar-fill" style="width:${(p.promedio_innovacion/5*100)}%; background:#3b82f6;"></div></div><span class="eval-value">${Number(p.promedio_innovacion).toFixed(1)}</span></div>
          <div class="eval-row"><span class="eval-label">Dominio Técnico</span><div class="eval-bar" style="flex:1;"><div class="eval-bar-fill" style="width:${(p.promedio_dominio_tecnico/5*100)}%; background:#10b981;"></div></div><span class="eval-value">${Number(p.promedio_dominio_tecnico).toFixed(1)}</span></div>
          <div class="eval-row"><span class="eval-label">Presentación</span><div class="eval-bar" style="flex:1;"><div class="eval-bar-fill" style="width:${(p.promedio_presentacion/5*100)}%; background:#f59e0b;"></div></div><span class="eval-value">${Number(p.promedio_presentacion).toFixed(1)}</span></div>
          <div class="eval-row"><span class="eval-label">Impacto</span><div class="eval-bar" style="flex:1;"><div class="eval-bar-fill" style="width:${(p.promedio_impacto/5*100)}%; background:#ef4444;"></div></div><span class="eval-value">${Number(p.promedio_impacto).toFixed(1)}</span></div>
        </div>
      </div>` : ''}

      <div class="section">
        <div class="section-title">RECURSOS ADICIONALES</div>
        <div class="recursos">
          ${p.video_pitch_url ? `<div class="recurso recurso-video"><strong>🎬 Video Pitch</strong><br>${p.video_pitch_url}</div>` : ''}
          ${p.enlace_tecnico_url ? `<div class="recurso recurso-enlace"><strong>🔗 Enlace Técnico / Demo</strong><br>${p.enlace_tecnico_url}</div>` : ''}
          ${p.pdf_poster_url ? `<div class="recurso recurso-poster"><strong>📄 Poster Técnico PDF</strong><br>Descargar ficha técnica completa</div>` : ''}
        </div>
      </div>

      <div class="qr-section">
        <small style="color:#64748b; display:block; margin-bottom:6px;"><i class="bi bi-qr-code-scan"></i> Escanea con tu móvil para evaluar este proyecto</small>
        <img src="https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(window.location.origin + '/evaluar.html?stand=' + p.codigo_stand)}" alt="QR" style="width:100px; height:100px;">
        <small style="color:#64748b; display:block; margin-top:4px; word-break:break-all; font-size:8px;">${window.location.origin}/evaluar.html?stand=${p.codigo_stand}</small>
      </div>

      <div class="footer">
        <div>
          <strong>EXPOTECNIA EFTP 2026</strong><br>
          Plataforma de Innovación Tecnológica Educativa
        </div>
        <div style="text-align:right;">
          Generado: ${new Date().toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' })}<br>
          https://expocta.onrender.com
        </div>
      </div>
    </body>
    </html>
  `;

  const ventana = window.open('', '_blank', 'width=900,height=1200');
  ventana.document.write(contenidoImprimible);
  ventana.document.close();
  ventana.onload = function() {
    ventana.print();
  };
}

/**
 * Abrir Modal de Detalle y Evaluación de un Proyecto
 */
async function openProyectoDetailModal(identifier) {  try {
    const res = await fetch(`/api/proyectos/${identifier}`);
    const data = await res.json();

    if (!data.success) {
      Swal.fire('Error', data.message, 'error');
      return;
    }

    const p = data.proyecto;

    // Guardar referencia para impresión
    proyectoActual = p;

    const promedioGeneral = Number(p.promedio || 0).toFixed(1);
    const totalVotos = Number(p.total_votos || 0);
    const fechaRegistro = p.creado_en
      ? new Date(p.creado_en).toLocaleDateString('es-PY', { day: '2-digit', month: '2-digit', year: 'numeric' })
      : 'No disponible';

    let comentariosHTML = '';
    if (p.comentarios && p.comentarios.length > 0) {
      comentariosHTML = `
        <div class="mt-4 text-start">
          <h6 class="fw-bold"><i class="bi bi-chat-square-text me-2"></i>Comentarios de Evaluadores (${p.comentarios.length})</h6>
          <div class="list-group list-group-flush max-h-200 overflow-auto" style="max-height: 180px;">
            ${p.comentarios.map(c => `
              <div class="list-group-item bg-light rounded mb-2 p-2">
                <div class="d-flex justify-content-between align-items-center mb-1">
                  <strong class="small">${c.usuario_nombre} <span class="badge bg-secondary">${c.usuario_rol}</span></strong>
                  <span class="badge bg-warning text-dark"><i class="bi bi-star-fill"></i> Avg ${((c.innovacion + c.dominio_tecnico + c.presentacion + c.impacto)/4).toFixed(1)}</span>
                </div>
                <p class="small text-muted mb-0">${c.comentario}</p>
              </div>
            `).join('')}
          </div>
        </div>
      `;
    }

    // Promedios por criterio (solo cuando ya existen evaluaciones)
    let criteriosHTML = '';
    if (totalVotos > 0) {
      const criterios = [
        { label: 'Innovación', valor: p.promedio_innovacion },
        { label: 'Dominio Técnico', valor: p.promedio_dominio_tecnico },
        { label: 'Presentación', valor: p.promedio_presentacion },
        { label: 'Impacto Social', valor: p.promedio_impacto }
      ];
      criteriosHTML = `
        <div class="p-3 bg-light rounded mb-3">
          <h6 class="fw-bold mb-3"><i class="bi bi-bar-chart-fill me-1"></i>Promedios por Criterio (${totalVotos} evaluación${totalVotos === 1 ? '' : 'es'})</h6>
          <div class="row g-2">
            ${criterios.map(c => `
              <div class="col-6 col-md-3">
                <div class="bg-white border rounded p-2 text-center h-100">
                  <div class="small text-muted">${c.label}</div>
                  <div class="fw-bold text-primary">${Number(c.valor || 0).toFixed(1)} / 5</div>
                </div>
              </div>
            `).join('')}
          </div>
        </div>`;
    }

    // Campos opcionales de ficha técnica para el modal (HTML separado para evitar ternarios en template literal)
    // Ficha técnica completa: siempre se muestran todos los campos, con "No especificado" cuando están vacíos
    const camposExtraModalHTML = `
      <div class="p-3 bg-light rounded mb-3">
        <h6 class="fw-bold"><i class="bi bi-question-circle me-1"></i>Problema que Resuelve</h6>
        <p class="small mb-0 text-muted" style="white-space: pre-line;">${p.problema_que_resuelve || 'No especificado.'}</p>
      </div>
      <div class="p-3 bg-light rounded mb-3">
        <h6 class="fw-bold"><i class="bi bi-globe-americas me-1"></i>Impacto / ODS Principal</h6>
        ${p.impacto_ods
          ? `<span class="badge bg-primary-subtle text-primary fw-semibold">${p.impacto_ods}</span>`
          : `<p class="small mb-0 text-muted">No especificado.</p>`}
      </div>
      <div class="p-3 bg-light rounded mb-3">
        <h6 class="fw-bold"><i class="bi bi-box-arrow-up-right me-1"></i>Enlace Técnico / Demo</h6>
        ${p.enlace_tecnico_url
          ? `<a href="${p.enlace_tecnico_url}" target="_blank" class="btn btn-sm btn-outline-primary text-break">${p.enlace_tecnico_url}</a>`
          : `<p class="small mb-0 text-muted">No especificado.</p>`}
      </div>
      <div class="p-3 bg-light rounded mb-3">
        <h6 class="fw-bold"><i class="bi bi-box me-1"></i>Requerimientos de Exhibición</h6>
        <p class="small mb-0 text-muted" style="white-space: pre-line;">${p.requerimientos_exhibicion || 'No especificado.'}</p>
      </div>`;

    Swal.fire({
      title: `<span class="badge bg-primary mb-1">${p.codigo_stand}</span><br><span class="fs-5">${p.titulo}</span>`,
      width: '850px',
      html: `
        <div class="text-start">
          ${bloqueFotoHTML(p)}

          <div class="d-flex flex-wrap gap-2 mb-3">
            <span class="badge bg-warning text-dark"><i class="bi bi-star-fill me-1"></i>${promedioGeneral} / 5</span>
            <span class="badge bg-secondary"><i class="bi bi-people-fill me-1"></i>${totalVotos} evaluación${totalVotos === 1 ? '' : 'es'}</span>
            <span class="badge bg-info text-dark"><i class="bi bi-speedometer2 me-1"></i>TRL ${p.trl_nivel}</span>
            <span class="badge bg-primary-subtle text-primary border border-primary-subtle"><i class="bi bi-mortarboard-fill me-1"></i>${p.especialidad}</span>
          </div>

          <div class="row g-3 mb-3">
            <div class="col-md-6">
              <p class="mb-1"><strong>Código de Stand:</strong> ${p.codigo_stand}</p>
              <p class="mb-1"><strong>Especialidad:</strong> ${p.especialidad}</p>
              <p class="mb-1"><strong>Aplicación empresarial:</strong> ${p.sector_aplicacion || 'No especificada'}</p>
              <p class="mb-1"><strong>Docente Tutor:</strong> ${p.docente_tutor}</p>
              <p class="mb-1"><strong>Fecha de registro:</strong> ${fechaRegistro}</p>
            </div>
            <div class="col-md-6">
              <p class="mb-1"><strong>Integrantes:</strong> ${p.integrantes}</p>
              <p class="mb-1"><strong>Tecnologías usadas:</strong> ${p.tecnologias_usadas}</p>
              <p class="mb-1"><strong>Nivel TRL:</strong> <span class="badge bg-info text-dark">TRL ${p.trl_nivel}</span></p>
            </div>
          </div>

          <div class="p-3 bg-light rounded mb-3">
            <h6 class="fw-bold"><i class="bi bi-file-text me-1"></i>Resumen Ejecutivo</h6>
            <p class="small mb-0 text-muted" style="white-space: pre-line;">${p.resumen_ejecutivo || 'Sin resumen registrado.'}</p>
          </div>

          ${camposExtraModalHTML}

          ${criteriosHTML}

          <div class="row g-2 mb-3">
            ${p.pdf_poster_url ? `
              <div class="col-sm-6">
                <a href="${p.pdf_poster_url}" target="_blank" class="btn btn-outline-danger w-100">
                  <i class="bi bi-file-earmark-pdf me-1"></i>Ver Poster PDF
                </a>
              </div>
            ` : ''}
            ${p.video_pitch_url ? `
              <div class="col-sm-6">
                <a href="${p.video_pitch_url}" target="_blank" class="btn btn-outline-primary w-100">
                  <i class="bi bi-youtube me-1"></i>Video Pitch
                </a>
              </div>
            ` : ''}
          </div>

          <div class="row g-2 mb-3">
            <div class="col-md-6 mx-auto">
              <div class="p-3 bg-white rounded border h-100 text-center">
                <small class="text-muted d-block mb-2"><i class="bi bi-qr-code-scan me-1"></i>Escanea con tu móvil para evaluar</small>
                <img src="https://api.qrserver.com/v1/create-qr-code/?size=130x130&data=${encodeURIComponent(window.location.origin + '/evaluar.html?stand=' + p.codigo_stand)}" alt="QR Stand" class="img-fluid">
                <small class="text-muted d-block mt-1 text-break">${window.location.origin}/evaluar.html?stand=${p.codigo_stand}</small>
              </div>
            </div>
          </div>

          ${comentariosHTML}

          <div class="d-grid gap-2 mt-3">
            <button class="btn btn-primary btn-lg fw-bold rounded-pill" onclick="window.location.href='evaluar.html?stand=${encodeURIComponent(p.codigo_stand)}'">
              <i class="bi bi-clipboard-check me-2"></i>Evaluar este Proyecto
            </button>
            <button class="btn btn-outline-secondary rounded-pill" onclick="imprimirFichaProyecto()">
              <i class="bi bi-printer me-2"></i>Imprimir Ficha Técnica (A4)
            </button>
          </div>
        </div>
      `,
      showCancelButton: true,
      cancelButtonText: 'Cerrar',
    });
  } catch (err) {
    Swal.fire('Error', 'No se pudo cargar la información del proyecto.', 'error');
  }
}

