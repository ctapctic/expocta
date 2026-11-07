/**
 * EXPOTECNIA EFTP - MAIN CLIENT FRAMEWORK & UTILITIES (CON RBAC POR ROL)
 */

let currentUser = JSON.parse(localStorage.getItem('expotecnia_user') || 'null');

/**
 * Retorna el usuario autenticado o null
 */
function getCurrentUser() {
  if (!currentUser) {
    currentUser = JSON.parse(localStorage.getItem('expotecnia_user') || 'null');
  }
  return currentUser;
}

/**
 * Guarda el usuario en LocalStorage y actualiza la UI global
 */
function setCurrentUser(user) {
  currentUser = user;
  localStorage.setItem('expotecnia_user', JSON.stringify(user));
  updateUserUI();
}

/**
 * Actualiza el indicador de perfil en el navbar y muestra/oculta el menú Admin según el rol
 */
function updateUserUI() {
  const userBtn = document.getElementById('user-profile-btn');
  const adminNavItem = document.getElementById('nav-admin-item');
  const u = getCurrentUser();

  if (userBtn) {
    if (u) {
      const roleColor = (u.rol === 'admin' || u.rol === 'docente') ? 'bg-danger' : 'bg-secondary';
      userBtn.innerHTML = `
        <i class="bi bi-person-circle text-info me-1"></i>
        <span class="d-none d-sm-inline">${u.nombre}</span>
        <span class="badge ${roleColor} ms-1 text-uppercase">${u.rol}</span>
      `;
    } else {
      userBtn.innerHTML = `
        <i class="bi bi-box-arrow-in-right me-1"></i>
        <span>Ingresar / PIN</span>
      `;
    }
  }

  // Visibilidad del menú "Panel de Gestión / Admin" según rol
  if (adminNavItem) {
    if (u && (u.rol === 'admin' || u.rol === 'docente')) {
      adminNavItem.style.display = 'block';
      adminNavItem.querySelector('a')?.classList.add('fw-bold', 'text-warning');
    } else {
      adminNavItem.style.display = 'none';
    }
  }
}

/**
 * Modal interactivo para Login/Registro por PIN
 */
async function showAuthModal(defaultRole = 'visitante', onSuccessCallback = null) {
  const u = getCurrentUser();
  if (u) {
    Swal.fire({
      title: `Hola, ${u.nombre}`,
      html: `
        <div class="text-start">
          <p class="mb-1"><strong>Email:</strong> ${u.email}</p>
          <p class="mb-1"><strong>Rol Actual:</strong> <span class="badge ${u.rol === 'admin' || u.rol === 'docente' ? 'bg-danger' : 'bg-primary'} text-uppercase">${u.rol}</span></p>
          <p class="mb-0"><strong>PIN Personal:</strong> <code class="fs-5">••••</code> <span class="text-muted small">(oculto por seguridad)</span></p>
        </div>
      `,
      showCancelButton: true,
      confirmButtonText: 'Cerrar Sesión',
      cancelButtonText: 'Cerrar',
      confirmButtonColor: '#ef4444'
    }).then((res) => {
      if (res.isConfirmed) {
        localStorage.removeItem('expotecnia_user');
        currentUser = null;
        updateUserUI();
        Swal.fire('Sesión cerrada', '', 'success').then(() => {
          if (window.location.pathname.endsWith('admin.html')) {
            window.location.href = 'index.html';
          }
        });
      }
    });
    return;
  }

  if (typeof Ventanas !== 'undefined') {
    try { await Ventanas.cargar(); } catch (_) { /* sin datos: se asume abierto */ }
  }

  Swal.fire({
    title: '🔑 Acceso por Email / PIN',
    html: `
      ${typeof Ventanas !== 'undefined' && !Ventanas.abierta('registro') ? `
        <div class="alert alert-warning text-start small py-2 mb-3">
          <i class="bi bi-lock-fill me-1"></i>
          <strong>${Ventanas.mensaje('registro')}</strong>
          Si ya tenés una cuenta, ingresá tu PIN para continuar.
        </div>
      ` : ''}
      <form id="swal-auth-form" class="text-start">
        <div class="mb-3">
          <label class="form-label fw-bold">Correo Electrónico</label>
          <input type="email" id="auth-email" class="form-control" placeholder="admin@expotecnia.edu o docente@..." required>
        </div>
        <div class="mb-3">
          <label class="form-label fw-bold">Nombre Completo (Opcional)</label>
          <input type="text" id="auth-nombre" class="form-control" placeholder="Ing. Carlos Pérez">
        </div>
        <div class="row">
          <div class="col-md-6 mb-3">
            <label class="form-label fw-bold">Rol de Acceso</label>
            <select id="auth-rol" class="form-select">
              <option value="visitante" ${defaultRole === 'visitante' || !['visitante', 'alumno', 'empresa'].includes(defaultRole) ? 'selected' : ''}>Visitante / Evaluador</option>
              <option value="alumno" ${defaultRole === 'alumno' ? 'selected' : ''}>Alumno / Estudiante</option>
              <option value="empresa" ${defaultRole === 'empresa' ? 'selected' : ''}>Empresa Patrocinadora</option>
            </select>
            <div class="form-text">Visitantes, alumnos y empresas se registran al instante. Docentes y administradores son habilitados por la organización.</div>
          </div>
          <div class="col-md-6 mb-3">
            <label class="form-label fw-bold">PIN Personal</label>
            <input type="password" id="auth-pin" class="form-control" placeholder="Ej: 9999 o 4321" maxlength="10">
          </div>
        </div>
      </form>
    `,
    showCancelButton: true,
    confirmButtonText: 'Ingresar a Expotecnia',
    confirmButtonColor: '#2563eb',
    cancelButtonText: 'Cancelar',
    preConfirm: () => {
      const email = document.getElementById('auth-email').value;
      const nombre = document.getElementById('auth-nombre').value;
      const rol = document.getElementById('auth-rol').value;
      const pin = document.getElementById('auth-pin').value;

      if (!email) {
        Swal.showValidationMessage('El correo electrónico es obligatorio.');
        return false;
      }

      return fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, nombre, rol, codigo_pin: pin })
      })
      .then(res => res.json())
      .then(data => {
        if (!data.success) throw new Error(data.message);
        return { usuario: data.usuario, pinInicial: data.pin_inicial };
      })
      .catch(err => {
        Swal.showValidationMessage(`Error: ${err.message}`);
      });
    }
  }).then((result) => {
    if (result.isConfirmed && result.value) {
      const { usuario, pinInicial } = result.value;
      setCurrentUser(usuario);
      Swal.fire({
        icon: 'success',
        title: '¡Acceso Concedido!',
        text: `Identificado como ${usuario.nombre} (${usuario.rol.toUpperCase()})`,
        timer: pinInicial ? 6000 : 1800,
        showConfirmButton: !pinInicial,
        html: pinInicial
          ? `<p class="mb-1">Identificado como <strong>${usuario.nombre}</strong> (${usuario.rol.toUpperCase()}).</p>
             <p class="mb-0">Tu PIN inicial es <code class="fs-4 fw-bold">${pinInicial}</code>. Guardalo: no volverá a mostrarse.</p>`
          : undefined
      }).then(() => {
        if (onSuccessCallback) onSuccessCallback(usuario);
      });
    }
  });
}

