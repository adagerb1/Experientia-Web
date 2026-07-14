import { RouterLink } from 'vue-router';
import { NAV, SOCIAL, LEGAL } from '../data/site.js';

// Iconos SVG por red (inline, sin dependencias).
const ICONS = {
  LinkedIn: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M4.98 3.5A2.5 2.5 0 1 0 5 8.5a2.5 2.5 0 0 0 0-5zM3 9h4v12H3zM9 9h3.8v1.7h.05c.53-1 1.83-2.05 3.77-2.05C20.4 8.65 21 11 21 14.1V21h-4v-6.1c0-1.45-.03-3.3-2-3.3-2 0-2.3 1.57-2.3 3.2V21H9z"/></svg>',
  Instagram: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M12 2.16c3.2 0 3.58.01 4.85.07 1.17.05 1.8.25 2.23.41.56.22.96.48 1.38.9.42.42.68.82.9 1.38.16.42.36 1.06.41 2.23.06 1.27.07 1.65.07 4.85s-.01 3.58-.07 4.85c-.05 1.17-.25 1.8-.41 2.23-.22.56-.48.96-.9 1.38-.42.42-.82.68-1.38.9-.42.16-1.06.36-2.23.41-1.27.06-1.65.07-4.85.07s-3.58-.01-4.85-.07c-1.17-.05-1.8-.25-2.23-.41a3.7 3.7 0 0 1-1.38-.9 3.7 3.7 0 0 1-.9-1.38c-.16-.42-.36-1.06-.41-2.23C2.17 15.58 2.16 15.2 2.16 12s.01-3.58.07-4.85c.05-1.17.25-1.8.41-2.23.22-.56.48-.96.9-1.38.42-.42.82-.68 1.38-.9.42-.16 1.06-.36 2.23-.41C8.42 2.17 8.8 2.16 12 2.16zM12 0C8.74 0 8.33.01 7.05.07 5.78.13 4.9.33 4.14.63c-.79.3-1.46.72-2.12 1.38A5.85 5.85 0 0 0 .63 4.14c-.3.76-.5 1.64-.56 2.91C.01 8.33 0 8.74 0 12s.01 3.67.07 4.95c.06 1.27.26 2.15.56 2.91.3.79.72 1.46 1.38 2.12.66.66 1.33 1.08 2.12 1.38.76.3 1.64.5 2.91.56C8.33 23.99 8.74 24 12 24s3.67-.01 4.95-.07c1.27-.06 2.15-.26 2.91-.56a5.85 5.85 0 0 0 2.12-1.38 5.85 5.85 0 0 0 1.38-2.12c.3-.76.5-1.64.56-2.91.06-1.28.07-1.69.07-4.95s-.01-3.67-.07-4.95c-.06-1.27-.26-2.15-.56-2.91a5.85 5.85 0 0 0-1.38-2.12A5.85 5.85 0 0 0 19.86.63c-.76-.3-1.64-.5-2.91-.56C15.67.01 15.26 0 12 0zm0 5.84A6.16 6.16 0 1 0 18.16 12 6.16 6.16 0 0 0 12 5.84zm0 10.16A4 4 0 1 1 16 12a4 4 0 0 1-4 4zm6.4-11.85a1.44 1.44 0 1 0 1.44 1.44 1.44 1.44 0 0 0-1.44-1.44z"/></svg>',
  YouTube: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M23.5 6.2a3 3 0 0 0-2.12-2.12C19.5 3.55 12 3.55 12 3.55s-7.5 0-9.38.53A3 3 0 0 0 .5 6.2 31.3 31.3 0 0 0 0 12a31.3 31.3 0 0 0 .5 5.8 3 3 0 0 0 2.12 2.12c1.88.53 9.38.53 9.38.53s7.5 0 9.38-.53a3 3 0 0 0 2.12-2.12A31.3 31.3 0 0 0 24 12a31.3 31.3 0 0 0-.5-5.8zM9.55 15.57V8.43L15.82 12z"/></svg>',
  X: '<svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor" aria-hidden="true"><path d="M18.9 1.15h3.68l-8.04 9.19L24 22.85h-7.4l-5.8-7.58-6.64 7.58H.48l8.6-9.83L0 1.15h7.6l5.24 6.93zM17.6 20.65h2.04L6.48 3.23H4.3z"/></svg>',
  Email: '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M2 4h20a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H2a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1zm10 7.4L3.6 6H20.4zM3 8.2V18h18V8.2l-8.4 5.6a1 1 0 0 1-1.2 0z"/></svg>'
};

export default {
  components: { RouterLink },
  setup() {
    return { NAV, SOCIAL, LEGAL, ICONS, year: new Date().getFullYear() };
  },
  template: `
  <footer class="footer">
    <div class="container footer__inner">
      <div class="footer__col">
        <router-link to="/" class="brand brand--light">
          <span class="brand__mark" aria-hidden="true"></span>
          <span class="brand__name">Tonny Dager</span>
        </router-link>
        <p class="footer__tag">Founder & CEO de ExperientIA S.A.S. Consultor, mentor y speaker en IA aplicada, automatización, marketing estratégico y growth business.</p>
        <div class="footer__social" aria-label="Redes sociales">
          <a v-for="s in SOCIAL" :key="s.label" :href="s.url" :aria-label="s.label" :title="s.label"
            :target="s.short === '@' ? '_self' : '_blank'" rel="noopener" v-html="ICONS[s.label] || s.short"></a>
        </div>
      </div>

      <nav class="footer__col" aria-label="Navegación">
        <h4>Explorar</h4>
        <router-link v-for="item in NAV.slice(0,5)" :key="item.to" :to="item.to">{{ item.label }}</router-link>
      </nav>

      <nav class="footer__col" aria-label="Soluciones">
        <h4>Soluciones</h4>
        <router-link v-for="item in NAV.slice(5)" :key="item.to" :to="item.to">{{ item.label }}</router-link>
      </nav>

      <nav class="footer__col" aria-label="Legal">
        <h4>Legal</h4>
        <router-link v-for="l in LEGAL" :key="l.to" :to="l.to">{{ l.label }}</router-link>
      </nav>
    </div>
    <p class="footer__copy">© {{ year }} Tonny Dager · ExperientIA S.A.S. Todos los derechos reservados.</p>
  </footer>`
};
