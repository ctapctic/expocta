    let ADMIN_ID = null;

    /* ── AUTO-ACCESO CON LA SESIÓN GUARDADA (admin.html) ── */
    (function autoAccesoSesion() {
      try {
        const u = JSON.parse(localStorage.getItem('expotecnia_user') || 'null');
        if (u && u.rol === 'admin' && u.id) {
          ADMIN_ID = u.id;
          document.getElementById('auth-overlay').style.display = 'none';
          document.getElementById('main-content').style.display = 'block';
          recargarConfig();
        }
      } catch (e) { /* sin sesión válida: queda el ingreso manual */ }
    })();

    /* ── AUTENTICACIÓN ── */
    async function autenticarAdmin() {
      const idInput = document.getElementById('auth-usuario-id');
      const errorDiv = document.getElementById('auth-error');
      const btn = document.getElementById('auth-btn');
      const uid = parseInt(idInput.value, 10);

      if (!uid || uid < 1) {
        errorDiv.textContent = 'Ingresa un ID de usuario válido.';
        errorDiv.style.display = 'block';
        return;
      }

      btn.disabled = true;
      btn.innerHTML = '<span class="spinner-border spinner-border-sm me-2"></span>Verificando...';
      errorDiv.style.display = 'none';

      try {
        // Verificar que el usuario existe y es admin consultando la configuración con su ID
        const res = await fetch('/api/config', {
          headers: { 'x-usuario-id': uid }
        });
        const data = await res.json();

        if (!data.success) throw new Error('No autorizado');

        // Intentar un PUT vacío para verificar permisos reales de admin
        const verify = await fetch('/api/config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'x-usuario-id': uid },
          body: JSON.stringify({})
        });
        const vData = await verify.json();

        // Si responde 403, no es admin
        if (verify.status === 403) {
          throw new Error(vData.message || 'No eres administrador.');
        }

        // Acceso concedido
        ADMIN_ID = uid;
        document.getElementById('auth-overlay').style.display = 'none';
        document.getElementById('main-content').style.display = 'block';
        recargarConfig();
      } catch (err) {
        errorDiv.textContent = err.message || 'Error de autenticación.';
        errorDiv.style.display = 'block';
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-unlock-fill me-2"></i>Verificar acceso';
      }
    }

    // Enter en el input de auth
    document.getElementById('auth-usuario-id').addEventListener('keydown', e => {
      if (e.key === 'Enter') autenticarAdmin();
    });

    /* ── CARGAR CONFIG ── */
    async function recargarConfig() {
      try {
        const res  = await fetch('/api/config');
        const data = await res.json();
        if (!data.success) return;

        const c = data.config;

        // Poblar campos
        [
          'nombre_evento','anio_evento','institucion_organizadora',
          'institucion_padre','sede','mensaje_bienvenida',
          'logo_ministerio_url','logo_institucion_url','color_primario'
        ].forEach(k => {
          const el = document.getElementById(k);
          if (el && c[k]) el.value = c[k].valor || '';
        });

        // Sync color picker
        const colorVal = c.color_primario?.valor || '#38bdf8';
        document.getElementById('color_primario_picker').value = colorVal;
        document.getElementById('color_preview_text').style.color = colorVal;

        // Ventanas de tiempo (ISO UTC -> valor local del input datetime-local)
        CAMPOS_VENTANAS.forEach(k => {
          const el = document.getElementById(k);
          if (el) el.value = isoToLocalInput(c[k]?.valor || '');
        });
        actualizarEstadoVentanasDesdeFormulario();

        // Logo previews
        previewLogo(document.getElementById('logo_ministerio_url'), 'prev-ministerio');
        previewLogo(document.getElementById('logo_institucion_url'), 'prev-institucion');

        // Vista previa header
        actualizarPreview(c);
      } catch (err) {
        console.error('Error cargando config:', err);
      }
    }

    /* ── VENTANAS DE TIEMPO ── */
    const CAMPOS_VENTANAS = ['registro_inicio', 'registro_fin', 'votacion_inicio', 'votacion_fin'];

    // ISO UTC -> "YYYY-MM-DDTHH:mm" en hora local del navegador (para datetime-local)
    function isoToLocalInput(iso) {
      if (!iso) return '';
      const d = new Date(iso);
      if (isNaN(d.getTime())) return '';
      const pad = (n) => String(n).padStart(2, '0');
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
    }

    // "YYYY-MM-DDTHH:mm" (hora local) -> ISO UTC (con Z)
    function localInputToISO(valor) {
      if (!valor) return '';
      const d = new Date(valor);
      if (isNaN(d.getTime())) return '';
      return d.toISOString();
    }

    function formatearFechaLocal(ms) {
      try {
        return new Date(ms).toLocaleString('es-PY', { dateStyle: 'short', timeStyle: 'short' });
      } catch (_) {
        return new Date(ms).toLocaleString();
      }
    }

    function textoEstadoVentana(inicioISO, finISO) {
      const ahora = Date.now();
      const ini = inicioISO ? Date.parse(inicioISO) : null;
      const fin = finISO ? Date.parse(finISO) : null;

      if ((!ini || isNaN(ini)) && (!fin || isNaN(fin))) {
        return { abierta: true, texto: 'Sin límites: siempre abierto.' };
      }
      if (ini && !isNaN(ini) && ahora < ini) {
        return { abierta: false, texto: `Cerrado. Se habilita el ${formatearFechaLocal(ini)}.` };
      }
      if (fin && !isNaN(fin) && ahora > fin) {
        return { abierta: false, texto: `Cerrado. Cerró el ${formatearFechaLocal(fin)}.` };
      }
      return {
        abierta: true,
        texto: fin && !isNaN(fin) ? `Abierto hasta el ${formatearFechaLocal(fin)}.` : 'Abierto.'
      };
    }

    function pintarEstadoVentana(idEl, estado) {
      const el = document.getElementById(idEl);
      if (!el) return;
      el.innerHTML = estado.abierta
        ? `<span class="text-success"><i class="bi bi-unlock-fill me-1"></i>${estado.texto}</span>`
        : `<span class="text-danger"><i class="bi bi-lock-fill me-1"></i>${estado.texto}</span>`;
    }

    function actualizarEstadoVentanasDesdeFormulario() {
      const leer = (id) => {
        const el = document.getElementById(id);
        return el ? localInputToISO(el.value) : '';
      };

      pintarEstadoVentana('estado-registro', textoEstadoVentana(leer('registro_inicio'), leer('registro_fin')));
      pintarEstadoVentana('estado-votacion', textoEstadoVentana(leer('votacion_inicio'), leer('votacion_fin')));
    }

    // Previsualización en vivo al editar las fechas
    CAMPOS_VENTANAS.forEach(k => {
      const el = document.getElementById(k);
      if (el) el.addEventListener('input', actualizarEstadoVentanasDesdeFormulario);
    });

    /* ── GUARDAR ── */
    async function guardarConfiguracion(e) {
      e.preventDefault();
      const btn = document.getElementById('btn-guardar');
      const overlay = document.getElementById('loading-overlay');
      btn.disabled = true;
      overlay.classList.add('active');

      const form = document.getElementById('config-form');
      const data = new FormData(form);

      // datetime-local (hora local) -> ISO 8601 UTC para el backend
      CAMPOS_VENTANAS.forEach(k => {
        const raw = data.get(k);
        if (typeof raw === 'string') data.set(k, localInputToISO(raw));
      });

      // Validación: apertura anterior al cierre
      for (const tipo of ['registro', 'votacion']) {
        const ini = data.get(`${tipo}_inicio`);
        const fin = data.get(`${tipo}_fin`);
        if (ini && fin && new Date(ini) >= new Date(fin)) {
          mostrarToast(`La apertura de ${tipo} debe ser anterior al cierre.`, true);
          btn.disabled = false;
          overlay.classList.remove('active');
          return;
        }
      }

      // Si se eligió un archivo de logo, se envía el binario y se descarta la URL del campo
      [
        ['logo_ministerio', 'logo_ministerio_url', 'logo_ministerio_file'],
        ['logo_institucion', 'logo_institucion_url', 'logo_institucion_file']
      ].forEach(([field, urlKey, fileKey]) => {
        const fileInput = document.getElementById(fileKey);
        const file = fileInput && fileInput.files && fileInput.files[0];
        if (file) {
          data.append(field, file);
          data.delete(urlKey);
        }
      });

      try {
        const res = await fetch('/api/config', {
          method: 'PUT',
          headers: {
            'x-usuario-id': ADMIN_ID
          },
          body: data
        });
        const result = await res.json();

        if (result.success) {
          mostrarToast('✅ ' + result.message, false);
          limpiarInputsLogo();
          recargarConfig();
        } else {
          mostrarToast('❌ ' + result.message, true);
        }
      } catch (err) {
        mostrarToast('❌ Error de red: ' + err.message, true);
      } finally {
        btn.disabled = false;
        overlay.classList.remove('active');
      }
    }

    /* ── PREVIEW LOGO ── */
    function previewLogo(input, previewId) {
      const img = document.getElementById(previewId);
      const url = input.value.trim();
      if (url) {
        img.src = url;
        img.classList.add('visible');
        img.onerror = () => img.classList.remove('visible');
      } else {
        img.classList.remove('visible');
      }
    }

    /* ── PREVIEW LOGO DESDE ARCHIVO ── */
    function previewLogoFile(input, previewId) {
      const img = document.getElementById(previewId);
      const file = input.files && input.files[0];
      if (file) {
        img.src = URL.createObjectURL(file);
        img.classList.add('visible');
        // El archivo tiene prioridad: limpia el campo de URL para no pisar el upload
        const urlInput = document.getElementById(input.id.replace('_file', '_url'));
        if (urlInput) urlInput.value = '';
      } else {
        previewLogo(document.getElementById(input.id.replace('_file', '_url')), previewId);
      }
    }

    function limpiarInputsLogo() {
      ['logo_ministerio_file', 'logo_institucion_file'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = '';
      });
    }

    /* ── SYNC COLOR PICKER ── */
    function syncColorPicker(input) {
      const val = input.value.trim();
      if (/^#[0-9A-Fa-f]{6}$/.test(val)) {
        document.getElementById('color_primario_picker').value = val;
        document.getElementById('color_preview_text').style.color = val;
      }
    }

    /* ── PREVIEW HEADER ── */
    function actualizarPreview(c) {
      const get = (k) => c[k]?.valor || '';
      const nombre    = get('nombre_evento') || 'Expotecnia EFTP';
      const anio      = get('anio_evento');
      const inst      = get('institucion_organizadora');
      const padre     = get('institucion_padre');
      const sede      = get('sede');
      const logoMin   = get('logo_ministerio_url');
      const logoInst  = get('logo_institucion_url');
      const color     = get('color_primario') || '#38bdf8';

      document.getElementById('prev-title').textContent = nombre + (anio ? ` ${anio}` : '');
      document.getElementById('prev-title').style.color = '#fff';
      document.getElementById('prev-subtitle').innerHTML =
        `${inst ? `<span style="color:${color}">${inst}</span>` : ''}` +
        (padre ? ` &bull; ${padre}` : '') +
        (sede  ? ` &bull; <i class="bi bi-geo-alt-fill"></i> ${sede}` : '');

      const logosDiv = document.getElementById('prev-logos');
      logosDiv.innerHTML = '';
      if (logoMin) {
        const img = document.createElement('img');
        img.src = logoMin; img.style.cssText = 'height:50px;object-fit:contain;filter:brightness(0) invert(1)';
        img.onerror = () => img.remove();
        logosDiv.appendChild(img);
      }
      if (logoInst) {
        const img = document.createElement('img');
        img.src = logoInst; img.style.cssText = 'height:50px;object-fit:contain;filter:brightness(0) invert(1)';
        img.onerror = () => img.remove();
        logosDiv.appendChild(img);
      }
    }

    /* ── TOAST ── */
    function mostrarToast(msg, isError = false) {
      const t = document.getElementById('toast-msg');
      t.textContent = msg;
      t.className = 'toast-msg' + (isError ? ' error' : '');
      t.classList.add('show');
      setTimeout(() => t.classList.remove('show'), 3500);
    }
