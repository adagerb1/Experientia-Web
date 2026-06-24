// Capa de interacción premium: cursor glow, spotlight en cards,
// botones magnéticos y parallax del hero. Delegación + rAF (ligero).
import { prefersReducedMotion } from './utils.js';

export function initFx() {
  if (prefersReducedMotion()) return;
  const fine = window.matchMedia('(pointer: fine)').matches;
  const cursor = document.querySelector('.fx-cursor');
  if (cursor && fine) cursor.classList.add('is-on');

  let raf = false, px = 0, py = 0, lastBtn = null;

  function onMove(e) {
    px = e.clientX; py = e.clientY;
    const t = e.target;

    // Spotlight: el card bajo el cursor recibe sus coordenadas.
    const card = t.closest && t.closest('.card');
    if (card) {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%');
      card.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%');
    }

    // Botón magnético: se inclina sutilmente hacia el cursor.
    const btn = t.closest && t.closest('.btn, .nav__cta');
    if (btn) {
      const r = btn.getBoundingClientRect();
      const mx = e.clientX - (r.left + r.width / 2);
      const my = e.clientY - (r.top + r.height / 2);
      btn.style.transform = `translate(${mx * 0.18}px, ${my * 0.30}px)`;
      lastBtn = btn;
    } else if (lastBtn) {
      lastBtn.style.transform = '';
      lastBtn = null;
    }

    if (!raf) { raf = true; requestAnimationFrame(tick); }
  }

  function tick() {
    raf = false;
    if (cursor && fine) cursor.style.transform = `translate(${px}px, ${py}px)`;
    const hb = document.querySelector('.hero__bg');
    if (hb) {
      const cx = px / window.innerWidth - 0.5;
      const cy = py / window.innerHeight - 0.5;
      hb.style.setProperty('--px', (cx * 24) + 'px');
      hb.style.setProperty('--py', (cy * 24) + 'px');
    }
  }

  // Cursor crece sobre elementos interactivos.
  document.addEventListener('pointerover', (e) => {
    if (!cursor || !fine) return;
    const interactive = e.target.closest && e.target.closest('a, button, .card, .combo');
    cursor.style.width = interactive ? '54px' : '30px';
    cursor.style.height = interactive ? '54px' : '30px';
  }, { passive: true });

  document.addEventListener('pointermove', onMove, { passive: true });
}
