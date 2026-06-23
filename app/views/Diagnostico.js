import PageCta from '../components/PageCta.js';

const TYPES = [
  ['Diagnóstico Estratégico IA & Growth', 'Sesión 1:1 para identificar oportunidades de crecimiento, automatización, IA, marketing, ventas y datos.', '60 min · Virtual'],
  ['Diagnóstico IA & Automatización', 'Identifica procesos manuales, herramientas desconectadas y oportunidades de automatización con IA.', '60 min · Virtual'],
  ['Diagnóstico Growth & Revenue', 'Revisa oferta, embudo, captación, seguimiento, conversión, CRM y oportunidades de revenue.', '60 min · Virtual'],
  ['Sesión Estratégica 1:1 con Tonny', 'Claridad, foco y dirección sobre una decisión o reto de crecimiento.', '75 min · Virtual'],
  ['Llamada de Exploración Empresarial', 'Llamada breve para entender qué necesita tu empresa: diagnóstico, mentoría, implementación o conferencia.', '20 min · Virtual']
];

const INCLUDES = ['Lectura estratégica de tu situación actual', 'Identificación de brechas', 'Oportunidades de automatización', 'Recomendaciones de IA aplicada', 'Ruta de acción priorizada'];

export default {
  components: { PageCta },
  setup() { return { TYPES, INCLUDES }; },
  template: `
  <div class="page">
    <section class="page__hero">
      <div class="container">
        <p class="kicker" v-reveal>Diagnóstico IA & Growth</p>
        <h1 class="section__title" v-reveal>Convierte tu situación actual en una ruta clara de crecimiento.</h1>
        <p class="page__lead" v-reveal>Un diagnóstico configurado, comprable y agendable para identificar oportunidades concretas de crecimiento, automatización, IA, marketing, ventas y datos en tu negocio.</p>
        <div class="hero__actions" style="margin-top:24px" v-reveal>
          <router-link to="/contacto" class="btn btn--primary">Reservar y pagar diagnóstico</router-link>
          <router-link to="/contacto" class="btn btn--ghost">Consultar disponibilidad</router-link>
        </div>
      </div>
    </section>

    <section class="section section--soft">
      <div class="container">
        <p class="kicker" v-reveal>Qué incluye</p>
        <h2 class="section__title" v-reveal>Lo que obtienes en tu diagnóstico.</h2>
        <ul class="ruta__list" style="max-width:640px;margin-top:20px" v-reveal>
          <li v-for="i in INCLUDES" :key="i">{{ i }}</li>
        </ul>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <p class="kicker" v-reveal>Tipos de diagnóstico</p>
        <h2 class="section__title" v-reveal>Elige el diagnóstico para tu momento.</h2>
        <div class="casos__grid">
          <article class="card" v-for="t in TYPES" :key="t[0]" v-reveal>
            <h3 class="card__title">{{ t[0] }}</h3>
            <p class="card__text">{{ t[1] }}</p>
            <p class="caso__sector" style="margin-top:10px">{{ t[2] }}</p>
          </article>
        </div>
      </div>
    </section>

    <page-cta title="Reserva tu diagnóstico y empieza con claridad."
      primary="Reservar y pagar diagnóstico" secondary="Consultar disponibilidad" secondary-to="/contacto" />
  </div>`
};
