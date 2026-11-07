/**
 * EXPOTECNIA EFTP - VENTANAS DE TIEMPO (REGISTRO / VOTACIÓN)
 *
 * Uso:
 *   await Ventanas.cargar();                 // precarga el estado
 *   Ventanas.abierta('votacion');            // consulta sincrónica sobre el cache
 *   await Ventanas.bloquear('votacion');     // true si puede continuar, false si cerró
 *   Ventanas.mensaje('registro');            // texto listo para mostrar
 *
 * Cualquier contenedor con [data-ventanas-banner] muestra el estado de las
 * ventanas configuradas.
 */
(function () {
  'use strict';

  const TTL_MS = 60000;
  const REFRESH_MS = 60000;

  const state = {
    ventanas: null,
    at: 0,
    promesa: null
  };

  const NOMBRES = {
    registro: 'Registro',
    votacion: 'Votación'
  };

  const ACCIONES = {
    registro: 'registrarte o dejar tus datos',
    votacion: 'votar'
  };

  function parseMs(iso) {
    if (!iso) return null;
    const ms = Date.parse(iso);
    return Number.isFinite(ms) ? ms : null;
  }

  function abiertaSegun(ventana) {
    if (!ventana) return true;
    const ahora = Date.now();
    const inicio = parseMs(ventana.inicio);
    const fin = parseMs(ventana.fin);
    if (inicio != null && ahora < inicio) return false;
    if (fin != null && ahora > fin) return false;
    return true;
  }

  function tieneLimites(ventana) {
    return !!(ventana && (ventana.inicio || ventana.fin));
  }

  function formatoFecha(iso) {
    const ms = parseMs(iso);
    if (ms == null) return '';
    try {
      return new Date(ms).toLocaleString('es-PY', {
        dateStyle: 'short',
        timeStyle: 'short'
      });
    } catch (_) {
      return new Date(ms).toLocaleString();
    }
  }

  async function cargar(force) {
    const ahora = Date.now();
    if (!force && state.ventanas && ahora - state.at < TTL_MS) {
      return state.ventanas;
    }
    if (state.promesa) return state.promesa;

    state.promesa = (async () => {
      try {
        const res = await fetch('/api/config/ventanas', { cache: 'no-store' });
        const data = await res.json();
        if (data.success && data.ventanas) {
          // Normalizar campos por si el backend agrega información extra.
          state.ventanas = {
            registro: data.ventanas.registro || { inicio: null, fin: null, abierta: true },
            votacion: data.ventanas.votacion || { inicio: null, fin: null, abierta: true }
          };
          state.at = Date.now();
          renderBanners();
        }
      } catch (_) {
        // Sin conexión: se asume abierto para no bloquear la navegación.
      } finally {
        state.promesa = null;
      }
      return state.ventanas;
    })();

    return state.promesa;
  }

  function abierta(tipo) {
    if (!state.ventanas) return true;
    return abiertaSegun(state.ventanas[tipo]);
  }

  function mensaje(tipo) {
    const nombre = NOMBRES[tipo] || 'La acción';
    const ventana = state.ventanas && state.ventanas[tipo];

    if (!ventana || !tieneLimites(ventana)) {
      return `${nombre} abierto sin límite de horario.`;
    }

    const ahora = Date.now();
    const inicio = parseMs(ventana.inicio);
    const fin = parseMs(ventana.fin);

    if (!abiertaSegun(ventana)) {
      if (inicio != null && ahora < inicio) {
        return `${nombre} se habilita el ${formatoFecha(ventana.inicio)}.`;
      }
      if (fin != null && ahora > fin) {
        return `${nombre} cerró el ${formatoFecha(ventana.fin)}.`;
      }
      return `${nombre} está cerrado en este momento.`;
    }

    if (fin != null) {
      return `${nombre} abierto hasta el ${formatoFecha(ventana.fin)}.`;
    }
    if (inicio != null) {
      return `${nombre} habilitado desde el ${formatoFecha(ventana.inicio)}.`;
    }
    return `${nombre} abierto.`;
  }

  async function verificar(tipo, options) {
    const force = options && options.force;
    await cargar(force);
    return abierta(tipo);
  }

  /**
   * Si la ventana está cerrada muestra un aviso y devuelve false.
   * Pensado para usar al inicio de una acción (abrir modal, enviar formulario).
   */
  async function bloquear(tipo) {
    const permitido = await verificar(tipo, { force: true });
    if (permitido) return true;

    const texto = mensaje(tipo);
    if (typeof Swal !== 'undefined') {
      Swal.fire({
        icon: 'warning',
        title: tipo === 'votacion' ? 'Votación cerrada' : 'Registro cerrado',
        text: texto,
        confirmButtonColor: '#2563eb'
      });
    } else {
      window.alert(texto);
    }
    return false;
  }

  function bannerHTML(tipo) {
    const ventana = state.ventanas && state.ventanas[tipo];
    if (!tieneLimites(ventana)) return '';

    const esAbierta = abiertaSegun(ventana);
    const clase = esAbierta ? 'border-success-subtle bg-success-subtle text-success-emphasis' : 'border-danger-subtle bg-danger-subtle text-danger-emphasis';
    const icono = esAbierta ? 'bi-unlock-fill' : 'bi-lock-fill';
    const detalle = esAbierta && ventana.fin
      ? `Cierra el ${formatoFecha(ventana.fin)}`
      : (!esAbierta ? mensaje(tipo) : '');

    return `
      <div class="d-flex align-items-start gap-2 border ${clase} rounded-3 px-3 py-2 small">
        <i class="bi ${icono} mt-1"></i>
        <div>
          <strong>${NOMBRES[tipo]}: ${esAbierta ? 'abierto' : 'cerrado'}</strong>
          ${detalle ? `<span class="d-block">${detalle}</span>` : ''}
        </div>
      </div>
    `;
  }

  function renderBanners() {
    const contenedores = document.querySelectorAll('[data-ventanas-banner]');
    if (!contenedores.length) return;

    const html = ['registro', 'votacion'].map(bannerHTML).filter(Boolean).join('');
    contenedores.forEach((el) => {
      if (!html) {
        el.innerHTML = '';
        el.classList.add('d-none');
      } else {
        el.innerHTML = `<div class="d-flex flex-wrap gap-2 mb-3">${html}</div>`;
        el.classList.remove('d-none');
      }
    });
  }

  window.Ventanas = {
    cargar,
    abierta,
    verificar,
    bloquear,
    mensaje,
    formatoFecha,
    renderBanners,
    ACCIONES
  };

  document.addEventListener('DOMContentLoaded', () => {
    renderBanners();
    cargar().then(renderBanners);
    // Refresco periódico: detecta el paso de la hora de apertura/cierre.
    setInterval(() => {
      cargar(true).then(renderBanners);
    }, REFRESH_MS);
  });
})();
