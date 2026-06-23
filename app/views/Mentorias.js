import PageCta from '../components/PageCta.js';

const OFFERS = [
  ['Sesión estratégica 1:1', 'Claridad y dirección sobre una decisión o reto puntual.'],
  ['Mentoría intensiva', 'Acompañamiento concentrado para un objetivo concreto.'],
  ['Mentoría mensual', 'Ritmo sostenido de decisiones y priorización.'],
  ['Mentoría premium', 'Acompañamiento cercano de alto nivel.'],
  ['Mentoría empresarial', 'Para equipos directivos y áreas completas.'],
  ['Acompañamiento de implementación', 'Mentoría conectada a la ejecución con ExperientIA.']
];
const SEGMENTS = ['Empresarios y founders', 'Líderes de equipos', 'Profesionales expertos', 'Consultores', 'Equipos directivos', 'Negocios que quieren crecer con IA, automatización y growth'];

export default {
  components: { PageCta },
  setup() { return { OFFERS, SEGMENTS }; },
  template: `
  <div class="page">
    <section class="page__hero">
      <div class="container">
        <p class="kicker" v-reveal>Mentorías</p>
        <h1 class="section__title" v-reveal>Mentoría estratégica para decidir mejor y crecer con foco.</h1>
        <p class="page__lead" v-reveal>Acompañamiento premium para empresarios, líderes y founders que necesitan claridad, priorización y una ruta de crecimiento con criterio y datos.</p>
        <div class="hero__actions" style="margin-top:24px" v-reveal>
          <router-link to="/contacto" class="btn btn--primary">Aplicar a mentoría</router-link>
          <router-link to="/contacto" class="btn btn--ghost">Agendar conversación inicial</router-link>
        </div>
      </div>
    </section>

    <section class="section section--soft">
      <div class="container">
        <p class="kicker" v-reveal>Para quién</p>
        <h2 class="section__title" v-reveal>Pensada para quienes lideran.</h2>
        <ul class="ruta__list" style="max-width:640px;margin-top:20px" v-reveal>
          <li v-for="s in SEGMENTS" :key="s">{{ s }}</li>
        </ul>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <p class="kicker" v-reveal>Formatos</p>
        <h2 class="section__title" v-reveal>Elige tu modalidad de acompañamiento.</h2>
        <div class="casos__grid">
          <article class="card" v-for="o in OFFERS" :key="o[0]" v-reveal>
            <h3 class="card__title">{{ o[0] }}</h3>
            <p class="card__text">{{ o[1] }}</p>
          </article>
        </div>
      </div>
    </section>

    <page-cta title="Construyamos tu ruta de crecimiento juntos." primary="Aplicar a mentoría" secondary="Agendar conversación inicial" secondary-to="/contacto" />
  </div>`
};