/**
 * Escáner / Búsqueda Directa de Stand por Código QR
 */
function openQRScannerModal() {
  Swal.fire({
    title: '📱 Escanear / Ingresar Stand QR',
    html: `
      <p class="text-muted small mb-3">Ingresa el código del Stand (ej: <strong>STAND-101</strong>):</p>
      <div class="input-group mb-3">
        <span class="input-group-text bg-primary text-white"><i class="bi bi-qr-code-scan"></i></span>
        <input type="text" id="qr-stand-input" class="form-control form-control-lg text-uppercase fw-bold" placeholder="STAND-101" autofocus>
      </div>
      <div class="d-flex justify-content-center gap-2">
        <button type="button" class="btn btn-outline-secondary btn-sm" onclick="document.getElementById('qr-stand-input').value='STAND-101'">STAND-101</button>
        <button type="button" class="btn btn-outline-secondary btn-sm" onclick="document.getElementById('qr-stand-input').value='STAND-102'">STAND-102</button>
        <button type="button" class="btn btn-outline-secondary btn-sm" onclick="document.getElementById('qr-stand-input').value='STAND-103'">STAND-103</button>
      </div>
    `,
    showCancelButton: true,
    confirmButtonText: 'Ir a Evaluar Stand',
    confirmButtonColor: '#06b6d4',
    cancelButtonText: 'Cerrar',
    preConfirm: () => {
      const code = document.getElementById('qr-stand-input').value.trim();
      if (!code) {
        Swal.showValidationMessage('Ingresa un código de Stand válido.');
        return false;
      }
      return code;
    }
  }).then((res) => {
    if (res.isConfirmed && res.value) {
      window.location.href = `evaluar.html?stand=${encodeURIComponent(res.value)}`;
    }
  });
}

// Logos institucionales (config del evento): se inyectan en cada
// contenedor [data-logos-institucionales]; sin logos configurados, no se muestra nada.
async function cargarLogosInstitucionales() {
  const contenedores = document.querySelectorAll('[data-logos-institucionales]');
  if (!contenedores.length) return;
  try {
    const res = await fetch('/api/config');
    const data = await res.json();
    if (!data.success) return;
    const c = data.config || {};
    const get = (k) => (c[k]?.valor || '').trim();
    const urls = [get('logo_ministerio_url'), get('logo_institucion_url')].filter(Boolean);
    if (!urls.length) return;
    contenedores.forEach((cont) => {
      cont.innerHTML = '';
      urls.forEach((url) => {
        const img = document.createElement('img');
        img.src = url;
        img.alt = 'Logo institucional';
        img.onerror = () => img.remove();
        cont.appendChild(img);
      });
      cont.classList.remove('d-none');
    });
  } catch (e) { /* sin config u offline: la página se ve igual sin logos */ }
}

// Resaltar elemento activo al cargar y actualizar UI de roles
document.addEventListener('DOMContentLoaded', () => {
  updateUserUI();
  cargarLogosInstitucionales();

  const path = window.location.pathname;
  document.querySelectorAll('.nav-link').forEach(link => {
    const href = link.getAttribute('href');
    // Las pestañas internas (sin href) son controladas por Bootstrap; no tocarlas.
    if (!href) return;
    if (path.endsWith(href) || (path === '/' && href === 'index.html')) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });
});
