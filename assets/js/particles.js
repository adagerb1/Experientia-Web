// Constelación interactiva del hero (canvas vanilla, ligero, reactivo al cursor).
import { prefersReducedMotion } from './utils.js';

export function initConstellation(canvas) {
  if (!canvas || prefersReducedMotion()) return () => {};
  const ctx = canvas.getContext('2d');
  const host = canvas.parentElement || canvas;
  let w = 0, h = 0, dpr = 1, particles = [], raf = null;
  const mouse = { x: -9999, y: -9999 };

  function resize() {
    const rect = canvas.getBoundingClientRect();
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = canvas.width = Math.max(1, rect.width * dpr);
    h = canvas.height = Math.max(1, rect.height * dpr);
    const count = Math.max(28, Math.min(72, Math.floor(rect.width * rect.height / 15000)));
    particles = Array.from({ length: count }, () => ({
      x: Math.random() * w, y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.22 * dpr, vy: (Math.random() - 0.5) * 0.22 * dpr
    }));
  }

  function step() {
    ctx.clearRect(0, 0, w, h);
    const link = 132 * dpr, near = 175 * dpr;
    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx; p.y += p.vy;
      if (p.x < 0 || p.x > w) p.vx *= -1;
      if (p.y < 0 || p.y > h) p.vy *= -1;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 1.6 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(37,99,255,0.55)';
      ctx.fill();
      for (let j = i + 1; j < particles.length; j++) {
        const q = particles[j];
        const dx = p.x - q.x, dy = p.y - q.y, d = Math.hypot(dx, dy);
        if (d < link) {
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y);
          ctx.strokeStyle = 'rgba(37,99,255,' + (0.16 * (1 - d / link)) + ')';
          ctx.lineWidth = 1; ctx.stroke();
        }
      }
      const md = Math.hypot(p.x - mouse.x, p.y - mouse.y);
      if (md < near) {
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(mouse.x, mouse.y);
        ctx.strokeStyle = 'rgba(34,211,238,' + (0.30 * (1 - md / near)) + ')';
        ctx.lineWidth = 1; ctx.stroke();
      }
    }
    raf = requestAnimationFrame(step);
  }

  function start() { if (!raf) step(); }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = null; } }
  function onMove(e) { const r = canvas.getBoundingClientRect(); mouse.x = (e.clientX - r.left) * dpr; mouse.y = (e.clientY - r.top) * dpr; }
  function onLeave() { mouse.x = mouse.y = -9999; }
  function onVis() { document.hidden ? stop() : start(); }

  resize();
  start();
  window.addEventListener('resize', resize);
  host.addEventListener('pointermove', onMove, { passive: true });
  host.addEventListener('pointerleave', onLeave);
  document.addEventListener('visibilitychange', onVis);

  return () => {
    stop();
    window.removeEventListener('resize', resize);
    host.removeEventListener('pointermove', onMove);
    host.removeEventListener('pointerleave', onLeave);
    document.removeEventListener('visibilitychange', onVis);
  };
}
