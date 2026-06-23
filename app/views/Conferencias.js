import PageCta from '../components/PageCta.js';

const TOPICS = [
  'La otra mirada de la inteligencia artificial en los negocios',
  'IA, automatización y growth: de la herramienta al sistema',
  'Marketing para humanos y máquinas',
  'Empresas inteligentes: vender, operar y decidir con IA',
  'Customer Centricity en tiempos de inteligencia artificial',
  'Growth 360: percepción, demanda, conversión e ingresos',
  'Liderazgo y transformación en la era de la IA'
];
const RESULTS = ['Inspiración estratégica', 'Formación accionable', 'Visión de futuro', 'Activación de equipos', 'Experiencias diseñadas para movilizar acción'];

export default {
  components: { PageCta },
  setup() { return { TOPICS, RESULTS }; },
  template: `
  <div class="page">
    <section class="page__hero">
      <div class="container">
        <p class="kicker" v-reveal>Conferencias & Workshops</p>
        <h1 class="section__title" v-reveal>Abre visión y activa a tu equipo en la era de la IA.</h1>
        <p class="page__lead" v-reveal>Speaker estratégico para empresas, gremios, cámaras de comercio, universidades, eventos y equipos corporativos que quieren entender y aplicar IA, automatización y growth con criterio.</p>
        <div class="hero__actions" style="margin-top:24px" v-reveal>
          <router-link to="/contacto" class="btn btn--primary">Solicitar conferencia</router-link>
        </div>
      </div>
    </section>

    <section class="section section--soft">
      <div class="container">
        <p class="kicker" v-reveal>Temas</p>
        <h2 class="section__title" v-reveal>Conferencias diseñadas para movilizar acción.</h2>
        <div class="casos__grid">
          <article class="card" v-for="t in TOPICS" :key="t" v-reveal>
            <h3 class="card__title" style="font-size:1.05rem">{{ t }}</h3>
          </article>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <p class="kicker" v-reveal>Resultados esperados</p>
        <h2 class="section__title" v-reveal>Qué se lleva tu audiencia.</h2>
        <ul class="ruta__list" style="max-width:640px;margin-top:20px" v-reveal>
          <li v-for="r in RESULTS" :key="r">{{ r }}</li>
        </ul>
      </div>
    </section>

    <page-cta title="Llevemos esta experiencia a tu empresa o evento." primary="Solicitar conferencia" secondary="Ver temas disponibles" secondary-to="/contacto" />
  </div>`
};
