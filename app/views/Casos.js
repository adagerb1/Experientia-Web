import { ref, onMounted } from 'vue';
import PageCta from '../components/PageCta.js';
import CasosGrid from '../components/CasosGrid.js';
import { CASES } from '../data/site.js';
import { api } from '../../assets/js/api.js?v=20260727-1';

const SECTORS = ['Educación', 'Servicios profesionales', 'Legal', 'Salud', 'Retail', 'Formación', 'Consultoría', 'Restaurantes', 'Empresas de servicios', 'Automatización comercial'];

export default {
  components: { PageCta, CasosGrid },
  setup() {
    const cases = ref([]);

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

    return { cases, SECTORS };
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

        <casos-grid :cases="cases" />
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
