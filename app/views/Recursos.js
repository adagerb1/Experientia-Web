import PageCta from '../components/PageCta.js';
import { RESOURCES } from '../data/site.js';

const CATEGORIES = ['IA aplicada a negocios', 'Automatización', 'Growth', 'Revenue', 'Marketing estratégico', 'CRM', 'Experiencia de cliente', 'Agentes inteligentes', 'Liderazgo', 'Transformación digital'];

export default {
  components: { PageCta },
  setup() { return { RESOURCES, CATEGORIES }; },
  template: `
  <div class="page">
    <section class="page__hero">
      <div class="container">
        <p class="kicker" v-reveal>Recursos</p>
        <h1 class="section__title" v-reveal>Ideas, estrategias e insights para crecer en la era de la IA.</h1>
        <p class="page__lead" v-reveal>Contenido para líderes, empresarios y equipos que quieren entender cómo aplicar inteligencia artificial, automatización, marketing y datos con criterio de negocio.</p>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="recursos__grid">
          <article class="card recurso" v-for="r in RESOURCES" :key="r.title" v-reveal>
            <span class="recurso__type">{{ r.type }}</span>
            <h3 class="recurso__title">{{ r.title }}</h3>
            <p class="card__text">{{ r.text }}</p>
            <router-link to="/contacto" class="recurso__link">Solicitar recurso →</router-link>
          </article>
        </div>
      </div>
    </section>

    <section class="section section--soft">
      <div class="container">
        <p class="kicker" v-reveal>Categorías</p>
        <h2 class="section__title" v-reveal>Explora por tema.</h2>
        <div class="logos" style="justify-content:flex-start" v-reveal>
          <span class="logo-chip" v-for="c in CATEGORIES" :key="c">{{ c }}</span>
        </div>
      </div>
    </section>

    <page-cta title="¿Quieres tu guía estratégica?" primary="Recibir guía estratégica" primary-to="/contacto" secondary="Agenda una conversación" secondary-to="/contacto" />
  </div>`
};
