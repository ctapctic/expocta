# Expotecnia EFTP — Plataforma Web (100% Online)

Plataforma web **100% online** para la Expotecnia de Educación Formativo-Técnica Profesional (EFTP): exploración de proyectos/stands por QR, evaluación en tiempo real de proyectos y charlas, oferta formativa, conexión con empresas y ranking en vivo.

## Stack

| Capa | Tecnología |
|---|---|
| Backend | Node.js (CommonJS) + Express 4 |
| Base de datos | MariaDB (pool nativo `mariadb`, sin ORM) |
| Frontend | HTML5 + CSS + JavaScript vanilla, Bootstrap 5.3, SweetAlert2 |
| Uploads | Multer (imágenes, PDFs) → `public/uploads/` |

## Puesta en marcha

1. **Base de datos**: crear el schema y datos semilla ejecutando `database.sql` en MariaDB.
   ```bash
   mariadb -u root -p < database.sql
   ```
2. **Configuración**: copiar `.env.example` → `.env` y ajustar credenciales (host, usuario, contraseña, nombre de BD).
3. **Instalar dependencias**:
   ```bash
   npm install
   ```
4. **(Opcional, una sola vez)** inicializar la tabla de configuración del evento:
   ```bash
   node src/scripts/init_config.js
   ```
5. **Iniciar**:
   ```bash
   npm start        # producción
   npm run dev      # desarrollo con recarga (node --watch)
   ```

Servidor en `http://localhost:3000`. Estado de salud: `GET /api/health`.

### Usuarios de prueba (semilla)

| Email | Rol | PIN |
|---|---|---|
| admin@expotecnia.edu | admin | 9999 |
| carlos.evaluador@tech.com | visitante | 1234 |
| m.docente@instituto.edu | docente | 4321 |
| juan.alumno@estudiantes.edu | alumno | 1111 |

En la base los PINes se guardan como hash bcrypt (`usuarios.codigo_pin`), nunca en texto plano. Las cuentas nuevas reciben un PIN inicial de 4 dígitos que se muestra una única vez al registrarse; el rol siempre se asigna del lado del servidor (`visitante`), sin importar lo que pida el cliente.

Sobre una base ya existente con PINes en texto plano, convertirlos con:

```bash
node src/scripts/hash_pins.js   # idempotente
```

## Estructura

```
database.sql              # Schema + datos semilla (9 tablas)
src/
  app.js                  # Bootstrap de Express, middlewares y montaje de rutas
  config/db.js            # Pool MariaDB + helper query()
  middleware/             # authMiddleware (roles), errorHandler, multer (uploads)
  routes/                 # Definición de endpoints REST
  controllers/            # Lógica de negocio
  scripts/init_config.js  # Inicialización de configuracion_evento
  scripts/hash_pins.js    # Migra PINes en texto plano a bcrypt
  scripts/add_sector_aplicacion.js  # Agrega sector_aplicacion a proyectos y canoniza especialidad (TIC/MECATRÓNICA/DISEÑO DE MODA)
public/                   # Frontend estático servido por Express
  index.html              # Landing del evento
  panel.html              # Portal visitante "todo en uno"
  proyectos.html          # Stands con filtros y QR
  evaluar.html            # Rúbrica de evaluación por QR
  leaderboard.html        # Ranking en vivo (auto-refresh)
  charlas.html, ofertas.html, empresas.html
  admin.html, config.html # Paneles de gestión (admin/docente): CRUD de proyectos, charlas, ofertas y empresas
  js/                     # Lógica por página (11 archivos)
  css/                    # styles.css (global) + hoja por página (leaderboard.css, config.css)
  icons/                  # Iconos de la app
  uploads/                # Archivos subidos + imágenes de los proyectos demo (proyecto-iot.jpg, proyecto-robot.jpg, proyecto-pwa.jpg)
```

Los logos institucionales (`logo_ministerio_url` y `logo_institucion_url` de la configuración del evento) se muestran como chips blancos en la navbar pública, el hero de la landing y el encabezado del leaderboard; si no hay logos configurados, esas zonas quedan limpias sin imágenes rotas.

## API REST

