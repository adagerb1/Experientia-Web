import { ref } from 'vue';
import PageCta from '../components/PageCta.js';
import InfoModal from '../components/InfoModal.js';

const CTA = { cta_label: 'Solicitar propuesta', cta_to: '/contacto?intent=Quiero un entrenamiento para mi equipo' };
const PROGRAMS = [
  { icon: '◎', title: 'IA aplicada al negocio', text: 'Tu equipo aprende a identificar y ejecutar casos de uso reales.', kicker: 'De la teoría a la ejecución',
    pain: '¿Tu equipo habla de IA pero no sabe por dónde empezar a aplicarla?',
    promise: 'Salen con casos de uso identificados y priorizados para tu propia operación.',
    points: ['Detectan dónde la IA ahorra tiempo o genera ingresos', 'Practican con herramientas reales, no diapositivas', 'Un plan de aplicación para las próximas semanas'], ...CTA },
  { icon: '⊹', title: 'Automatización inteligente', text: 'Diseño de flujos que liberan tiempo y reducen errores.', kicker: 'Recupera horas',
    pain: '¿Cuánto tiempo pierde tu equipo en tareas repetitivas que nadie disfruta?',
    promise: 'Aprenden a diseñar automatizaciones que liberan horas y reducen errores.',
    points: ['Mapean procesos y detectan cuellos de botella', 'Diseñan flujos que trabajan solos', 'Menos errores humanos, más foco en lo importante'], ...CTA },
  { icon: '↗', title: 'Growth & Revenue', text: 'Captación, conversión y datos como un sistema predecible.', kicker: 'Crecimiento predecible',
    pain: '¿Tu crecimiento depende de la suerte o del esfuerzo heroico de unos pocos?',
    promise: 'Instalan un sistema de captación, conversión y datos que crece de forma predecible.',
    points: ['Un embudo que sí convierte y se mide', 'Seguimiento comercial sin fugas', 'Decisiones con datos, no con intuición'], ...CTA },
  { icon: '◈', title: 'Cultura de datos y decisión', text: 'Decidir con criterio, indicadores y trazabilidad.', kicker: 'Decidir con criterio',
    pain: '¿Se toman decisiones importantes sin datos que las respalden?',
    promise: 'Tu equipo aprende a decidir con indicadores, criterio y trazabilidad.',
    points: ['Definen los indicadores que sí importan', 'Rutinas de revisión que crean disciplina', 'Una cultura que ejecuta y mide'], ...CTA }
];
const FORMATS = ['In-company (presencial o virtual)', 'Bootcamps intensivos', 'Programas por módulos', 'Workshops prácticos', 'Acompañamiento post-entrenamiento'];

export default {
  components: { PageCta, InfoModal },
  setup() { const selected = ref(null); return { PROGRAMS, FORMATS, selected }; },
  template: `
  <div class="page">
    <section class="page__hero">
      <div class="container">
        <p class="kicker" v-reveal>Entrenamientos</p>
        <h1 class="section__title" v-reveal>Entrena a tu equipo para crecer en la era de la IA.</h1>
        <p class="page__lead" v-reveal>Programas aplicados de IA, automatización, marketing y growth diseñados para que tu equipo no solo entienda, sino que ejecute. Formación con criterio de negocio y resultados medibles.</p>
        <div class="hero__actions" style="margin-top:24px" v-reveal>
          <router-link to="/contacto?intent=Quiero un entrenamiento para mi equipo" class="btn btn--primary">Solicitar propuesta</router-link>
          <router-link to="/conferencias" class="btn btn--ghost">Ver conferencias</router-link>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <p class="kicker" v-reveal>Programas</p>
        <h2 class="section__title" v-reveal>Lo que tu equipo dominará.</h2>
        <p class="section__text" v-reveal>Toca cada programa para ver cómo transforma a tu equipo.</p>
        <div class="pilares__grid">
          <article class="card card--clickable" v-for="p in PROGRAMS" :key="p.title" v-reveal @click="selected = p">
            <span class="card__icon" aria-hidden="true">{{ p.icon }}</span>
            <h3 class="card__title">{{ p.title }}</h3>
            <p class="card__text">{{ p.text }}</p>
            <span class="card__more">Ver detalle →</span>
          </article>
        </div>
      </div>
    </section>

    <info-modal :item="selected" @close="selected = null" />

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
      primary="Solicitar propuesta" primary-to="/contacto?intent=Quiero un entrenamiento para mi equipo" secondary="Agenda una sesión" secondary-to="/agenda?tipo=llamada-exploracion" />
  </div>`
};
