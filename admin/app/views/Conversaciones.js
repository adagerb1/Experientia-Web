import { ref, reactive, computed, onMounted, onUnmounted, nextTick } from 'vue';
import { api } from '../api.js';

export default {
  setup() {
    const items = ref([]); const selected = ref(null); const loading = ref(true); const busy = ref(false);
    const error = ref(''); const reply = ref(''); const transcript = ref(null);
    const filters = reactive({ channel: '', status: 'open', q: '' });
    const summary = reactive({ total: 0, open: 0, unread: 0, human: 0 });
    let timer;

    const missing = computed(() => {
      const s = selected.value?.state || {}; const out = [];
      if (!s.preferred_name) out.push('nombre'); if (!s.email) out.push('correo');
      if (!s.sector) out.push('sector'); if (!s.challenge) out.push('reto');
      return out;
    });
    const initials = (n) => String(n || '?').trim().slice(0, 1).toUpperCase();
    const stamp = (d) => d ? new Date(String(d).replace(' ', 'T')).toLocaleString('es-CO', { dateStyle: 'short', timeStyle: 'short' }) : '';

    async function load(quiet = false) {
      if (!quiet) loading.value = true; error.value = '';
      try {
        const r = (await api.conversations(filters)).data || {};
        items.value = r.items || []; Object.assign(summary, r.summary || {});
      } catch (e) { if (!quiet) error.value = e.message; }
      finally { if (!quiet) loading.value = false; }
    }
    async function open(id) {
      try {
        selected.value = (await api.conversation(id)).data; await load(true);
        await nextTick(); if (transcript.value) transcript.value.scrollTop = transcript.value.scrollHeight;
      } catch (e) { error.value = e.message; }
    }
    async function send() {
      const body = reply.value.trim(); if (!body || !selected.value) return;
      busy.value = true; error.value = '';
      try { await api.replyConversation(selected.value.id, body); reply.value = ''; await open(selected.value.id); }
      catch (e) { error.value = e.message; } finally { busy.value = false; }
    }
    async function patch(data) {
      if (!selected.value) return;
      busy.value = true;
      try { await api.updateConversation(selected.value.id, data); await open(selected.value.id); }
      catch (e) { error.value = e.message; } finally { busy.value = false; }
    }
    function onKey(e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }
    onMounted(() => { load(); timer = setInterval(() => load(true), 20000); });
    onUnmounted(() => clearInterval(timer));
    return { items, selected, loading, busy, error, reply, filters, summary, missing, transcript,
      initials, stamp, load, open, send, patch, onKey };
  },
  template: `
  <div class="view view--full conversations-view">
    <div class="topbar"><div><h1>Conversaciones</h1><p class="topbar__sub">WhatsApp y Telegram en una sola bandeja, con AlexIA y control humano.</p></div>
      <button class="btn btn--ghost btn--sm" @click="load()">↻ Actualizar</button></div>
    <p v-if="error" class="error">{{ error }}</p>
    <div class="cards cards--tight">
      <div class="stat stat--mini"><div class="stat__num">{{ summary.open }}</div><div class="stat__label">Abiertas</div><span class="stat__period">En atención</span></div>
      <div class="stat stat--mini"><div class="stat__num">{{ summary.unread }}</div><div class="stat__label">Sin leer</div><span class="stat__period">Mensajes entrantes</span></div>
      <div class="stat stat--mini"><div class="stat__num">{{ summary.human }}</div><div class="stat__label">Control humano</div><span class="stat__period">AlexIA pausada</span></div>
    </div>
    <div class="conv-filters">
      <select v-model="filters.channel" @change="load()"><option value="">Todos los canales</option><option value="whatsapp">WhatsApp</option><option value="telegram">Telegram</option></select>
      <select v-model="filters.status" @change="load()"><option value="">Todos los estados</option><option value="open">Abiertas</option><option value="closed">Cerradas</option></select>
      <input v-model="filters.q" @keyup.enter="load()" placeholder="Buscar nombre, teléfono, correo o empresa" />
      <button class="btn btn--sm" @click="load()">Buscar</button>
    </div>
    <div class="conv-shell panel panel--flush">
      <aside class="conv-list">
        <div v-if="loading" class="loading">Cargando conversaciones…</div>
        <button v-for="c in items" :key="c.id" class="conv-item" :class="{ on: selected?.id===c.id }" @click="open(c.id)">
          <span class="conv-avatar" :class="'conv-avatar--'+c.channel">{{ c.channel==='whatsapp' ? 'W' : 'T' }}</span>
          <span class="conv-item__body"><b>{{ c.name || c.external_id }}</b><small>{{ c.last_message || 'Conversación iniciada' }}</small><em>{{ stamp(c.last_message_at || c.created_at) }}</em></span>
          <span v-if="+c.unread_count" class="conv-unread">{{ c.unread_count }}</span>
        </button>
        <div v-if="!loading && !items.length" class="loading">No hay conversaciones con estos filtros.</div>
      </aside>
      <section v-if="selected" class="conv-chat">
        <header class="conv-chat__head">
          <div class="flex"><span class="conv-avatar" :class="'conv-avatar--'+selected.channel">{{ selected.channel==='whatsapp' ? 'W' : 'T' }}</span>
            <div><b>{{ selected.name || selected.external_id }}</b><small>{{ selected.channel }} · {{ selected.external_id }}</small></div></div>
          <div class="flex"><span v-if="selected.human_takeover" class="pill pill--amber">Control humano</span>
            <button class="btn btn--ghost btn--sm" @click="patch({ human_takeover: selected.human_takeover ? 0 : 1 })">{{ selected.human_takeover ? 'Reactivar AlexIA' : 'Tomar control' }}</button>
            <button class="btn btn--ghost btn--sm" @click="patch({ status: selected.status==='open' ? 'closed' : 'open' })">{{ selected.status==='open' ? 'Cerrar' : 'Reabrir' }}</button></div>
        </header>
        <div class="conv-messages" ref="transcript">
          <div v-for="m in selected.messages" :key="m.id" class="conv-msg" :class="m.direction==='outbound' ? 'conv-msg--out' : 'conv-msg--in'">
            <div><p>{{ m.body }}</p><small>{{ stamp(m.created_at) }} · {{ m.status }}<template v-if="m.error_message"> · {{ m.error_message }}</template></small></div>
          </div>
        </div>
        <div class="conv-compose"><textarea v-model="reply" @keydown="onKey" rows="2" placeholder="Responder como equipo comercial…"></textarea>
          <button class="btn" @click="send" :disabled="busy || !reply.trim()">Enviar</button></div>
      </section>
      <aside v-if="selected" class="conv-profile">
        <div class="conv-profile__avatar">{{ initials(selected.name) }}</div><h2>{{ selected.name || 'Contacto' }}</h2>
        <span class="pill pill--blue">{{ selected.state?.stage || 'new' }}</span>
        <dl><dt>Correo</dt><dd>{{ selected.lead?.email || 'Pendiente' }}</dd><dt>WhatsApp</dt><dd>{{ selected.lead?.whatsapp || (selected.channel==='whatsapp' ? selected.external_id : 'Pendiente') }}</dd>
          <dt>Empresa</dt><dd>{{ selected.lead?.company || 'Pendiente' }}</dd><dt>Origen</dt><dd>{{ selected.lead?.source || ('agente:'+selected.channel) }}</dd></dl>
        <div class="conv-missing"><b>Perfil progresivo</b><p v-if="missing.length">Falta captar: {{ missing.join(', ') }}.</p><p v-else>Datos comerciales mínimos completos.</p></div>
        <a v-if="selected.lead_id" :href="'/admin/leads'" class="btn btn--ghost btn--sm">Ver en Leads →</a>
      </aside>
      <div v-if="!selected" class="conv-empty"><span>💬</span><b>Selecciona una conversación</b><p>Verás el historial, el lead y los datos que AlexIA debe captar.</p></div>
    </div>
  </div>`
};
