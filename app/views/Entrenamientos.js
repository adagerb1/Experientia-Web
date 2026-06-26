import PageCta from '../components/PageCta.js';

const PROGRAMS = [
  ['IA aplicada al negocio', 'Tu equipo aprende a identificar y ejecutar casos de uso reales.'],
  ['Automatización inteligente', 'Diseño de flujos que liberan tiempo y reducen errores.'],
  ['Growth & Revenue', 'Captación, conversión y datos como un sistema predecible.'],
  ['Cultura de datos y decisión', 'Decidir con criterio, indicadores y trazabilidad.']
];
const FORMATS = ['In-company (presencial o virtual)', 'Bootcamps intensivos', 'Programas por módulos', 'Workshops prácticos', 'Acompañamiento post-entrenamiento'];

export default {
  components: { PageCta },
  setup() { return { PROGRAMS, FORMATS }; },
  template: `
  <div class="page">
    <section class="page__hero">
      <div class="container">
        <p class="kicker" v-reveal>Entrenamientos</p>
        <h1 class="section__title" v-reveal>Entrena a tu equipo para crecer en la era de la IA.</h1>
        <p class="page__lead" v-reveal>Programas aplicados de IA, automatización, marketing y growth diseñados para que tu equipo no solo entienda, sino que ejecute. Formación con criterio de negocio y resultados medibles.</p>
        <div class="hero__actions" style="margin-top:24px" v-reveal>
          <router-link to="/contacto" class="btn btn--primary">Solicitar propuesta</router-link>
          <router-link to="/conferencias" class="btn btn--ghost">Ver conferencias</router-link>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <p class="kicker" v-reveal>Programas</p>
        <h2 class="section__title" v-reveal>Lo que tu equipo dominará.</h2>
        <div class="pilares__grid">
          <article class="card" v-for="p in PROGRAMS" :key="p[0]" v-reveal>
            <h3 class="card__title">{{ p[0] }}</h3>
            <p class="card__text">{{ p[1] }}</p>
          </article>
        </div>
      </div>
    </section>

    <section class="section section--soft">
      <div class="container">
        <p class="kicker" v-reveal>Formatos</p>
        <h2 class="section__title" v-reveal>Se adapta a tu empresa.</h2>
        <ul class="ruta__list" style="max-width:640px;margin-top:20px" v-reveal>
          <li v-for="f in FORMATS" :key="f">{{ f }}</li>
        </ul>
      </div>
    </section>

    <page-cta title="Llevemos a tu equipo al siguiente nivel."
      primary="Solicitar propuesta" secondary="Agenda una sesión" secondary-to="/contacto" />
  </div>`
};
