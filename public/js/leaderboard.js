    const REFRESH_MS = 10000;
    const FALLBACK = 'https://images.unsplash.com/photo-1581092160607-ee22621dd758?w=600&auto=format&fit=crop&q=80';

    document.addEventListener('DOMContentLoaded', () => {
      // Cargar config institucional primero, luego leaderboard
      loadConfig().then(() => {
        loadLeaderboard();
        setInterval(loadLeaderboard, REFRESH_MS);
      });
    });

    /* CONFIG INSTITUCIONAL */
    async function loadConfig() {
      try {
        const res = await fetch('/api/config');
        const data = await res.json();
        if (!data.success) return;
        renderHeader(data.config);
      } catch (err) {
        console.warn('Config no disponible, usando defaults:', err.message);
      }
    }

    function renderHeader(c) {
      const get = (k) => (c[k]?.valor || '').trim();

      const nombre = get('nombre_evento') || 'Expotecnia EFTP';
      const anio = get('anio_evento') || '';
      const inst = get('institucion_organizadora') || '';
      const padre = get('institucion_padre') || '';
      const sede = get('sede') || '';
      const logoMin = get('logo_ministerio_url');
      const logoInst = get('logo_institucion_url');
      const color = get('color_primario') || '#38bdf8';

      // Titulo
      const titulo = anio && !nombre.includes(anio) ? `${nombre} ${anio}` : nombre;
      document.getElementById('header-title').textContent = `${titulo} \u2022 TOP 5 LEADERBOARD`;

      // Institución
      const instEl = document.getElementById('header-inst');
      if (instEl) {
        instEl.textContent = inst || 'RANKING OFICIAL EN TIEMPO REAL';
        instEl.style.color = color;
      }

      // Sede
      const sedeEl = document.getElementById('header-sede');
      if (sedeEl && sede) {
        sedeEl.innerHTML = ` &bull; <i class="bi bi-geo-alt-fill"></i> ${sede}`;
      }

      // Institución padre / ministerio
      const padreEl = document.getElementById('header-padre');
      if (padreEl && padre) {
        padreEl.innerHTML = `<i class="bi bi-diagram-3 me-1" style="color:${color};"></i>${padre}`;
      }

      // Logos (misma línea del título)
      const logosDiv = document.getElementById('logos-container');
      if (logosDiv) {
        logosDiv.innerHTML = '';
        const addLogo = (url, alt) => {
          if (!url) return;
          const img = document.createElement('img');
          img.src = url; img.alt = alt;
          img.style.cssText = 'height:48px;max-width:170px;object-fit:contain;background:#fff;border-radius:10px;padding:4px 8px;';
          img.onerror = () => img.remove();
          logosDiv.appendChild(img);
        };
        addLogo(logoMin, 'Logo Ministerio');
        addLogo(logoInst, 'Logo Institución');
      }

      // Color primario: actualizar variable CSS
      document.documentElement.style.setProperty('--accent', color);
    }

    async function loadLeaderboard() {
      try {
        const res = await fetch('/api/proyectos/leaderboard');
        const data = await res.json();
        if (!data.success) return;

        if (data.telemetria) renderStats(data.telemetria);
        if (data.leaderboard) renderCards(data.leaderboard);
        if (data.ticker) {
          renderTicker(data.ticker);
          renderFeed(data.ticker);
        }
        if (data.charlas_proximas || data.charlas_top) renderCharlas(data);
        if (data.ofertas_top) renderOfertas(data.ofertas_top);
        if (data.empresas) renderEmpresas(data.empresas);

        const badge = document.getElementById('update-badge-sm');
        const t = new Date().toLocaleTimeString('es-ES');
        if (badge) badge.innerHTML = `<i class="bi bi-clock-history me-1 text-info"></i>Actualizado: ${t}`;
      } catch (err) {
        console.error('Error leaderboard:', err);
      }
    }

    /* STATS */
    function renderStats(t) {
      setText('stat-acreditaciones', Number(t.total_acreditaciones).toLocaleString('es'));
      setText('stat-evaluaciones', Number(t.total_evaluaciones).toLocaleString('es'));
      setText('stat-prospectos', Number(t.tasa_captacion_prospectos).toLocaleString('es'));
      setText('stat-stands', Number(t.stands_activos).toLocaleString('es'));
    }

    function setText(id, val) {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    }

    /* LEADERBOARD CARDS */
    function renderCards(proyectos) {
      const container = document.getElementById('leaderboard-container');
      if (!container) return;
      if (!proyectos.length) {
        container.innerHTML = '<div class="text-center py-5 text-muted"><h4>Esperando primeras valoraciones...</h4></div>';
        return;
      }
      container.innerHTML = proyectos.map((p, i) => buildCard(p, i + 1)).join('');
    }

    function buildCard(p, pos) {
      const rankClass = pos === 1 ? 'rank-1' : pos === 2 ? 'rank-2' : pos === 3 ? 'rank-3' : 'rank-other';
      const cardClass = pos <= 3 ? `pos-${pos}` : '';
      const medal = pos === 1 ? '🥇' : pos === 2 ? '🥈' : pos === 3 ? '🥉' : `#${pos}`;
      const imgUrl = p.imagen_url || FALLBACK;
      const scoreCC = pos === 1 ? '' : pos === 2 ? 'pos-2' : pos === 3 ? 'pos-3' : '';

      // Criterios de evaluación: el leaderboard solo trae promedio general;
      // si existieran desgloses se usarían, si no se repite el promedio
      const inn = p.promedio_innovacion != null ? p.promedio_innovacion : p.promedio;
      const tec = p.promedio_dominio_tecnico != null ? p.promedio_dominio_tecnico : p.promedio;
      const pre = p.promedio_presentacion != null ? p.promedio_presentacion : p.promedio;
      const imp = p.promedio_impacto != null ? p.promedio_impacto : p.promedio;

      const tutor = p.docente_tutor
        ? `<span class="badge" style="background:rgba(167,139,250,0.15);color:var(--purple);"><i class="bi bi-person-badge me-1"></i>${p.docente_tutor}</span>`
        : '';

      return `
        <div class="lb-card ${cardClass}">
          <div class="d-flex flex-wrap align-items-center gap-3">
            <div class="rank-badge ${rankClass}">${medal}</div>
            <div class="thumb-wrap d-none d-sm-flex">
              <img src="${imgUrl}" alt="${p.titulo}" onerror="this.src='${FALLBACK}'">
            </div>
            <div class="flex-grow-1" style="min-width:0;">
              <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
                <span class="badge bg-primary fw-bold">${p.codigo_stand}</span>
                <span class="badge" style="background:rgba(56,189,248,0.15);color:var(--accent);">${p.especialidad}</span>
                <span class="badge bg-secondary">TRL ${p.trl_nivel}</span>
                ${tutor}
              </div>
              <h5 class="fw-bold text-white mb-2">${p.titulo}</h5>
              <div class="row g-1 lb-criteria">
                ${criteriaBar('Innovación', inn, 'bar-innov')}
                ${criteriaBar('Técnico', tec, 'bar-tecnico')}
                ${criteriaBar('Presentación', pre, 'bar-present')}
                ${criteriaBar('Impacto', imp, 'bar-impacto')}
              </div>
            </div>
            <div class="text-center flex-shrink-0" style="min-width:90px;">
              <div class="score-main ${scoreCC}">${Number(p.promedio).toFixed(2)}</div>
              <div style="font-size:0.68rem;color:#64748b;text-transform:uppercase;letter-spacing:0.1em;">/ 5.00</div>
              <div class="mt-1" style="font-size:0.78rem;color:#94a3b8;">
                <i class="bi bi-people-fill me-1 text-info"></i>${p.total_votos} votos
              </div>
            </div>
          </div>
        </div>
      `;
    }

    function criteriaBar(label, val, cls) {
      const pct = Math.min(100, Math.round((Number(val) / 5) * 100));
      return `
        <div class="col-6 col-md-3">
          <div class="crit-label">${label} <strong style="color:#e2e8f0;">${Number(val).toFixed(1)}</strong></div>
          <div class="score-bar"><div class="score-bar-fill ${cls}" style="width:${pct}%"></div></div>
        </div>
      `;
    }

    /* TICKER */
    function renderTicker(items) {
      const wrap = document.getElementById('ticker-content');
      if (!wrap || !items.length) return;
      wrap.innerHTML = items.map(ev => `
        <span class="ticker-item">
          <span style="width:7px;height:7px;background:var(--green);border-radius:50%;display:inline-block;"></span>
          <span class="tick-badge">${ev.codigo}</span>
          <span>${ev.titulo}</span>
          <i class="bi ${ev.tipo === 'charla' ? 'bi-easel2-fill' : ev.tipo === 'empresa' ? 'bi-building-fill' : 'bi-star-fill text-warning'}"
             style="font-size:0.75rem;${ev.tipo === 'charla' ? 'color:var(--purple);' : ev.tipo === 'empresa' ? 'color:var(--green);' : ''}"></i>
          <span class="tick-score">${Number(ev.nota).toFixed(1)}</span>
          <span style="color:#334155;">— ${ev.usuario} (${ev.rol})</span>
        </span>
      `).join('');
    }

    /* FEED */
    function renderFeed(items) {
      const list = document.getElementById('feed-list');
      if (!list || !items.length) return;
      list.innerHTML = items.map(ev => {
        const ago = timeAgo(new Date(ev.fecha), ev.segundos_hace);
        const esCharla = ev.tipo === 'charla';
        const esEmpresa = ev.tipo === 'empresa';
        const icono = esCharla ? 'bi-easel2-fill' : esEmpresa ? 'bi-building-fill' : 'bi-geo-alt-fill';
        const iconStyle = esCharla
          ? 'style="color:var(--purple);"'
          : esEmpresa
            ? 'style="color:var(--green);"'
            : 'style="color:#22d3ee;"';
        return `
          <div class="feed-item">
            <span class="feed-dot"></span>
            <div class="flex-grow-1" style="overflow:hidden;">
              <div class="fw-semibold text-white" style="font-size:0.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                <i class="bi ${icono} me-1" ${iconStyle}></i>${ev.codigo} &mdash; ${ev.titulo}
              </div>
              <div style="font-size:0.73rem;color:#64748b;">
                ${ev.usuario}
                <span class="badge ms-1" style="background:rgba(255,255,255,0.06);color:#94a3b8;font-size:0.62rem;">${ev.rol}</span>
                &middot; ${ago}
              </div>
            </div>
            <span class="feed-score-pill"><i class="bi bi-star-fill me-1" style="font-size:0.6rem;"></i>${Number(ev.nota).toFixed(1)}</span>
          </div>
        `;
      }).join('');
    }

    /* CHARLAS */
    function renderCharlas(data) {
      const list = document.getElementById('charlas-list');
      if (!list) return;
      const prox = data.charlas_proximas || [];
      const top = (data.charlas_top || []).filter(c => c.total_votos > 0);

      let html = '';
      if (prox.length) {
        html += '<div class="charlas-section">Próximas</div>';
        html += prox.map(c => charlaItem(c)).join('');
      }
      if (top.length) {
        html += '<div class="charlas-section">Mejor puntuadas</div>';
        html += top.map((c, i) => charlaItem(c, i + 1)).join('');
      }
      list.innerHTML = html ||
        '<div class="feed-item text-muted small">Programación de charlas no disponible.</div>';
    }

    function charlaItem(c, rank) {
      // horario_str llega como "YYYY-MM-DD HH:MM:SS" (hora local sin zona): se usa tal cual.
      const hs = c.horario_str || '';
      const when = hs ? hs.slice(11, 16) : '--:--';
      const day = hs
        ? new Date(`${hs.slice(0, 10)}T12:00:00`).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
        : '';
      const rankBadge = rank ? `<span class="tick-badge me-1">#${rank}</span>` : '';
      const notaPill = c.total_votos > 0
        ? `<span class="feed-score-pill"><i class="bi bi-star-fill me-1" style="font-size:0.6rem;"></i>${Number(c.promedio).toFixed(1)}</span>`
        : '';
      const lugar = c.ubicacion
        ? ` &middot; <i class="bi bi-geo-alt me-1"></i>${c.ubicacion}`
        : '';

      return `
        <div class="feed-item">
          <div class="text-center flex-shrink-0" style="min-width:56px;">
            <div class="fw-bold" style="font-size:0.95rem;line-height:1;color:var(--purple);">${when}</div>
            <div style="font-size:0.62rem;color:#64748b;text-transform:uppercase;">${day}</div>
          </div>
          <div class="flex-grow-1" style="overflow:hidden;">
            <div class="fw-semibold text-white" style="font-size:0.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${rankBadge}${c.titulo}
            </div>
            <div style="font-size:0.73rem;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${c.foto_expositor_url
                ? `<img src="${c.foto_expositor_url}" alt="" style="width:18px;height:18px;object-fit:cover;border-radius:50%;vertical-align:-4px;margin-right:4px;" onerror="this.remove()">`
                : '<i class="bi bi-person me-1"></i>'}${c.expositor}${lugar}
            </div>
          </div>
          ${notaPill}
        </div>
      `;
    }

    /* OFERTAS EFTP */
    function renderOfertas(items) {
      const list = document.getElementById('ofertas-list');
      if (!list) return;
      if (!items.length) {
        list.innerHTML = '<div class="feed-item text-muted small">Ofertas EFTP no disponibles.</div>';
        return;
      }
      list.innerHTML = items.map((o, i) => `
        <div class="feed-item">
          <div class="rank-badge rank-other flex-shrink-0" style="min-width:34px;height:34px;font-size:0.85rem;">${i + 1}</div>
          <div class="flex-grow-1" style="overflow:hidden;">
            <div class="fw-semibold text-white" style="font-size:0.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
              ${o.nombre_carrera}
            </div>
            <div style="font-size:0.73rem;color:#64748b;">
              <span class="badge me-1" style="background:rgba(56,189,248,0.15);color:var(--accent);font-size:0.62rem;">${o.modalidad}</span>
              ${o.duracion_horas} hs
            </div>
          </div>
          <span class="feed-score-pill" style="background:rgba(16,185,129,0.15);color:var(--green);"
            title="Prospectos registrados">
            <i class="bi bi-mortarboard me-1" style="font-size:0.6rem;"></i>${o.total_prospectos}
          </span>
        </div>
      `).join('');
    }

    /* EMPRESAS */
    function renderEmpresas(items) {
      const list = document.getElementById('empresas-list');
      if (!list) return;
      if (!items.length) {
        list.innerHTML = '<div class="feed-item text-muted small">Sin empresas registradas.</div>';
        return;
      }
      list.innerHTML = items.map(e => {
        const logo = e.logo_url
          ? `<img src="${e.logo_url}" alt="${e.nombre_corporativo}"
               style="width:38px;height:38px;border-radius:8px;object-fit:contain;background:#fff;padding:3px;border:1px solid var(--border);flex-shrink:0;"
               onerror="this.outerHTML='<span class=\\'bi bi-building\\' style=\\'font-size:1.3rem;color:var(--pink);flex-shrink:0;\\'></span>'">`
          : `<span class="bi bi-building" style="font-size:1.3rem;color:var(--pink);flex-shrink:0;"></span>`;
        return `
          <div class="feed-item">
            ${logo}
            <div class="flex-grow-1" style="overflow:hidden;">
              <div class="fw-semibold text-white" style="font-size:0.82rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${e.nombre_corporativo}
              </div>
              <div style="font-size:0.7rem;color:#64748b;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">
                ${e.descripcion || ''}
              </div>
            </div>
            <div class="text-end flex-shrink-0">
              <span class="feed-score-pill"><i class="bi bi-star-fill me-1" style="font-size:0.6rem;"></i>${Number(e.promedio || 0).toFixed(1)}</span>
              <div style="font-size:0.62rem;color:#64748b;margin-top:2px;">${e.total_votos === 1 ? '1 voto' : `${e.total_votos} votos`}</div>
            </div>
          </div>
        `;
      }).join('');
    }

    function timeAgo(date, segundos) {
      const s = segundos != null
        ? Math.max(0, Math.floor(segundos))
        : Math.floor((Date.now() - date.getTime()) / 1000);
      if (s < 60) return 'hace un momento';
      if (s < 3600) return `hace ${Math.floor(s / 60)}min`;
      return `hace ${Math.floor(s / 3600)}h`;
    }