| Método | Endpoint | Descripción |
|---|---|---|
| POST | `/api/auth/login` | Login/registro por email + PIN |
| GET | `/api/auth/perfil/:id` | Perfil de usuario |
| GET | `/api/auth/resumen/:id` | Resumen de actividad del visitante |
| GET | `/api/proyectos` | Listado de proyectos/stands |
| GET | `/api/proyectos/leaderboard` | Ranking de proyectos |
| GET | `/api/proyectos/:codigo` | Detalle por código de stand (ej. `STAND-101`) |
| POST | `/api/proyectos` | Crear proyecto (admin/docente, multipart) |
| PUT | `/api/proyectos/:id` | Editar proyecto (admin/docente; conserva archivos no reenviados) |
| POST | `/api/proyectos/evaluar` | Evaluar proyecto |
| DELETE | `/api/proyectos/:id` | Eliminar proyecto (admin/docente; borra valoraciones en cascada) |
| GET | `/api/oferta` | Oferta formativa |
| GET | `/api/oferta/:identifier` | Oferta por id o código |
| POST | `/api/oferta` | Crear oferta (admin/docente, brochure PDF) |
| PUT | `/api/oferta/:id` | Editar oferta (admin/docente) |
| DELETE | `/api/oferta/:id` | Eliminar oferta (admin/docente; bloqueada si tiene prospectos, `409`) |
| POST | `/api/oferta/prospecto` | Registrar prospecto de admisión |
| GET | `/api/charlas` | Charlas del evento |
| GET | `/api/charlas/:identifier` | Charla por id o código |
| POST | `/api/charlas` | Crear charla (admin/docente, diapositivas PDF + foto del expositor) |
| PUT | `/api/charlas/:id` | Editar charla (admin/docente) |
| DELETE | `/api/charlas/:id` | Eliminar charla (admin/docente; borra valoraciones en cascada) |
| GET | `/api/empresas` | Empresas participantes |
| GET | `/api/empresas/:identifier` | Empresa por id o código |
| POST | `/api/empresas` | Crear empresa (admin/docente, logo + catálogo) |
| PUT | `/api/empresas/:id` | Editar empresa (admin/docente) |
| DELETE | `/api/empresas/:id` | Eliminar empresa (admin/docente) |
| POST | `/api/valoraciones/proyecto` | Valorar proyecto |
| POST | `/api/valoraciones/charla` | Valorar charla |
| GET | `/api/valoraciones/stats` | Estadísticas y top ranking |
| GET | `/api/valoraciones/actividad-evento` | Feed en vivo del evento |
| GET | `/api/config` | Configuración del evento (pública) |
| PUT | `/api/config` | Actualizar configuración (admin) |
| GET | `/api/health` | Estado del servidor |

Las rutas de gestión exigen el encabezado `x-usuario-id` con un usuario de rol `admin` o `docente`; sin encabezado responden `401`. `GET /api/auth/perfil/:id` y `/api/auth/resumen/:id` solo devuelven datos del propio usuario o de un `admin` (otro caso, `403`).

## Arquitectura 100% Online

- **Todas las operaciones requieren conexión a internet** (evaluaciones, carga de datos, CRUD, sync)
- **Sin Service Worker** ni caché offline
- **Sin cola offline** en localStorage
- **Sin manifest.json** ni PWA
- Evaluaciones y valoraciones se envían directamente al backend vía API REST
- Leaderboard con auto-refresh cada 10s consulta `/api/proyectos/leaderboard` y `/api/valoraciones/actividad-evento`
- Logos e imágenes se cargan directamente desde `public/uploads/` o URLs externas

## Notas de Desarrollo

- **Sin ORM:** SQL parametrizado directo en controllers via `db.query(sql, params)`
- **CommonJS:** `require`/`module.exports` (no ES modules)
- **Uploads:** Multer guarda en `public/uploads/`; URLs relativas `/uploads/archivo.ext`
- **CORS:** Habilitado globalmente para desarrollo
- **Puerto:** 3000 (configurable via `PORT` env)
- **Health check:** `/api/health` para load balancers / monitoreo
- **PINes:** Siempre bcrypt; nuevos usuarios reciben PIN 4 dígitos mostrado 1 vez
- **Rol default:** `visitante` (forzado servidor, ignorando cliente)