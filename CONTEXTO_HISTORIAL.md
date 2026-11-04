# Expotecnia EFTP — Historial de Contexto y Documentación Técnica

> **Proyecto:** Plataforma Web para Expotecnia de EFTP (100% Online)  
> **Stack:** Node.js (CommonJS) + Express 4 + MariaDB (sin ORM) + Frontend Vanilla JS + Bootstrap 5.3  
> **Puerto:** 3000  
> **Fecha de inicio:** 2026

---

## 📋 Resumen del Proyecto

Plataforma web **100% online** para la Expotecnia de Educación Formativo-Técnica Profesional (EFTP) que permite:
- Exploración de proyectos/stands por código QR
- Evaluación en tiempo real de proyectos y charlas (rúbrica)
- Oferta formativa y registro de prospectos de admisión
- Conexión con empresas participantes
- Ranking en vivo (leaderboard con auto-refresh)
- Panel de administración para gestión CRUD completa

---

## 🏗️ Arquitectura

### Backend (`src/`)
```
src/
├── app.js                    # Bootstrap Express, middlewares, rutas, health check
├── config/
│   └── db.js                 # Pool MariaDB nativo + helper query() + testConnection()
├── middleware/
│   ├── authMiddleware.js     # Validación de roles (admin/docente/visitante) via x-usuario-id
│   ├── errorHandler.js       # Manejo centralizado de errores + notFoundHandler
│   └── multer.js             # Configuración uploads (imágenes, PDFs) → public/uploads/
├── routes/                   # Definición endpoints REST
│   ├── authRoutes.js         # POST /login, GET /perfil/:id, /resumen/:id
│   ├── proyectoRoutes.js     # CRUD proyectos + leaderboard + evaluar
│   ├── ofertaRoutes.js       # CRUD oferta + prospectos
│   ├── charlaRoutes.js       # CRUD charlas
│   ├── empresaRoutes.js      # CRUD empresas
│   ├── valoracionRoutes.js   # Valoraciones proyectos/charlas + stats
│   └── configRoutes.js       # GET/PUT configuración evento
├── controllers/              # Lógica de negocio
│   ├── authController.js
│   ├── proyectosController.js
│   ├── ofertaController.js
│   ├── charlaController.js
│   ├── empresaController.js
│   ├── valoracionController.js
│   └── configController.js
└── scripts/
    ├── init_config.js        # Inicializa tabla configuracion_evento
    ├── hash_pins.js          # Migra PINes texto plano → bcrypt (idempotente)
    └── add_sector_aplicacion.js  # Agrega sector_aplicacion + canoniza especialidad
```

### Frontend (`public/`)
```
public/
├── index.html                # Landing del evento
├── panel.html                # Portal visitante "todo en uno"
├── proyectos.html            # Stands con filtros y QR
├── evaluar.html              # Rúbrica de evaluación por QR (?stand=STAND-101)
├── leaderboard.html          # Ranking en vivo (auto-refresh 10s)
├── charlas.html              # Charlas del evento
├── ofertas.html              # Oferta formativa
├── empresas.html             # Empresas participantes
├── admin.html                # Panel gestión: proyectos, charlas, ofertas, empresas
├── config.html               # Configuración del evento (admin)
├── css/
│   ├── styles.css            # Global
│   ├── leaderboard.css
│   └── config.css
├── js/
│   ├── app.js                # Framework principal: auth modal, RBAC, QR scanner, logos
│   ├── index.js              # Landing logic
│   ├── panel.js              # Panel visitante
│   ├── proyectos.js          # Lista stands + filtros
│   ├── evaluar.js            # Formulario rúbrica + envío online
│   ├── leaderboard.js        # Ranking tiempo real
│   ├── charlas.js            # Lista charlas + valoración
│   ├── ofertas.js            # Oferta + prospectos
│   ├── empresas.js           # Lista empresas
│   ├── admin.js              # CRUD gestión (admin/docente)
│   └── config.js             # Config evento
├── icons/
│   └── icon-1024.png
└── uploads/                  # Archivos subidos + imágenes demo
```

---

## 🗄️ Base de Datos (MariaDB)

### Tablas Principales (9 tablas)

| Tabla | Descripción | Claves / Índices |
|-------|-------------|------------------|
| `usuarios` | Usuarios del sistema (visitante, alumno, docente, empresa, admin) | PK `id`, UK `email`, idx `rol` |
| `proyectos` | Stands/proyectos de la expo | PK `id`, UK `codigo_stand`, idx `especialidad` |
| `oferta_formativa` | Carreras/tecniciaturas EFTP | PK `id`, UK `codigo_oferta` |
| `prospectos_eftp` | Interesados en carreras | PK `id`, FK `usuario_id`, FK `oferta_id`, UK `usuario+oferta` |
| `charlas` | Charlas/conferencias del evento | PK `id`, UK `codigo_charla`, idx `horario` |
| `empresas` | Empresas patrocinadoras/participantes | PK `id`, UK `codigo_empresa` |
| `valoraciones_proyectos` | Evaluaciones rúbrica 4 criterios (1-5) | PK `id`, FK `usuario_id`, FK `proyecto_id`, UK `usuario+proyecto` |
| `valoraciones_charlas` | Evaluaciones charlas (contenido + expositor 1-5) | PK `id`, FK `usuario_id`, FK `charla_id`, UK `usuario+charla` |
| `configuracion_evento` | Config global clave-valor (logos, colores, textos) | PK `clave` |

