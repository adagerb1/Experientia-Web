import { ref, reactive, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { track } from '../../assets/js/tracking.js';
import { api } from '../../assets/js/api.js';

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

// Link en Bio premium — mini landing editable desde el panel.
export default {
  setup() {
    const router = useRouter();
    const photoError = ref(false);
    const cfg = reactive({ ...DEFAULTS });

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
    return { cfg, photoError, initials, btnClass, go };
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
          <div class="bio__pitch-item" v-for="(l, i) in cfg.pitch_items" :key="i">
            <strong>{{ l.title }}</strong><span>{{ l.text }}</span>
          </div>
        </div>
      </div>

      <p class="bio__foot">{{ cfg.footer }}</p>
    </div>
  </div>`
};
