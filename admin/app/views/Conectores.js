import { ref, reactive, computed, onMounted } from 'vue';
import { api } from '../api.js';

// Campos por proveedor. Los secretos NO se rellenan al cargar: se dejan vacíos
// con un indicador de "guardado". Escribir uno nuevo lo reemplaza; dejarlo
// vacío conserva el que ya está guardado.
const FIELDS = {
  epayco: [
    { k: 'public_key', label: 'Public key', secret: false },
    { k: 'p_cust_id', label: 'P_CUST_ID', secret: false },
    { k: 'p_key', label: 'P_KEY', secret: true },
    { k: 'test', label: 'Modo prueba (true/false)', secret: false }
  ],
  wompi: [
    { k: 'public_key', label: 'Llave pública', secret: false },
    { k: 'private_key', label: 'Llave privada', secret: true },
    { k: 'integrity_secret', label: 'Secreto de integridad', secret: true },
    { k: 'events_secret', label: 'Secreto de eventos', secret: true }
  ],
  openai: [
    { k: 'api_key', label: 'API key', secret: true },
    { k: 'model', label: 'Modelo (ej. gpt-4o-mini)', secret: false }
  ],
  anthropic: [
    { k: 'api_key', label: 'API key', secret: true },
    { k: 'model', label: 'Modelo (ej. claude-sonnet-5)', secret: false }
  ]
};

export default {
  setup() {
    const items = ref([]); const error = ref(''); const loading = ref(true);
    const forms = reactive({}); const saved = reactive({}); const busy = reactive({}); const msg = reactive({});

    async function load() {
      loading.value = true;
      try {
        items.value = (await api.connectors()).data || [];
        items.value.forEach((c) => {
          const cfg = c.config || {};
          const f = { _active: !!+c.active };
          (FIELDS[c.provider] || []).forEach((fd) => {
            if (fd.secret) {
              f[fd.k] = '';
              saved[c.provider + '.' + fd.k] = !!cfg['_has_' + fd.k] || (typeof cfg[fd.k] === 'string' && cfg[fd.k].startsWith('••••'));
            } else {
              f[fd.k] = cfg[fd.k] ?? '';
            }
          });
          forms[c.provider] = f;
        });
      } catch (e) { error.value = e.message; }
      finally { loading.value = false; }
    }
    onMounted(load);

    const payment = computed(() => items.value.filter((c) => c.kind === 'payment'));
    const ai = computed(() => items.value.filter((c) => c.kind === 'ai'));
    const fieldsFor = (p) => FIELDS[p] || [];
    const isSaved = (p, k) => !!saved[p + '.' + k];
    const isConfigured = (p) => fieldsFor(p).some((fd) => (fd.secret ? isSaved(p, fd.k) : (forms[p] && forms[p][fd.k])));

    async function save(p) {
      busy[p] = true; msg[p] = '';
      try {
        const f = forms[p]; const config = {};
        fieldsFor(p).forEach((fd) => {
          const v = f[fd.k];
          if (fd.secret) { if (v && String(v).trim() !== '') config[fd.k] = v; }  // solo si escribió uno nuevo
          else config[fd.k] = v ?? '';
        });
        await api.saveConnector(p, { config, active: f._active ? 1 : 0 });
        msg[p] = 'Guardado ✓'; await load();
      } catch (e) { msg[p] = e.message; } finally { busy[p] = false; }
    }
    async function test(p) {
      busy[p] = true; msg[p] = 'Probando…';
      try { const r = await api.testConnector(p); msg[p] = r.data && r.data.ok ? ('Conexión OK ' + (r.data.reply || '')) : (r.message || 'OK'); }
      catch (e) { msg[p] = e.message; } finally { busy[p] = false; }
    }

    return { items, error, loading, forms, busy, msg, payment, ai, fieldsFor, isSaved, isConfigured, save, test };
  },
  template: `
  <div class="view view--narrow">
    <div class="topbar"><div><h1>Conectores</h1><p class="topbar__sub">Pasarelas de pago e inteligencia artificial. Solo un activo por tipo.</p></div></div>
    <p v-if="error" class="error">{{ error }}</p>
    <div v-if="loading" class="skeleton-table"><div class="skeleton-row" v-for="i in 4" :key="i" style="height:70px"></div></div>

    <template v-else>
      <h2 class="conn-h">💳 Pasarelas de pago</h2>
      <div class="conn-grid">
        <div class="panel conn-card" v-for="c in payment" :key="c.provider" :class="{ 'conn-card--on': forms[c.provider]._active }">
          <div class="conn-card__head">
            <strong>{{ c.label }}</strong>
            <div class="conn-badges">
              <span v-if="isConfigured(c.provider)" class="pill pill--blue">Configurado</span>
              <span v-if="forms[c.provider]._active" class="pill pill--green">Activo</span>
            </div>
          </div>
          <div class="field" v-for="fd in fieldsFor(c.provider)" :key="fd.k">
            <label>{{ fd.label }} <span v-if="fd.secret && isSaved(c.provider, fd.k)" class="saved-tag">guardado ✓</span></label>
            <input v-model="forms[c.provider][fd.k]" :type="fd.secret ? 'password' : 'text'" autocomplete="off"
              :placeholder="fd.secret ? (isSaved(c.provider, fd.k) ? 'Guardado — escribe para cambiar' : 'Sin configurar') : ''" />
          </div>
          <label class="switch switch--row"><input type="checkbox" v-model="forms[c.provider]._active" /><span>Activar como pasarela</span></label>
          <div class="flex between">
            <span class="muted" style="font-size:.82rem">{{ msg[c.provider] }}</span>
            <button class="btn btn--sm" @click="save(c.provider)" :disabled="busy[c.provider]">Guardar</button>
          </div>
        </div>
      </div>

      <h2 class="conn-h">✦ Inteligencia artificial (AlexIA)</h2>
      <div class="conn-grid">
        <div class="panel conn-card" v-for="c in ai" :key="c.provider" :class="{ 'conn-card--on': forms[c.provider]._active }">
          <div class="conn-card__head">
            <strong>{{ c.label }}</strong>
            <div class="conn-badges">
              <span v-if="isConfigured(c.provider)" class="pill pill--blue">Configurado</span>
              <span v-if="forms[c.provider]._active" class="pill pill--green">Activo</span>
            </div>
          </div>
          <div class="field" v-for="fd in fieldsFor(c.provider)" :key="fd.k">
            <label>{{ fd.label }} <span v-if="fd.secret && isSaved(c.provider, fd.k)" class="saved-tag">guardado ✓</span></label>
            <input v-model="forms[c.provider][fd.k]" :type="fd.secret ? 'password' : 'text'" autocomplete="off"
              :placeholder="fd.secret ? (isSaved(c.provider, fd.k) ? 'Guardado — escribe para cambiar' : 'Sin configurar') : ''" />
          </div>
          <label class="switch switch--row"><input type="checkbox" v-model="forms[c.provider]._active" /><span>Activar para AlexIA</span></label>
          <div class="flex between">
            <span class="muted" style="font-size:.82rem">{{ msg[c.provider] }}</span>
            <div class="flex">
              <button class="btn btn--ghost btn--sm" @click="test(c.provider)" :disabled="busy[c.provider]">Probar</button>
              <button class="btn btn--sm" @click="save(c.provider)" :disabled="busy[c.provider]">Guardar</button>
            </div>
          </div>
        </div>
      </div>
      <p class="hint">AlexIA usa el conector de IA <b>activo</b> para generar artículos y responder preguntas sobre tus datos (solo lectura).</p>
    </template>
  </div>`
};
