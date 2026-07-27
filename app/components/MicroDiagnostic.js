import { ref, reactive, computed } from 'vue';
import { useRouter } from 'vue-router';
import { QUESTIONS, scoreDiagnostic } from '../data/diagnostic.js';
import { store } from '../../assets/js/store.js';
import { track, EVENTS } from '../../assets/js/tracking.js?v=20260726-2';
import { api } from '../../assets/js/api.js?v=20260726-2';

export default {
  setup() {
    const router = useRouter();
    const STAGE = { intro: 'intro', questions: 'questions', result: 'result' };
    const stage = ref(STAGE.intro);
    const current = ref(0);
    const answers = ref(Array(QUESTIONS.length).fill(null));
    const result = ref(null);
    const lead = reactive({ name: '', email: '', company: '', sent: false });

    const progress = computed(() => QUESTIONS.map((_, i) => i <= current.value));

    function start() {
      stage.value = STAGE.questions;
      track(EVENTS.START_MICRODIAGNOSTIC);
    }
    function choose(optIndex) {
      answers.value[current.value] = optIndex;
      if (current.value < QUESTIONS.length - 1) {
        current.value++;
      } else {
        finish();
      }
    }
    function back() {
      if (current.value > 0) current.value--;
      else stage.value = STAGE.intro;
    }
    function finish() {
      result.value = scoreDiagnostic(answers.value);
      store.setDiagnosticResult(result.value);
      store.setSticky(result.value.route.cta);
      stage.value = STAGE.result;
      track(EVENTS.COMPLETE_MICRODIAGNOSTIC, { route: result.value.routeKey, urgency: result.value.urgency });
    }
    function goToRoute() {
      track(EVENTS.SELECT_ROUTE, { route: result.value.routeKey });
      router.push(result.value.route.to);
    }
    async function sendLead() {
      // Primero valor, luego datos (regla del Documento 3).
      const payload = {
        ...lead,
        primary_need: optionLabel(0),
        recommended_route: result.value.routeKey,
        urgency: result.value.urgency,
        source: 'microdiagnostico'
      };
      await api.createLead(payload);          // fallback elegante si el backend no está
      lead.sent = true;
      track(EVENTS.LEAD_CREATED, { route: result.value.routeKey });
    }
    function optionLabel(qIndex) {
      const i = answers.value[qIndex];
      return i == null ? null : QUESTIONS[qIndex].options[i].label;
    }

    return { STAGE, stage, current, answers, result, lead, progress, QUESTIONS, start, choose, back, goToRoute, sendLead };
  },
  template: `
  <div class="diag__card" v-reveal>
    <p class="kicker kicker--light">Microdiagnóstico</p>

    <!-- Intro -->
    <div v-if="stage === STAGE.intro">
      <h2 class="diag__title">Encuentra tu ruta estratégica</h2>
      <p class="diag__text">Responde unas preguntas rápidas y descubre el mejor punto de partida para aplicar IA, automatización, marketing, datos o growth en tu negocio.</p>
      <p class="diag__meta">⏱ 1 a 2 minutos · 6 preguntas</p>
      <button class="btn btn--primary" @click="start">Iniciar diagnóstico</button>
    </div>

    <!-- Questions -->
    <div v-else-if="stage === STAGE.questions">
      <transition name="diag-step" mode="out-in">
        <div :key="current">
          <p class="diag__q">{{ current + 1 }} · {{ QUESTIONS[current].q }}</p>
          <div class="diag__options">
            <button v-for="(opt, i) in QUESTIONS[current].options" :key="i" type="button"
              class="diag__opt" :class="{ 'is-selected': answers[current] === i }" @click="choose(i)">
              {{ opt.label }}
            </button>
          </div>
        </div>
      </transition>
      <div class="diag__nav">
        <button class="diag__back" @click="back">← Atrás</button>
        <div class="diag__progress" aria-hidden="true">
          <span v-for="(on, i) in progress" :key="i" class="diag__dot" :class="{ 'is-active': on }"></span>
        </div>
      </div>
    </div>

    <!-- Result -->
    <div v-else class="diag__result" aria-live="polite">
      <span class="diag__result-mark" aria-hidden="true">✓</span>
      <p class="diag__result-route">Ruta recomendada</p>
      <h3 class="diag__result-title">{{ result.route.name }}</h3>
      <p class="diag__result-text">{{ result.message }}</p>
      <div class="diag__result-actions">
        <button class="btn btn--primary" @click="goToRoute">{{ result.route.cta }}</button>
      </div>

      <form v-if="!lead.sent" class="diag__lead" @submit.prevent="sendLead">
        <input v-model="lead.name" type="text" placeholder="Tu nombre" required aria-label="Nombre" />
        <input v-model="lead.email" type="email" placeholder="Email corporativo" required aria-label="Email" />
        <input v-model="lead.company" type="text" placeholder="Empresa" aria-label="Empresa" />
        <button class="btn btn--light" type="submit">Recibir mi resultado por email</button>
      </form>
      <p v-else class="diag__text" style="margin-top:18px">Gracias. Te enviaremos tu resultado y los siguientes pasos. ✦</p>
    </div>
  </div>`
};
