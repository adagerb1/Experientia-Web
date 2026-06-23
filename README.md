# Tonny Dager — Nucleus Growth Experience

Sitio web público de **Tonny Dager** (Founder & CEO de ExperientIA S.A.S.),
construido sobre la experiencia **Nucleus Growth Experience**.

> IA, automatización y growth para empresas que quieren vender mejor,
> operar con menos fricción y escalar con claridad.

Incluye el **sitio público**, la **API REST en PHP 8**, el **panel administrativo**
(`/admin`), agenda propia, CRM con pipeline y pagos con **ePayco**. Despliegue
zero-config en VPS / WHM / cPanel (ver `docs/README-INSTALACION.txt`).

## Stack (decisión técnica oficial — Addendum)
- **Frontend:** Vue 3 vía CDN / ES Modules / `importmap` — **sin build** (no npm, no Vite, no Webpack).
- **Routing:** Vue Router en modo *history*.
- **Estilos:** CSS3 nativo modular con variables globales (`tokens.css`).
- **Despliegue:** zero-config, listo para subir/descomprimir en cPanel / WHM.

## Estructura
```
.
├── index.html              # Sitio público — SPA Vue (importmap + Schema)
├── .htaccess               # Rewrite SPA + passthrough /api y /admin + headers
├── robots.txt · sitemap.xml · llms.txt · manifest.json
├── assets/css · assets/js  # design system modular + app público
├── app/                    # componentes, vistas (10 páginas) y datos del público
├── admin/                  # Panel administrativo — SPA Vue (login + módulos)
├── api/                    # Front controller REST (index.php, routes.php, .htaccess)
├── core/                   # Controllers · Models · Services · Middlewares · Helpers · Http · Db
├── config/                 # app · database · payments · mail (acceso denegado)
├── database/               # schema.sql + seeds/seed.sql
├── storage/                # logs · exports · cache (acceso denegado)
└── docs/                   # instalación · changelog · manifiesto
```

## Backend (API REST PHP 8)
- Front controller en `api/index.php` (autoloader PSR-4, router propio, JSON estricto).
- Autenticación **Bearer Token** (HMAC) + `AuthMiddleware` para rutas admin.
- MySQL vía **PDO con prepared statements** (helper `Core\Db`).
- Módulos: health, auth, leads, microdiagnóstico (scoring server-side), consultas,
  disponibilidad, reservas, pagos **ePayco** (init + confirmación con validación de
  firma e idempotencia), pipeline, formularios, recursos, settings, reportes, tracking.
- Servicios: Scoring, Availability, Epayco, Notification, Pipeline.
- 28 tablas (`database/schema.sql`) + datos iniciales (`database/seeds/seed.sql`).

## Panel admin (`/admin`)
SPA Vue 3 con login (Bearer Token), dashboard, leads + ficha, pipeline board,
consultas (CRUD), reservas y configuración. Usuario semilla:
`admin@tonnydager.com` / `NucleusAdmin2026!` (cambiar tras el primer ingreso).

## Páginas (URLs limpias)
`/` · `/sobre-tonny-dager` · `/diagnostico-ia-growth` · `/mentorias` ·
`/conferencias` · `/experientia` · `/alexia` · `/casos` · `/recursos` · `/contacto`

## Microdiagnóstico
6 preguntas (necesidad, perfil, madurez, bloqueo, urgencia, presupuesto) con
**scoring** que recomienda una de 6 rutas: Growth & Revenue · IA & Automatización ·
IA Estratégica · Mentoría · Conferencias · ExperientIA/AlexIA. La lógica vive en
`app/data/diagnostic.js` y queda lista para persistir vía `/api`.

## Sistema de diseño
| Token | Color |
|-------|-------|
| Blanco Puro | `#FFFFFF` |
| Azul Profundo | `#0B1D3A` |
| Azul Eléctrico | `#2563FF` |
| Gris Frío | `#E6ECF2` |
| Cian Glow | `#22D3EE` |

70% light professional / 30% dark immersive · tipografía Inter.

## Motion language
Nucleus Loader · Clarity Reveal (scroll) · Adaptive CTA (etiqueta por sección) ·
Scroll Storytelling (barra de progreso) · Microinteractions · `prefers-reduced-motion`.

## Desarrollo local
El modo *history* requiere un servidor con fallback a `index.html`:

```bash
# opción simple (sin fallback de rutas profundas):
python3 -m http.server 8000
# para probar rutas profundas, usar un server con fallback SPA o el .htaccess en Apache
```

> Vue y Vue Router se cargan desde CDN (unpkg) vía `importmap`; requiere acceso a internet.
