/* =========================================================
   NUCLEUS GROWTH EXPERIENCE — main.js
   Motion notes: Nucleus Loader · Clarity Reveal · Adaptive CTA
   Scroll Storytelling · Microinteractions · Reduced Motion
   ========================================================= */
(function () {
  'use strict';

  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const $ = (sel, ctx = document) => ctx.querySelector(sel);
  const $$ = (sel, ctx = document) => Array.from(ctx.querySelectorAll(sel));

  /* ---------- 01 · NUCLEUS LOADER ---------- */
  const loader = $('#loader');
  function hideLoader() {
    if (!loader) return;
    loader.classList.add('is-done');
    window.setTimeout(() => { loader.style.display = 'none'; }, 650);
  }
  if (prefersReduced && loader) {
    loader.style.display = 'none';
  } else {
    window.addEventListener('load', () => window.setTimeout(hideLoader, 700));
    // Safety net: never trap the user behind the loader.
    window.setTimeout(hideLoader, 3500);
  }

  /* ---------- 02 · CLARITY REVEAL (scroll) ---------- */
  const revealEls = $$('.reveal');
  if ('IntersectionObserver' in window && !prefersReduced) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry, i) => {
        if (entry.isIntersecting) {
          // gentle stagger for sibling groups
          entry.target.style.transitionDelay = Math.min(i * 60, 180) + 'ms';
          entry.target.classList.add('is-visible');
          io.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add('is-visible'));
  }

  /* ---------- 04 · SCROLL STORYTELLING (progress bar + header state) ---------- */
  const progress = $('#scrollProgress');
  const header = $('#header');
  function onScroll() {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const height = document.documentElement.scrollHeight - window.innerHeight;
    const pct = height > 0 ? (scrollTop / height) * 100 : 0;
    if (progress) progress.style.width = pct + '%';
    if (header) header.classList.toggle('is-scrolled', scrollTop > 8);
  }
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (!ticking) {
      window.requestAnimationFrame(() => { onScroll(); ticking = false; });
      ticking = true;
    }
  }, { passive: true });
  onScroll();

  /* ---------- 03 · ADAPTIVE / STICKY CTA ---------- */
  const stickyCta = $('#stickyCta');
  const hero = $('#hero');
  const ctaFinal = $('#cta-final');
  if (stickyCta && 'IntersectionObserver' in window) {
    // Show sticky CTA once past the hero, hide it over the final CTA (no duplicate ask).
    let pastHero = false, atFinal = false;
    const update = () => stickyCta.classList.toggle('is-visible', pastHero && !atFinal);

    new IntersectionObserver(([e]) => { pastHero = !e.isIntersecting; update(); },
      { threshold: 0.1 }).observe(hero);
    if (ctaFinal) {
      new IntersectionObserver(([e]) => { atFinal = e.isIntersecting; update(); },
        { threshold: 0.25 }).observe(ctaFinal);
    }
  }

  /* ---------- MOBILE NAV ---------- */
  const navToggle = $('#navToggle');
  const nav = $('#nav');
  if (navToggle && nav) {
    const closeNav = () => {
      nav.classList.remove('is-open');
      navToggle.setAttribute('aria-expanded', 'false');
      navToggle.setAttribute('aria-label', 'Abrir menú');
    };
    navToggle.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', String(open));
      navToggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    });
    $$('.nav__link, .nav__cta', nav).forEach((a) => a.addEventListener('click', closeNav));
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeNav(); });
  }

  /* ---------- COUNT-UP METRICS (microinteraction) ---------- */
  const counters = $$('.metric__num[data-count]');
  function animateCount(el) {
    const target = parseFloat(el.dataset.count);
    const prefix = el.dataset.prefix || '';
    const suffix = el.dataset.suffix || '';
    if (prefersReduced) { el.textContent = prefix + target + suffix; return; }
    const dur = 1400; const start = performance.now();
    function step(now) {
      const p = Math.min((now - start) / dur, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      el.textContent = prefix + Math.round(target * eased) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }
  if ('IntersectionObserver' in window) {
    const cio = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) { animateCount(entry.target); cio.unobserve(entry.target); }
      });
    }, { threshold: 0.6 });
    counters.forEach((c) => cio.observe(c));
  }

  /* ---------- 05 · MICRODIAGNÓSTICO (interactive) ---------- */
  const form = $('#diagForm');
  if (form) {
    const steps = $$('.diag__step', form);
    const result = $('.diag__result', form);
    const dots = $$('.diag__dot');
    const resultText = $('#diagResultText');
    const answers = {};

    const messages = {
      claridad: 'Tu mayor oportunidad está en construir claridad estratégica: un foco único que ordene cada decisión.',
      estrategia: 'Tu mayor oportunidad está en una estrategia con propósito que convierta el esfuerzo en dirección.',
      ejecucion: 'Tu mayor oportunidad está en un sistema de ejecución que escale procesos y resultados.',
      _default: 'Tu próximo paso es construir un sistema que convierta tu enfoque en crecimiento sostenible.'
    };

    let current = 0;
    function show(idx) {
      steps.forEach((s, i) => s.classList.toggle('is-active', i === idx));
      dots.forEach((d, i) => d.classList.toggle('is-active', i <= idx));
    }
    function finish() {
      steps.forEach((s) => s.classList.remove('is-active'));
      result.classList.add('is-active');
      dots.forEach((d) => d.classList.add('is-active'));
      if (resultText) resultText.textContent = messages[answers['2']] || messages._default;
    }

    $$('.diag__opt', form).forEach((btn) => {
      btn.addEventListener('click', () => {
        const step = btn.closest('.diag__step').dataset.step;
        answers[step] = btn.dataset.value;
        if (current < steps.length - 1) { current++; show(current); }
        else { finish(); }
      });
    });
  }

  /* ---------- ADAPTIVE CTA LABEL BY SECTION ---------- */
  // Subtly adapt the sticky CTA label to the user's place in the journey.
  const ctaLabel = stickyCta ? stickyCta.querySelector('span:first-child') : null;
  if (ctaLabel && 'IntersectionObserver' in window) {
    const labels = {
      diagnostico: 'Diagnosticar mi negocio',
      rutas: 'Ver mi ruta',
      casos: 'Quiero resultados similares'
    };
    const sio = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting && labels[entry.target.id]) {
          ctaLabel.textContent = labels[entry.target.id];
        }
      });
    }, { threshold: 0.5 });
    ['diagnostico', 'rutas', 'casos'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) sio.observe(el);
    });
    // reset to default when back near the top / hero
    if (hero) {
      new IntersectionObserver(([e]) => {
        if (e.isIntersecting) ctaLabel.textContent = 'Hablar con Tonny';
      }, { threshold: 0.4 }).observe(hero);
    }
  }
})();
