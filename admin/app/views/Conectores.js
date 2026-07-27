import { ref, reactive, computed, onMounted } from 'vue';
import { api } from '../api.js?v=20260727-1';

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
      'Copia el "Secreto de integridad" y el "Secreto de eventos" (webhooks).',
      'Pega cada valor, Guarda y activa Wompi.'
    ],
    fields: [
      { k: 'public_key', label: 'Llave pública', help: 'Llave pública de Wompi. Empieza por "pub_test_" o "pub_prod_".', example: 'pub_prod_xxx' },
      { k: 'private_key', label: 'Llave privada', secret: true, help: 'Llave privada (prv_...). Se usa en el servidor. NO la compartas.', example: 'prv_prod_xxx' },
      { k: 'integrity_secret', label: 'Secreto de integridad', secret: true, help: 'Firma la transacción para que Wompi la acepte.', example: 'prod_integrity_xxx' },
      { k: 'events_secret', label: 'Secreto de eventos', secret: true, help: 'Valida los webhooks de confirmación de pago.', example: 'prod_events_xxx' }
    ]
  },
  openai: {
    url: 'https://platform.openai.com/api-keys',
    guide: [
      'Entra a platform.openai.com e inicia sesión (o crea tu cuenta).',
      'Abre "API keys" o ve a platform.openai.com/api-keys.',
      'Haz clic en "Create new secret key", ponle un nombre y créala.',
      'Copia la clave (empieza por sk-...). Solo se muestra una vez.',
      'En Settings → Billing agrega saldo (necesario para usarla).',
      'Pega la clave, elige modelos y voz, Guarda y activa el conector.'
    ],
    fields: [
      { k: 'api_key', label: 'API key', secret: true, help: 'Clave secreta de OpenAI. Empieza por "sk-". Texto, imágenes y audio.', example: 'sk-proj-abc123...' },
      { k: 'model', label: 'Modelo de texto', help: 'Modelo para redactar y responder (AlexIA). Recomendado: gpt-4o-mini o gpt-4o.', example: 'gpt-4o-mini' },
      { k: 'image_model', label: 'Modelo de imagen (portadas)', type: 'select', options: ['dall-e-3', 'gpt-image-1'], help: 'Modelo para generar portadas.', example: 'dall-e-3' },
      { k: 'tts_model', label: 'Modelo de audio', type: 'select', options: ['tts-1', 'tts-1-hd', 'gpt-4o-mini-tts'], help: 'Narración base (si no usas ElevenLabs).', example: 'tts-1' },
      { k: 'tts_voice', label: 'Voz del audio', type: 'select', options: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'], help: 'Voz de la narración OpenAI.', example: 'alloy' }
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
      { k: 'api_key', label: 'API key', secret: true, help: 'Clave secreta de Anthropic. Empieza por "sk-ant-". Solo texto.', example: 'sk-ant-api03-...' },
      { k: 'model', label: 'Modelo de texto', help: 'Modelo de Claude para redactar y responder.', example: 'claude-sonnet-5' }
    ]
  },
  sendgrid: {
    url: 'https://app.sendgrid.com/settings/api_keys',
    guide: [
      'Entra a app.sendgrid.com e inicia sesión (o crea tu cuenta gratuita).',
      'Ve a "Settings" → "API Keys" → "Create API Key" (Full Access o Mail Send).',
      'Copia la clave (empieza por SG.). Solo se muestra una vez.',
      'En "Sender Authentication" verifica el correo/dominio remitente.',
      'Pega la clave y el remitente aquí, Guarda y activa.'
    ],
    fields: [
      { k: 'api_key', label: 'API key', secret: true, help: 'Clave de SendGrid. Empieza por "SG.".', example: 'SG.xxxxx' },
      { k: 'from_email', label: 'Correo remitente', help: 'Dirección verificada en SendGrid.', example: 'hola@tonnydager.com' },
      { k: 'from_name', label: 'Nombre remitente', help: 'Nombre visible del remitente.', example: 'Tonny Dager' }
    ]
  },
  google_calendar: {
    url: 'https://console.cloud.google.com/apis/credentials',
    guide: [
      'En console.cloud.google.com crea/elige un proyecto y activa "Google Calendar API".',
      'Configura la pantalla de consentimiento OAuth (tipo Externo) y añade tu correo como usuario de prueba.',
      'Crea un "ID de cliente de OAuth" tipo "Aplicación web" (copia client_id y client_secret).',
      'Genera un refresh_token con el scope calendar (OAuth Playground: developers.google.com/oauthplayground).',
      'Pega client_id, client_secret y refresh_token; deja calendar_id en "primary". Guarda y activa.'
    ],
    fields: [
      { k: 'client_id', label: 'Client ID', help: 'ID de cliente OAuth del proyecto.', example: '1234-abc.apps.googleusercontent.com' },
      { k: 'client_secret', label: 'Client secret', secret: true, help: 'Secreto del cliente OAuth.', example: 'GOCSPX-...' },
      { k: 'refresh_token', label: 'Refresh token', secret: true, help: 'Permite crear eventos y leer tu ocupación.', example: '1//0g...' },
      { k: 'calendar_id', label: 'Calendar ID', help: '"primary" = tu calendario principal.', example: 'primary' }
    ]
  },
  elevenlabs: {
    url: 'https://elevenlabs.io/app/voice-lab',
    guide: [
      'Crea tu cuenta en elevenlabs.io e inicia sesión.',
      'Para clonar tu voz: ve a "Voice Lab" → "Add Voice" → "Instant Voice Clone" y sube 1-3 min de tu audio limpio.',
      'Abre la voz creada y copia su "Voice ID".',
      'En tu perfil → "API Keys" crea una clave y cópiala.',
      'Pega API key y Voice ID aquí, elige el modelo multilingüe, Guarda y activa. Usa "Probar voz".'
    ],
    fields: [
      { k: 'api_key', label: 'API key', secret: true, help: 'Clave de ElevenLabs (perfil → API Keys).', example: 'xi-...' },
      { k: 'voice_id', label: 'Voice ID', help: 'ID de tu voz (clonada o de la galería). Ej.: la voz de Tonny.', example: '21m00Tcm4TlvDq8ikWAM' },
      { k: 'model_id', label: 'Modelo', type: 'select', options: ['eleven_multilingual_v2', 'eleven_turbo_v2_5', 'eleven_flash_v2_5'], help: 'multilingual_v2 = mejor calidad en español.', example: 'eleven_multilingual_v2' },
      { k: 'stability', label: 'Estabilidad (0-1)', help: 'Más alto = voz más estable/monótona. 0.4-0.6 recomendado.', example: '0.5' },
      { k: 'similarity_boost', label: 'Similitud (0-1)', help: 'Qué tan fiel a la voz original. 0.7-0.9 recomendado.', example: '0.8' }
    ]
  },
  veo: {
    url: 'https://aistudio.google.com/apikey',
    guide: [
      'Entra a aistudio.google.com/apikey e inicia sesión con tu cuenta de Google.',
      'Crea una API key de Gemini (habilita facturación: VEO es de pago).',
      'Copia la clave y pégala aquí.',
      'Elige el modelo VEO disponible y la relación de aspecto. Guarda y activa.',
      'Genera video desde Recursos (tipo "Video"). La generación tarda ~1-3 min.'
    ],
    fields: [
      { k: 'api_key', label: 'API key (Gemini)', secret: true, help: 'Clave de Google AI Studio con VEO habilitado.', example: 'AIza...' },
      { k: 'model', label: 'Modelo VEO', type: 'select', options: ['veo-3.0-generate-preview', 'veo-2.0-generate-001'], help: 'Modelo de generación de video.', example: 'veo-3.0-generate-preview' },
      { k: 'aspect', label: 'Relación de aspecto', type: 'select', options: ['16:9', '9:16'], help: '16:9 horizontal, 9:16 vertical (reels).', example: '16:9' }
    ]
  },
  telegram: {
    url: 'https://t.me/BotFather',
    guide: [
      'En Telegram abre @BotFather y envía /newbot para crear tu BOT COMERCIAL (leads). Copia su token.',
      'Repite /newbot para crear tu BOT INTERNO de AlexIA. Copia su token.',
      'Pega el token comercial en "Bot comercial" y el interno en "Bot AlexIA".',
      'Escribe una clave secreta de webhook (inventa una) para proteger los webhooks.',
      'Para AlexIA, escríbele a tu bot interno y pon tu chat_id en "Chats autorizados" (usa "Probar": el bot te dirá tu chat_id).',
      'Guarda, activa y pulsa "Probar": registra los webhooks automáticamente.'
    ],
    fields: [
      { k: 'leads_bot_token', label: 'Bot comercial (leads)', secret: true, help: 'Token del bot que conversa con leads, agenda y entrega diagnóstico.', example: '123456:ABC-...' },
      { k: 'bot_token', label: 'Bot AlexIA (interno)', secret: true, help: 'Token del bot privado para consultar a AlexIA desde Telegram.', example: '789012:XYZ-...' },
      { k: 'allowed_chat_ids', label: 'Chats autorizados (AlexIA)', help: 'IDs de chat que pueden usar AlexIA, separados por coma. "Probar" te muestra el tuyo.', example: '12345678' },
      { k: 'webhook_secret', label: 'Secreto de webhook', secret: true, help: 'Clave que inventas para proteger los webhooks. Cualquier texto largo.', example: 'mi-secreto-largo-123' }
    ]
  },
  whatsapp: {
    url: 'https://developers.facebook.com/apps',
    guide: [
      'En developers.facebook.com crea una app tipo "Business" y añade el producto "WhatsApp".',
      'En WhatsApp → API Setup copia el "Temporary/Permanent access token", el "Phone number ID" y el "WhatsApp Business Account ID (WABA ID)".',
      'Inventa un "Verify token" (solo letras/números/guiones, sin espacios) y pégalo aquí.',
      'IMPORTANTE: pulsa GUARDAR en este conector ANTES de verificar en Meta (la verificación compara contra lo guardado aquí).',
      'En Meta → WhatsApp → Configuration → Webhook: pega la Callback URL que te da "Probar" y el MISMO verify token, y pulsa "Verify and save".',
      'En Meta → App settings → Basic copia el App secret. Permite comprobar que cada webhook entrante fue firmado por Meta.',
      'Si Meta dice que no pudo validar el webhook: revisa que el token sea idéntico (sin espacios al final) y que ya esté guardado aquí. Puedes probar la URL en el navegador: debe responder "Verificación fallida" con el motivo.',
      'Tras verificar, suscríbete al campo "messages" y guarda.',
      'Pulsa "Registrar / renovar en WABA" en este conector. Esto ejecuta la suscripción de la app al WABA sin usar Make ni Graph API Explorer.',
      'Activa el conector y usa "Diagnosticar / enviar prueba" para validar credenciales, suscripción y entrega.'
    ],
    fields: [
      { k: 'access_token', label: 'Access token', secret: true, help: 'Token de la API de WhatsApp Cloud (Meta).', example: 'EAAG...' },
      { k: 'phone_number_id', label: 'Phone number ID', help: 'ID del número emisor (WhatsApp → API Setup).', example: '1029384756' },
      { k: 'public_number', label: 'Número público de AlexIA', help: 'Número completo con indicativo internacional que abrirán los botones wa.me. El diagnóstico lo completa automáticamente desde Meta.', example: '573001234567' },
      { k: 'verify_token', label: 'Verify token', secret: true, help: 'Clave que inventas para verificar el webhook en Meta.', example: 'mi-verify-token' },
      { k: 'business_account_id', label: 'WABA ID', help: 'ID de la cuenta de WhatsApp Business. Es obligatorio para registrar la aplicación y recibir los eventos reales del número.', example: '1122334455' },
      { k: 'app_secret', label: 'App secret', secret: true, help: 'Secreto de la app de Meta para validar que cada webhook sea auténtico.', example: 'Meta → App settings → Basic' },
      { k: 'api_version', label: 'Versión Graph API', help: 'Versión activa de Meta Graph API. Se puede actualizar sin tocar código.', example: 'v25.0' }
    ]
  },
  linkedin: {
    url: 'https://www.linkedin.com/developers/apps',
    guide: [
      'En linkedin.com/developers crea una app y asóciala a la PÁGINA de organización (ExperientIA / Tonny Dager) que quieres medir.',
      'Solicita los productos "Community Management API" (analítica de publicaciones de página).',
      'Genera un access token con los permisos r_organization_social y rw_organization_admin.',
      'Copia el URN de la organización: urn:li:organization:XXXXXX (lo ves en la URL de administración de la página o vía API).',
      'Pega el token y el URN, pulsa "Probar" y luego actívalo. Sincroniza las métricas desde el Content Studio.',
      'Importante: LinkedIn solo expone analítica de publicaciones de PÁGINA de organización, no de perfiles personales.'
    ],
    fields: [
      { k: 'access_token', label: 'Access token', secret: true, help: 'Token OAuth con permisos de analítica de organización (Community Management API).', example: 'AQV...' },
      { k: 'organization_urn', label: 'URN de la organización', help: 'Identificador de la página. Formato urn:li:organization:XXXXXX (o solo el número).', example: 'urn:li:organization:1234567' },
      { k: 'api_version', label: 'Versión de API', help: 'Versión mensual de la API de LinkedIn (AAAAMM). Déjalo así si no sabes.', example: '202401' }
    ]
  }
};

