# Tonny Dager — Nucleus Growth Experience

Sitio web público de **Tonny Dager** (Founder & CEO de ExperientIA S.A.S.),
construido sobre la experiencia **Nucleus Growth Experience**.

> IA, automatización y growth para empresas que quieren vender mejor,
> operar con menos fricción y escalar con claridad.

Esta fase entrega la **capa pública (frontend)**. La capa administrativa
(`/admin`), la API PHP (`/api`), la agenda propia, el CRM/pipeline y los pagos
ePayco se desarrollan en sprints posteriores (ver Addendum Técnico).

## Stack (decisión técnica oficial — Addendum)
- **Frontend:** Vue 3 vía CDN / ES Modules / `importmap` — **sin build** (no npm, no Vite, no Webpack).
- **Routing:** Vue Router en modo *history*.
- **Estilos:** CSS3 nativo modular con variables globales (`tokens.css`).
- **Despliegue:** zero-config, listo para subir/descomprimir en cPanel / WHM.

## Estructura
```
.
├── index.html              # Mount Vue + importmap + Schema (Person/Org/WebSite)
├── .htaccess               # Rewrite SPA (history) + headers + cache
├── robots.txt · sitemap.xml · llms.txt · manifest.json
├── assets/
│   ├── css/                # tokens · base · layout · components · motion · responsive
│   ├── js/                 # app · router · store · api · motion · tracking · utils
│   ├── img/ · icons/
├── app/
│   ├── components/         # AppHeader, SiteFooter, StickyCTA, MicroDiagnostic, PageCta
│   ├── views/              # 10 páginas (Home + secciones del sitemap) + NotFound
│   └── data/               # site.js (contenido) · diagnostic.js (preguntas + scoring)
```

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
