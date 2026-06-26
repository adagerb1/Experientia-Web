import { ref } from 'vue';
import PageCta from '../components/PageCta.js';

const EXPERTISE = [
  ['IA aplicada al negocio', 'Identificar dónde la inteligencia artificial genera valor real, no solo novedad.'],
  ['Automatización', 'Liberar capacidad operativa conectando herramientas y procesos.'],
  ['Marketing & Growth', 'Sistemas comerciales predecibles de captación, conversión y fidelización.'],
  ['Revenue y datos', 'Decisiones guiadas por datos, indicadores y trazabilidad.'],
  ['Estrategia empresarial', 'Claridad, foco y priorización para crecer con estructura.'],
  ['Liderazgo y transformación', 'Acompañar a equipos en la era de la inteligencia artificial.']
];

export default {
  components: { PageCta },
  setup() {
    const photoError = ref(false);
    return { EXPERTISE, photoError };
  },
  template: `
  <div class="page">
    <section class="page__hero">
      <div class="container about-hero">
        <div v-reveal>
          <p class="kicker">Sobre Tonny</p>
          <h1 class="section__title">Estrategia humana que convierte la complejidad en crecimiento.</h1>
          <p class="page__lead">Tonny Dager es Founder & CEO de ExperientIA S.A.S., consultor, mentor y speaker en IA aplicada, automatización, marketing estratégico y growth business. Acompaña a empresarios, líderes y equipos a tomar mejores decisiones y construir sistemas reales de crecimiento.</p>
          <div class="hero__actions" style="margin-top:24px">
            <router-link to="/contacto" class="btn btn--primary">Hablar con Tonny</router-link>
            <router-link to="/experientia" class="btn btn--ghost">Conocer ExperientIA</router-link>
          </div>
        </div>
        <div class="about-photo" v-reveal>
          <span class="about-photo__glow" aria-hidden="true"></span>
          <img v-if="!photoError" src="/assets/img/tonny-portrait.png" loading="lazy"
               alt="Retrato de Tonny Dager" @error="photoError = true" />
          <div v-else class="hero-photo-fallback" aria-hidden="true"><span>TD</span></div>
        </div>
      </div>
    </section>

    <section class="section section--soft">
      <div class="container">
        <h2 class="section__title" v-reveal>Filosofía de trabajo</h2>
        <p class="section__text" v-reveal>No empiezo por la herramienta, empiezo por la oportunidad de negocio. La tecnología, los datos y la IA solo tienen sentido cuando se convierten en claridad, decisiones y resultados medibles. Por eso creé ExperientIA: para unir visión estratégica con capacidad real de implementación.</p>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <p class="kicker" v-reveal>Áreas de expertise</p>
        <h2 class="section__title" v-reveal>Dónde acompaño a las empresas.</h2>
        <div class="pilares__grid">
          <article class="card" v-for="e in EXPERTISE" :key="e[0]" v-reveal>
            <h3 class="card__title">{{ e[0] }}</h3>
            <p class="card__text">{{ e[1] }}</p>
          </article>
        </div>
      </div>
    </section>

    <page-cta title="Hablemos de tu próximo nivel de crecimiento."
      primary="Hablar con Tonny" secondary="Conocer ExperientIA" secondary-to="/experientia" />
  </div>`
};
