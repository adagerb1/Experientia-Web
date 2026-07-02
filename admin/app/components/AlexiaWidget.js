import { ref, nextTick } from 'vue';
import { api } from '../api.js';

// Asistente AlexIA en el panel: pregunta sobre leads, diagnósticos, reservas,
// recursos, etc. Consulta la base de datos en SOLO LECTURA.
export default {
  setup() {
    const open = ref(false);
    const input = ref('');
    const busy = ref(false);
    const log = ref([{ role: 'ai', text: 'Hola, soy AlexIA, tu analista de crecimiento. Pregúntame por leads, pipeline, diagnósticos o reservas y te doy el hallazgo, el dato y la jugada recomendada.' }]);
    const body = ref(null);
    const QUICK = [
      'Resumen ejecutivo de la semana: leads, diagnósticos y reservas',
      '¿Qué leads de urgencia alta siguen sin reserva? Priorízalos',
      '¿En qué etapa del pipeline se estancan las oportunidades?',
      '¿Cuál es la línea más débil que más se repite en los diagnósticos?'
    ];
    function quick(q) { input.value = q; send(); }

    async function send() {
      const q = input.value.trim();
      if (!q || busy.value) return;
      log.value.push({ role: 'me', text: q }); input.value = ''; busy.value = true;
      await scroll();
      try {
        const r = await api.alexia(q, 'auto');
        const d = r.data || {};
        log.value.push({ role: 'ai', text: d.reply || 'Sin respuesta.', sql: d.sql || '', rows: d.rows || null });
      } catch (e) {
        log.value.push({ role: 'ai', text: 'No pude responder: ' + e.message });
      } finally { busy.value = false; await scroll(); }
    }
    async function scroll() { await nextTick(); if (body.value) body.value.scrollTop = body.value.scrollHeight; }

    return { open, input, busy, log, body, send, QUICK, quick };
  },
  template: `
  <div class="alexia">
    <button class="alexia__fab" @click="open = !open" :aria-label="open ? 'Cerrar AlexIA' : 'Abrir AlexIA'">
      <span v-if="!open">✦ AlexIA</span><span v-else>✕</span>
    </button>
    <transition name="alexia">
      <div v-if="open" class="alexia__panel">
        <header class="alexia__head"><span class="alexia__dot"></span> AlexIA · asistente</header>
        <div ref="body" class="alexia__body">
          <div v-for="(m,i) in log" :key="i" class="alexia__msg" :class="'alexia__msg--'+m.role">
            <p>{{ m.text }}</p>
            <details v-if="m.sql" class="alexia__sql"><summary>Ver consulta</summary><code>{{ m.sql }}</code></details>
          </div>
          <div v-if="busy" class="alexia__msg alexia__msg--ai"><p class="alexia__typing">Analizando…</p></div>
        </div>
        <div class="alexia__quick" v-if="log.length <= 1">
          <button v-for="q in QUICK" :key="q" type="button" @click="quick(q)">{{ q }}</button>
        </div>
        <form class="alexia__input" @submit.prevent="send">
          <input v-model="input" placeholder="Pregunta a AlexIA…" :disabled="busy" />
          <button type="submit" :disabled="busy || !input.trim()">Enviar</button>
        </form>
      </div>
    </transition>
  </div>`
};
