import { ref, computed, nextTick } from 'vue';
import { api } from '../api.js';

const DEFAULT_QUICK = [
  'Resumen ejecutivo de la semana: leads, diagnósticos y reservas',
  '¿Qué leads de urgencia alta siguen sin reserva? Priorízalos',
  '¿En qué etapa del pipeline se estancan las oportunidades?',
  '¿Cuál es la línea más débil que más se repite en los diagnósticos?'
];
const STORE = 'alexia_quick';
const SIZE_STORE = 'alexia_size';
const SIZES = ['normal', 'wide', 'full'];

// Asistente AlexIA en el panel: consulta la BD en SOLO LECTURA.
// Experiencia alineada al documento Lexis (cap. 7): cabecera con identidad y
// estado, controles de tamaño (normal/amplio/pantalla completa) con preferencia
// guardada, solicitudes rápidas de un clic, respuestas ricas e input multilínea.
export default {
  setup() {
    const open = ref(false);
    const size = ref(SIZES.includes(localStorage.getItem(SIZE_STORE)) ? localStorage.getItem(SIZE_STORE) : 'normal');
    const input = ref('');
    const busy = ref(false);
    const log = ref([{ role: 'ai', text: 'Hola, soy AlexIA, tu analista de crecimiento. Pregúntame por leads, pipeline, diagnósticos o reservas y te doy el hallazgo, el dato y la jugada recomendada.' }]);
    const body = ref(null);

    // Tamaño del panel con preferencia guardada.
    function cycleSize() {
      const i = SIZES.indexOf(size.value);
      size.value = SIZES[(i + 1) % SIZES.length];
      try { localStorage.setItem(SIZE_STORE, size.value); } catch (e) {}
    }
    const sizeLabel = computed(() => size.value === 'normal' ? 'Ampliar' : (size.value === 'wide' ? 'Pantalla completa' : 'Reducir'));
    const sizeIcon = computed(() => size.value === 'normal' ? '⤢' : (size.value === 'wide' ? '⛶' : '⤡'));

    // Solicitudes rápidas: guardadas por el usuario + recomendadas.
    const custom = ref([]);
    try { custom.value = JSON.parse(localStorage.getItem(STORE) || '[]') || []; } catch (e) { custom.value = []; }
    const quickList = computed(() => [...custom.value, ...DEFAULT_QUICK]);
    function persist() { try { localStorage.setItem(STORE, JSON.stringify(custom.value.slice(0, 30))); } catch (e) {} }
    function addQuick(text) {
      const t = (text || '').trim();
      if (!t || quickList.value.includes(t)) return;
      custom.value.unshift(t); persist();
    }
    function removeQuick(text) { custom.value = custom.value.filter((x) => x !== text); persist(); }
    const isCustom = (t) => custom.value.includes(t);
    const shorten = (t) => t.length > 46 ? t.slice(0, 44) + '…' : t;

    function quick(q) { input.value = q; send(); }

    function onKey(e) {
      if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
    }

    async function send() {
      const q = input.value.trim();
      if (!q || busy.value) return;
      log.value.push({ role: 'me', text: q }); input.value = ''; busy.value = true;
      await scroll();
      try {
        const r = await api.alexia(q, 'auto');
        const d = r.data || {};
        log.value.push({ role: 'ai', text: d.reply || 'Sin respuesta.', sql: d.sql || '', rows: (d.rows && d.rows.length) ? d.rows : null });
      } catch (e) {
        log.value.push({ role: 'ai', text: 'No fue posible responder: ' + e.message + '. Revisa el conector de IA o intenta de nuevo.' });
      } finally { busy.value = false; await scroll(); }
    }
    async function scroll() { await nextTick(); if (body.value) body.value.scrollTop = body.value.scrollHeight; }

    const cols = (rows) => rows && rows.length ? Object.keys(rows[0]) : [];

    return { open, size, cycleSize, sizeLabel, sizeIcon, input, busy, log, body, send, quick, quickList,
      addQuick, removeQuick, isCustom, shorten, onKey, cols };
  },
  template: `
  <div class="lexia" :class="'lexia--'+size">
    <button class="lexia__fab" @click="open = !open" :aria-label="open ? 'Cerrar AlexIA' : 'Abrir AlexIA'">
      <span v-if="!open">✦ AlexIA</span><span v-else>✕</span>
    </button>
    <transition name="lexia">
      <div v-if="open" class="lexia__panel">
        <header class="lexia__head">
          <div class="lexia__id">
            <span class="lexia__avatar">✦</span>
            <div class="lexia__idtx">
              <b>AlexIA</b>
              <span class="lexia__status" :class="busy ? 'is-busy' : 'is-on'">{{ busy ? 'Analizando…' : 'En línea · analista de crecimiento' }}</span>
            </div>
          </div>
          <div class="lexia__ctrls">
            <button type="button" class="lexia__ico" @click="cycleSize" :title="sizeLabel" :aria-label="sizeLabel">{{ sizeIcon }}</button>
            <button type="button" class="lexia__ico" @click="open = false" title="Cerrar" aria-label="Cerrar">✕</button>
          </div>
        </header>

        <div class="lexia__quick">
          <span class="lexia__quick-lbl">Solicitudes rápidas</span>
          <div class="lexia__chips">
            <button type="button" class="lexia__chip" v-for="q in quickList" :key="q" @click="quick(q)" :title="q">
              {{ shorten(q) }}<i v-if="isCustom(q)" class="lexia__chip-x" @click.stop="removeQuick(q)" title="Quitar">✕</i>
            </button>
          </div>
        </div>

        <div ref="body" class="lexia__body" @wheel.stop>
          <div v-for="(m,i) in log" :key="i" class="lexia__msg" :class="'lexia__msg--'+m.role">
            <div class="lexia__bubble">
              <div class="lexia__msg-top">
                <p>{{ m.text }}</p>
                <button v-if="m.role==='me'" type="button" class="lexia__save" @click="addQuick(m.text)" title="Guardar como solicitud rápida">★</button>
              </div>
              <div v-if="m.rows" class="lexia__table-wrap">
                <table class="lexia__table">
                  <thead><tr><th v-for="c in cols(m.rows)" :key="c">{{ c }}</th></tr></thead>
                  <tbody>
                    <tr v-for="(row,ri) in m.rows" :key="ri"><td v-for="c in cols(m.rows)" :key="c">{{ row[c] }}</td></tr>
                  </tbody>
                </table>
              </div>
              <details v-if="m.sql" class="lexia__sql"><summary>Ver consulta</summary><code>{{ m.sql }}</code></details>
            </div>
          </div>
          <div v-if="busy" class="lexia__msg lexia__msg--ai"><div class="lexia__bubble"><p class="lexia__typing"><span></span><span></span><span></span></p></div></div>
        </div>

        <form class="lexia__input" @submit.prevent="send">
          <textarea v-model="input" @keydown="onKey" rows="1" :disabled="busy"
            placeholder="Escribe una solicitud…  ·  Enter envía, Shift+Enter salta línea"></textarea>
          <button type="submit" :disabled="busy || !input.trim()" aria-label="Enviar">➤</button>
        </form>
      </div>
    </transition>
  </div>`
};
