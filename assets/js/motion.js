// Motion Layer: Clarity Reveal mediante IntersectionObserver.
// Directiva Vue `v-reveal` y un observador global reutilizable.
import { prefersReducedMotion } from './utils.js';

let observer = null;

function getObserver() {
  if (observer || !('IntersectionObserver' in window)) return observer;
  observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
  return observer;
}

export const revealDirective = {
  mounted(el) {
    el.classList.add('reveal');
    // Stagger: retrasa según cuántos hermanos .reveal lo preceden.
    let i = 0, p = el.previousElementSibling;
    while (p) { if (p.classList && p.classList.contains('reveal')) i++; p = p.previousElementSibling; }
    if (i > 0) el.style.transitionDelay = Math.min(i * 70, 360) + 'ms';

    if (prefersReducedMotion() || !('IntersectionObserver' in window)) {
      el.classList.add('is-visible');
      return;
    }
    getObserver().observe(el);
  },
  unmounted(el) {
    if (observer) observer.unobserve(el);
  }
};

// Count-up para métricas numéricas (microinteracción).
export function countUp(el, target, { prefix = '', suffix = '', duration = 1400 } = {}) {
  if (prefersReducedMotion()) { el.textContent = prefix + target + suffix; return; }
  const start = performance.now();
  function step(now) {
    const p = Math.min((now - start) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = prefix + Math.round(target * eased) + suffix;
    if (p < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}
