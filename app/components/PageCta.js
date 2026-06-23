import { RouterLink } from 'vue-router';

// Bloque CTA reutilizable al cierre de las páginas internas.
export default {
  components: { RouterLink },
  props: {
    title: { type: String, default: 'Demos el siguiente paso con claridad.' },
    text: { type: String, default: 'Agenda una conversación estratégica y definamos tu ruta de crecimiento.' },
    primary: { type: String, default: 'Agenda una conversación estratégica' },
    primaryTo: { type: String, default: '/contacto' },
    secondary: { type: String, default: '' },
    secondaryTo: { type: String, default: '/diagnostico-ia-growth' }
  },
  template: `
  <section class="section cta-final">
    <div class="cta-final__bg" aria-hidden="true"><span class="orbit orbit--1"></span><span class="orbit__glow"></span></div>
    <div class="container cta-final__inner" v-reveal>
      <h2 class="cta-final__title">{{ title }}</h2>
      <p class="cta-final__text">{{ text }}</p>
      <div class="cta-final__actions">
        <router-link :to="primaryTo" class="btn btn--primary btn--lg">{{ primary }}</router-link>
        <router-link v-if="secondary" :to="secondaryTo" class="btn btn--ghost btn--lg">{{ secondary }}</router-link>
      </div>
    </div>
  </section>`
};
