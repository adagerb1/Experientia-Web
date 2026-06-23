import PageCta from '../components/PageCta.js';
import { CASES } from '../data/site.js';

const SECTORS = ['Educación', 'Servicios profesionales', 'Legal', 'Salud', 'Retail', 'Formación', 'Consultoría', 'Restaurantes', 'Empresas de servicios', 'Automatización comercial'];

export default {
  components: { PageCta },
  setup() { return { CASES, SECTORS }; },
  template: `
  <div class="page">
    <section class="page__hero">
      <div class="container">
        <p class="kicker" v-reveal>Casos reales</p>
        <h1 class="section__title" v-reveal>Casos reales. Impacto medible.</h1>
        <p class="page__lead" v-reveal>La estrategia cobra valor cuando se convierte en resultados. Estos ejemplos muestran cómo la claridad, la automatización, los datos y la IA transforman procesos, ventas y decisiones.</p>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="casos__metrics" v-reveal>
          <div class="caso-metric"><span class="caso-metric__num">+47%</span><span class="caso-metric__label">Crecimiento promedio</span></div>
          <div class="caso-metric"><span class="caso-metric__num">+32%</span><span class="caso-metric__label">En ventas</span></div>
          <div class="caso-metric"><span class="caso-metric__num">−28%</span><span class="caso-metric__label">En costos operativos</span></div>
        </div>
        <div class="casos__grid">
          <article class="card caso" v-for="c in CASES" :key="c.sector" v-reveal>
            <span class="caso__sector">{{ c.sector }}</span>
            <p class="caso__row"><strong>Problema</strong>{{ c.problem }}</p>
            <p class="caso__row"><strong>Intervención</strong>{{ c.action }}</p>
            <p class="caso__row"><strong>Resultado</strong>{{ c.result }}</p>
          </article>
        </div>
      </div>
    </section>

    <section class="section section--soft">
      <div class="container">
        <p class="kicker" v-reveal>Sectores</p>
        <h2 class="section__title" v-reveal>Experiencia transversal.</h2>
        <div class="logos" style="justify-content:flex-start" v-reveal>
          <span class="logo-chip" v-for="s in SECTORS" :key="s">{{ s }}</span>
        </div>
      </div>
    </section>

    <page-cta title="¿Quieres resultados similares en tu empresa?" primary="Quiero resultados similares" secondary="Reservar diagnóstico" secondary-to="/diagnostico-ia-growth" />
  </div>`
};
