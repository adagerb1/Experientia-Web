import { RouterLink } from 'vue-router';
import { NAV } from '../data/site.js';

export default {
  components: { RouterLink },
  setup() {
    return { NAV, year: new Date().getFullYear() };
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
          <a href="#" aria-label="LinkedIn">in</a>
          <a href="#" aria-label="Instagram">ig</a>
          <a href="#" aria-label="YouTube">yt</a>
          <a href="mailto:hola@tonnydager.com" aria-label="Email">@</a>
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
        <a href="#">Política de privacidad</a>
        <a href="#">Términos y condiciones</a>
        <a href="#">Tratamiento de datos</a>
        <a href="#">Cookies</a>
      </nav>
    </div>
    <p class="footer__copy">© {{ year }} Tonny Dager · ExperientIA S.A.S. Todos los derechos reservados.</p>
  </footer>`
};
