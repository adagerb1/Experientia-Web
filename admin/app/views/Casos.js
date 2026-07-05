import { ref, reactive, computed, onMounted } from 'vue';
import { api } from '../api.js';
import Modal from '../components/Modal.js';
import RichEditor from '../components/RichEditor.js';
import DataTable from '../components/DataTable.js';
import CoverOptions from '../components/CoverOptions.js';

const SECTORS = ['Educación', 'Servicios profesionales', 'Legal', 'Salud', 'Retail', 'Formación',
  'Consultoría', 'Restaurantes', 'Empresas de servicios', 'Automatización comercial', 'Tecnología', 'Manufactura'];

export default {
  components: { Modal, RichEditor, DataTable, CoverOptions },
  setup() {
    const items = ref([]); const error = ref(''); const loading = ref(true); const saving = ref(false);
    const editing = ref(null); const slugTouched = ref(false);
    const aiOpen = ref(false); const aiBrief = ref(''); const aiBusy = ref(false); const aiMsg = ref('');
    const coverBusy = ref(false); const audioBusy = ref(false); const coverUploading = ref(false);
    const blank = () => ({ sector: SECTORS[0], title: '', slug: '', client: '', metric_value: '', metric_label: '',
      summary: '', problem: '', intervention: '', result: '', body: '', image_url: '', audio_url: '', tags: '',
      featured: 0, published: 1, position: 0 });
    const form = reactive(blank());

    async function load() {
      loading.value = true;
      try { items.value = (await api.cases()).data || []; } catch (e) { error.value = e.message; }
      finally { loading.value = false; }
    }
    onMounted(load);

    const kpis = computed(() => ({
      total: items.value.length,
      published: items.value.filter((c) => +c.published).length,
      featured: items.value.filter((c) => +c.featured).length
    }));

    const rows = computed(() => items.value.map((c) => ({ ...c, _estado: +c.published ? 'Publicado' : 'Borrador' })));
    const columns = [
      { key: 'sector', label: 'Sector', filter: true },
      { key: 'title', label: 'Título' },
      { key: 'metric_value', label: 'Métrica', width: '160px', sortable: false },
      { key: '_estado', label: 'Estado', filter: ['Publicado', 'Borrador'], width: '130px' }
    ];

    function slugify(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
    function create() { editing.value = 'new'; Object.assign(form, blank()); slugTouched.value = false; aiMsg.value = ''; }
    function edit(it) { editing.value = it.id; Object.assign(form, blank(), it); slugTouched.value = false; aiMsg.value = ''; }
    function onTitle() { if (!slugTouched.value) form.slug = slugify(form.title || form.sector); }
    function onSlug() { slugTouched.value = true; }

    async function save() {
      if (!form.sector) { error.value = 'El sector es obligatorio.'; return; }
      saving.value = true; error.value = '';
      try {
        if (editing.value === 'new') await api.saveCase({ ...form });
        else await api.updateCase(editing.value, { ...form });
        editing.value = null; await load();
      } catch (e) { error.value = e.message; } finally { saving.value = false; }
    }
    // Bloquear/publicar (paso previo a eliminar): oculta o muestra el caso en el sitio.
    async function togglePub(it) {
      try { await api.updateCase(it.id, { published: +it.published ? 0 : 1 }); await load(); }
      catch (e) { error.value = 'No fue posible cambiar el estado: ' + e.message; }
    }
    async function remove(it) {
      if (+it.published) { error.value = 'Oculta primero el caso (Ocultar) y luego podrás eliminarlo.'; return; }
      if (!confirm('Eliminar definitivamente el caso «' + (it.title || it.sector) + '». Esta acción no se puede deshacer. ¿Continuar?')) return;
      try { await api.deleteCase(it.id); await load(); } catch (e) { error.value = 'No fue posible eliminar: ' + e.message; }
    }

    // Genera el caso completo con AlexIA desde el sector + un breve.
    async function generateAI() {
      aiBusy.value = true; aiMsg.value = 'Generando con AlexIA…';
      try {
        const r = await api.alexiaCase({ sector: form.sector, client: form.client, brief: aiBrief.value });
        const d = r.data || {};
        ['title', 'problem', 'intervention', 'result', 'metric_value', 'metric_label', 'summary', 'tags', 'body']
          .forEach((k) => { if (d[k]) form[k] = d[k]; });
        if (!slugTouched.value) form.slug = slugify(form.title || form.sector);
        aiMsg.value = 'Listo ✓ — revisa y ajusta el caso.'; aiOpen.value = false;
      } catch (e) { aiMsg.value = 'AlexIA: ' + e.message; } finally { aiBusy.value = false; }
    }

    async function onCover(e) {
      const file = e.target.files[0]; if (!file) return;
      coverUploading.value = true;
      try { form.image_url = (await api.uploadImage(file)).data.url; }
      catch (err) { error.value = 'No se pudo subir la imagen: ' + err.message; }
      finally { coverUploading.value = false; e.target.value = ''; }
    }
    const coverInstructions = ref('');
    const coverOpts = reactive({ aspect: '16:9', quality: '', style: '', lighting: '', mood: '' });
    async function generateCover() {
      if (!form.title.trim() && !form.summary.trim()) { error.value = 'Escribe primero el título o el resumen.'; return; }
      coverBusy.value = true;
      try { form.image_url = (await api.alexiaCover({ title: form.title || ('Caso ' + form.sector), category: form.sector, type: 'Caso de éxito', excerpt: form.summary, body: form.result, instructions: coverInstructions.value, ...coverOpts })).data.url; }
      catch (e) { error.value = 'Imagen: ' + e.message; } finally { coverBusy.value = false; }
    }
    async function generateAudio() {
      if (editing.value === 'new') { error.value = 'Guarda el caso antes de generar el audio.'; return; }
      audioBusy.value = true;
      try { form.audio_url = (await api.alexiaAudio(editing.value, 'case')).data.url; }
      catch (e) { error.value = 'Audio: ' + e.message; } finally { audioBusy.value = false; }
    }

    return { items, rows, columns, error, loading, saving, editing, form, SECTORS, kpis, aiOpen, aiBrief, aiBusy, aiMsg,
      coverBusy, audioBusy, coverUploading, coverInstructions, coverOpts, create, edit, onTitle, onSlug, save, remove, togglePub, generateAI, onCover, generateCover, generateAudio };
  },
  template: `
  <div class="view">
    <div class="topbar"><div><h1>Casos de éxito</h1><p class="topbar__sub">Historias reales con métrica destacada. Se muestran como tarjetas interactivas en el sitio.</p></div>
      <button class="btn" @click="create">+ Nuevo caso</button></div>
    <p v-if="error" class="error">{{ error }}</p>

    <div class="cards cards--tight" v-if="!loading">
      <div class="stat stat--mini"><div class="stat__num">{{ kpis.total }}</div><div class="stat__label">Casos</div></div>
      <div class="stat stat--mini"><div class="stat__num">{{ kpis.published }}</div><div class="stat__label">Publicados</div></div>
      <div class="stat stat--mini"><div class="stat__num">{{ kpis.featured }}</div><div class="stat__label">Destacados</div></div>
    </div>

    <div v-if="loading" class="skeleton-table"><div class="skeleton-row" v-for="i in 5" :key="i"></div></div>

    <div v-else class="panel panel--flush">
      <data-table :rows="rows" :columns="columns" :page-size="15" empty-icon="★" empty-text="Aún no hay casos de éxito. Publica el primero o genéralo con AlexIA.">
        <template #empty-action><button class="btn btn--sm" @click="create">+ Crear el primer caso</button></template>
        <template #cell-sector="{ row }"><strong>{{ row.sector }}</strong><br><small class="muted">/casos/{{ row.slug }}</small></template>
        <template #cell-title="{ row }">{{ row.title || '—' }}</template>
        <template #cell-metric_value="{ row }"><span v-if="row.metric_value" class="pill pill--blue">{{ row.metric_value }}</span> <small class="muted">{{ row.metric_label }}</small></template>
        <template #cell-_estado="{ row }"><span class="pill" :class="+row.published ? 'pill--green':'pill--red'">{{ row._estado }}</span> <span v-if="+row.featured" class="pill pill--amber">Destacado</span></template>
        <template #actions="{ row }">
          <div class="row-acts">
            <a class="btn btn--sm btn--ghost" :href="'/casos/' + row.slug" target="_blank" rel="noopener" title="Ver en el sitio">Ver</a>
            <button class="btn btn--sm btn--ghost" @click="edit(row)">Editar</button>
            <button class="btn btn--sm btn--ghost" @click="togglePub(row)" :title="+row.published ? 'Ocultar del sitio' : 'Publicar'">{{ +row.published ? 'Ocultar' : 'Publicar' }}</button>
            <button class="btn btn--sm btn--ghost btn--danger" @click="remove(row)" :disabled="+row.published" :title="+row.published ? 'Oculta primero para poder eliminar' : 'Eliminar'">Eliminar</button>
          </div>
        </template>
      </data-table>
    </div>

    <modal v-if="editing" :title="editing==='new' ? 'Nuevo caso' : 'Editar caso'" wide @close="editing=null">
      <div class="ai-gen ai-gen--col" style="margin-bottom:14px">
        <label class="lbl-row">✦ Generar con AlexIA
          <button type="button" class="btn btn--sm btn--ghost" @click="aiOpen = !aiOpen">{{ aiOpen ? 'Ocultar' : 'Abrir' }}</button>
        </label>
        <template v-if="aiOpen">
          <p class="muted" style="font-size:.8rem;margin:0 0 6px">AlexIA usa el <b>sector</b> (y el cliente/brief si los das) para redactar problema, intervención, resultado, métrica y relato.</p>
          <textarea v-model="aiBrief" rows="2" placeholder="Breve del caso (opcional): qué hiciste, contexto, resultado aproximado…"></textarea>
          <button type="button" class="btn btn--sm" @click="generateAI" :disabled="aiBusy">{{ aiBusy ? 'Generando…' : '✦ Generar caso' }}</button>
        </template>
        <p v-if="aiMsg" class="muted" style="font-size:.82rem;margin:4px 0">{{ aiMsg }}</p>
      </div>

      <div class="form-grid">
        <div class="field"><label>Sector</label>
          <input v-model="form.sector" list="caso-sectors" @input="onTitle" />
          <datalist id="caso-sectors"><option v-for="s in SECTORS" :key="s" :value="s"></option></datalist>
        </div>
        <div class="field"><label>Cliente <small class="muted">(opcional / anónimo)</small></label><input v-model="form.client" placeholder="Empresa de..." /></div>
        <div class="field field--full"><label>Título</label><input v-model="form.title" @input="onTitle" placeholder="Titular del caso" /></div>
        <div class="field"><label>Slug (URL)</label><input v-model="form.slug" @input="onSlug" placeholder="mi-caso" /></div>
        <div class="field"><label>Etiquetas <small class="muted">(coma)</small></label><input v-model="form.tags" placeholder="IA, automatización, ventas" /></div>
        <div class="field"><label>Métrica destacada</label><input v-model="form.metric_value" placeholder="+38%" /></div>
        <div class="field"><label>Qué mide</label><input v-model="form.metric_label" placeholder="en conversión de ventas" /></div>
        <div class="field field--full"><label>Resumen / gancho</label><textarea v-model="form.summary" rows="2"></textarea></div>
        <div class="field field--full"><label>Problema</label><textarea v-model="form.problem" rows="2"></textarea></div>
        <div class="field field--full"><label>Intervención</label><textarea v-model="form.intervention" rows="2"></textarea></div>
        <div class="field field--full"><label>Resultado</label><textarea v-model="form.result" rows="2"></textarea></div>
        <div class="field field--full"><label>Relato completo <small class="muted">(opcional, para la página de detalle y el audio)</small></label>
          <rich-editor v-model="form.body" />
        </div>
        <div class="field field--full"><label>Imagen</label>
          <textarea v-model="coverInstructions" rows="2" style="margin-bottom:8px" placeholder="Instrucciones para la imagen (opcional): qué quieres ver, colores, escena, elementos…"></textarea>
          <cover-options :opts="coverOpts" idp="caso-cov" />
          <div class="cover-up">
            <img v-if="form.image_url" :src="form.image_url" class="cover-up__preview" alt="imagen del caso" />
            <div class="cover-up__ctrl">
              <div class="flex" style="flex-wrap:wrap;gap:8px">
                <button type="button" class="btn btn--sm" @click="generateCover" :disabled="coverBusy">{{ coverBusy ? 'Generando…' : '✦ Generar imagen' }}</button>
                <label class="cover-up__file">{{ coverUploading ? 'Subiendo…' : 'Subir imagen' }}<input type="file" accept="image/*" @change="onCover" hidden /></label>
              </div>
              <input v-model="form.image_url" placeholder="o pega una URL /assets/..." />
            </div>
          </div>
        </div>
        <div class="field field--full"><label>Audio (narración)</label>
          <div class="audio-gen">
            <button type="button" class="btn btn--sm" @click="generateAudio" :disabled="audioBusy || editing==='new'">{{ audioBusy ? 'Generando…' : '🔊 Generar audio del caso' }}</button>
            <audio v-if="form.audio_url" :src="form.audio_url" controls style="height:34px"></audio>
            <small v-if="editing==='new'" class="muted">Guarda el caso primero para generar el audio.</small>
          </div>
        </div>
        <div class="field"><label>Destacado</label><select v-model.number="form.featured"><option :value="0">No</option><option :value="1">Sí</option></select></div>
        <div class="field"><label>Orden</label><input type="number" v-model.number="form.position" /></div>
        <div class="field"><label>Estado</label><select v-model.number="form.published"><option :value="1">Publicado</option><option :value="0">Borrador</option></select></div>
      </div>

      <template #foot>
        <button class="btn btn--ghost" @click="editing=null">Cancelar</button>
        <button class="btn" @click="save" :disabled="saving">{{ saving ? 'Guardando…' : 'Guardar caso' }}</button>
      </template>
    </modal>
  </div>`
};
