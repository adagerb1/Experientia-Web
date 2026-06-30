import { ref, reactive, computed } from 'vue';
import { useRouter } from 'vue-router';
import { ZONES, SCALE, CONTEXT, scoreTablero } from '../data/tablero.js';
import { track } from '../../assets/js/tracking.js';
import { api } from '../../assets/js/api.js';

// Diagnóstico Tablero de Crecimiento — experiencia guiada (Q3).
export default {
  setup() {
    const router = useRouter();
    const STAGE = { intro: 'intro', zones: 'zones', context: 'context', lead: 'lead', result: 'result' };
    const stage = ref(STAGE.intro);
    const zoneIndex = ref(0);
    const scores = reactive({});
    const context = reactive({ reto: '', urgencia: '' });
    const lead = reactive({ name: '', company: '', email: '', whatsapp: '', objetivo: '' });
    const result = ref(null);
    const sent = ref(false);

    const totalSteps = ZONES.length;
    const progress = computed(() => Math.round(((zoneIndex.value) / totalSteps) * 100));
    const currentZone = computed(() => ZONES[zoneIndex.value]);

    function start() { stage.value = STAGE.zones; track('form_started', { asset: 'tablero' }); track('scoring_started'); }
    function pick(value) {
      scores[currentZone.value.key] = value;
      if (zoneIndex.value < ZONES.length - 1) zoneIndex.value++;
      else { stage.value = STAGE.context; track('scoring_completed'); }
    }
    function back() {
      if (stage.value === STAGE.zones && zoneIndex.value > 0) zoneIndex.value--;
      else if (stage.value === STAGE.zones) stage.value = STAGE.intro;
      else if (stage.value === STAGE.context) stage.value = STAGE.zones;
      else if (stage.value === STAGE.lead) stage.value = STAGE.context;
    }
    function ctxNext() { if (context.reto && context.urgencia) stage.value = STAGE.lead; }
    function finish() {
      result.value = scoreTablero(scores);
      stage.value = STAGE.result;
      track('diagnostic_submitted', { total: result.value.total, offer: result.value.offer });
      track('result_viewed');
      // Persiste en backend cuando esté disponible (fallback elegante).
      api.submitForm('tablero_diagnostico', {
        ...lead, ...context, scores: { ...scores },
        total: result.value.total, nivel: result.value.level,
        linea_debil: result.value.weakestLine.name, zona_critica: result.value.criticalZone.name,
        oferta_sugerida: result.value.offer, source: 'diagnostico_tablero'
      });
    }
    function agendar() { track('agenda_clicked', { from: 'tablero_result' }); router.push('/contacto'); }

    return { STAGE, stage, zoneIndex, scores, context, lead, result, sent, SCALE, CONTEXT,
      progress, currentZone, totalSteps, start, pick, back, ctxNext, finish, agendar };
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

          <!-- Zonas (1-5) -->
          <div v-else-if="stage === STAGE.zones">
            <div class="tablero__progress"><span :style="{ width: progress + '%' }"></span></div>
            <p class="tablero__step">Zona {{ zoneIndex + 1 }} de {{ totalSteps }} · {{ currentZone.name }}</p>
            <transition name="diag-step" mode="out-in">
              <div :key="currentZone.key">
                <p class="diag__q">{{ currentZone.q }}</p>
                <div class="scale">
                  <button v-for="s in SCALE" :key="s.value" class="scale__btn"
                    :class="{ 'is-selected': scores[currentZone.key] === s.value }" @click="pick(s.value)">
                    <span class="scale__num">{{ s.value }}</span>
                    <span class="scale__label">{{ s.label }}</span>
                  </button>
                </div>
              </div>
            </transition>
            <button class="diag__back" @click="back">← Atrás</button>
          </div>

          <!-- Contexto -->
          <div v-else-if="stage === STAGE.context">
            <p class="diag__q">{{ CONTEXT.reto.q }}</p>
            <div class="diag__options">
              <button v-for="o in CONTEXT.reto.options" :key="o" class="diag__opt"
                :class="{ 'is-selected': context.reto === o }" @click="context.reto = o">{{ o }}</button>
            </div>
            <p class="diag__q" style="margin-top:22px">{{ CONTEXT.urgencia.q }}</p>
            <div class="diag__options diag__options--row">
              <button v-for="o in CONTEXT.urgencia.options" :key="o" class="diag__opt"
                :class="{ 'is-selected': context.urgencia === o }" @click="context.urgencia = o">{{ o }}</button>
            </div>
            <div class="diag__nav">
              <button class="diag__back" @click="back">← Atrás</button>
              <button class="btn btn--primary" :disabled="!context.reto || !context.urgencia" @click="ctxNext">Continuar</button>
            </div>
          </div>

          <!-- Datos del lead -->
          <div v-else-if="stage === STAGE.lead">
            <h2 class="diag__title" style="font-size:1.4rem">Tu resultado está listo.</h2>
            <p class="diag__text">Déjanos dónde enviarte la lectura y desbloquea tu marcador del tablero.</p>
            <form class="diag__lead" @submit.prevent="finish">
              <input v-model="lead.name" type="text" placeholder="Nombre completo *" required />
              <input v-model="lead.company" type="text" placeholder="Empresa" />
              <input v-model="lead.email" type="email" placeholder="Email *" required />
              <input v-model="lead.whatsapp" type="tel" placeholder="WhatsApp" />
              <input v-model="lead.objetivo" type="text" placeholder="¿Qué quieres lograr en 90 días?" />
              <button class="btn btn--primary btn--lg" type="submit">Ver mi marcador del tablero</button>
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