// Grupos de conectores para la UI (orden y presentación C-level).
const GROUPS = [
  { kind: 'payment', title: 'Pasarelas de pago', icon: '💳', hint: 'Cobra consultas y servicios. Solo una activa a la vez.' },
  { kind: 'ai', title: 'Inteligencia artificial (AlexIA)', icon: '✦', hint: 'El cerebro que redacta, analiza y responde. Imágenes y audio requieren OpenAI.' },
  { kind: 'voice', title: 'Voz de marca', icon: '🎙', hint: 'Narra tus recursos con tu propia voz (clonada con ElevenLabs).' },
  { kind: 'video', title: 'Video con IA', icon: '🎬', hint: 'Genera recursos en video con Google VEO.' },
  { kind: 'calendar', title: 'Agenda', icon: '📅', hint: 'Sincroniza reuniones y disponibilidad con Google Calendar.' },
  { kind: 'email', title: 'Correo', icon: '✉️', hint: 'Envía confirmaciones y recordatorios de forma confiable.' },
  { kind: 'messaging', title: 'Mensajería y bots', icon: '💬', hint: 'El mismo agente comercial en Telegram y WhatsApp: conversa, agenda y entrega diagnósticos.' },
  { kind: 'social', title: 'Redes sociales y analítica', icon: '📊', hint: 'Ingesta automática de métricas de tus publicaciones hacia el Content Studio.' }
];

