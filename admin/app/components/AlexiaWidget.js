import { ref, reactive, computed, nextTick } from 'vue';
import { api } from '../api.js';

// Solicitudes recomendadas (icono + título + instrucción), estilo LexIA.
const DEFAULT_QUICK = [
  { icon: '📊', title: 'Resumen de la semana', q: 'Resumen ejecutivo de la semana: leads, diagnósticos y reservas' },
  { icon: '🔥', title: 'Leads calientes sin reserva', q: '¿Qué leads de urgencia alta siguen sin reserva? Priorízalos' },
  { icon: '↗', title: 'Fugas del pipeline', q: '¿En qué etapa del pipeline se estancan las oportunidades?' },
  { icon: '⬡', title: 'Línea más débil', q: '¿Cuál es la línea más débil que más se repite en los diagnósticos?' },
  { icon: '📅', title: 'Reservas por confirmar', q: '¿Qué reservas están sin confirmar y cuáles son sus fechas?' },
];
const STORE = 'alexia_quick';
const SIZE_STORE = 'alexia_size';
const SIZES = ['normal', 'wide', 'full'];

// Asistente AlexIA en el panel: consulta la BD en SOLO LECTURA. Experiencia
// alineada al documento Lexis (cap. 7): identidad y estado, controles de tamaño,
// solicitudes rápidas de un clic (recomendadas + guardadas), respuestas ricas
// (tablas con búsqueda propia y chip de estado) e input multilínea.
export default {
  setup() {
    const open = ref(false);
    const size = ref(SIZES.includes(localStorage.getItem(SIZE_STORE)) ? localStorage.getItem(SIZE_STORE) : 'normal');
    const reqOpen = ref(false);
    const input = ref('');
    const busy = ref(false);
    const log = ref([{ role: 'ai', text: 'Hola, soy AlexIA, tu analista de crecimiento. Pregúntame por leads, pipeline, diagnósticos o reservas y te doy el hallazgo, el dato y la jugada recomendada.' }]);
    const body = ref(null);
    const tq = reactive({}); // búsqueda por tabla, indexada por mensaje

    // Tamaño del panel con preferencia guardada.
    function cycleSize() {
      const i = SIZES.indexOf(size.value);
      size.value = SIZES[(i + 1) % SIZES.length];
      try { localStorage.setItem(SIZE_STORE, size.value); } catch (e) {}
    }
    const sizeLabel = computed(() => size.value === 'normal' ? 'Ampliar' : (size.value === 'wide' ? 'Pantalla completa' : 'Reducir'));
    const sizeIcon = computed(() => size.value === 'normal' ? '⤢' : (size.value === 'wide' ? '⛶' : '⤡'));

    // Solicitudes guardadas por el usuario (localStorage).
    const custom = ref([]);
    try { custom.value = JSON.parse(localStorage.getItem(STORE) || '[]') || []; } catch (e) { custom.value = []; }
    function persist() { try { localStorage.setItem(STORE, JSON.stringify(custom.value.slice(0, 30))); } catch (e) {} }
    const savedList = computed(() => DEFAULT_QUICK.map((x) => x.q));
    function addQuick(text) {
      const t = (text || '').trim();
      if (!t || custom.value.includes(t) || savedList.value.includes(t)) return;
      custom.value.unshift(t); persist();
    }
    function removeQuick(text) { custom.value = custom.value.filter((x) => x !== text); persist(); }

    function quick(q) { reqOpen.value = false; input.value = q; send(); }

    function onKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }

    async function send() {
      const q = input.value.trim();
      if (!q || busy.value) return;
      log.value.push({ role: 'me', text: q }); input.value = ''; busy.value = true;
      await scroll();
      try {
        const r = await api.alexia(q, 'auto');
        const d = r.data || {};
        const rows = (d.rows && d.rows.length) ? d.rows : null;
        log.value.push({ role: 'ai', text: d.reply || 'Sin respuesta.', sql: d.sql || '', rows, status: rows ? (rows.length + ' registro(s) consultado(s)') : '' });
      } catch (e) {
        log.value.push({ role: 'ai', text: 'No fue posible responder: ' + e.message + '. Revisa el conector de IA o intenta de nuevo.' });
      } finally { busy.value = false; await scroll(); }
    }
    async function scroll() { await nextTick(); if (body.value) body.value.scrollTop = body.value.scrollHeight; }

    const cols = (rows) => rows && rows.length ? Object.keys(rows[0]) : [];
    // Filas filtradas por la búsqueda propia de cada tabla del chat.
    function rowsOf(m, i) {
      const term = (tq[i] || '').trim().toLowerCase();
      if (!term || !m.rows) return m.rows || [];
      return m.rows.filter((r) => Object.values(r).some((v) => String(v ?? '').toLowerCase().includes(term)));
    }

    return { open, size, cycleSize, sizeLabel, sizeIcon, reqOpen, input, busy, log, body, tq,
      send, quick, DEFAULT_QUICK, custom, addQuick, removeQuick, onKey, cols, rowsOf };
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
              <span class="lexia__status-line" :class="busy ? 'is-busy' : 'is-on'">{{ busy ? 'Analizando…' : 'Asistente conectado a tu negocio' }}</span>
            </div>
          </div>
          <div class="lexia__ctrls">
            <button type="button" class="lexia__ico" :class="{ on: reqOpen }" @click="reqOpen = !reqOpen" title="Preguntas y solicitudes rápidas" aria-label="Solicitudes rápidas">⚡</button>
            <button type="button" class="lexia__ico" @click="cycleSize" :title="sizeLabel" :aria-label="sizeLabel">{{ sizeIcon }}</button>
            <button type="button" class="lexia__ico" @click="open = false" title="Cerrar" aria-label="Cerrar">✕</button>
          </div>
        </header>

        <!-- Popover de solicitudes rápidas -->
        <transition name="lexia-pop">
        <div v-if="reqOpen" class="lexia__requests">
          <div class="lexia__req-head">
            <div><b>Solicitudes rápidas</b><span>Ejecuta una instrucción frecuente con un clic.</span></div>
            <button type="button" class="lexia__ico lexia__ico--sm" @click="reqOpen = false" aria-label="Cerrar">✕</button>
          </div>
          <p class="lexia__req-sec">Recomendadas</p>
          <button type="button" class="lexia__req-item" v-for="r in DEFAULT_QUICK" :key="r.q" @click="quick(r.q)">
            <span class="lexia__req-ico">{{ r.icon }}</span>
            <span class="lexia__req-tx"><b>{{ r.title }}</b><small>{{ r.q }}</small></span>
          </button>
          <p class="lexia__req-sec">Mis solicitudes <span class="lexia__req-count">{{ custom.length }}</span></p>
          <template v-if="custom.length">
            <div class="lexia__req-item lexia__req-item--saved" v-for="q in custom" :key="q">
              <button type="button" class="lexia__req-tx" @click="quick(q)"><b>{{ q }}</b></button>
              <button type="button" class="lexia__req-x" @click="removeQuick(q)" title="Quitar">✕</button>
            </div>
          </template>
          <p v-else class="lexia__req-empty">Guarda una solicitud con la estrella ★ en cualquiera de tus mensajes.</p>
        </div>
        </transition>

        <div ref="body" class="lexia__body" @wheel.stop>
          <div v-for="(m,i) in log" :key="i" class="lexia__msg" :class="'lexia__msg--'+m.role">
            <div class="lexia__bubble">
              <div class="lexia__msg-top">
                <p>{{ m.text }}</p>
                <button v-if="m.role==='me'" type="button" class="lexia__save" @click="addQuick(m.text)" title="Guardar como solicitud rápida">★</button>
              </div>
              <div v-if="m.rows" class="lexia__result">
                <div class="lexia__tsearch" v-if="m.rows.length > 6">
                  <span aria-hidden="true">⌕</span>
                  <input v-model="tq[i]" type="search" placeholder="Buscar en esta tabla…" />
                </div>
                <div class="lexia__table-wrap">
                  <table class="lexia__table">
                    <thead><tr><th v-for="c in cols(m.rows)" :key="c">{{ c }}</th></tr></thead>
                    <tbody>
                      <tr v-for="(row,ri) in rowsOf(m,i)" :key="ri"><td v-for="c in cols(m.rows)" :key="c">{{ row[c] }}</td></tr>
                      <tr v-if="!rowsOf(m,i).length"><td :colspan="cols(m.rows).length" class="lexia__tempty">Sin coincidencias.</td></tr>
                    </tbody>
                  </table>
                </div>
              </div>
              <span v-if="m.status" class="lexia__status">✓ {{ m.status }}</span>
              <details v-if="m.sql" class="lexia__sql"><summary>Ver consulta</summary><code>{{ m.sql }}</code></details>
            </div>
          </div>
          <div v-if="busy" class="lexia__msg lexia__msg--ai"><div class="lexia__bubble"><p class="lexia__typing"><span></span><span></span><span></span></p></div></div>
        </div>

        <form class="lexia__input" @submit.prevent="send">
          <textarea v-model="input" @keydown="onKey" rows="1" :disabled="busy"
            placeholder="Escribe tu consulta aquí…  ·  Enter envía, Shift+Enter salta línea"></textarea>
          <button type="submit" :disabled="busy || !input.trim()" aria-label="Enviar">➤</button>
        </form>
      </div>
    </transition>
  </div>`
};
