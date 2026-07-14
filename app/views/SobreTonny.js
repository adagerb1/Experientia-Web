import { ref } from 'vue';
import PageCta from '../components/PageCta.js';
import InfoModal from '../components/InfoModal.js';

const CTA = { cta_label: 'Agendar una conversación', cta_to: '/agenda' };
const EXPERTISE = [
  { icon: '◎', title: 'IA aplicada al negocio', text: 'Identificar dónde la inteligencia artificial genera valor real, no solo novedad.', kicker: 'IA con criterio',
    pain: '¿Te presionan por "usar IA" pero no sabes dónde realmente moverá la aguja?',
    promise: 'Identificamos juntos dónde la IA genera valor real en tu empresa, y dónde no.',
    points: ['Priorizamos por impacto, no por moda', 'Casos de uso atados a una métrica de negocio', 'Un camino claro para empezar sin sobre-invertir'], ...CTA },
  { icon: '⊹', title: 'Automatización', text: 'Liberar capacidad operativa conectando herramientas y procesos.', kicker: 'Recupera capacidad',
    pain: '¿Tu equipo está saturado haciendo a mano lo que una máquina podría hacer?',
    promise: 'Liberamos capacidad operativa conectando tus herramientas y procesos.',
    points: ['Menos tareas repetitivas, más foco estratégico', 'Procesos que no dependen de recordar', 'Escalas sin multiplicar la nómina'], ...CTA },
  { icon: '↗', title: 'Marketing & Growth', text: 'Sistemas comerciales predecibles de captación, conversión y fidelización.', kicker: 'Demanda predecible',
    pain: '¿Vendes a tirones y no logras un flujo constante de clientes?',
    promise: 'Construimos un sistema comercial predecible: captación, conversión y fidelización.',
    points: ['Un motor de demanda que no depende de la suerte', 'Seguimiento que no deja fugas', 'Clientes que vuelven y refieren'], ...CTA },
  { icon: '◈', title: 'Revenue y datos', text: 'Decisiones guiadas por datos, indicadores y trazabilidad.', kicker: 'Decidir con datos',
    pain: '¿Decides a ciegas porque los datos están dispersos o no se usan?',
    promise: 'Convertimos tus datos en decisiones: indicadores claros y trazabilidad.',
    points: ['Ves con claridad de dónde viene (y se fuga) el revenue', 'Indicadores que guían la acción', 'Decisiones más rápidas y con menos riesgo'], ...CTA },
  { icon: '⬡', title: 'Estrategia empresarial', text: 'Claridad, foco y priorización para crecer con estructura.', kicker: 'Claridad y foco',
    pain: '¿Sientes que haces mucho pero avanzas poco, sin una dirección clara?',
    promise: 'Recuperas claridad, foco y prioridades para crecer con estructura.',
    points: ['Sabes qué sí y qué no hacer ahora', 'Una ruta de crecimiento priorizada', 'Menos dispersión, más avance real'], ...CTA },
  { icon: '✦', title: 'Liderazgo y transformación', text: 'Acompañar a equipos en la era de la inteligencia artificial.', kicker: 'Equipos que ejecutan',
    pain: '¿La estrategia se queda en el papel porque el equipo no la ejecuta?',
    promise: 'Acompaño a tus líderes y equipos a convertir la visión en ejecución.',
    points: ['Del discurso a la cultura de ejecución', 'Adopción de la IA sin miedo', 'Un equipo alineado y en movimiento'], ...CTA }
];

export default {
  components: { PageCta, InfoModal },
  setup() {
    const photoError = ref(false);
    const selected = ref(null);
    return { EXPERTISE, photoError, selected };
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
            <router-link to="/agenda" class="btn btn--primary">Hablar con Tonny</router-link>
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
        <p class="section__text" v-reveal>Toca cada área para ver cómo puede ayudarte.</p>
        <div class="pilares__grid">
          <article class="card card--clickable" v-for="e in EXPERTISE" :key="e.title" v-reveal @click="selected = e">
            <span class="card__icon" aria-hidden="true">{{ e.icon }}</span>
            <h3 class="card__title">{{ e.title }}</h3>
            <p class="card__text">{{ e.text }}</p>
            <span class="card__more">Ver cómo aplica →</span>
          </article>
        </div>
      </div>
    </section>

    <info-modal :item="selected" @close="selected = null" />

    <page-cta title="Hablemos de tu próximo nivel de crecimiento."
      primary="Hablar con Tonny" secondary="Conocer ExperientIA" secondary-to="/experientia" />
  </div>`
};