### Datos Semilla (Usuarios de Prueba)

| Email | Rol | PIN (texto plano) |
|-------|-----|-------------------|
| admin@expotecnia.edu | admin | 9999 |
| carlos.evaluador@tech.com | visitante | 1234 |
| m.docente@instituto.edu | docente | 4321 |
| juan.alumno@estudiantes.edu | alumno | 1111 |
| contacto@innovatech.com | empresa | 5555 |

> **Nota:** PINes se guardan como hash bcrypt en `usuarios.codigo_pin`. Para migrar PINes en texto plano: `node src/scripts/hash_pins.js`

---

## 🔌 API REST — Endpoints Principales

### Auth
- `POST /api/auth/login` — Login/registro por email + PIN (devuelve `usuario` + `pin_inicial` si es nuevo)
- `GET /api/auth/perfil/:id` — Perfil (solo propio o admin)
- `GET /api/auth/resumen/:id` — Resumen actividad visitante

### Proyectos
- `GET /api/proyectos` — Listado con filtros
- `GET /api/proyectos/leaderboard` — Ranking ordenado por promedio
- `GET /api/proyectos/:codigo` — Detalle por código stand (ej. `STAND-101`)
- `POST /api/proyectos` — Crear (admin/docente, multipart)
- `PUT /api/proyectos/:id` — Editar (conserva archivos no reenviados)
- `POST /api/proyectos/evaluar` — Evaluar proyecto (rúbrica 4 criterios)
- `DELETE /api/proyectos/:id` — Eliminar (cascada valoraciones)

### Oferta Formativa
- `GET /api/oferta` — Listado
- `GET /api/oferta/:identifier` — Por id o código
- `POST /api/oferta` — Crear (admin/docente, brochure PDF)
- `PUT /api/oferta/:id` — Editar
- `DELETE /api/oferta/:id` — Eliminar (bloqueado si tiene prospectos → 409)
- `POST /api/oferta/prospecto` — Registrar prospecto admisión

### Charlas
- `GET /api/charlas` — Listado
- `GET /api/charlas/:identifier` — Por id o código
- `POST /api/charlas` — Crear (admin/docente, PDF diapositivas + foto expositor)
- `PUT /api/charlas/:id` — Editar
- `DELETE /api/charlas/:id` — Eliminar (cascada valoraciones)

### Empresas
- `GET /api/empresas` — Listado
- `GET /api/empresas/:identifier` — Por id o código
- `POST /api/empresas` — Crear (admin/docente, logo + catálogo)
- `PUT /api/empresas/:id` — Editar
- `DELETE /api/empresas/:id` — Eliminar

### Valoraciones
- `POST /api/valoraciones/proyecto` — Valorar proyecto
- `POST /api/valoraciones/charla` — Valorar charla
- `GET /api/valoraciones/stats` — Estadísticas + top ranking
- `GET /api/valoraciones/actividad-evento` — Feed en vivo

### Configuración
- `GET /api/config` — Configuración pública del evento
- `PUT /api/config` — Actualizar (admin)

### Health
- `GET /api/health` — Estado servidor

---

## 🔐 Autenticación y RBAC

- **Login:** Email + PIN (bcrypt). Cuentas nuevas → rol `visitante` forzado por servidor.
- **Header requerido para gestión:** `x-usuario-id` con usuario `admin` o `docente`
- **Sin header:** 401 Unauthorized
- **Perfil ajeno (no admin):** 403 Forbidden

---

## 🚀 Puesta en Marcha

```bash
# 1. Base de datos
mariadb -u root -p < database.sql

# 2. Configuración
cp .env.example .env  # Ajustar credenciales DB

# 3. Dependencias
npm install

# 4. (Opcional, una vez) Inicializar config evento
node src/scripts/init_config.js

# 5. Iniciar
npm start        # Producción
npm run dev      # Desarrollo (node --watch)
```

**Servidor:** `http://localhost:3000`  
**Health:** `GET /api/health`

---

## 📝 Scripts de Mantenimiento

