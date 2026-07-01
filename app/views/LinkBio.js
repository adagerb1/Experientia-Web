import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { track } from '../../assets/js/tracking.js';

const LINES = [
  ['Dirección', 'define el rumbo'],
  ['Defensa', 'protege la estabilidad'],
  ['Mediocampo', 'conecta datos y procesos'],
  ['Ataque', 'convierte mercado en crecimiento']
];

// Link en Bio premium — mini landing del Tablero de Crecimiento (Q3).
export default {
  setup() {
    const router = useRouter();
    const photoError = ref(false);
    const go = (event, to, external) => {
      track(event, { from: 'link_bio' });
      if (external) window.open(to, '_blank', 'noopener');
      else router.push(to);
    };
    return { LINES, photoError, go };
  },
  template: `
  <div class="bio">
    <div class="bio__bg" aria-hidden="true"></div>
    <div class="bio__inner">
      <div class="bio__head" v-reveal>
        <div class="bio__avatar">
          <img v-if="!photoError" src="/assets/img/tonny-portrait.png" alt="Tonny Dager" @error="photoError = true" />
          <span v-else>TD</span>
        </div>
        <h1 class="bio__name">Tonny Dager</h1>
        <p class="bio__role">Arquitecto del Crecimiento Empresarial</p>
        <p class="bio__tags">Estrategia · Datos · IA · Automatización · Ventas</p>
      </div>

      <p class="bio__msg" v-reveal>Tu empresa puede vender y aun así estar trabada.<br />Haz el diagnóstico y descubre tu primera jugada de crecimiento.</p>

      <div class="bio__buttons">
        <button class="bio__btn bio__btn--primary" v-reveal @click="go('bio_diagnostic_clicked', '/diagnostico-tablero-crecimiento')">
          <span>Hacer Diagnóstico Tablero de Crecimiento</span><span aria-hidden="true">→</span>
        </button>
        <button class="bio__btn" v-reveal @click="go('bio_agenda_clicked', '/agenda')">
          <span>Agendar lectura estratégica</span><span aria-hidden="true">→</span>
        </button>
        <button class="bio__btn" v-reveal @click="go('bio_experientia_clicked', '/experientia')">
          <span>Conocer ExperientIA</span><span aria-hidden="true">→</span>
        </button>
        <button class="bio__btn bio__btn--ghost" v-reveal @click="go('bio_content_clicked', 'https://www.linkedin.com', true)">
          <span>Ver contenido destacado</span><span aria-hidden="true">↗</span>
        </button>
      </div>

      <div class="bio__pitch" v-reveal>
        <p class="bio__pitch-title">El Tablero en 4 líneas</p>
        <div class="bio__pitch-grid">
          <div class="bio__pitch-item" v-for="l in LINES" :key="l[0]">
            <strong>{{ l[0] }}</strong><span>{{ l[1] }}</span>
          </div>
        </div>
      </div>

      <p class="bio__foot">© 2026 Tonny Dager · ExperientIA</p>
    </div>
  </div>`
};
