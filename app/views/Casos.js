import { ref, computed, onMounted } from 'vue';
import PageCta from '../components/PageCta.js';
import { CASES } from '../data/site.js';
import { api } from '../../assets/js/api.js';

const SECTORS = ['Educación', 'Servicios profesionales', 'Legal', 'Salud', 'Retail', 'Formación', 'Consultoría', 'Restaurantes', 'Empresas de servicios', 'Automatización comercial'];

export default {
  components: { PageCta },
  setup() {
    const cases = ref([]);
    const flipped = ref({});      // id -> bool (tarjeta volteada)
    const playing = ref('');      // id del audio en reproducción
    let audioEl = null;

    // Normaliza los casos estáticos al mismo formato del backend (fallback offline).
    const fallback = CASES.map((c, i) => ({
      id: 'static-' + i, sector: c.sector, title: c.title || '', problem: c.problem,
      intervention: c.action, result: c.result, metric_value: c.metric || '', metric_label: c.metricLabel || '',
      summary: c.summary || '', tags: '', image_url: '', audio_url: ''
    }));

    onMounted(async () => {
      try {
        const r = await api.cases();
        cases.value = (r && r.data && r.data.length) ? r.data : fallback;
      } catch (e) { cases.value = fallback; }
    });

    const flip = (id) => { flipped.value = { ...flipped.value, [id]: !flipped.value[id] }; };
    const tagList = (t) => (t || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 4);

    function toggleAudio(c) {
      if (!c.audio_url) return;
      if (playing.value === c.id && audioEl) { audioEl.pause(); playing.value = ''; return; }
      if (audioEl) audioEl.pause();
      audioEl = new Audio(c.audio_url);
      audioEl.onended = () => { playing.value = ''; };
      audioEl.play().then(() => { playing.value = c.id; }).catch(() => { playing.value = ''; });
    }

    const hasCases = computed(() => cases.value.length > 0);
    return { cases, hasCases, SECTORS, flipped, flip, tagList, playing, toggleAudio };
  },
  template: `
  <div class="page">
    <section class="page__hero">
      <div class="container">
        <p class="kicker" v-reveal>Casos reales</p>
        <h1 class="section__title" v-reveal>Casos reales. Impacto medible.</h1>
        <p class="page__lead" v-reveal>La estrategia cobra valor cuando se convierte en resultados. Pasa el cursor o toca cada tarjeta para ver el problema, la intervención y el resultado.</p>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="casos__metrics" v-reveal>
          <div class="caso-metric"><span class="caso-metric__num">+47%</span><span class="caso-metric__label">Crecimiento promedio</span></div>
          <div class="caso-metric"><span class="caso-metric__num">+32%</span><span class="caso-metric__label">En ventas</span></div>
          <div class="caso-metric"><span class="caso-metric__num">−28%</span><span class="caso-metric__label">En costos operativos</span></div>
        </div>

        <div class="casos__grid casos__grid--flip">
          <div class="flipcard" v-for="c in cases" :key="c.id" :class="{ 'is-flipped': flipped[c.id] }" v-reveal @click="flip(c.id)">
            <div class="flipcard__inner">
              <!-- Frente -->
              <div class="flipcard__face flipcard__front" :style="c.image_url ? { backgroundImage: 'linear-gradient(180deg, rgba(11,29,58,.35), rgba(11,29,58,.88)), url(' + c.image_url + ')' } : null" :class="{ 'flipcard__front--img': c.image_url }">
                <span class="caso__sector">{{ c.sector }}</span>
                <div class="flipcard__front-body">
                  <span v-if="c.metric_value" class="flipcard__metric">{{ c.metric_value }}</span>
                  <span v-if="c.metric_label" class="flipcard__metric-label">{{ c.metric_label }}</span>
                  <h3 class="flipcard__title">{{ c.title || c.summary || c.result }}</h3>
                </div>
                <span class="flipcard__hint">Ver detalle →</span>
              </div>
              <!-- Reverso -->
              <div class="flipcard__face flipcard__back">
                <span class="caso__sector">{{ c.sector }}</span>
                <p class="caso__row"><strong>Problema</strong>{{ c.problem }}</p>
                <p class="caso__row"><strong>Intervención</strong>{{ c.intervention }}</p>
                <p class="caso__row"><strong>Resultado</strong>{{ c.result }}</p>
                <div class="flipcard__foot">
                  <div class="flipcard__tags"><span class="logo-chip" v-for="t in tagList(c.tags)" :key="t">{{ t }}</span></div>
                  <button v-if="c.audio_url" type="button" class="flipcard__audio" @click.stop="toggleAudio(c)">
                    {{ playing === c.id ? '❚❚ Pausar' : '▶ Escuchar' }}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <section class="section section--soft">
      <div class="container">
        <p class="kicker" v-reveal>Sectores</p>
        <h2 class="section__title" v-reveal>Experiencia transversal.</h2>
        <div class="logos" style="justify-content:flex-start" v-reveal>
          <span class="logo-chip" v-for="s in SECTORS" :key="s">{{ s }}</span>
        </div>
      </div>
    </section>

    <page-cta title="¿Quieres resultados similares en tu empresa?" primary="Quiero resultados similares" secondary="Reservar diagnóstico" secondary-to="/diagnostico-ia-growth" />
  </div>`
};
