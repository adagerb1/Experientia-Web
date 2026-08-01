import { ref, reactive, computed, onMounted } from 'vue';
import { api } from '../api.js';

const blankKnowledge = () => ({ id: 0, source_type: 'service', source_key: '', title: '', content_md: '', keywords: '', active: true });
const blankTrigger = () => ({ id: 0, channel: 'whatsapp', trigger_type: 'keyword', trigger_value: '', campaign_key: '', knowledge_source_id: '', priority: 100, active: true });

export default {
  setup() {
    const tab = ref('profiles'); const loading = ref(true); const saving = ref(''); const error = ref(''); const notice = ref('');
    const profiles = ref([]); const bindings = ref([]); const knowledge = ref([]); const triggers = ref([]); const campaigns = ref([]);
    const sourceTypes = ref([]); const channels = ref([]); const knowledgeForm = reactive(blankKnowledge()); const triggerForm = reactive(blankTrigger());

    const commercial = computed(() => profiles.value.find((p) => p.profile_key === 'commercial'));
    const internal = computed(() => profiles.value.find((p) => p.profile_key === 'internal_analyst'));
    const labelBinding = (b) => b.channel === 'whatsapp' ? 'WhatsApp comercial' : (b.endpoint_key === 'alexia' ? 'Telegram interno' : 'Telegram comercial');
    const kbTitle = (id) => knowledge.value.find((k) => +k.id === +id)?.title || 'Fuente';

    async function load() {
      loading.value = true; error.value = '';
      try {
        const [cfg, camps] = await Promise.all([api.alexiaConfig(), api.commercialCampaigns()]);
        const d = cfg.data || {}; profiles.value = d.profiles || []; bindings.value = d.bindings || [];
        knowledge.value = d.knowledge || []; triggers.value = d.triggers || [];
        sourceTypes.value = d.options?.source_types || []; channels.value = d.options?.channels || [];
        campaigns.value = camps.data?.items || [];
      } catch (e) { error.value = e.message; }
      finally { loading.value = false; }
    }
    function flash(message) { notice.value = message; setTimeout(() => { if (notice.value === message) notice.value = ''; }, 3000); }
    async function saveProfile(profile) {
      saving.value = 'profile:' + profile.profile_key; error.value = '';
      try { await api.saveAlexiaProfile(profile.profile_key, { ...profile, active: !!+profile.active }); flash('Perfil guardado.'); await load(); }
      catch (e) { error.value = e.message; } finally { saving.value = ''; }
    }
    async function saveBinding(binding) {
      saving.value = 'binding:' + binding.channel + ':' + binding.endpoint_key; error.value = '';
      try {
        await api.saveAlexiaBinding(binding.channel, binding.endpoint_key, { ...binding, active: !!+binding.active, accepted_media: { ...binding.accepted_media } });
        flash('Política del canal guardada.'); await load();
      } catch (e) { error.value = e.message; } finally { saving.value = ''; }
    }
    function editKnowledge(row = null) {
      Object.assign(knowledgeForm, blankKnowledge(), row || {});
      knowledgeForm.active = row ? !!+row.active : true;
      knowledgeForm.keywords = Array.isArray(row?.keywords) ? row.keywords.join(', ') : (row?.keywords || '');
      tab.value = 'knowledge';
    }
    async function saveKnowledge() {
      saving.value = 'knowledge'; error.value = '';
      const payload = { ...knowledgeForm, active: !!knowledgeForm.active, keywords: knowledgeForm.keywords };
      try {
        if (knowledgeForm.id) await api.updateAlexiaKnowledge(knowledgeForm.id, payload); else await api.saveAlexiaKnowledge(payload);
        Object.assign(knowledgeForm, blankKnowledge()); flash('Fuente MD guardada.'); await load();
      } catch (e) { error.value = e.message; } finally { saving.value = ''; }
    }
    async function removeKnowledge(row) {
      if (!confirm(`¿Eliminar la fuente “${row.title}”? Los disparadores vinculados quedarán sin fuente.`)) return;
      try { await api.deleteAlexiaKnowledge(row.id); flash('Fuente eliminada.'); await load(); }
      catch (e) { error.value = e.message; }
    }
    function editTrigger(row = null) { Object.assign(triggerForm, blankTrigger(), row || {}); triggerForm.active = row ? !!+row.active : true; tab.value = 'triggers'; }
    async function saveTrigger() {
      saving.value = 'trigger'; error.value = '';
      const payload = { ...triggerForm, active: !!triggerForm.active, knowledge_source_id: triggerForm.knowledge_source_id || null };
      try {
        if (triggerForm.id) await api.updateAlexiaTrigger(triggerForm.id, payload); else await api.saveAlexiaTrigger(payload);
        Object.assign(triggerForm, blankTrigger()); flash('Disparador guardado.'); await load();
      } catch (e) { error.value = e.message; } finally { saving.value = ''; }
    }
    async function removeTrigger(row) {
      if (!confirm(`¿Eliminar el disparador “${row.trigger_value}”?`)) return;
      try { await api.deleteAlexiaTrigger(row.id); flash('Disparador eliminado.'); await load(); }
      catch (e) { error.value = e.message; }
    }
    onMounted(load);
    return { tab, loading, saving, error, notice, profiles, bindings, knowledge, triggers, campaigns, sourceTypes, channels,
      knowledgeForm, triggerForm, commercial, internal, labelBinding, kbTitle, load, saveProfile, saveBinding,
      editKnowledge, saveKnowledge, removeKnowledge, editTrigger, saveTrigger, removeTrigger };
  },
  template: `
  <div class="view view--full alexia-config-view">
    <div class="topbar"><div><h1>AlexIA · Configuración</h1><p class="topbar__sub">Gobierna su propósito, conocimiento, canales y activadores comerciales.</p></div></div>
    <p v-if="error" class="error">{{ error }}</p><p v-if="notice" class="success">{{ notice }}</p>
    <div class="tabs alexia-tabs" role="tablist">
      <button v-for="item in [['profiles','Perfiles'],['channels','Canales y medios'],['knowledge','Cerebro comercial'],['triggers','Palabras y campañas']]" :key="item[0]" :class="{ on: tab===item[0] }" @click="tab=item[0]">{{ item[1] }}</button>
    </div>
    <div v-if="loading" class="panel loading">Cargando configuración…</div>

    <template v-else-if="tab==='profiles'">
      <div class="cards cards--2">
        <div v-for="p in profiles" :key="p.profile_key" class="panel">
          <div class="flex flex--between"><div><span class="pill" :class="p.purpose==='commercial' ? 'pill--green' : 'pill--blue'">{{ p.purpose==='commercial' ? 'Cara al cliente' : 'Uso interno' }}</span><h2>{{ p.name }}</h2></div><label class="switch"><input type="checkbox" v-model="p.active" :true-value="1" :false-value="0" /><span></span></label></div>
          <div class="field"><label>Nombre del perfil</label><input v-model="p.name" maxlength="120" /></div>
          <div class="field"><label>Instrucciones rectoras</label><textarea v-model="p.instructions" rows="8" maxlength="16000"></textarea><small class="muted">No incluyas llaves, contraseñas ni datos privados.</small></div>
          <div class="field"><label>Respuesta cuando el tema está fuera de alcance</label><textarea v-model="p.off_topic_message" rows="3" maxlength="500"></textarea></div>
          <button class="btn" @click="saveProfile(p)" :disabled="saving==='profile:'+p.profile_key">{{ saving==='profile:'+p.profile_key ? 'Guardando…' : 'Guardar perfil' }}</button>
        </div>
      </div>
    </template>

    <template v-else-if="tab==='channels'">
      <div class="cards cards--3">
        <div v-for="b in bindings" :key="b.channel+':'+b.endpoint_key" class="panel">
          <div class="flex flex--between"><div><span class="pill pill--blue">{{ b.channel }}</span><h2>{{ labelBinding(b) }}</h2></div><label class="switch"><input type="checkbox" v-model="b.active" :true-value="1" :false-value="0" /><span></span></label></div>
          <div class="field"><label>Perfil asignado</label><b>{{ b.profile_key==='internal_analyst' ? 'AlexIA Analista Interna' : 'AlexIA Comercial' }}</b><small class="muted">Asignación protegida según el uso interno o de cara al cliente.</small></div>
          <fieldset class="media-policy"><legend>Mensajes aceptados</legend>
            <label><input type="checkbox" v-model="b.accepted_media.text" /> Texto</label><label><input type="checkbox" v-model="b.accepted_media.audio" /> Audio con transcripción</label>
            <label><input type="checkbox" v-model="b.accepted_media.image" /> Imágenes</label><label><input type="checkbox" v-model="b.accepted_media.document" /> Documentos</label>
          </fieldset>
          <div class="field"><label>Documentos permitidos</label><div class="check-grid"><label v-for="ext in ['pdf','doc','docx','txt','md','csv']" :key="ext"><input type="checkbox" :value="ext" v-model="b.accepted_media.document_extensions" /> .{{ ext }}</label></div></div>
          <div class="field"><label>Tamaño máximo</label><select v-model.number="b.max_file_bytes"><option :value="5242880">5 MB</option><option :value="10485760">10 MB</option><option :value="26214400">25 MB</option></select></div>
          <button class="btn" @click="saveBinding(b)" :disabled="saving==='binding:'+b.channel+':'+b.endpoint_key">{{ saving==='binding:'+b.channel+':'+b.endpoint_key ? 'Guardando…' : 'Guardar política' }}</button>
        </div>
      </div>
      <div class="panel"><b>Comportamiento seguro</b><p class="muted">Audio: se descarga, valida y transcribe. TXT, MD, CSV y DOCX: se extraen cuando el servidor puede hacerlo. PDF, DOC e imágenes: se almacenan para revisión sin que AlexIA invente su contenido. El control humano siempre pausa la respuesta automática.</p></div>
    </template>

    <template v-else-if="tab==='knowledge'">
      <div class="admin-split">
        <div class="panel">
          <div class="flex flex--between"><div><h2>Fuentes aprobadas</h2><p class="muted">Servicios, soluciones, eventos y documentos de marca.</p></div><button class="btn btn--sm" @click="editKnowledge()">Nueva fuente</button></div>
          <div v-if="!knowledge.length" class="empty">Aún no hay fuentes MD. AlexIA usa el catálogo activo y las FAQ como respaldo.</div>
          <div v-for="k in knowledge" :key="k.id" class="source-row"><div><span class="pill">{{ k.source_type }}</span><b>{{ k.title }}</b><small>{{ (k.keywords || []).join(' · ') || 'Sin palabras clave' }}</small></div><div class="flex"><button class="btn btn--ghost btn--sm" @click="editKnowledge(k)">Editar</button><button class="btn btn--ghost btn--sm" @click="removeKnowledge(k)">Eliminar</button></div></div>
        </div>
        <form class="panel" @submit.prevent="saveKnowledge"><h2>{{ knowledgeForm.id ? 'Editar fuente' : 'Nueva fuente MD' }}</h2>
          <div class="form-grid"><div class="field"><label>Tipo</label><select v-model="knowledgeForm.source_type"><option v-for="t in sourceTypes" :key="t" :value="t">{{ t }}</option></select></div><div class="field"><label>Clave</label><input v-model="knowledgeForm.source_key" placeholder="ej. consultoria-growth" /></div></div>
          <div class="field"><label>Título</label><input v-model="knowledgeForm.title" required maxlength="180" /></div>
          <div class="field"><label>Palabras clave</label><input v-model="knowledgeForm.keywords" placeholder="consultoría, growth, automatización" /></div>
          <div class="field"><label>Contenido Markdown</label><textarea v-model="knowledgeForm.content_md" rows="16" required placeholder="# Fuente oficial\n\nInformación, condiciones, precios y respuestas aprobadas…"></textarea><small class="muted">Máximo 120.000 caracteres. Esta es la fuente que AlexIA puede afirmar.</small></div>
          <label class="check"><input type="checkbox" v-model="knowledgeForm.active" /> Fuente activa</label>
          <div class="flex"><button class="btn" :disabled="saving==='knowledge'">{{ saving==='knowledge' ? 'Guardando…' : 'Guardar fuente' }}</button><button type="button" class="btn btn--ghost" @click="editKnowledge()">Limpiar</button></div>
        </form>
      </div>
    </template>

    <template v-else>
      <div class="admin-split">
        <div class="panel"><h2>Disparadores activos</h2><p class="muted">Identifican el contexto desde textos precargados, palabras de campaña o códigos de referencia.</p>
          <div v-if="!triggers.length" class="empty">Crea el primer disparador para relacionar una conversación con su campaña.</div>
          <div v-for="t in triggers" :key="t.id" class="source-row"><div><span class="pill pill--blue">{{ t.channel }} · {{ t.trigger_type }}</span><b>{{ t.trigger_value }}</b><small>{{ t.campaign_key || kbTitle(t.knowledge_source_id) }} · prioridad {{ t.priority }}</small></div><div class="flex"><button class="btn btn--ghost btn--sm" @click="editTrigger(t)">Editar</button><button class="btn btn--ghost btn--sm" @click="removeTrigger(t)">Eliminar</button></div></div>
        </div>
        <form class="panel" @submit.prevent="saveTrigger"><h2>{{ triggerForm.id ? 'Editar disparador' : 'Nuevo disparador' }}</h2>
          <div class="form-grid"><div class="field"><label>Canal</label><select v-model="triggerForm.channel"><option v-for="c in channels" :key="c" :value="c">{{ c }}</option></select></div><div class="field"><label>Tipo</label><select v-model="triggerForm.trigger_type"><option value="keyword">Palabra o frase</option><option value="prefill">Texto precargado</option><option value="referral">Código de referencia</option></select></div></div>
          <div class="field"><label>Valor que debe reconocer</label><input v-model="triggerForm.trigger_value" required maxlength="180" placeholder="Quiero información de Marketing para Vender+" /></div>
          <div class="field"><label>Campaña o evento</label><select v-model="triggerForm.campaign_key"><option value="">Sin campaña</option><option v-for="c in campaigns" :key="c.key" :value="c.key">{{ c.name }}</option></select></div>
          <div class="field"><label>Fuente específica</label><select v-model="triggerForm.knowledge_source_id"><option value="">Sin fuente adicional</option><option v-for="k in knowledge" :key="k.id" :value="k.id">{{ k.title }}</option></select></div>
          <div class="field"><label>Prioridad</label><input type="number" min="1" max="999" v-model.number="triggerForm.priority" /></div>
          <label class="check"><input type="checkbox" v-model="triggerForm.active" /> Disparador activo</label>
          <div class="flex"><button class="btn" :disabled="saving==='trigger'">{{ saving==='trigger' ? 'Guardando…' : 'Guardar disparador' }}</button><button type="button" class="btn btn--ghost" @click="editTrigger()">Limpiar</button></div>
        </form>
      </div>
    </template>
  </div>`
};
