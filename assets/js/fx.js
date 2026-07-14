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
    const interactive = e.target.closest && e.target.closest('a, button, .card, .combo, .bento__tile');
    cursor.style.width = interactive ? '54px' : '30px';
    cursor.style.height = interactive ? '54px' : '30px';
  }, { passive: true });

  // Tilt 3D sutil en los tiles del bento (profundidad al pasar el cursor).
  if (fine) {
    document.addEventListener('pointermove', (e) => {
      const tile = e.target.closest && e.target.closest('.bento__tile');
      if (!tile) return;
      const r = tile.getBoundingClientRect();
      const rx = ((e.clientY - r.top) / r.height - 0.5) * -6;
      const ry = ((e.clientX - r.left) / r.width - 0.5) * 8;
      tile.style.setProperty('--rx', rx.toFixed(2) + 'deg');
      tile.style.setProperty('--ry', ry.toFixed(2) + 'deg');
    }, { passive: true });
    document.addEventListener('pointerout', (e) => {
      const tile = e.target.closest && e.target.closest('.bento__tile');
      if (tile) { tile.style.setProperty('--rx', '0deg'); tile.style.setProperty('--ry', '0deg'); }
    }, { passive: true });
  }

  document.addEventListener('pointermove', onMove, { passive: true });
}

// Parallax por scroll + header inteligente (se oculta al bajar, vuelve al subir).
export function initScrollFx() {
  const header = document.querySelector('.header');
  let lastY = window.scrollY, ticking = false;
  const reduced = prefersReducedMotion();

  function apply() {
    ticking = false;
    if (reduced) return;
    const vh = window.innerHeight;
    // Video del hero: leve zoom-drift cinematográfico al hacer scroll.
    const hv = document.querySelector('.hero__video');
    if (hv) {
      const p = Math.min(1, window.scrollY / vh);
      hv.style.transform = `scale(${(1 + p * 0.1).toFixed(3)}) translateY(${(p * 36).toFixed(1)}px)`;
    }
    // Elementos con profundidad: se mueven a distinta velocidad que el scroll.
    document.querySelectorAll('.orbit, .orbit__glow, .about-photo__glow, [data-plx]').forEach((el) => {
      const speed = parseFloat(el.dataset.plx || '0.12');
      const r = el.getBoundingClientRect();
      const center = r.top + r.height / 2 - vh / 2;
      el.style.setProperty('--plx', (-center * speed).toFixed(1) + 'px');
      el.classList.add('has-plx');
    });
  }

  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (header) {
      // Oculta el header al bajar (deja espacio al contenido) y lo trae de vuelta al subir.
      if (y > 180 && y > lastY + 8 && !document.querySelector('.navx.is-open')) header.classList.add('header--hidden');
      else if (y < lastY - 8 || y <= 180) header.classList.remove('header--hidden');
    }
    lastY = y;
    if (!ticking) { ticking = true; requestAnimationFrame(apply); }
  }, { passive: true });
  apply();
}

// Cortina de marca entre páginas (transición cinematográfica de ruta).
export function initCurtain(router) {
  if (prefersReducedMotion()) return;
  const c = document.createElement('div');
  c.className = 'route-curtain';
  c.innerHTML = '<span class="route-curtain__dot" aria-hidden="true"></span>';
  document.body.appendChild(c);
  let first = true;
  router.beforeEach((to, from, next) => {
    if (!first && to.path !== from.path && !to.meta.bare && !from.meta.bare) c.classList.add('is-on');
    next();
  });
  router.afterEach(() => {
    if (first) { first = false; return; }
    setTimeout(() => c.classList.remove('is-on'), 420);
  });
}

// Scroll storytelling: revela los títulos palabra por palabra (kinetic type).
export function enhanceTitles() {
  if (prefersReducedMotion()) return;
  document.querySelectorAll('.section__title:not([data-rw])').forEach((el) => {
    // Solo títulos de texto plano (evita los que tienen <br> o <span> internos).
    if (el.children.length) { el.setAttribute('data-rw', 'skip'); return; }
    el.setAttribute('data-rw', '1');
    const words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words
      .map((wd) => `<span class="rw-line"><span class="rw-word">${wd}</span></span>`)
      .join(' ');
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        el.querySelectorAll('.rw-word').forEach((s, i) => { s.style.transitionDelay = (i * 55) + 'ms'; });
        el.classList.add('rw-in');
        io.unobserve(el);
      });
    }, { threshold: 0.25 });
    io.observe(el);
  });
}
