import { ref, computed, nextTick } from 'vue';
import { api } from '../api.js';

const DEFAULT_QUICK = [
  'Resumen ejecutivo de la semana: leads, diagnósticos y reservas',
  '¿Qué leads de urgencia alta siguen sin reserva? Priorízalos',
  '¿En qué etapa del pipeline se estancan las oportunidades?',
  '¿Cuál es la línea más débil que más se repite en los diagnósticos?'
];
const STORE = 'alexia_quick';

// Asistente AlexIA en el panel: consulta la BD en SOLO LECTURA.
export default {
  setup() {
    const open = ref(false);
    const expanded = ref(false);       // panel ampliado (mejor para tablas)
    const quickOpen = ref(false);      // menú de preguntas rápidas
    const input = ref('');
    const busy = ref(false);
    const log = ref([{ role: 'ai', text: 'Hola, soy AlexIA, tu analista de crecimiento. Pregúntame por leads, pipeline, diagnósticos o reservas y te doy el hallazgo, el dato y la jugada recomendada.' }]);
    const body = ref(null);

    // Preguntas rápidas: base + las que guarde el usuario (localStorage).
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

    function quick(q) { quickOpen.value = false; input.value = q; send(); }

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
        log.value.push({ role: 'ai', text: 'No pude responder: ' + e.message });
      } finally { busy.value = false; await scroll(); }
    }
    async function scroll() { await nextTick(); if (body.value) body.value.scrollTop = body.value.scrollHeight; }

    const cols = (rows) => rows && rows.length ? Object.keys(rows[0]) : [];

    return { open, expanded, quickOpen, input, busy, log, body, send, quick, quickList, addQuick, removeQuick, isCustom, cols };
  },
  template: `
  <div class="alexia" :class="{ 'alexia--wide': expanded }">
    <button class="alexia__fab" @click="open = !open" :aria-label="open ? 'Cerrar AlexIA' : 'Abrir AlexIA'">
      <span v-if="!open">✦ AlexIA</span><span v-else>✕</span>
    </button>
    <transition name="alexia">
      <div v-if="open" class="alexia__panel" :class="{ 'alexia__panel--wide': expanded }">
        <header class="alexia__head">
          <span><span class="alexia__dot"></span> AlexIA · asistente</span>
          <div class="alexia__head-actions">
            <button type="button" class="alexia__ico" @click="quickOpen = !quickOpen" title="Preguntas rápidas">⚡</button>
            <button type="button" class="alexia__ico" @click="expanded = !expanded" :title="expanded ? 'Reducir' : 'Ampliar'">{{ expanded ? '⤡' : '⤢' }}</button>
          </div>
        </header>

        <div v-if="quickOpen" class="alexia__quick-menu">
          <p class="alexia__quick-title">Preguntas / solicitudes rápidas</p>
          <div class="alexia__quick-item" v-for="q in quickList" :key="q">
            <button type="button" class="alexia__quick-q" @click="quick(q)">{{ q }}</button>
            <button v-if="isCustom(q)" type="button" class="alexia__quick-x" @click="removeQuick(q)" title="Quitar">✕</button>
          </div>
        </div>

        <div ref="body" class="alexia__body">
          <div v-for="(m,i) in log" :key="i" class="alexia__msg" :class="'alexia__msg--'+m.role">
            <div class="alexia__msg-top">
              <p>{{ m.text }}</p>
              <button v-if="m.role==='me'" type="button" class="alexia__save" @click="addQuick(m.text)" title="Guardar en preguntas rápidas">★</button>
            </div>
            <div v-if="m.rows" class="alexia__table-wrap">
              <table class="alexia__table">
                <thead><tr><th v-for="c in cols(m.rows)" :key="c">{{ c }}</th></tr></thead>
                <tbody>
                  <tr v-for="(row,ri) in m.rows" :key="ri"><td v-for="c in cols(m.rows)" :key="c">{{ row[c] }}</td></tr>
                </tbody>
              </table>
            </div>
            <details v-if="m.sql" class="alexia__sql"><summary>Ver consulta</summary><code>{{ m.sql }}</code></details>
          </div>
          <div v-if="busy" class="alexia__msg alexia__msg--ai"><p class="alexia__typing">Analizando…</p></div>
        </div>

        <form class="alexia__input" @submit.prevent="send">
          <input v-model="input" placeholder="Pregunta a AlexIA…" :disabled="busy" />
          <button type="submit" :disabled="busy || !input.trim()">Enviar</button>
        </form>
      </div>
    </transition>
  </div>`
};