| Script | Descripción |
|--------|-------------|
| `node src/scripts/init_config.js` | Inicializa/actualiza tabla `configuracion_evento` |
| `node src/scripts/hash_pins.js` | Migra PINes texto plano → bcrypt (idempotente) |
| `node src/scripts/add_sector_aplicacion.js` | Agrega campo `sector_aplicacion` a proyectos + canoniza `especialidad` (TIC/MECATRÓNICA/DISEÑO DE MODA) |

---

## 🎨 Branding y Configuración Evento

Configurable vía `configuracion_evento` (admin en `/config.html`):
- `institucion_organizadora`, `institucion_padre`, `sede`
- `nombre_evento`, `anio_evento`
- `logo_ministerio_url`, `logo_institucion_url` (chips blancos en navbar, hero, leaderboard)
- `color_primario` (hex, ej. `#38bdf8`)
- `mensaje_bienvenida`

Los logos se inyectan automáticamente en contenedores `[data-logos-institucionales]` via `cargarLogosInstitucionales()` en `app.js`.

---

## 📦 Scripts de Generación y Mantenimiento

| Script | Descripción |
|--------|-------------|
| `node src/scripts/init_config.js` | Inicializa/actualiza tabla `configuracion_evento` |
| `node src/scripts/hash_pins.js` | Migra PINes texto plano → bcrypt (idempotente) |
| `node src/scripts/add_sector_aplicacion.js` | Agrega campo `sector_aplicacion` + canoniza especialidad |
| `node src/scripts/generate_poster.js [STAND]` | Genera posters PDF A4 (1 hoja c/u) con `pdfkit` desde datos de la BD |

## 🖨️ Generador de Posters PDF

Ubicación: `src/scripts/generate_poster.js`

Genera posters profesionales en **una sola hoja A4** por proyecto con:
- **Header:** Degradado institucional, imagen del proyecto, título grande, badge código stand, badge TRL con colores (Rojo 1-4 / Ámbar 5-6 / Verde 7-9), tags especialidad y sector
- **Columna Izquierda:** Resumen ejecutivo, tecnologías usadas, integrantes con avatares, docente tutor
- **Columna Derecha:** Ficha técnica con etiquetas idénticas al formulario admin (Código de Stand, Título, Especialidad, Sector de Aplicación, Nivel TRL, Docente Tutor), evaluación promedio con score grande y estrellas, barras de progreso por 4 criterios, recursos (video/PDF)
- **Footer:** Barra oscura institucional con texto blanco, QR placeholder y crédito

Dependencia: `pdfkit` (agregada a `package.json`)

## 📦 Dependencias Principales

```json
{
  "bcryptjs": "^3.0.3",      // Hash PINes
  "cors": "^2.8.5",          // CORS
  "dotenv": "^16.4.7",       // Variables de entorno
  "express": "^4.22.3",      // Framework web
  "mariadb": "^3.4.0",       // Driver MariaDB nativo (pool)
  "multer": "^1.4.5-lts.1",  // Uploads multipart
  "pdfkit": "^0.16.0"        // Generación de posters PDF
}
```

1. **Login admin:** `admin@expotecnia.edu` / PIN `9999` → acceso a `/admin.html` y `/config.html`
2. **Login visitante:** `carlos.evaluador@tech.com` / PIN `1234` → evaluar stands
3. **Leaderboard:** `http://localhost:3000/leaderboard.html` (auto-refresh 10s)
4. **Evaluar stand:** Acceder a `evaluar.html?stand=STAND-101` y completar rúbrica

---

## 📌 Notas de Desarrollo

- **Sin ORM:** SQL parametrizado directo en controllers via `db.query(sql, params)`
- **CommonJS:** `require`/`module.exports` (no ES modules)
- **Uploads:** Multer guarda en `public/uploads/`; URLs relativas `/uploads/archivo.ext`
- **CORS:** Habilitado globalmente para desarrollo
- **Puerto:** 3000 (configurable via `PORT` env)
- **Health check:** `/api/health` para load balancers / monitoreo
- **PINes:** Siempre bcrypt; nuevos usuarios reciben PIN 4 dígitos mostrado 1 vez
- **Rol default:** `visitante` (forzado servidor, ignorando cliente)
- **100% Online:** Requiere conexión a internet para todas las operaciones (evaluaciones, carga de datos, sync)

---

## 🔄 Historial de Cambios Relevantes

| Fecha | Cambio |
|-------|--------|
| 2026 | Inicialización del proyecto: schema DB, Express, arquitectura online |
| 2026 | Agregado `sector_aplicacion` a proyectos + canonización especialidades |
| 2026 | Migración PINes a bcrypt + script idempotente `hash_pins.js` |
| 2026 | **Eliminación completa de PWA/Offline-First** (Service Worker, cola offline, manifest) |
| 2026 | RBAC por roles en frontend (`app.js`) + middleware backend |

---

> **Última actualización:** 2026  
> **Mantenido por:** Full-Stack Senior Engineer