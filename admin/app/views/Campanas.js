import { ref, reactive, onMounted } from 'vue';
import { api } from '../api.js';

const blank = () => ({
  original_key: '', key: '', slug: '', name: '', campaign_type: 'event', status: 'draft', landing_mode: 'template',
  template_key: 'whatsapp_event', external_url: '', source_markdown: '', keywords: '', brand: 'ExperientIA × Tonny Dager',
  headline: '', lead: '', dates_label: '', schedule_label: '', location_label: '', starts_at: '', ends_at: '',
  vsl_url: '', offers_json: '{}', ctas_json: '{}',
  routing: { attendant: 'alexia', whatsapp_number: '', prefill_text: '', payment_connector_cop: 'wompi', payment_connector_foreign: '' }
});

function localDate(value) { return value ? String(value).replace(' ', 'T').slice(0, 16) : ''; }

export default {
  setup() {
    const items = ref([]); const templates = ref([]); const form = reactive(blank()); const editing = ref(false);
    const loading = ref(true); const saving = ref(false); const error = ref(''); const notice = ref('');
    async function load() {
      loading.value = true; error.value = '';
      try { const d = (await api.commercialCampaigns()).data || {}; items.value = d.items || []; templates.value = d.templates || []; }
      catch (e) { error.value = e.message; } finally { loading.value = false; }
    }
    function create() { Object.assign(form, blank()); editing.value = true; window.scrollTo({ top: 0, behavior: 'smooth' }); }
    function edit(row) {
      Object.assign(form, blank(), row, {
        original_key: row.key, keywords: Array.isArray(row.keywords) ? row.keywords.join(', ') : '',
        starts_at: localDate(row.starts_at), ends_at: localDate(row.ends_at),
        vsl_url: row.vsl_url || '', offers_json: JSON.stringify(row.offers || {}, null, 2), ctas_json: JSON.stringify(row.ctas || {}, null, 2),
        routing: { ...blank().routing, ...(row.routing || {}) }
      });
      editing.value = true; window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    function cancel() { editing.value = false; Object.assign(form, blank()); }
    async function save() {
      error.value = ''; let offers; let ctas;
      try { offers = JSON.parse(form.offers_json || '{}'); ctas = JSON.parse(form.ctas_json || '{}'); }
      catch (_) { error.value = 'La configuración de ofertas o CTA no contiene JSON válido.'; return; }
      saving.value = true;
      const payload = { ...form, keywords: form.keywords, routing: { ...form.routing }, config: { offers, ctas, vsl_url: form.vsl_url || null } };
      delete payload.original_key; delete payload.offers_json; delete payload.ctas_json;
      try {
        if (form.original_key) await api.updateCommercialCampaign(form.original_key, payload); else await api.saveCommercialCampaign(payload);
        notice.value = 'Campaña o evento guardado y disponible para AlexIA.'; cancel(); await load();
      } catch (e) { error.value = e.message; } finally { saving.value = false; }
    }
    async function remove(row) {
      if (row._source === 'code') { error.value = 'Esta campaña es el respaldo de código. Edítala para crear una personalización administrable.'; return; }
      if (!confirm(`¿Eliminar la personalización de “${row.name}”?`)) return;
      try { await api.deleteCommercialCampaign(row.key); notice.value = 'Personalización eliminada.'; await load(); }
      catch (e) { error.value = e.message; }
    }
    const statusLabel = (status) => ({ published: 'Publicada', draft: 'Borrador', paused: 'Pausada', closed: 'Cerrada' }[status] || status);
    onMounted(load);
    return { items, templates, form, editing, loading, saving, error, notice, create, edit, cancel, save, remove, statusLabel };
  },
  template: `
  <div class="view view--full campaigns-view">
    <div class="topbar"><div><h1>Campañas y eventos</h1><p class="topbar__sub">Fuente única para landing, AlexIA, WhatsApp, planes, pago y trazabilidad.</p></div><button class="btn" @click="create">Nueva campaña o evento</button></div>
    <p v-if="error" class="error">{{ error }}</p><p v-if="notice" class="success">{{ notice }}</p>

    <form v-if="editing" class="panel campaign-editor" @submit.prevent="save">
      <div class="flex flex--between"><div><span class="pill pill--blue">{{ form.original_key ? 'Edición' : 'Nuevo' }}</span><h2>{{ form.name || 'Configurar campaña o evento' }}</h2></div><button type="button" class="btn btn--ghost btn--sm" @click="cancel">Cerrar</button></div>
      <div class="form-grid form-grid--3"><div class="field"><label>Nombre</label><input v-model="form.name" required maxlength="180" /></div><div class="field"><label>Clave interna</label><input v-model="form.key" required placeholder="evento_2026" /></div><div class="field"><label>Slug público</label><input v-model="form.slug" required placeholder="nombre-del-evento" /></div></div>
      <div class="form-grid form-grid--3"><div class="field"><label>Tipo</label><select v-model="form.campaign_type"><option value="event">Evento</option><option value="webinar">Webinar</option><option value="workshop">Workshop</option><option value="program">Programa</option><option value="service">Servicio</option></select></div><div class="field"><label>Estado</label><select v-model="form.status"><option value="draft">Borrador</option><option value="published">Publicada</option><option value="paused">Pausada</option><option value="closed">Cerrada</option></select></div><div class="field"><label>Marca</label><input v-model="form.brand" /></div></div>

      <div class="panel panel--soft"><h3>Landing</h3><div class="form-grid form-grid--3"><div class="field"><label>Modo</label><select v-model="form.landing_mode"><option value="template">Plantilla administrada</option><option value="external">URL externa existente</option></select></div><div v-if="form.landing_mode==='template'" class="field"><label>Plantilla</label><select v-model="form.template_key"><option v-for="t in templates" :key="t.key" :value="t.key">{{ t.label }}</option></select></div><div v-else class="field"><label>URL externa HTTPS</label><input v-model="form.external_url" type="url" placeholder="https://…" /></div><div class="field"><label>VSL opcional (HTTPS)</label><input v-model="form.vsl_url" type="url" placeholder="https://…" /></div></div>
        <div class="field"><label>Titular</label><input v-model="form.headline" maxlength="300" /></div><div class="field"><label>Promesa / introducción</label><textarea v-model="form.lead" rows="3" maxlength="1200"></textarea></div>
      </div>

      <div class="form-grid form-grid--3"><div class="field"><label>Fecha visible</label><input v-model="form.dates_label" /></div><div class="field"><label>Horario visible</label><input v-model="form.schedule_label" /></div><div class="field"><label>Lugar o modalidad</label><input v-model="form.location_label" /></div><div class="field"><label>Inicio operativo</label><input v-model="form.starts_at" type="datetime-local" /></div><div class="field"><label>Cierre operativo</label><input v-model="form.ends_at" type="datetime-local" /></div><div class="field"><label>Palabras clave</label><input v-model="form.keywords" placeholder="evento, edición, fecha" /></div></div>

      <div class="panel panel--soft"><h3>Conversación y atención</h3><div class="form-grid form-grid--3"><div class="field"><label>Quién atiende</label><select v-model="form.routing.attendant"><option value="alexia">AlexIA</option><option value="human">Humano</option></select></div><div class="field"><label>Número para este evento</label><input v-model="form.routing.whatsapp_number" inputmode="tel" placeholder="57300… · vacío usa el general" /></div><div class="field"><label>Texto precargado</label><input v-model="form.routing.prefill_text" maxlength="500" placeholder="Hola, quiero información del evento…" /></div></div></div>

      <div class="panel panel--soft"><h3>Pagos por moneda</h3><div class="form-grid"><div class="field"><label>COP</label><select v-model="form.routing.payment_connector_cop"><option value="">Sin pasarela</option><option value="wompi">Wompi · checkout automático</option><option value="epayco">ePayco · requiere URL del plan</option></select></div><div class="field"><label>Moneda extranjera</label><select v-model="form.routing.payment_connector_foreign"><option value="">Pendiente de conectar Stripe, PayPal o Mercado Pago</option></select></div></div><p class="muted">Wompi genera un checkout firmado y concilia el pago con click_id. ePayco conserva el fallback controlado hasta configurar una URL de checkout compatible. Moneda extranjera no se presentará como operativa antes de instalar y probar su conector.</p></div>

      <div class="field"><label>Documento maestro en Markdown</label><textarea v-model="form.source_markdown" rows="18" placeholder="# Evento\n\nInformación oficial, oferta, agenda, objeciones, políticas, guiones y CTA…"></textarea><small class="muted">AlexIA usa este contenido como fuente de verdad y como base para la plantilla comercial.</small></div>
      <details class="panel panel--soft"><summary><b>Configuración avanzada de ofertas y CTA</b></summary><p class="muted">JSON administrable para precios, monedas, planes, enlaces de checkout y reglas del CTA. No guardes secretos.</p><div class="form-grid"><div class="field"><label>Ofertas / planes</label><textarea v-model="form.offers_json" rows="14" spellcheck="false"></textarea></div><div class="field"><label>Reglas CTA</label><textarea v-model="form.ctas_json" rows="14" spellcheck="false"></textarea></div></div></details>
      <div class="save-bar"><span class="muted">First-mobile: un CTA principal, estados de carga y fallbacks honestos.</span><button class="btn" :disabled="saving">{{ saving ? 'Guardando…' : 'Guardar configuración' }}</button></div>
    </form>

    <div v-if="loading" class="panel loading">Cargando campañas…</div>
    <div v-else class="campaign-grid">
      <article v-for="c in items" :key="c.key" class="panel campaign-card"><div class="flex flex--between"><span class="pill" :class="c.status==='published' ? 'pill--green' : 'pill--amber'">{{ statusLabel(c.status) }}</span><small class="muted">{{ c._source==='database' ? 'Administrable' : 'Respaldo seguro' }}</small></div><h2>{{ c.name }}</h2><p>{{ c.headline || c.lead }}</p><dl><dt>Fecha</dt><dd>{{ c.dates_label || c.starts_at || 'Por definir' }}</dd><dt>Landing</dt><dd>{{ c.landing_mode==='external' ? 'URL externa' : (c.template_key || 'Plantilla actual') }}</dd><dt>Atención</dt><dd>{{ c.routing?.attendant==='human' ? 'Humano' : 'AlexIA' }}</dd><dt>Conocimiento</dt><dd>{{ c.source_markdown ? 'MD configurado' : 'Pendiente de MD' }}</dd></dl><div class="flex"><button class="btn btn--sm" @click="edit(c)">Configurar</button><a v-if="c.status==='published'" class="btn btn--ghost btn--sm" :href="c.external_url || ('/'+c.slug)" target="_blank" rel="noopener">Abrir landing</a><button v-if="c._source==='database'" class="btn btn--ghost btn--sm" @click="remove(c)">Eliminar ajuste</button></div></article>
    </div>
  </div>`
};
