import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { track } from '../../assets/js/tracking.js?v=20260727-1';
import { api } from '../../assets/js/api.js?v=20260727-1';
import InfoModal from '../components/InfoModal.js';

// Configuración por defecto (fallback si el backend no responde).
const DEFAULTS = {
  name: 'Tonny Dager',
  role: 'Arquitecto del Crecimiento Empresarial',
  avatar_url: '/assets/img/tonny-portrait.png',
  tags: 'Estrategia · Datos · IA · Automatización · Ventas',
  message: 'Tu empresa puede vender y aun así estar trabada. Haz el diagnóstico y descubre tu primera jugada de crecimiento.',
  show_pitch: true,
  pitch_title: 'El Tablero en 4 líneas',
  pitch_items: [
    { title: 'Dirección', text: 'define el rumbo' },
    { title: 'Defensa', text: 'protege la estabilidad' },
    { title: 'Mediocampo', text: 'conecta datos y procesos' },
    { title: 'Ataque', text: 'convierte mercado en crecimiento' }
  ],
  buttons: [
    { label: 'Hacer Diagnóstico Tablero de Crecimiento', url: '/diagnostico-tablero-crecimiento', external: false, style: 'primary', event: 'bio_diagnostic_clicked' },
    { label: 'Agendar lectura estratégica', url: '/agenda', external: false, style: 'normal', event: 'bio_agenda_clicked' },
    { label: 'Conocer ExperientIA', url: '/experientia', external: false, style: 'normal', event: 'bio_experientia_clicked' },
    { label: 'Ver contenido destacado', url: 'https://www.linkedin.com', external: true, style: 'ghost', event: 'bio_content_clicked' }
  ],
  footer: '© 2026 Tonny Dager · ExperientIA'
};

// Detalle C-level por línea del Tablero (se muestra al tocar cada una).
const LINE_DETAIL = {
  dirección: { icon: '🧭', kicker: 'Dirección estratégica', title: 'Dirección — define el rumbo',
    pain: '¿Tu empresa avanza rápido… pero no estás seguro de si es hacia el lugar correcto?',
    promise: 'La línea que fija el norte: visión, estrategia y decisiones que ordenan todo lo demás.',
    points: ['Claridad de hacia dónde vas y por qué', 'Prioridades que alinean al equipo', 'Menos reacción, más intención'], cta_label: 'Hacer el diagnóstico', cta_to: '/diagnostico-tablero-crecimiento' },
  defensa: { icon: '🛡️', kicker: 'Defensa empresarial', title: 'Defensa — protege la estabilidad',
    pain: '¿Creces por un lado mientras se te fugan margen, caja o talento por el otro?',
    promise: 'La línea que cuida lo que ya tienes: finanzas, operación y cultura sanas.',
    points: ['Finanzas y operación bajo control', 'Menos fugas de tiempo y dinero', 'Una base estable para escalar sin romperte'], cta_label: 'Hacer el diagnóstico', cta_to: '/diagnostico-tablero-crecimiento' },
  mediocampo: { icon: '⚙️', kicker: 'Mediocampo de crecimiento', title: 'Mediocampo — conecta datos y procesos',
    pain: '¿Tienes herramientas y datos, pero desconectados y sin convertirse en decisiones?',
    promise: 'La línea que hace fluir el juego: datos, procesos y automatización que conectan todo.',
    points: ['Tus datos por fin trabajan para ti', 'Procesos que no dependen de héroes', 'Automatización que libera capacidad'], cta_label: 'Hacer el diagnóstico', cta_to: '/diagnostico-tablero-crecimiento' },
  ataque: { icon: '⚡', kicker: 'Ataque comercial', title: 'Ataque — convierte mercado en crecimiento',
    pain: '¿Inviertes en marketing y ventas pero el mercado no se convierte en ingresos?',
    promise: 'La línea que anota: marketing, ventas y experiencia que convierten en revenue.',
    points: ['Demanda que sí se transforma en ventas', 'Un embudo comercial sin fugas', 'Clientes que compran, vuelven y refieren'], cta_label: 'Hacer el diagnóstico', cta_to: '/diagnostico-tablero-crecimiento' }
};

// Link en Bio premium — mini landing editable desde el panel.
export default {
  components: { InfoModal },
  setup() {
    const router = useRouter();
    const photoError = ref(false);
    const cfg = reactive({ ...DEFAULTS });
    const selected = ref(null);
    // Empareja la línea (por su título) con el detalle definido.
    function openLine(l) {
      const key = (l.title || '').trim().toLowerCase().split(/\s|—|-/)[0]
        .replace('direccion', 'dirección');
      selected.value = LINE_DETAIL[key] || { title: l.title, promise: l.text, cta_label: 'Hacer el diagnóstico', cta_to: '/diagnostico-tablero-crecimiento' };
    }

    onMounted(async () => {
      try {
        const r = await api.bio();
        if (r && r.data) Object.assign(cfg, r.data);
      } catch (e) { /* usa DEFAULTS */ }
    });

    const initials = () => (cfg.name || 'TD').split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    const btnClass = (b) => b.style === 'primary' ? 'bio__btn bio__btn--primary' : (b.style === 'ghost' ? 'bio__btn bio__btn--ghost' : 'bio__btn');

    const go = (b) => {
      track(b.event || 'bio_link_clicked', { from: 'link_bio', url: b.url });
      const external = b.external || /^https?:\/\//i.test(b.url || '');
      if (external) window.open(b.url, '_blank', 'noopener');
      else router.push(b.url);
    };
    return { cfg, photoError, initials, btnClass, go, selected, openLine };
  },
  template: `
  <div class="bio">
    <div class="bio__bg" aria-hidden="true"></div>
    <div class="bio__inner">
      <div class="bio__head" v-reveal>
        <div class="bio__avatar">
          <img v-if="cfg.avatar_url && !photoError" :src="cfg.avatar_url" :alt="cfg.name" @error="photoError = true" />
          <span v-else>{{ initials() }}</span>
        </div>
        <h1 class="bio__name">{{ cfg.name }}</h1>
        <p class="bio__role">{{ cfg.role }}</p>
        <p class="bio__tags" v-if="cfg.tags">{{ cfg.tags }}</p>
      </div>

      <p class="bio__msg" v-if="cfg.message" v-reveal>{{ cfg.message }}</p>

      <div class="bio__buttons">
        <button v-for="(b, i) in cfg.buttons" :key="i" :class="btnClass(b)" v-reveal @click="go(b)">
          <span>{{ b.label }}</span><span aria-hidden="true">{{ (b.external || /^https?:/.test(b.url)) ? '↗' : '→' }}</span>
        </button>
      </div>

      <div class="bio__pitch" v-if="cfg.show_pitch && cfg.pitch_items && cfg.pitch_items.length" v-reveal>
        <p class="bio__pitch-title">{{ cfg.pitch_title }}</p>
        <div class="bio__pitch-grid">
          <button type="button" class="bio__pitch-item bio__pitch-item--btn" v-for="(l, i) in cfg.pitch_items" :key="i" @click="openLine(l)">
            <strong>{{ l.title }}</strong><span>{{ l.text }}</span>
            <span class="bio__pitch-more">Ver detalle →</span>
          </button>
        </div>
      </div>

      <p class="bio__foot">{{ cfg.footer }}</p>
    </div>
    <info-modal :item="selected" @close="selected = null" />
  </div>`
};
