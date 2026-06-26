import PageCta from '../components/PageCta.js';

const GET = [
  ['Claridad estratégica', 'Salimos del ruido: defines qué priorizar y por qué.'],
  ['Diagnóstico de oportunidades', 'Dónde la IA, la automatización y el growth generan más valor.'],
  ['Ruta de acción priorizada', 'Próximos pasos concretos, medibles y accionables.'],
  ['Criterio para decidir', 'Marco para tomar mejores decisiones con datos, no por intuición.']
];
const FOR = ['Empresarios y founders', 'Directivos y líderes de área', 'Equipos que quieren escalar con IA', 'Negocios que necesitan foco y dirección'];
const STEPS = [
  ['01', 'Conversación', 'Agendas tu sesión y nos cuentas tu reto principal.'],
  ['02', 'Sesión estratégica 1:1', 'Trabajamos tu situación, oportunidades y prioridades.'],
  ['03', 'Ruta y siguientes pasos', 'Te llevas un plan claro y opciones para implementar.']
];

export default {
  components: { PageCta },
  setup() { return { GET, FOR, STEPS }; },
  template: `
  <div class="page">
    <section class="hero" style="padding-top:clamp(120px,16vw,170px)">
      <div class="hero__bg" aria-hidden="true"><span class="orbit orbit--1"></span><span class="orbit__glow"></span></div>
      <div class="container" style="position:relative;z-index:1">
        <p class="eyebrow" v-reveal>Servicio insignia</p>
        <h1 class="hero__title" style="max-width:16ch" v-reveal>Sesión de <span class="grad">Consultoría Estratégica</span> 1:1 con Tonny.</h1>
        <p class="hero__sub" v-reveal>Una conversación de alto nivel para convertir tu complejidad en una ruta clara de crecimiento. Aquí empieza la relación: del diagnóstico nacen la mentoría, la implementación y el acompañamiento.</p>
        <div class="hero__actions" v-reveal>
          <router-link to="/contacto" class="btn btn--primary btn--lg">Agenda tu sesión estratégica</router-link>
          <router-link to="/diagnostico-ia-growth" class="btn btn--ghost btn--lg">Hacer diagnóstico primero</router-link>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <p class="kicker" v-reveal>Qué te llevas</p>
        <h2 class="section__title" v-reveal>Sales con claridad y una ruta accionable.</h2>
        <div class="pilares__grid">
          <article class="card" v-for="g in GET" :key="g[0]" v-reveal>
            <h3 class="card__title">{{ g[0] }}</h3>
            <p class="card__text">{{ g[1] }}</p>
          </article>
        </div>
      </div>
    </section>

    <section class="section section--soft">
      <div class="container">
        <p class="kicker" v-reveal>Cómo funciona</p>
        <h2 class="section__title" v-reveal>Tres pasos, cero fricción.</h2>
        <div class="rutas__grid">
          <article class="card ruta" v-for="s in STEPS" :key="s[0]" v-reveal>
            <span class="ruta__num">{{ s[0] }}</span>
            <h3 class="ruta__title">{{ s[1] }}</h3>
            <p class="ruta__text">{{ s[2] }}</p>
          </article>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <p class="kicker" v-reveal>Para quién</p>
        <h2 class="section__title" v-reveal>Pensada para quienes deciden.</h2>
        <ul class="ruta__list" style="max-width:640px;margin-top:20px" v-reveal>
          <li v-for="f in FOR" :key="f">{{ f }}</li>
        </ul>
      </div>
    </section>

    <page-cta title="El siguiente paso de tu empresa empieza con una conversación."
      primary="Agenda tu sesión estratégica" secondary="Ver mentorías" secondary-to="/mentorias" />
  </div>`
};
