---
id: expotecnia-eftp
name: Expotecnia EFTP
description: Skill para trabajar con la plataforma Expotecnia EFTP - Plataforma web 100% online para eventos técnicos con MariaDB, Express, y arquitectura online-first
---

# Expotecnia EFTP — Skill Context

Este skill proporciona contexto completo para trabajar en la plataforma **Expotecnia EFTP**, una plataforma web **100% online** para la Expotecnia de Educación Formativo-Técnica Profesional.

## Stack Tecnológico

| Capa | Tecnología |
|---|---|
| **Backend** | Node.js (CommonJS) + Express 4 |
| **Base de datos** | MariaDB (pool nativo `mariadb`, sin ORM) |
| **Frontend** | HTML5 + CSS + JavaScript vanilla, Bootstrap 5.3, SweetAlert2 |
| **Uploads** | Multer (imágenes, PDFs) → `public/uploads/` |

## Estructura del Proyecto

```
ctaexpo/
├── database.sql              # Schema + datos semilla (9 tablas)
├── package.json
├── README.md
├── CONTEXTO_HISTORIAL.md     # Este archivo de contexto
├── src/
│   ├── app.js                # Bootstrap Express
│   ├── config/db.js          # Pool MariaDB + helper query()
│   ├── middleware/           # auth, errorHandler, multer
│   ├── routes/               # 7 archivos de rutas REST
│   ├── controllers/          # 7 controladores lógica negocio
│   └── scripts/              # 3 scripts mantenimiento
└── public/                   # Frontend estático
    ├── *.html (10 páginas)
    ├── css/ (3 archivos)
    ├── js/ (11 archivos)
    ├── icons/
    └── uploads/
```

| **Uploads** | Multer (imágenes, PDFs) → `public/uploads/` |
| **PDF Generator** | `pdfkit` — `src/scripts/generate_poster.js` genera posters A4 dinámicos desde la BD |

## Comandos Principales

```bash
# Instalación y setup
npm install
mariadb -u root -p < database.sql
cp .env.example .env
node src/scripts/init_config.js

# Generar posters PDF (una sola hoja A4 c/u)
node src/scripts/generate_poster.js         # todos
node src/scripts/generate_poster.js STAND-101 # uno solo

# Desarrollo
npm run dev        # node --watch

# Producción
npm start

# Mantenimiento
node src/scripts/hash_pins.js           # Migra PINes a bcrypt
node src/scripts/add_sector_aplicacion.js  # Agrega sector + canoniza especialidades
```

## Usuarios de Prueba (Seed)

| Email | Rol | PIN |
|---|---|---|
| admin@expotecnia.edu | admin | 9999 |
| carlos.evaluador@tech.com | visitante | 1234 |
| m.docente@instituto.edu | docente | 4321 |
| juan.alumno@estudiantes.edu | alumno | 1111 |

## API REST - Endpoints Clave

### Autenticación
- `POST /api/auth/login` — Login email+PIN → retorna usuario + pin_inicial si nuevo
- `GET /api/auth/perfil/:id` — Perfil (solo propio o admin)
- `GET /api/auth/resumen/:id` — Actividad visitante

### Proyectos (Stands)
- `GET /api/proyectos` — Listado con filtros
- `GET /api/proyectos/leaderboard` — Ranking tiempo real
- `GET /api/proyectos/:codigo` — Detalle por código QR (ej. STAND-101)
- `POST /api/proyectos` — Crear (admin/docente, multipart)
- `PUT /api/proyectos/:id` — Editar
- `POST /api/proyectos/evaluar` — Evaluar (rúbrica 4 criterios 1-5)
- `DELETE /api/proyectos/:id` — Eliminar (cascada)

### Oferta Formativa
- `GET /api/oferta` / `:identifier` — Listado / detalle
- `POST/PUT/DELETE /api/oferta` — CRUD (admin/docente)
- `POST /api/oferta/prospecto` — Registrar interesado

### Charlas
- `GET /api/charlas` / `:identifier`
- `POST/PUT/DELETE /api/charlas` — CRUD (admin/docente, PDF + foto)

### Empresas
- `GET /api/empresas` / `:identifier`
- `POST/PUT/DELETE /api/empresas` — CRUD (admin/docente)