export default {
  setup() {
    const items = ref([]); const error = ref(''); const loading = ref(true);
    const forms = reactive({}); const saved = reactive({}); const busy = reactive({}); const msg = reactive({});
    const testLink = reactive({}); const testDetails = reactive({}); const testEmail = ref(''); const testPhone = ref('');
    const testMessage = ref('Hola, soy AlexIA. Este es un mensaje de prueba del conector de Tonny Dager.');
    const guideOpen = reactive({}); const hintKey = ref(''); const activeKind = ref('');

    async function load() {
      loading.value = true; error.value = '';
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
      } catch (e) { error.value = 'No fue posible cargar los conectores: ' + e.message; }
      finally { loading.value = false; }
    }
    onMounted(load);

    // Conteos por grupo para la barra resumen.
    const summary = computed(() => ({
      configured: items.value.filter((c) => isConfigured(c.provider)).length,
      active: items.value.filter((c) => forms[c.provider] && forms[c.provider]._active).length,
      total: items.value.length
    }));
    const groups = computed(() => GROUPS
      .map((g) => ({ ...g, items: items.value.filter((c) => c.kind === g.kind) }))
      .filter((g) => g.items.length));
    // Chips de filtro por categoría de conector.
    const chips = computed(() => groups.value.map((g) => ({ kind: g.kind, title: g.title, icon: g.icon, count: g.items.length })));
    const visibleGroups = computed(() => activeKind.value ? groups.value.filter((g) => g.kind === activeKind.value) : groups.value);
    const waSubscription = computed(() => testDetails.whatsapp?.health?.subscription || testDetails.whatsapp?.subscription || null);

    const fieldsFor = (p) => (PROVIDERS[p] && PROVIDERS[p].fields) || [];
    const guideFor = (p) => (PROVIDERS[p] && PROVIDERS[p].guide) || [];
    const urlFor = (p) => (PROVIDERS[p] && PROVIDERS[p].url) || '#';
    const isSaved = (p, k) => !!saved[p + '.' + k];
    const isConfigured = (p) => fieldsFor(p).some((fd) => (fd.secret ? isSaved(p, fd.k) : (forms[p] && forms[p][fd.k])));
    const toggleHint = (id) => { hintKey.value = hintKey.value === id ? '' : id; };
    // Proveedores que soportan botón "Probar".
    const canTest = (p) => ['openai', 'anthropic', 'sendgrid', 'google_calendar', 'elevenlabs', 'telegram', 'whatsapp', 'veo'].includes(p);
    const testLabel = (p) => ({ google_calendar: 'Crear evento de prueba', sendgrid: 'Enviar correo de prueba',
      elevenlabs: '🔊 Probar voz', telegram: 'Registrar webhooks', whatsapp: 'Diagnosticar / enviar prueba', veo: 'Validar API key' }[p] || 'Probar');

    function connectorPayload(p) {
      const f = forms[p]; const config = {};
      fieldsFor(p).forEach((fd) => {
        const v = f[fd.k];
        if (fd.secret) { if (v && String(v).trim() !== '') config[fd.k] = v; }
        else config[fd.k] = v ?? '';
      });
      return { config, active: f._active ? 1 : 0 };
    }

    async function save(p) {
      busy[p] = true; msg[p] = '';
      try {
        await api.saveConnector(p, connectorPayload(p));
        msg[p] = 'Cambios guardados ✓'; await load();
      } catch (e) { msg[p] = 'No fue posible guardar: ' + e.message; } finally { busy[p] = false; }
    }

    async function registerWhatsAppWaba() {
      if (!forms.whatsapp?.business_account_id?.trim()) {
        msg.whatsapp = 'Escribe el WABA ID para poder registrar la aplicación.'; return;
      }
      busy.whatsapp = true; msg.whatsapp = 'Guardando y registrando la aplicación en el WABA…';
      try {
        await api.saveConnector('whatsapp', connectorPayload('whatsapp'));
        const r = await api.subscribeWhatsAppWaba(); const d = r.data || {};
        testDetails.whatsapp = { ...(testDetails.whatsapp || {}), ...d };
        msg.whatsapp = r.message || 'Suscripción WABA confirmada por Meta.';
        await load();
      } catch (e) {
        const d = e.data?.errors || {};
        if (d.subscription || d.events) {
          const sub = d.subscription?.subscription || d.subscription || null;
          testDetails.whatsapp = { ...(testDetails.whatsapp || {}), subscription: sub, registration: d.subscription, events: d.events || [] };
        }
        msg.whatsapp = 'No fue posible registrar el WABA: ' + e.message;
      } finally { busy.whatsapp = false; }
    }

    async function test(p) {
      busy[p] = true; msg[p] = 'Probando la conexión…'; testLink[p] = ''; testDetails[p] = null;
      try {
        let body;
        if (p === 'sendgrid' && testEmail.value) body = { email: testEmail.value };
        if (p === 'whatsapp') body = { phone: testPhone.value, message: testMessage.value };
        const r = await api.testConnector(p, body);
        const d = r.data || {};
        testDetails[p] = d;
        if (d.html_link) testLink[p] = d.html_link;
        if (d.webhook_url) testLink[p] = d.webhook_url;
        if (d.audio_url) new Audio(d.audio_url + '?t=' + Date.now()).play().catch(() => {});
        msg[p] = r.message || (d.ok ? ('Conexión correcta ' + (d.reply || '')) : 'Conexión correcta');
        if (p === 'whatsapp' && d.health) {
          const ph = d.health.phone || {}; const sub = d.health.subscription;
          msg[p] += ' · ' + (ph.verified_name || ph.display_phone_number || 'Número verificado');
          msg[p] += d.signature_configured ? ' · firma segura activa' : ' · falta App secret para validar firmas';
          if (sub) msg[p] += sub.ok && sub.apps?.length ? ' · app suscrita' : ' · revisar suscripción WABA';
        }
      } catch (e) { testDetails[p] = e.data?.errors || null; msg[p] = 'No fue posible probar la conexión: ' + e.message; } finally { busy[p] = false; }
    }

    return { items, error, loading, forms, busy, msg, testLink, testEmail, guideOpen, hintKey, groups, summary,
      activeKind, chips, visibleGroups, waSubscription,
      fieldsFor, guideFor, urlFor, isSaved, isConfigured, toggleHint, canTest, testLabel, save, test,
      testPhone, testMessage, testDetails, registerWhatsAppWaba };
  },
  template: `
  <div class="view">
    <div class="topbar"><div><h1>Conectores</h1><p class="topbar__sub">Integra pagos, IA, voz, video, agenda, correo y mensajería. Cada tarjeta trae su guía.</p></div></div>
    <p v-if="error" class="error">{{ error }}</p>

    <div class="cards cards--tight" v-if="!loading">
      <div class="stat stat--mini"><div class="stat__num">{{ summary.total }}</div><div class="stat__label">Conectores</div><span class="stat__period">Disponibles</span></div>
      <div class="stat stat--mini"><div class="stat__num">{{ summary.configured }}</div><div class="stat__label">Configurados</div><span class="stat__period">Con credenciales</span></div>
      <div class="stat stat--mini"><div class="stat__num">{{ summary.active }}</div><div class="stat__label">Activos</div><span class="stat__period">En uso</span></div>
    </div>

    <div v-if="loading" class="skeleton-table"><div class="skeleton-row" v-for="i in 5" :key="i" style="height:80px"></div></div>

    <template v-else>
      <div class="conn-chips">
        <button class="conn-chip" :class="{ 'conn-chip--on': activeKind === '' }" @click="activeKind = ''">Todos <span>{{ summary.total }}</span></button>
        <button class="conn-chip" v-for="ch in chips" :key="ch.kind" :class="{ 'conn-chip--on': activeKind === ch.kind }" @click="activeKind = ch.kind">
          <span aria-hidden="true">{{ ch.icon }}</span> {{ ch.title }} <span>{{ ch.count }}</span>
        </button>
      </div>

      <section class="conn-section" v-for="g in visibleGroups" :key="g.kind">
        <div class="conn-section__head"><span class="conn-section__ico">{{ g.icon }}</span>
          <div><h2>{{ g.title }}</h2><p class="conn-section__hint">{{ g.hint }}</p></div></div>
        <div class="conn-grid">
          <div class="panel conn-card" v-for="c in g.items" :key="c.provider" :class="{ 'conn-card--on': forms[c.provider]._active }">
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
              <input v-model="testEmail" type="email" autocomplete="off" placeholder="tucorreo@ejemplo.com" />
            </div>
            <div v-if="c.provider === 'whatsapp'" class="conn-wa-test">
              <div class="field"><label>Teléfono para prueba <span class="muted">(con indicativo)</span></label>
                <input v-model="testPhone" type="tel" autocomplete="off" placeholder="573001234567" /></div>
              <div class="field"><label>Mensaje de prueba</label>
                <input v-model="testMessage" type="text" autocomplete="off" /></div>
              <p class="muted" style="font-size:.78rem;margin:-3px 0 10px">Sin teléfono, el diagnóstico valida credenciales y número. Con teléfono, además realiza un envío real y muestra el error exacto de Meta.</p>
              <div class="conn-wa-sub">
                <div class="conn-wa-sub__head"><b>Suscripción de la aplicación al WABA</b>
                  <span v-if="waSubscription?.subscribed" class="pill pill--green">Registrada ✓</span>
                  <span v-else-if="waSubscription?.ok" class="pill pill--amber">Sin registrar</span>
                  <span v-else class="pill pill--blue">Pendiente de comprobar</span></div>
                <p>Conecta esta aplicación con el WABA real. El test de Meta puede llegar aunque este registro todavía falte.</p>
                <p v-if="waSubscription?.error" class="error conn-wa-sub__error">{{ waSubscription.error }}</p>
                <button type="button" class="btn btn--ghost btn--sm" @click="registerWhatsAppWaba" :disabled="busy.whatsapp || !forms.whatsapp?.business_account_id">
                  {{ waSubscription?.subscribed ? 'Renovar registro WABA' : 'Registrar / renovar en WABA' }}
                </button>
              </div>
            </div>
            <label class="switch switch--row"><input type="checkbox" v-model="forms[c.provider]._active" /><span>Activar</span></label>
            <p v-if="testLink[c.provider]" style="font-size:.82rem;margin:0 0 8px"><a :href="testLink[c.provider]" target="_blank" rel="noopener" class="link">Ver resultado ↗</a></p>
            <div v-if="c.provider==='whatsapp' && testDetails.whatsapp?.events?.length" class="conn-events">
              <b>Actividad reciente</b>
              <div v-for="ev in testDetails.whatsapp.events.slice(0,5)" :key="ev.id" class="conn-event">
                <span :class="ev.status==='failed'||ev.status==='rejected' ? 'pill pill--red' : 'pill pill--green'">{{ ev.status }}</span>
                <small>{{ ev.direction }} · {{ ev.event_type }} · {{ ev.created_at }}<template v-if="ev.error_message"><br>{{ ev.error_message }}</template></small>
              </div>
            </div>
            <div class="flex between"><span class="muted conn-msg">{{ msg[c.provider] }}</span>
              <div class="flex">
                <button v-if="canTest(c.provider)" class="btn btn--ghost btn--sm" @click="test(c.provider)" :disabled="busy[c.provider]">{{ testLabel(c.provider) }}</button>
                <button class="btn btn--sm" @click="save(c.provider)" :disabled="busy[c.provider]">Guardar</button>
              </div>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>`
};
