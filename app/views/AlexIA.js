import { ref } from 'vue';
import PageCta from '../components/PageCta.js';
import InfoModal from '../components/InfoModal.js';

const CTA = { cta_label: 'Solicitar demo de AlexIA', cta_to: '/contacto?intent=Quiero conocer AlexIA' };
const USES = [
  { title: 'Atención por WhatsApp', icon: '💬', kicker: 'Atención 24/7',
    pain: '¿Pierdes clientes porque nadie responde a tiempo (o fuera de horario)?',
    promise: 'Un agente que responde en segundos, todos los días, con el tono de tu marca.',
    points: ['Responde al instante 24/7, incluso fines de semana', 'Resuelve dudas frecuentes y filtra lo que sí necesita a una persona', 'Nunca deja un mensaje sin leer ni un cliente sin respuesta'], ...CTA },
  { title: 'Agendamiento', icon: '📅', kicker: 'Agenda sin fricción',
    pain: '¿Se te caen reuniones por el ida y vuelta para cuadrar horarios?',
    promise: 'El agente agenda por ti: muestra disponibilidad, reserva y confirma.',
    points: ['Sincroniza con tu calendario y evita choques', 'Envía recordatorios para reducir las ausencias', 'Reagenda solo, sin que muevas un dedo'], ...CTA },
  { title: 'Seguimiento comercial', icon: '📈', kicker: 'Cero fugas',
    pain: '¿Cuántas oportunidades se enfrían porque nadie hizo el seguimiento a tiempo?',
    promise: 'Seguimiento constante y oportuno a cada lead, sin depender de la memoria del equipo.',
    points: ['Retoma conversaciones en el momento justo', 'Prioriza a quién contactar primero', 'Mantiene el pipeline vivo mientras tu equipo cierra'], ...CTA },
  { title: 'Calificación de leads', icon: '🎯', kicker: 'Habla con los correctos',
    pain: '¿Tu equipo pierde tiempo con contactos que nunca iban a comprar?',
    promise: 'El agente califica cada lead y entrega a ventas solo los que valen la pena.',
    points: ['Hace las preguntas clave sin sonar a formulario', 'Puntúa por intención, urgencia y capacidad', 'Enruta al vendedor indicado con el contexto listo'], ...CTA },
  { title: 'Soporte', icon: '🛟', kicker: 'Clientes que se quedan',
    pain: '¿El soporte lento te está costando clientes y reputación?',
    promise: 'Respuestas inmediatas a lo repetitivo; tu equipo se enfoca en lo complejo.',
    points: ['Resuelve el 80% de consultas al instante', 'Escala a un humano con todo el historial', 'Aprende de tus documentos y procesos'], ...CTA },
  { title: 'Recordatorios', icon: '⏰', kicker: 'Menos ausencias',
    pain: '¿Pierdes ingresos por citas o pagos que la gente simplemente olvida?',
    promise: 'Recordatorios automáticos y humanos que reducen ausencias y atrasos.',
    points: ['Recuerda citas, pagos y renovaciones', 'Personaliza el mensaje y el canal', 'Confirma o reagenda en la misma conversación'], ...CTA },
  { title: 'Cobranza', icon: '💳', kicker: 'Cobra sin desgaste',
    pain: '¿La cartera vencida crece y perseguir pagos desgasta a tu equipo?',
    promise: 'Recordatorios de pago firmes y respetuosos que recuperan cartera sin fricción.',
    points: ['Segmenta por antigüedad de la deuda', 'Ofrece opciones y enlaces de pago', 'Escala los casos que lo requieran'], ...CTA },
  { title: 'NPS y satisfacción', icon: '⭐', kicker: 'Escucha a escala',
    pain: '¿Tomas decisiones sin saber realmente qué sienten tus clientes?',
    promise: 'Mide satisfacción de forma conversacional y convierte feedback en acción.',
    points: ['Encuestas que la gente sí responde', 'Detecta detractores a tiempo', 'Convierte promotores en referidos'], ...CTA },
  { title: 'Pedidos', icon: '🛒', kicker: 'Vende en el chat',
    pain: '¿Cuántas ventas se pierden entre "me interesa" y "no me respondieron"?',
    promise: 'El agente toma pedidos y guía la compra dentro de la conversación.',
    points: ['Muestra catálogo y resuelve dudas', 'Toma el pedido y confirma el pago', 'Se integra con tu operación'], ...CTA },
  { title: 'Integración con CRM', icon: '🔗', kicker: 'Todo en un solo lugar',
    pain: '¿Tus conversaciones viven en un chat y tus datos en otro mundo?',
    promise: 'Cada interacción queda registrada y accionable en tu CRM, sin trabajo manual.',
    points: ['Crea y actualiza contactos automáticamente', 'Registra cada conversación y su resultado', 'Dispara tareas y alertas para tu equipo'], ...CTA }
];

export default {
  components: { PageCta, InfoModal },
  setup() {
    const selected = ref(null);
    return { USES, selected };
  },
  template: `
  <div class="page">
    <section class="hero" style="padding-top:clamp(110px,16vw,160px)">
      <div class="hero__bg" aria-hidden="true"><span class="orbit orbit--1"></span><span class="orbit__glow"></span></div>
      <div class="container">
        <p class="eyebrow" v-reveal>AlexIA · ExperientIA</p>
        <h1 class="section__title" v-reveal>Agentes inteligentes que atienden, venden y dan seguimiento.</h1>
        <p class="page__lead" v-reveal>AlexIA es la solución de agentes conversacionales del ecosistema ExperientIA para automatizar atención, ventas, soporte, agendamiento y seguimiento, integrada con tu CRM.</p>
        <div class="hero__actions" style="margin-top:24px" v-reveal>
          <router-link to="/contacto?intent=Quiero conocer AlexIA" class="btn btn--primary">Solicitar demo de AlexIA</router-link>
          <router-link to="/casos" class="btn btn--ghost">Ver casos de uso</router-link>
        </div>
      </div>
    </section>

    <section class="section section--soft">
      <div class="container">
        <p class="kicker" v-reveal>Casos de uso</p>
        <h2 class="section__title" v-reveal>Dónde AlexIA genera valor.</h2>
        <p class="section__text" v-reveal>Toca cada caso para ver cómo aplica en tu empresa.</p>
        <div class="casos__grid">
          <article class="card card--clickable" v-for="u in USES" :key="u.title" v-reveal @click="selected = u">
            <span style="font-size:1.7rem" aria-hidden="true">{{ u.icon }}</span>
            <h3 class="card__title" style="font-size:1.05rem;margin-top:8px">{{ u.title }}</h3>
            <p class="card__text" style="font-size:.9rem">{{ u.kicker }}</p>
            <span class="card__more">Ver cómo aplica →</span>
          </article>
        </div>
      </div>
    </section>

    <info-modal :item="selected" @close="selected = null" />
    <page-cta title="Pongamos un agente inteligente a trabajar por ti." primary="Solicitar demo de AlexIA" primary-to="/contacto?intent=Quiero conocer AlexIA" secondary="Ver casos de uso" secondary-to="/casos" />
  </div>`
};