### Valoraciones (100% Online)
- `POST /api/valoraciones/proyecto` — Valorar proyecto
- `POST /api/valoraciones/charla` — Valorar charla
- `GET /api/valoraciones/stats` — Stats + top ranking
- `GET /api/valoraciones/actividad-evento` — Feed en vivo

### Configuración Evento
- `GET /api/config` — Pública
- `PUT /api/config` — Admin (logos, colores, textos)

### Health
- `GET /api/health` — Estado servidor

## RBAC (Role-Based Access Control)

### Backend (middleware/authMiddleware.js)
- Header `x-usuario-id` obligatorio para rutas gestión
- Roles válidos: `admin`, `docente` → acceso CRUD
- Sin header → 401; perfil ajeno (no admin) → 403

### Frontend (`public/js/app.js`)
- `getCurrentUser()` / `setCurrentUser()` → localStorage
- `updateUserUI()` — navbar + menú admin visible solo admin/docente
- `showAuthModal()` — Login/registro PIN con SweetAlert2
- `openQRScannerModal()` — Escaneo/ingreso código stand → `evaluar.html?stand=...`
- `cargarLogosInstitucionales()` — Inyecta logos config en `[data-logos-institucionales]`

## Base de Datos - 9 Tablas

```sql
usuarios              -- id, nombre, email, rol, codigo_pin (bcrypt), creado_en
proyectos             -- id, codigo_stand, titulo, especialidad, sector_aplicacion, resumen, trl_nivel, tecnologias, integrantes, docente_tutor, imagen_url, video_pitch_url, pdf_poster_url
oferta_formativa      -- id, codigo_oferta, nombre_carrera, duracion_horas, modalidad, perfil_egreso, requisitos, brochure_pdf_url, video_lab_url
prospectos_eftp       -- id, usuario_id, oferta_id, telefono, comentario
charlas               -- id, codigo_charla, titulo, eje_tematico, expositor, biografia, foto_expositor_url, horario, ubicacion, diapositivas_pdf_url
empresas              -- id, codigo_empresa, nombre_corporativo, descripcion, ofertas_pasantia, requisitos_perfil, logo_url, catalogo_pdf_url
valoraciones_proyectos -- id, usuario_id, proyecto_id, innovacion, dominio_tecnico, presentacion, impacto, comentario (1-5 cada criterio)
valoraciones_charlas  -- id, usuario_id, charla_id, nota_contenido, nota_expositor, comentario (1-5)
configuracion_evento  -- clave (PK), valor, descripcion, actualizado_en
```

## Configuración Evento (Tabla `configuracion_evento`)

Claves administradas en `/config.html` (admin):
- `institucion_organizadora`, `institucion_padre`, `sede`
- `nombre_evento`, `anio_evento`
- `logo_ministerio_url`, `logo_institucion_url` (chips blancos en navbar, hero, leaderboard)
- `color_primario` (hex, ej. `#38bdf8`)
- `mensaje_bienvenida`

## Notas de Desarrollo

1. **Sin ORM:** SQL parametrizado directo en controllers via `db.query(sql, params)`
2. **CommonJS:** `require`/`module.exports` (no ES modules)
3. **Uploads:** Multer → `public/uploads/`; URLs relativas `/uploads/archivo.ext`
4. **CORS:** Global habilitado
5. **Puerto:** 3000 (env `PORT`)
6. **Health:** `/api/health` para monitoreo
7. **PINes:** Siempre bcrypt; nuevos usuarios reciben PIN 4 dígitos mostrado 1 vez
8. **Rol default:** `visitante` (forzado servidor, ignorando cliente)
9. **100% Online:** Requiere conexión a internet para todas las operaciones (evaluaciones, carga de datos, sync)

## Testing Rápido

```bash
# 1. Login admin → acceso /admin.html, /config.html
# 2. Login visitante → evaluar stands
# 3. Leaderboard: http://localhost:3000/leaderboard.html (refresh 10s)
# 4. Evaluar stand: evaluar.html?stand=STAND-101 → completar rúbrica
```

---

**Referencia completa:** Ver `CONTEXTO_HISTORIAL.md` y `README.md` en la raíz del proyecto.