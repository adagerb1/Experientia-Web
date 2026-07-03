import { ref, reactive, computed, onMounted } from 'vue';
import { api } from '../api.js';

// Definición por proveedor: campos (con ayuda y ejemplo) + guía paso a paso.
const PROVIDERS = {
  epayco: {
    url: 'https://dashboard.epayco.co',
    guide: [
      'Entra a dashboard.epayco.co e inicia sesión con tu cuenta ePayco.',
      'Ve a "Configuración" → "Llaves API" (o "Integraciones").',
      'Copia PUBLIC_KEY, P_CUST_ID_CLIENTE (P_CUST_ID) y P_KEY.',
      'Deja "Modo prueba" en true mientras pruebas; ponlo en false para cobros reales.',
      'Pega cada valor en su campo, Guarda y activa ePayco.'
    ],
    fields: [
      { k: 'public_key', label: 'Public key', help: 'Llave pública de ePayco (identifica tu comercio en el checkout).', example: '491d...' },
      { k: 'p_cust_id', label: 'P_CUST_ID', help: 'ID de cliente de ePayco (P_CUST_ID_CLIENTE). Se usa para validar la confirmación de pago.', example: '123456' },
      { k: 'p_key', label: 'P_KEY', secret: true, help: 'Llave privada (P_KEY) para firmar/validar transacciones. NO la compartas.', example: 'a1b2c3...' },
      { k: 'test', label: 'Modo prueba', type: 'select', options: ['true', 'false'], help: 'true = pruebas (no cobra). false = producción (cobros reales).', example: 'true' }
    ]
  },
  wompi: {
    url: 'https://comercios.wompi.co',
    guide: [
      'Entra a comercios.wompi.co y accede a tu cuenta (Bancolombia).',
      'Ve a "Desarrolladores" → "Llaves de API".',
      'Copia la Llave pública (pub_...) y la Llave privada (prv_...).',
      'Copia el "Secreto de integridad" (firma los pagos) y el "Secreto de eventos" (webhooks).',
      'Pega cada valor, Guarda y activa Wompi.'
    ],
    fields: [
      { k: 'public_key', label: 'Llave pública', help: 'Llave pública de Wompi. Empieza por "pub_test_" (pruebas) o "pub_prod_".', example: 'pub_prod_xxx' },
      { k: 'private_key', label: 'Llave privada', secret: true, help: 'Llave privada (prv_...). Se usa en el servidor. NO la compartas.', example: 'prv_prod_xxx' },
      { k: 'integrity_secret', label: 'Secreto de integridad', secret: true, help: 'Firma la transacción para que Wompi la acepte. Está en Desarrolladores → Llaves.', example: 'prod_integrity_xxx' },
      { k: 'events_secret', label: 'Secreto de eventos', secret: true, help: 'Valida los webhooks de confirmación de pago.', example: 'prod_events_xxx' }
    ]
  },
  openai: {
    url: 'https://platform.openai.com/api-keys',
    guide: [
      'Entra a platform.openai.com e inicia sesión (o crea tu cuenta).',
      'Abre "API keys" (menú lateral) o ve a platform.openai.com/api-keys.',
      'Haz clic en "Create new secret key", ponle un nombre y créala.',
      'Copia la clave (empieza por sk-...). Solo se muestra una vez.',
      'En Settings → Billing agrega un método de pago / saldo (necesario para usarla).',
      'Pega la clave aquí, elige modelos y voz, Guarda y activa el conector.'
    ],
    fields: [
      { k: 'api_key', label: 'API key', secret: true, help: 'Clave secreta de OpenAI. Empieza por "sk-". Se usa para texto, imágenes y audio.', example: 'sk-proj-abc123...' },
      { k: 'model', label: 'Modelo de texto', help: 'Modelo para redactar y responder (AlexIA). Recomendado: gpt-4o-mini (rápido/económico) o gpt-4o.', example: 'gpt-4o-mini' },
      { k: 'image_model', label: 'Modelo de imagen (portadas)', type: 'select', options: ['dall-e-3', 'gpt-image-1'], help: 'Modelo para generar portadas. dall-e-3 es una buena opción general.', example: 'dall-e-3' },
      { k: 'tts_model', label: 'Modelo de audio', type: 'select', options: ['tts-1', 'tts-1-hd', 'gpt-4o-mini-tts'], help: 'Modelo de narración. tts-1 es rápido; tts-1-hd suena mejor.', example: 'tts-1' },
      { k: 'tts_voice', label: 'Voz del audio', type: 'select', options: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'], help: 'Voz de la narración. "nova" y "shimmer" son claras; "onyx" es grave.', example: 'alloy' }
    ]
  },
  sendgrid: {
    url: 'https://app.sendgrid.com/settings/api_keys',
    guide: [
      'Entra a app.sendgrid.com e inicia sesión (o crea tu cuenta gratuita).',
      'Ve a "Settings" → "API Keys" y haz clic en "Create API Key".',
      'Ponle un nombre, elige acceso "Full Access" (o al menos "Mail Send") y créala.',
      'Copia la clave (empieza por SG.). Solo se muestra una vez.',
      'En "Settings" → "Sender Authentication" verifica el correo/dominio que usarás como remitente.',
      'Pega la clave y el remitente verificado aquí, Guarda y activa el conector.'
    ],
    fields: [
      { k: 'api_key', label: 'API key', secret: true, help: 'Clave de SendGrid para enviar correos (confirmaciones y recordatorios). Empieza por "SG.".', example: 'SG.xxxxx' },
      { k: 'from_email', label: 'Correo remitente', help: 'Dirección verificada en SendGrid desde la que salen los correos.', example: 'hola@tonnydager.com' },
      { k: 'from_name', label: 'Nombre remitente', help: 'Nombre visible del remitente en la bandeja del destinatario.', example: 'Tonny Dager' }
    ]
  },
  google_calendar: {
    url: 'https://console.cloud.google.com/apis/credentials',
    guide: [
      'Entra a console.cloud.google.com y crea (o elige) un proyecto.',
      'En "APIs y servicios" → "Biblioteca" activa "Google Calendar API".',
      'En "Pantalla de consentimiento OAuth" configura la app (tipo Externo) y añade tu correo como usuario de prueba.',
      'En "Credenciales" crea un "ID de cliente de OAuth" tipo "Aplicación web" y copia client_id y client_secret.',
      'Genera un refresh_token autorizando el scope calendar (usa OAuth Playground: developers.google.com/oauthplayground, marca "Use your own OAuth credentials").',
      'Pega client_id, client_secret y refresh_token; deja calendar_id en "primary" (o el ID de otro calendario). Guarda y activa.'
    ],
    fields: [
      { k: 'client_id', label: 'Client ID', help: 'ID de cliente OAuth del proyecto de Google Cloud.', example: '1234-abc.apps.googleusercontent.com' },
      { k: 'client_secret', label: 'Client secret', secret: true, help: 'Secreto del cliente OAuth. NO lo compartas.', example: 'GOCSPX-...' },
      { k: 'refresh_token', label: 'Refresh token', secret: true, help: 'Token que permite crear eventos y leer tu ocupación sin volver a iniciar sesión.', example: '1//0g...' },
      { k: 'calendar_id', label: 'Calendar ID', help: 'Calendario donde se crean las reuniones. "primary" es tu calendario principal.', example: 'primary' }
    ]
  },
  anthropic: {
    url: 'https://console.anthropic.com/settings/keys',
    guide: [
      'Entra a console.anthropic.com e inicia sesión.',
      'Ve a "API Keys" (Settings → API Keys) y crea una nueva.',
      'Copia la clave (empieza por sk-ant-...).',
      'Pega la clave, elige el modelo (ej. claude-sonnet-5), Guarda y activa.'
    ],
    fields: [
      { k: 'api_key', label: 'API key', secret: true, help: 'Clave secreta de Anthropic. Empieza por "sk-ant-". Solo texto (no genera imágenes/audio).', example: 'sk-ant-api03-...' },
      { k: 'model', label: 'Modelo de texto', help: 'Modelo de Claude para redactar y responder. Ej.: claude-sonnet-5.', example: 'claude-sonnet-5' }
    ]
  }
};

export default {
  setup() {
    const items = ref([]); const error = ref(''); const loading = ref(true);
    const forms = reactive({}); const saved = reactive({}); const busy = reactive({}); const msg = reactive({});
    const testLink = reactive({}); const testEmail = ref('');
    const guideOpen = reactive({}); const hintKey = ref(''); const voiceBusy = ref(false);

    async function load() {
      loading.value = true;
      try {
        items.value = (await api.connectors()).data || [];
        items.value.forEach((c) => {
          const cfg = c.config || {};
          const f = { _active: !!+c.active };
          fieldsFor(c.provider).forEach((fd) => {
            if (fd.secret) {
              f[fd.k] = '';
              saved[c.provider + '.' + fd.k] = !!cfg['_has_' + fd.k] || (typeof cfg[fd.k] === 'string' && cfg[fd.k].startsWith('••••'));
            } else {
              f[fd.k] = cfg[fd.k] ?? (fd.type === 'select' ? fd.options[0] : '');
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
    const agenda = computed(() => items.value.filter((c) => c.kind === 'calendar' || c.kind === 'email'));
    const fieldsFor = (p) => (PROVIDERS[p] && PROVIDERS[p].fields) || [];
    const guideFor = (p) => (PROVIDERS[p] && PROVIDERS[p].guide) || [];
    const urlFor = (p) => (PROVIDERS[p] && PROVIDERS[p].url) || '#';
    const isSaved = (p, k) => !!saved[p + '.' + k];
    const isConfigured = (p) => fieldsFor(p).some((fd) => (fd.secret ? isSaved(p, fd.k) : (forms[p] && forms[p][fd.k])));
    const toggleHint = (id) => { hintKey.value = hintKey.value === id ? '' : id; };

    async function save(p) {
      busy[p] = true; msg[p] = '';
      try {
        const f = forms[p]; const config = {};
        fieldsFor(p).forEach((fd) => {
          const v = f[fd.k];
          if (fd.secret) { if (v && String(v).trim() !== '') config[fd.k] = v; }
          else config[fd.k] = v ?? '';
        });
        await api.saveConnector(p, { config, active: f._active ? 1 : 0 });
        msg[p] = 'Guardado ✓'; await load();
      } catch (e) { msg[p] = e.message; } finally { busy[p] = false; }
    }
    async function test(p) {
      busy[p] = true; msg[p] = 'Probando…'; testLink[p] = '';
      try {
        const body = p === 'sendgrid' && testEmail.value ? { email: testEmail.value } : undefined;
        const r = await api.testConnector(p, body);
        const d = r.data || {};
        // Google Calendar devuelve el enlace del evento creado.
        if (d.html_link) testLink[p] = d.html_link;
        msg[p] = r.message || (d.ok ? ('Conexión OK ' + (d.reply || '')) : 'OK');
      } catch (e) { msg[p] = e.message; } finally { busy[p] = false; }
    }

    // Reproduce una frase de muestra con la voz/modelo seleccionados (sin guardar).
    async function testVoice(p) {
      const f = forms[p] || {};
      voiceBusy.value = true; msg[p] = 'Generando muestra…';
      try {
        const r = await api.alexiaVoice(f.tts_voice || 'alloy', f.tts_model || 'tts-1');
        if (r.data && r.data.url) { new Audio(r.data.url + '?t=' + Date.now()).play(); msg[p] = 'Reproduciendo muestra ▶'; }
        else msg[p] = 'No se pudo generar la muestra.';
      } catch (e) { msg[p] = e.message; } finally { voiceBusy.value = false; }
    }

    return { items, error, loading, forms, busy, msg, testLink, testEmail, guideOpen, hintKey, voiceBusy, payment, ai, agenda,
      fieldsFor, guideFor, urlFor, isSaved, isConfigured, toggleHint, save, test, testVoice };
  },
  template: `
  <div class="view view--narrow">
    <div class="topbar"><div><h1>Conectores</h1><p class="topbar__sub">Pasarelas de pago e inteligencia artificial. Cada tarjeta trae su guía de configuración.</p></div></div>
    <p v-if="error" class="error">{{ error }}</p>
    <div v-if="loading" class="skeleton-table"><div class="skeleton-row" v-for="i in 4" :key="i" style="height:70px"></div></div>

    <template v-else>
      <h2 class="conn-h">💳 Pasarelas de pago</h2>
      <div class="conn-grid">
        <div class="panel conn-card" v-for="c in payment" :key="c.provider" :class="{ 'conn-card--on': forms[c.provider]._active }">
          <div class="conn-card__head">
            <strong>{{ c.label }} <button type="button" class="help-btn" @click="guideOpen[c.provider] = !guideOpen[c.provider]" title="Cómo configurar">?</button></strong>
            <div class="conn-badges">
              <span v-if="isConfigured(c.provider)" class="pill pill--blue">Configurado</span>
              <span v-if="forms[c.provider]._active" class="pill pill--green">Activo</span>
            </div>
          </div>
          <div v-if="guideOpen[c.provider]" class="guide">
            <p class="guide__t">Paso a paso</p>
            <ol><li v-for="(s,i) in guideFor(c.provider)" :key="i">{{ s }}</li></ol>
            <a :href="urlFor(c.provider)" target="_blank" rel="noopener" class="guide__link">Abrir el sitio ↗</a>
          </div>
          <div class="field" v-for="fd in fieldsFor(c.provider)" :key="fd.k">
            <label>{{ fd.label }}
              <button type="button" class="help-dot" @click="toggleHint(c.provider+'.'+fd.k)" :title="fd.help">?</button>
              <span v-if="fd.secret && isSaved(c.provider, fd.k)" class="saved-tag">guardado ✓</span>
            </label>
            <div v-if="hintKey === c.provider+'.'+fd.k" class="field-hint">{{ fd.help }}<template v-if="fd.example"><br><b>Ejemplo:</b> {{ fd.example }}</template></div>
            <select v-if="fd.type === 'select'" v-model="forms[c.provider][fd.k]"><option v-for="o in fd.options" :key="o" :value="o">{{ o }}</option></select>
            <input v-else v-model="forms[c.provider][fd.k]" :type="fd.secret ? 'password' : 'text'" autocomplete="off"
              :placeholder="fd.secret ? (isSaved(c.provider, fd.k) ? 'Guardado — escribe para cambiar' : (fd.example || 'Sin configurar')) : (fd.example || '')" />
          </div>
          <label class="switch switch--row"><input type="checkbox" v-model="forms[c.provider]._active" /><span>Activar como pasarela</span></label>
          <div class="flex between"><span class="muted" style="font-size:.82rem">{{ msg[c.provider] }}</span>
            <button class="btn btn--sm" @click="save(c.provider)" :disabled="busy[c.provider]">Guardar</button></div>
        </div>
      </div>

      <h2 class="conn-h">📅 Agenda y correo</h2>
      <div class="conn-grid">
        <div class="panel conn-card" v-for="c in agenda" :key="c.provider" :class="{ 'conn-card--on': forms[c.provider]._active }">
          <div class="conn-card__head">
            <strong>{{ c.label }} <button type="button" class="help-btn" @click="guideOpen[c.provider] = !guideOpen[c.provider]" title="Cómo configurar">?</button></strong>
            <div class="conn-badges">
              <span v-if="isConfigured(c.provider)" class="pill pill--blue">Configurado</span>
              <span v-if="forms[c.provider]._active" class="pill pill--green">Activo</span>
            </div>
          </div>
          <div v-if="guideOpen[c.provider]" class="guide">
            <p class="guide__t">Paso a paso</p>
            <ol><li v-for="(s,i) in guideFor(c.provider)" :key="i">{{ s }}</li></ol>
            <a :href="urlFor(c.provider)" target="_blank" rel="noopener" class="guide__link">Abrir el sitio ↗</a>
          </div>
          <div class="field" v-for="fd in fieldsFor(c.provider)" :key="fd.k">
            <label>{{ fd.label }}
              <button type="button" class="help-dot" @click="toggleHint(c.provider+'.'+fd.k)" :title="fd.help">?</button>
              <span v-if="fd.secret && isSaved(c.provider, fd.k)" class="saved-tag">guardado ✓</span>
            </label>
            <div v-if="hintKey === c.provider+'.'+fd.k" class="field-hint">{{ fd.help }}<template v-if="fd.example"><br><b>Ejemplo:</b> {{ fd.example }}</template></div>
            <select v-if="fd.type === 'select'" v-model="forms[c.provider][fd.k]"><option v-for="o in fd.options" :key="o" :value="o">{{ o }}</option></select>
            <input v-else v-model="forms[c.provider][fd.k]" :type="fd.secret ? 'password' : 'text'" autocomplete="off"
              :placeholder="fd.secret ? (isSaved(c.provider, fd.k) ? 'Guardado — escribe para cambiar' : (fd.example || 'Sin configurar')) : (fd.example || '')" />
          </div>
          <div v-if="c.provider === 'sendgrid'" class="field">
            <label>Enviar prueba a <span class="muted">(opcional)</span></label>
            <input v-model="testEmail" type="email" autocomplete="off" placeholder="tucorreo@ejemplo.com — si lo dejas vacío, va al remitente" />
          </div>
          <label class="switch switch--row"><input type="checkbox" v-model="forms[c.provider]._active" /><span>Activar</span></label>
          <p v-if="testLink[c.provider]" style="font-size:.82rem;margin:0 0 8px"><a :href="testLink[c.provider]" target="_blank" rel="noopener" class="link">Ver evento de prueba en el calendario ↗</a></p>
          <div class="flex between"><span class="muted" style="font-size:.82rem">{{ msg[c.provider] }}</span>
            <div class="flex">
              <button class="btn btn--ghost btn--sm" @click="test(c.provider)" :disabled="busy[c.provider]">{{ c.provider === 'google_calendar' ? 'Crear evento de prueba' : 'Enviar correo de prueba' }}</button>
              <button class="btn btn--sm" @click="save(c.provider)" :disabled="busy[c.provider]">Guardar</button>
            </div></div>
        </div>
      </div>
      <p class="hint">Con <b>Google Calendar</b> activo, cada reserva confirmada crea un evento con enlace de Meet y se descuenta tu ocupación de los horarios disponibles. Con <b>SendGrid</b> activo, las confirmaciones y recordatorios salen por ese canal (más fiable que el correo del hosting). Usa <b>Probar</b> para validar cada uno antes de activarlo.</p>

      <h2 class="conn-h">✦ Inteligencia artificial (AlexIA)</h2>
      <div class="conn-grid">
        <div class="panel conn-card" v-for="c in ai" :key="c.provider" :class="{ 'conn-card--on': forms[c.provider]._active }">
          <div class="conn-card__head">
            <strong>{{ c.label }} <button type="button" class="help-btn" @click="guideOpen[c.provider] = !guideOpen[c.provider]" title="Cómo configurar">?</button></strong>
            <div class="conn-badges">
              <span v-if="isConfigured(c.provider)" class="pill pill--blue">Configurado</span>
              <span v-if="forms[c.provider]._active" class="pill pill--green">Activo</span>
            </div>
          </div>
          <div v-if="guideOpen[c.provider]" class="guide">
            <p class="guide__t">Paso a paso</p>
            <ol><li v-for="(s,i) in guideFor(c.provider)" :key="i">{{ s }}</li></ol>
            <a :href="urlFor(c.provider)" target="_blank" rel="noopener" class="guide__link">Abrir el sitio ↗</a>
          </div>
          <div class="field" v-for="fd in fieldsFor(c.provider)" :key="fd.k">
            <label>{{ fd.label }}
              <button type="button" class="help-dot" @click="toggleHint(c.provider+'.'+fd.k)" :title="fd.help">?</button>
              <span v-if="fd.secret && isSaved(c.provider, fd.k)" class="saved-tag">guardado ✓</span>
            </label>
            <div v-if="hintKey === c.provider+'.'+fd.k" class="field-hint">{{ fd.help }}<template v-if="fd.example"><br><b>Ejemplo:</b> {{ fd.example }}</template></div>
            <select v-if="fd.type === 'select'" v-model="forms[c.provider][fd.k]"><option v-for="o in fd.options" :key="o" :value="o">{{ o }}</option></select>
            <input v-else v-model="forms[c.provider][fd.k]" :type="fd.secret ? 'password' : 'text'" autocomplete="off"
              :placeholder="fd.secret ? (isSaved(c.provider, fd.k) ? 'Guardado — escribe para cambiar' : (fd.example || 'Sin configurar')) : (fd.example || '')" />
          </div>
          <button v-if="c.provider === 'openai'" type="button" class="btn btn--ghost btn--sm" style="margin-bottom:12px" @click="testVoice(c.provider)" :disabled="voiceBusy">🔊 Probar voz</button>
          <label class="switch switch--row"><input type="checkbox" v-model="forms[c.provider]._active" /><span>Activar para AlexIA</span></label>
          <div class="flex between"><span class="muted" style="font-size:.82rem">{{ msg[c.provider] }}</span>
            <div class="flex">
              <button class="btn btn--ghost btn--sm" @click="test(c.provider)" :disabled="busy[c.provider]">Probar</button>
              <button class="btn btn--sm" @click="save(c.provider)" :disabled="busy[c.provider]">Guardar</button>
            </div></div>
        </div>
      </div>
      <p class="hint">AlexIA usa el conector de IA <b>activo</b> para generar artículos, portadas, audio y responder preguntas sobre tus datos (solo lectura). Las <b>imágenes y el audio</b> requieren OpenAI.</p>
    </template>
  </div>`
};
