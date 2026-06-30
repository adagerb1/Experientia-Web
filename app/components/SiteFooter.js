import { RouterLink } from 'vue-router';
import { NAV, SOCIAL, LEGAL } from '../data/site.js';

export default {
  components: { RouterLink },
  setup() {
    return { NAV, SOCIAL, LEGAL, year: new Date().getFullYear() };
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
          <a v-for="s in SOCIAL" :key="s.label" :href="s.url" :aria-label="s.label"
            :target="s.short === '@' ? '_self' : '_blank'" rel="noopener">{{ s.short }}</a>
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
