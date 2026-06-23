import PageCta from '../components/PageCta.js';

const USES = ['Atención por WhatsApp', 'Agendamiento', 'Seguimiento comercial', 'Calificación de leads', 'Soporte', 'Recordatorios', 'Cobranza', 'NPS', 'Pedidos', 'Integración con CRM'];

export default {
  components: { PageCta },
  setup() { return { USES }; },
  template: `
  <div class="page">
    <section class="hero" style="padding-top:clamp(110px,16vw,160px)">
      <div class="hero__bg" aria-hidden="true"><span class="orbit orbit--1"></span><span class="orbit__glow"></span></div>
      <div class="container">
        <p class="eyebrow" v-reveal>AlexIA · ExperientIA</p>
        <h1 class="section__title" v-reveal>Agentes inteligentes que atienden, venden y dan seguimiento.</h1>
        <p class="page__lead" v-reveal>AlexIA es la solución de agentes conversacionales del ecosistema ExperientIA para automatizar atención, ventas, soporte, agendamiento y seguimiento, integrada con tu CRM.</p>
        <div class="hero__actions" style="margin-top:24px" v-reveal>
          <router-link to="/contacto" class="btn btn--primary">Solicitar demo de AlexIA</router-link>
          <router-link to="/casos" class="btn btn--ghost">Ver casos de uso</router-link>
        </div>
      </div>
    </section>

    <section class="section section--soft">
      <div class="container">
        <p class="kicker" v-reveal>Casos de uso</p>
        <h2 class="section__title" v-reveal>Dónde AlexIA genera valor.</h2>
        <div class="casos__grid">
          <article class="card" v-for="u in USES" :key="u" v-reveal>
            <h3 class="card__title" style="font-size:1.05rem">{{ u }}</h3>
          </article>
        </div>
      </div>
    </section>

    <page-cta title="Pongamos un agente inteligente a trabajar por ti." primary="Solicitar demo de AlexIA" primary-to="/contacto" secondary="Ver casos de uso" secondary-to="/casos" />
  </div>`
};
