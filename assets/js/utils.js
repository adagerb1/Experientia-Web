// Utilidades compartidas.
export const prefersReducedMotion = () =>
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Inicializa la barra de progreso de scroll + estado del header (Scroll Storytelling).
export function initScrollProgress() {
  let bar = document.getElementById('scrollProgress');
  if (!bar) {
    bar = document.createElement('div');
    bar.id = 'scrollProgress';
    bar.className = 'scroll-progress';
    bar.setAttribute('aria-hidden', 'true');
    document.body.appendChild(bar);
  }
  let ticking = false;
  const update = () => {
    const scrollTop = window.scrollY || document.documentElement.scrollTop;
    const height = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (height > 0 ? (scrollTop / height) * 100 : 0) + '%';
    const header = document.querySelector('.header');
    if (header) header.classList.toggle('is-scrolled', scrollTop > 8);
    ticking = false;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { window.requestAnimationFrame(update); ticking = true; }
  }, { passive: true });
  update();
}

// Oculta el Nucleus Loader una vez cargada la app.
export function hideLoader() {
  const loader = document.getElementById('loader');
  if (!loader) return;
  if (prefersReducedMotion()) { loader.style.display = 'none'; return; }
  loader.classList.add('is-done');
  setTimeout(() => { loader.style.display = 'none'; }, 650);
}
