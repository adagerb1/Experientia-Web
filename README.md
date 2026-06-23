# Nucleus Growth Experience — Web

Sitio web mobile-first de **Nucleus Growth Experience** (Tonny Dager).
Construido a partir de los tres entregables de concepto: Concept Board,
UX Flow First-Mobile y Home Wireframe + Motion Notes.

> Del ruido a la claridad. De la claridad al sistema. Del sistema al crecimiento.

## Stack
Sitio estático, sin build step — HTML5 semántico, CSS moderno y JavaScript vanilla.
Pensado para Core Web Vitals óptimos, accesibilidad AA y carga rápida.

```
.
├── index.html        # Home: hero, métricas, problema, microdiagnóstico,
│                     # pilares, sistema, rutas, casos, recursos, CTA final
├── styles/main.css   # Sistema visual 70/30, paleta y lenguaje de motion
├── scripts/main.js   # Motion notes: loader, clarity reveal, adaptive CTA,
│                     # scroll storytelling, microinteracciones, microdiagnóstico
├── assets/           # favicon + imagen Open Graph (SVG)
├── llms.txt          # Contexto estructurado para IA y LLMs
└── robots.txt
```

## Sistema de diseño
| Token | Color |
|-------|-------|
| Blanco Puro | `#FFFFFF` |
| Azul Profundo | `#0B1D3A` |
| Azul Eléctrico | `#2563FF` |
| Gris Frío | `#E6ECF2` |
| Cian Glow | `#22D3EE` |

Relación visual **70% light & professional / 30% dark & immersive**.
Tipografía: Inter (sans-serif moderna, ejecutiva y clara).

## Motion language
1. **Nucleus Loader** — loader de entrada con órbitas.
2. **Clarity Reveal** — revelado progresivo del contenido al hacer scroll.
3. **Adaptive CTA** — el CTA se adapta a la etapa del usuario.
4. **Scroll Storytelling** — barra de progreso y secuencia narrativa.
5. **Microinteractions** — contadores y feedback en hover.
6. **Reduced Motion** — respeta `prefers-reduced-motion`.

## Desarrollo local
No requiere dependencias. Sirve la carpeta con cualquier servidor estático:

```bash
python3 -m http.server 8000
# abre http://localhost:8000
```
