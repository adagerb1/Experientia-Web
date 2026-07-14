import { ref } from 'vue';
import PageCta from '../components/PageCta.js';
import InfoModal from '../components/InfoModal.js';

const CTA = { cta_label: 'Solicitar esta conferencia', cta_to: '/contacto?intent=Quiero contratar una conferencia' };
const TOPICS = [
  { title: 'La otra mirada de la inteligencia artificial en los negocios', icon: '🔭', kicker: 'Apertura de visión',
    pain: '¿Sientes que la IA avanza más rápido de lo que tu empresa logra entender y aplicar?',
    promise: 'Una charla que baja la IA de la moda al negocio: dónde crea valor real y dónde es solo ruido.',
    points: ['Tu equipo pasa del miedo a la claridad', 'Ejemplos reales aplicables a tu sector', 'Sale con una idea concreta para empezar mañana'], ...CTA },
  { title: 'IA, automatización y growth: de la herramienta al sistema', icon: '⚙️', kicker: 'Del caos al sistema',
    pain: '¿Compraste herramientas que nadie usa y siguen sin darte resultados?',
    promise: 'El marco para convertir herramientas sueltas en un sistema de crecimiento medible.',
    points: ['Deja de coleccionar apps y empieza a operar como sistema', 'Cómo priorizar qué automatizar primero', 'Del "tenemos IA" al "la IA nos da resultados"'], ...CTA },
  { title: 'Marketing para humanos y máquinas', icon: '🧲', kicker: 'Demanda con criterio',
    pain: '¿Inviertes en marketing pero no ves cómo se convierte en clientes y en ingresos?',
    promise: 'Cómo conectar marca, contenido y datos para generar demanda que sí vende.',
    points: ['Marketing conectado a ventas y a revenue', 'Contenido que atrae a las personas y a los algoritmos', 'Del "me ven" al "me compran"'], ...CTA },
  { title: 'Empresas inteligentes: vender, operar y decidir con IA', icon: '🧠', kicker: 'Decisiones con datos',
    pain: '¿Tu empresa decide por intuición porque los datos están dispersos o no se usan?',
    promise: 'Cómo vender, operar y decidir mejor apoyándote en IA y datos, sin perder lo humano.',
    points: ['Decisiones más rápidas y con menos riesgo', 'Operación más liviana y enfocada', 'IA como copiloto, no como reemplazo'], ...CTA },
  { title: 'Customer Centricity en tiempos de inteligencia artificial', icon: '❤️', kicker: 'Cliente en el centro',
    pain: '¿La experiencia de tu cliente se está enfriando mientras automatizas?',
    promise: 'Cómo usar la IA para acercarte al cliente, no para alejarte de él.',
    points: ['Personalización real a escala', 'Momentos que fidelizan y generan referidos', 'Tecnología al servicio de la relación'], ...CTA },
  { title: 'Growth 360: percepción, demanda, conversión e ingresos', icon: '🚀', kicker: 'Crecimiento integral',
    pain: '¿Creces a tirones y no logras un motor de crecimiento predecible?',
    promise: 'Una visión 360 del crecimiento: de cómo te perciben hasta cómo se traduce en ingresos.',
    points: ['Entiende dónde se fuga tu crecimiento', 'Conecta percepción, demanda, conversión y revenue', 'Un mapa claro de tus próximas palancas'], ...CTA },
  { title: 'Liderazgo y transformación en la era de la IA', icon: '🧭', kicker: 'Liderar el cambio',
    pain: '¿Tu equipo se resiste al cambio o no sabe cómo adoptar la IA sin miedo?',
    promise: 'Cómo liderar una transformación que la gente abraza en lugar de temer.',
    points: ['Activa a tu equipo con propósito y claridad', 'Cultura de ejecución, no solo de intención', 'Del discurso a la acción medible'], ...CTA }
];
const RESULTS = ['Inspiración estratégica', 'Formación accionable', 'Visión de futuro', 'Activación de equipos', 'Experiencias diseñadas para movilizar acción'];

export default {
  components: { PageCta, InfoModal },
  setup() { const selected = ref(null); return { TOPICS, RESULTS, selected }; },
  template: `
  <div class="page">
    <section class="page__hero">
      <div class="container">
        <p class="kicker" v-reveal>Conferencias & Workshops</p>
        <h1 class="section__title" v-reveal>Abre visión y activa a tu equipo en la era de la IA.</h1>
        <p class="page__lead" v-reveal>Speaker estratégico para empresas, gremios, cámaras de comercio, universidades, eventos y equipos corporativos que quieren entender y aplicar IA, automatización y growth con criterio.</p>
        <div class="hero__actions" style="margin-top:24px" v-reveal>
          <router-link to="/contacto?intent=Quiero contratar una conferencia" class="btn btn--primary">Solicitar conferencia</router-link>
        </div>
      </div>
    </section>

    <section class="section section--soft">
      <div class="container">
        <p class="kicker" v-reveal>Temas</p>
        <h2 class="section__title" v-reveal>Conferencias diseñadas para movilizar acción.</h2>
        <p class="section__text" v-reveal>Toca cada tema para ver el valor que recibe tu audiencia.</p>
        <div class="casos__grid">
          <article class="card card--clickable" v-for="t in TOPICS" :key="t.title" v-reveal @click="selected = t">
            <span style="font-size:1.6rem" aria-hidden="true">{{ t.icon }}</span>
            <h3 class="card__title" style="font-size:1.05rem;margin-top:8px">{{ t.title }}</h3>
            <span class="card__more">Ver el valor →</span>
          </article>
        </div>
      </div>
    </section>

    <info-modal :item="selected" @close="selected = null" />

    <section class="section">
      <div class="container">
        <p class="kicker" v-reveal>Resultados esperados</p>
        <h2 class="section__title" v-reveal>Qué se lleva tu audiencia.</h2>
        <ul class="ruta__list" style="max-width:640px;margin-top:20px" v-reveal>
          <li v-for="r in RESULTS" :key="r">{{ r }}</li>
        </ul>
      </div>
    </section>

    <page-cta title="Llevemos esta experiencia a tu empresa o evento." primary="Solicitar conferencia" primary-to="/contacto?intent=Quiero contratar una conferencia" secondary="Agenda una llamada" secondary-to="/agenda?tipo=llamada-exploracion" />
  </div>`
};
