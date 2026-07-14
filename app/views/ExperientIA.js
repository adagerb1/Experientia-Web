import PageCta from '../components/PageCta.js';

const SOLUTIONS = [
  ['⊹', 'Automatización de procesos', 'Flujos que reducen tareas manuales y conectan tus herramientas.'],
  ['◎', 'Agentes inteligentes (AlexIA)', 'Atención, ventas y seguimiento conversacional automatizado.'],
  ['⬡', 'Integración con CRM', 'Datos, pipeline y seguimiento en un solo sistema.'],
  ['◈', 'Analítica y dashboards', 'Visibilidad para decidir con datos confiables.'],
  ['✦', 'IA aplicada', 'Casos de uso priorizados por impacto de negocio.'],
  ['↗', 'Growth systems', 'Sistemas comerciales predecibles y escalables.']
];

export default {
  components: { PageCta },
  setup() { return { SOLUTIONS }; },
  template: `
  <div class="page">
    <section class="hero" style="padding-top:clamp(110px,16vw,160px)">
      <div class="hero__bg" aria-hidden="true"><span class="orbit orbit--1"></span><span class="orbit__glow"></span></div>
      <div class="container">
        <p class="eyebrow" v-reveal>ExperientIA S.A.S.</p>
        <h1 class="section__title" v-reveal>Convertimos la claridad en sistemas, tecnología y resultados.</h1>
        <p class="page__lead" v-reveal>Tonny Dager crea la claridad estratégica. ExperientIA es la firma que implementa soluciones de IA, automatización, datos y growth. La marca personal abre confianza; ExperientIA ejecuta la transformación.</p>
        <div class="hero__actions" style="margin-top:24px" v-reveal>
          <router-link to="/contacto?intent=Quiero hablar con ExperientIA" class="btn btn--primary">Conocer soluciones ExperientIA</router-link>
          <router-link to="/agenda?tipo=diagnostico-ia-automatizacion" class="btn btn--ghost">Solicitar diagnóstico empresarial</router-link>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <p class="kicker" v-reveal>Soluciones principales</p>
        <h2 class="section__title" v-reveal>Qué implementamos.</h2>
        <div class="pilares__grid">
          <article class="card" v-for="s in SOLUTIONS" :key="s[1]" v-reveal>
            <span class="card__icon" aria-hidden="true">{{ s[0] }}</span>
            <h3 class="card__title">{{ s[1] }}</h3>
            <p class="card__text">{{ s[2] }}</p>
          </article>
        </div>
      </div>
    </section>

    <page-cta title="Implementemos un sistema real de crecimiento." primary="Conocer soluciones" primary-to="/contacto?intent=Quiero hablar con ExperientIA" secondary="Conocer AlexIA" secondary-to="/alexia" />
  </div>`
};
