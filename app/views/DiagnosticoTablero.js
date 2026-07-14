import { ref, reactive, computed, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { ZONES, CONTEXT, scoreTablero } from '../data/tablero.js';
import { COUNTRIES } from '../data/countries.js';
import Combobox from '../components/Combobox.js';
import PhoneField from '../components/PhoneField.js';
import { track } from '../../assets/js/tracking.js';
import { api } from '../../assets/js/api.js';
import { saveLead, getUtm, markDiagnostico } from '../../assets/js/leadStore.js';

const SECTORS = ['Servicios profesionales', 'Educación', 'Salud', 'Retail / Comercio', 'Manufactura', 'Tecnología / SaaS', 'Construcción / Inmobiliario', 'Turismo / Hotelería', 'Finanzas / Seguros', 'Agroindustria', 'Legal', 'Otro'];
const SIZES = ['1–10 empleados', '11–50 empleados', '51–200 empleados', '+200 empleados'];
const REVENUES = ['Menos de $50M COP/mes', '$50M–$200M COP/mes', '$200M–$1.000M COP/mes', 'Más de $1.000M COP/mes', 'Prefiero no decir'];

// Diagnóstico Tablero de Crecimiento — experiencia guiada (Q3).
export default {
  components: { Combobox, PhoneField },
  setup() {
    const router = useRouter();
    const STAGE = { intro: 'intro', zones: 'zones', context: 'context', lead: 'lead', result: 'result' };
    const stage = ref(STAGE.intro);
    const zoneIndex = ref(0);
    const scores = reactive({});
    const context = reactive({ reto: [], urgencia: '', objetivo: '' });
    const lead = reactive({ name: '', company: '', email: '', country: '', whatsapp: '',
      cargo: '', sector: '', company_size: '', revenue_range: '', website: '', consent: false });
    const result = ref(null);
    let submitted = false;

    const totalSteps = ZONES.length;
    const progress = computed(() => Math.round((zoneIndex.value / totalSteps) * 100));
    const currentZone = computed(() => ZONES[zoneIndex.value]);

    function start() { stage.value = STAGE.zones; track('form_started', { asset: 'tablero' }); track('scoring_started'); }
    function pick(score) {
      scores[currentZone.value.key] = score;
      if (zoneIndex.value < ZONES.length - 1) zoneIndex.value++;
      else { stage.value = STAGE.context; track('scoring_completed'); }
    }
    function back() {
      if (stage.value === STAGE.zones && zoneIndex.value > 0) zoneIndex.value--;
      else if (stage.value === STAGE.zones) stage.value = STAGE.intro;
      else if (stage.value === STAGE.context) stage.value = STAGE.zones;
      else if (stage.value === STAGE.lead) stage.value = STAGE.context;
    }
    function toggleReto(o) {
      const i = context.reto.indexOf(o);
      if (i === -1) context.reto.push(o); else context.reto.splice(i, 1);
    }
    const ctxReady = computed(() => context.reto.length > 0 && context.urgencia);
    function ctxNext() { if (ctxReady.value) stage.value = STAGE.lead; }

    const leadReady = computed(() =>
      lead.name.trim() && /.+@.+\..+/.test(lead.email) && lead.consent);

    function finish() {
      if (!leadReady.value) return;
      // El resultado que se muestra es solo referencial; el backend recalcula el oficial.
      result.value = scoreTablero(scores);
      stage.value = STAGE.result;
      submitted = true;
      track('diagnostic_submitted', { total: result.value.total, offer: result.value.offer });
      track('result_viewed');
      saveLead(lead);
      markDiagnostico(); // deja constancia para preparar la sesión al agendar
      // Se envían SOLO las respuestas por zona + contexto + datos; el servidor
      // recalcula total, nivel, zona crítica y oferta (no se confía en el navegador).
      api.submitForm('tablero_diagnostico', {
        name: lead.name, company: lead.company, email: lead.email,
        country: lead.country, whatsapp: lead.whatsapp,
        role: lead.cargo, cargo: lead.cargo, sector: lead.sector,
        company_size: lead.company_size, revenue_range: lead.revenue_range, website: lead.website,
        consent: lead.consent ? 1 : 0,
        reto: context.reto.join(', '), urgencia: context.urgencia, objetivo_90_dias: context.objetivo,
        scores: { ...scores }, source: 'diagnostico_tablero',
        utm: getUtm()
      });
    }
    function agendar() { track('agenda_clicked', { from: 'tablero_result' }); router.push('/agenda?tipo=sesion-estrategica-tonny'); }

    // Abandono por etapa: registra dónde se retiró el usuario si no completó.
    function reportAbandon() {
      if (submitted || stage.value === STAGE.intro || stage.value === STAGE.result) return;
      track('diagnostic_abandoned', { stage: stage.value, zone_index: zoneIndex.value, answered: Object.keys(scores).length });
    }
    onUnmounted(reportAbandon);
    if (typeof window !== 'undefined') {
      window.addEventListener('pagehide', reportAbandon, { once: false });
    }

    return { STAGE, stage, zoneIndex, scores, context, lead, result, CONTEXT, COUNTRIES,
      SECTORS, SIZES, REVENUES, leadReady,
      progress, currentZone, totalSteps, ctxReady, start, pick, back, toggleReto, ctxNext, finish, agendar };
  },
  template: `
  <div class="page tablero">
    <section class="section tablero__section">
      <div class="container" style="max-width:760px">
        <div class="diag__card tablero__card" v-reveal>
          <p class="kicker kicker--light">Diagnóstico Tablero de Crecimiento</p>

          <!-- Intro -->
          <div v-if="stage === STAGE.intro">
            <h1 class="diag__title">Tu empresa puede vender todos los meses y aun así estar trabada.</h1>
            <p class="diag__text">Este diagnóstico te ayuda a leer tu negocio como un tablero: estrategia, defensa, mediocampo, ataque y marcador. Descubre dónde se está trabando y cuál debe ser tu primera jugada.</p>
            <p class="diag__meta">⏱ 3–4 minutos · 11 zonas · Resultado al instante</p>
            <button class="btn btn--primary btn--lg" @click="start">Empezar diagnóstico</button>
          </div>

          <!-- Zonas: opciones coherentes con cada pregunta -->
          <div v-else-if="stage === STAGE.zones">
            <div class="tablero__progress"><span :style="{ width: progress + '%' }"></span></div>
            <p class="tablero__step">Zona {{ zoneIndex + 1 }} de {{ totalSteps }} · {{ currentZone.name }}</p>
            <transition name="diag-step" mode="out-in">
              <div :key="currentZone.key">
                <p class="diag__q">{{ currentZone.q }}</p>
                <div class="diag__options">
                  <button v-for="(opt, i) in currentZone.options" :key="i" class="diag__opt"
                    :class="{ 'is-selected': scores[currentZone.key] === i + 1 }" @click="pick(i + 1)">{{ opt }}</button>
                </div>
              </div>
            </transition>
            <button class="diag__back" @click="back">← Atrás</button>
          </div>

          <!-- Contexto: reto (múltiple) + urgencia (única) + objetivo 90 días -->
          <div v-else-if="stage === STAGE.context">
            <p class="diag__q">{{ CONTEXT.reto.q }} <span class="diag__hint">(elige todas las que apliquen)</span></p>
            <div class="diag__options">
              <button v-for="o in CONTEXT.reto.options" :key="o" class="diag__opt diag__opt--check"
                :class="{ 'is-selected': context.reto.includes(o) }" @click="toggleReto(o)">{{ o }}</button>
            </div>
            <p class="diag__q" style="margin-top:24px">{{ CONTEXT.urgencia.q }}</p>
            <div class="diag__options diag__options--row">
              <button v-for="o in CONTEXT.urgencia.options" :key="o" class="diag__opt"
                :class="{ 'is-selected': context.urgencia === o }" @click="context.urgencia = o">{{ o }}</button>
            </div>
            <p class="diag__q" style="margin-top:24px">¿Qué te gustaría lograr en los próximos 90 días?</p>
            <input v-model="context.objetivo" class="combo__input" type="text" placeholder="Escribe tu objetivo (opcional)" />
            <div class="diag__nav">
              <button class="diag__back" @click="back">← Atrás</button>
              <button class="btn btn--primary" :disabled="!ctxReady" @click="ctxNext">Continuar</button>
            </div>
          </div>

          <!-- Datos del lead (solo datos) -->
          <div v-else-if="stage === STAGE.lead">
            <h2 class="diag__title" style="font-size:1.4rem">Tu resultado está listo.</h2>
            <p class="diag__text">Déjanos dónde enviarte la lectura y desbloquea tu marcador del tablero.</p>
            <form class="diag__lead" @submit.prevent="finish">
              <input v-model="lead.name" type="text" placeholder="Nombre completo *" required />
              <input v-model="lead.email" type="email" placeholder="Email corporativo *" required />
              <input v-model="lead.company" type="text" placeholder="Empresa" />
              <input v-model="lead.cargo" type="text" placeholder="Tu cargo" />
              <combobox v-model="lead.sector" :options="SECTORS" placeholder="Sector de la empresa" name="sector" />
              <combobox v-model="lead.company_size" :options="SIZES" placeholder="Tamaño de la empresa" name="size" />
              <combobox v-model="lead.revenue_range" :options="REVENUES" placeholder="Facturación aproximada" name="revenue" />
              <input v-model="lead.website" type="text" placeholder="Sitio web (opcional)" />
              <combobox v-model="lead.country" :options="COUNTRIES" placeholder="País (escribe para buscar)" name="country" />
              <phone-field v-model="lead.whatsapp" default-iso="CO" />
              <label class="diag__consent">
                <input type="checkbox" v-model="lead.consent" />
                <span>Autorizo el <a href="/tratamiento-de-datos" target="_blank" rel="noopener">tratamiento de mis datos</a> para recibir mi diagnóstico y ser contactado por el equipo de Tonny Dager.</span>
              </label>
              <button class="btn btn--primary btn--lg" type="submit" :disabled="!leadReady">Ver mi marcador del tablero</button>
            </form>
            <button class="diag__back" @click="back">← Atrás</button>
          </div>

          <!-- Resultado -->
          <div v-else class="diag__result" aria-live="polite">
            <span class="diag__result-mark" aria-hidden="true">{{ result.total }}</span>
            <p class="diag__result-route">{{ result.total }} / 55 · {{ result.level }}</p>
            <h2 class="diag__result-title">{{ result.reading }}</h2>

            <div class="pitch">
              <div class="pitch__line" v-for="l in result.byLine" :key="l.name">
                <span class="pitch__name">{{ l.name }}</span>
                <span class="pitch__bar"><i :style="{ width: l.pct + '%' }"></i></span>
                <span class="pitch__score">{{ l.score }}/{{ l.max }}</span>
              </div>
            </div>

            <div class="tablero__highlight">
              <p><strong>Línea más débil:</strong> {{ result.weakestLine.name }}</p>
              <p><strong>Zona crítica:</strong> {{ result.criticalZone.name }}</p>
              <p><strong>Tu primera jugada:</strong> {{ result.firstPlay }}</p>
              <p class="tablero__offer">Oferta sugerida: <strong>{{ result.offer }}</strong></p>
            </div>

            <p class="diag__text" style="margin:14px 0 20px">La lectura profunda la hacemos en sesión. Agenda tu lectura estratégica del tablero.</p>
            <button class="btn btn--primary btn--lg" @click="agendar">Agendar lectura estratégica</button>
          </div>
        </div>
      </div>
    </section>
  </div>`
};
