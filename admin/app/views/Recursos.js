import { ref, reactive, computed, onMounted } from 'vue';
import { api } from '../api.js';
import Modal from '../components/Modal.js';
import RichEditor from '../components/RichEditor.js';
import DataTable from '../components/DataTable.js';

const TYPES = ['Artículo', 'Guía', 'Checklist', 'Ebook', 'Plantilla', 'Video'];
const CATEGORIES = ['IA aplicada a negocios', 'Automatización', 'Growth', 'Estrategia', 'Marketing estratégico',
  'CRM', 'Ventas', 'Experiencia de cliente', 'Agentes inteligentes', 'Datos y analítica', 'Liderazgo', 'Transformación digital'];

export default {
  components: { Modal, RichEditor, DataTable },
  setup() {
    const items = ref([]); const error = ref(''); const loading = ref(true); const saving = ref(false);
    const editing = ref(null); const captures = ref(null); const capData = ref([]);
    const coverUploading = ref(false); const coverBusy = ref(false); const audioBusy = ref(false);
    const coverPreview = ref(''); const previewBusy = ref(false);
    const slugTouched = ref(false); const docUploading = ref(false);
    const DOWNLOAD_TYPES = ['Guía', 'Ebook', 'Plantilla'];
    const aiOpen = ref(false); const aiInstructions = ref(''); const aiBusy = ref(false); const aiMsg = ref('');
    const blank = () => ({ type: 'Artículo', title: '', slug: '', category: CATEGORIES[0], categories: [], author: 'Tonny Dager', read_min: 5,
      excerpt: '', body: '', cover_url: '', gated: 0, file_url: '', cta_label: '', email_subject: '', email_body: '',
      seo_title: '', seo_desc: '', featured: 0, published: 1, audio_url: '', video_url: '' });
    const form = reactive(blank());
    // Normaliza las categorías guardadas (texto separado por coma) a array.
    const splitCats = (it) => {
      if (Array.isArray(it.categories)) return it.categories;
      const raw = (it.categories || it.category || '').toString();
      return raw.split(',').map((s) => s.trim()).filter(Boolean);
    };
    const toggleCat = (c) => {
      const i = form.categories.indexOf(c);
      if (i >= 0) form.categories.splice(i, 1); else form.categories.push(c);
    };

    async function load() {
      loading.value = true;
      try { items.value = (await api.resources()).data || []; } catch (e) { error.value = e.message; }
      finally { loading.value = false; }
    }
    onMounted(load);

    const kpis = computed(() => ({
      total: items.value.length,
      gated: items.value.filter((r) => +r.gated).length,
      captures: items.value.reduce((a, r) => a + (Number(r.captures) || 0), 0)
    }));

    // Filas y columnas para la tabla (orden, filtros y paginación).
    const rows = computed(() => items.value.map((r) => ({
      ...r, _acceso: +r.gated ? 'Con captura' : 'Abierto', _estado: +r.published ? 'Publicado' : 'Borrador'
    })));
    const columns = [
      { key: 'title', label: 'Título' },
      { key: 'type', label: 'Tipo', filter: true, width: '110px' },
      { key: 'category', label: 'Categoría', filter: true },
      { key: '_acceso', label: 'Acceso', filter: ['Con captura', 'Abierto'], width: '130px' },
      { key: 'captures', label: 'Capturas', align: 'center', width: '100px', sortValue: (r) => Number(r.captures) || 0 },
      { key: '_estado', label: 'Estado', filter: ['Publicado', 'Borrador'], width: '120px' }
    ];

    function slugify(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
    function create() { editing.value = 'new'; Object.assign(form, blank()); slugTouched.value = false; coverPreview.value = ''; }
    function edit(it) { editing.value = it.id; Object.assign(form, blank(), it); form.categories = splitCats(it); slugTouched.value = false; coverPreview.value = ''; }
    // El slug se genera automáticamente desde el título mientras no lo edites a mano.
    function onTitle() { if (!slugTouched.value) form.slug = slugify(form.title); }
    function onSlug() { slugTouched.value = true; }
    async function save() {
      if (!form.title || !form.slug) { error.value = 'Título y slug son obligatorios.'; return; }
      saving.value = true; error.value = '';
      try {
        if (editing.value === 'new') await api.saveResource({ ...form });
        else await api.updateResource(editing.value, { ...form });
        editing.value = null; await load();
      } catch (e) { error.value = e.message; } finally { saving.value = false; }
    }
    async function remove(it) {
      if (!confirm('¿Eliminar «' + it.title + '»?')) return;
      try { await api.deleteResource(it.id); await load(); } catch (e) { error.value = e.message; }
    }
    async function openCaptures(it) {
      captures.value = it; capData.value = [];
      try { capData.value = (await api.resourceLeads(it.id)).data || []; } catch (e) { error.value = e.message; }
    }

    async function onCover(e) {
      const file = e.target.files[0]; if (!file) return;
      coverUploading.value = true;
      try { form.cover_url = (await api.uploadImage(file)).data.url; }
      catch (err) { error.value = 'No se pudo subir la portada: ' + err.message; }
      finally { coverUploading.value = false; e.target.value = ''; }
    }

    // Genera el artículo con el contexto del formulario y llena resumen + SEO.
    async function generateAI() {
      if (!form.title.trim()) { aiMsg.value = 'Escribe primero el título.'; return; }
      aiBusy.value = true; aiMsg.value = 'Generando con AlexIA…';
      try {
        const r = await api.alexiaResource({
          title: form.title, type: form.type, category: form.category, author: form.author,
          read_min: form.read_min, excerpt: form.excerpt, instructions: aiInstructions.value
        });
        const d = r.data || {};
        if (d.html) form.body = d.html;
        if (d.excerpt) form.excerpt = d.excerpt;
        if (d.seo_title) form.seo_title = d.seo_title;
        if (d.seo_desc) form.seo_desc = d.seo_desc;
        aiMsg.value = 'Listo ✓ — se generó contenido, resumen y SEO. Revísalo.'; aiOpen.value = false;
      } catch (e) { aiMsg.value = 'AlexIA: ' + e.message; }
      finally { aiBusy.value = false; }
    }

    // Genera la portada con IA (optimizada para web).
    async function generateCover() {
      if (!form.title.trim()) { error.value = 'Escribe primero el título.'; return; }
      coverBusy.value = true;
      try { form.cover_url = (await api.alexiaCover(coverCtx())).data.url; coverPreview.value = ''; }
      catch (e) { error.value = 'Portada: ' + e.message; }
      finally { coverBusy.value = false; }
    }

    const coverInstructions = ref(''); const lightbox = ref('');
    function coverCtx() { return { title: form.title, category: form.category, type: form.type, excerpt: form.excerpt, body: form.body, instructions: coverInstructions.value }; }

    // Previsualiza el estilo de portada (candidato) antes de fijarla.
    async function previewCover() {
      if (!form.title.trim()) { error.value = 'Escribe primero el título.'; return; }
      previewBusy.value = true;
      try { coverPreview.value = (await api.alexiaCover(coverCtx())).data.url; }
      catch (e) { error.value = 'Portada: ' + e.message; }
      finally { previewBusy.value = false; }
    }

    // El recurso necesita adjuntar documento si es descargable o de tipo guía/ebook/plantilla.
    const needsDoc = computed(() => +form.gated === 1 || DOWNLOAD_TYPES.includes(form.type));
    async function onDoc(e) {
      const file = e.target.files[0]; if (!file) return;
      docUploading.value = true; error.value = '';
      try { form.file_url = (await api.uploadDoc(file)).data.url; if (!+form.gated) form.gated = 1; }
      catch (err) { error.value = 'Documento: ' + err.message; }
      finally { docUploading.value = false; e.target.value = ''; }
    }
    function useCoverPreview() { form.cover_url = coverPreview.value; coverPreview.value = ''; }
    function discardCoverPreview() { coverPreview.value = ''; }

    // Genera el audio (narración) del recurso; requiere que esté guardado.
    async function generateAudio() {
      if (editing.value === 'new') { error.value = 'Guarda el recurso antes de generar el audio.'; return; }
      audioBusy.value = true;
      try { form.audio_url = (await api.alexiaAudio(editing.value)).data.url; }
      catch (e) { error.value = 'Audio: ' + e.message; }
      finally { audioBusy.value = false; }
    }

    // ---- Video con IA (VEO): es asíncrono; se inicia y luego se consulta. ----
    const videoBusy = ref(false); const videoOp = ref(''); const videoMsg = ref('');
    const videoOpts = reactive({ aspect: '16:9', resolution: '', style: '', lighting: '', mood: '' });
    async function generateVideo() {
      videoBusy.value = true; videoMsg.value = 'Iniciando generación (puede tardar 1-3 min)…';
      try {
        // Se envía el ARTÍCULO COMPLETO (como en el audio) + las opciones de estilo.
        const r = await api.alexiaVideo({
          title: form.title, excerpt: form.excerpt, body: form.body,
          aspect: videoOpts.aspect, resolution: videoOpts.resolution,
          style: videoOpts.style, lighting: videoOpts.lighting, mood: videoOpts.mood
        });
        videoOp.value = r.data.operation || '';
        videoMsg.value = 'Generando video… pulsa "Consultar estado" en ~1 min.';
      } catch (e) { videoMsg.value = e.message; } finally { videoBusy.value = false; }
    }
    async function checkVideo() {
      if (!videoOp.value) return;
      videoBusy.value = true; videoMsg.value = 'Consultando…';
      try {
        const r = await api.alexiaVideoStatus(videoOp.value, editing.value !== 'new' ? editing.value : null);
        const d = r.data || {};
        if (!d.done) { videoMsg.value = 'Aún generando… vuelve a consultar en ~30s.'; }
        else if (d.error) { videoMsg.value = 'Error: ' + d.error; }
        else if (d.url) { form.video_url = d.url; videoOp.value = ''; videoMsg.value = 'Video listo ✓'; }
      } catch (e) { videoMsg.value = 'Video: ' + e.message; } finally { videoBusy.value = false; }
    }

    return { items, rows, columns, error, loading, saving, editing, form, TYPES, CATEGORIES, kpis, captures, capData,
      coverUploading, coverBusy, audioBusy, coverPreview, previewBusy, docUploading, needsDoc, aiOpen, aiInstructions, aiBusy, aiMsg,
      create, edit, onTitle, onSlug, onDoc, save, remove, openCaptures, onCover, generateAI, generateCover, generateAudio,
      previewCover, useCoverPreview, discardCoverPreview, toggleCat,
      videoBusy, videoOp, videoMsg, videoOpts, generateVideo, checkVideo,
      coverInstructions, lightbox };
  },
  template: `
  <div class="view">
    <div class="topbar"><div><h1>Recursos & Blog</h1><p class="topbar__sub">Artículos y descargables con captura de lead y entrega por correo.</p></div>
      <button class="btn" @click="create">+ Nuevo recurso</button></div>
    <p v-if="error" class="error">{{ error }}</p>

    <div class="cards cards--tight" v-if="!loading">
      <div class="stat stat--mini"><div class="stat__num">{{ kpis.total }}</div><div class="stat__label">Recursos</div></div>
      <div class="stat stat--mini"><div class="stat__num">{{ kpis.gated }}</div><div class="stat__label">Descargables (gated)</div></div>
      <div class="stat stat--mini"><div class="stat__num">{{ kpis.captures }}</div><div class="stat__label">Capturas totales</div></div>
    </div>

    <div v-if="loading" class="skeleton-table"><div class="skeleton-row" v-for="i in 5" :key="i"></div></div>

    <div v-else class="panel panel--flush">
      <data-table :rows="rows" :columns="columns" :page-size="15" empty-text="Aún no hay recursos.">
        <template #cell-title="{ row }"><strong>{{ row.title }}</strong><br><small class="muted">/recursos/{{ row.slug }}</small></template>
        <template #cell-type="{ row }">{{ row.type }}</template>
        <template #cell-category="{ row }">{{ row.categories || row.category || '—' }}</template>
        <template #cell-_acceso="{ row }"><span class="pill" :class="+row.gated ? 'pill--amber':'pill--blue'">{{ row._acceso }}</span></template>
        <template #cell-captures="{ row }"><a v-if="+row.captures" class="link" @click.prevent="openCaptures(row)" href="#">{{ row.captures }}</a><span v-else class="muted">0</span></template>
        <template #cell-_estado="{ row }"><span class="pill" :class="+row.published ? 'pill--green':'pill--red'">{{ row._estado }}</span></template>
        <template #actions="{ row }"><button class="btn btn--sm btn--ghost" @click="edit(row)">Editar</button><button class="btn btn--sm btn--ghost" @click="remove(row)">✕</button></template>
      </data-table>
    </div>

    <modal v-if="editing" :title="editing==='new' ? 'Nuevo recurso' : 'Editar recurso'" wide @close="editing=null">
      <div class="form-grid">
        <div class="field"><label>Título</label><input v-model="form.title" @input="onTitle" /></div>
        <div class="field"><label>Slug (URL) <small class="muted">se genera del título</small></label><input v-model="form.slug" @input="onSlug" placeholder="mi-articulo" /></div>
        <div class="field"><label>Tipo</label><select v-model="form.type"><option v-for="t in TYPES" :key="t" :value="t">{{ t }}</option></select></div>
        <div class="field field--full"><label>Categorías <small class="muted">(elige una o varias)</small></label>
          <div class="cat-picker">
            <button type="button" class="cat-chip" v-for="c in CATEGORIES" :key="c" :class="{ 'cat-chip--on': form.categories.includes(c) }" @click="toggleCat(c)">{{ c }}</button>
          </div>
        </div>
        <div class="field"><label>Autor</label><input v-model="form.author" /></div>
        <div class="field"><label>Minutos de lectura</label><input type="number" v-model.number="form.read_min" /></div>
        <div class="field field--full"><label>Resumen (excerpt)</label><textarea v-model="form.excerpt" rows="2" placeholder="Lo llena AlexIA o escríbelo tú."></textarea></div>
        <div class="field field--full">
          <label class="lbl-row">Contenido
            <button type="button" class="btn btn--sm btn--ghost" @click="aiOpen = !aiOpen">✦ Generar con AlexIA</button>
          </label>
          <div v-if="aiOpen" class="ai-gen ai-gen--col">
            <p class="muted" style="font-size:.8rem;margin:0 0 6px">AlexIA usará el <b>título, tipo, categoría, autor y minutos</b>. Añade instrucciones extra (opcional) y generará el <b>contenido, el resumen y el SEO</b>.</p>
            <textarea v-model="aiInstructions" rows="2" placeholder="Instrucciones adicionales (enfoque, ejemplos, tono, llamado a la acción…)"></textarea>
            <button type="button" class="btn btn--sm" @click="generateAI" :disabled="aiBusy">{{ aiBusy ? 'Generando…' : '✦ Generar artículo + resumen + SEO' }}</button>
          </div>
          <p v-if="aiMsg" class="muted" style="font-size:.82rem;margin:4px 0">{{ aiMsg }}</p>
          <rich-editor v-model="form.body" />
        </div>
        <div class="field field--full"><label>Imagen de portada</label>
          <textarea v-model="coverInstructions" rows="2" style="margin-bottom:8px" placeholder="Instrucciones para la imagen (opcional): qué quieres ver, colores, escena, elementos…"></textarea>
          <div class="cover-up">
            <img v-if="form.cover_url" :src="form.cover_url" class="cover-up__preview cover-up__preview--zoom" alt="portada" @click="lightbox = form.cover_url" title="Clic para ampliar" />
            <div class="cover-up__ctrl">
              <div class="flex" style="flex-wrap:wrap;gap:8px">
                <button type="button" class="btn btn--ghost btn--sm" @click="previewCover" :disabled="previewBusy || coverBusy">{{ previewBusy ? 'Generando…' : '👁 Previsualizar estilo' }}</button>
                <button type="button" class="btn btn--sm" @click="generateCover" :disabled="coverBusy || previewBusy">{{ coverBusy ? 'Generando…' : '✦ Generar portada' }}</button>
                <label class="cover-up__file">Subir imagen<input type="file" accept="image/jpeg,image/png,image/webp" @change="onCover" hidden /></label>
              </div>
              <input v-model="form.cover_url" placeholder="o pega una URL /assets/..." />
              <small class="muted">JPG, PNG o WebP · máx. 10 MB · se optimiza a 1200×630 px (horizontal), ligera para web.</small>
            </div>
          </div>
          <div v-if="coverPreview" class="cover-candidate">
            <img :src="coverPreview" alt="previsualización de estilo" class="cover-up__preview--zoom" @click="lightbox = coverPreview" title="Clic para ampliar" />
            <div class="cover-candidate__actions">
              <p class="muted" style="font-size:.82rem;margin:0">Previsualización. Haz clic en la imagen para verla en grande. ¿La usamos como portada?</p>
              <div class="flex">
                <button type="button" class="btn btn--sm" @click="useCoverPreview">Usar como portada</button>
                <button type="button" class="btn btn--ghost btn--sm" @click="previewCover" :disabled="previewBusy">Generar otra</button>
                <button type="button" class="btn btn--ghost btn--sm" @click="discardCoverPreview">Descartar</button>
              </div>
            </div>
          </div>
        </div>
        <div class="field field--full"><label>Audio (narración)</label>
          <div class="audio-gen">
            <button type="button" class="btn btn--sm" @click="generateAudio" :disabled="audioBusy || editing==='new'">{{ audioBusy ? 'Generando…' : '🔊 Generar audio del artículo' }}</button>
            <audio v-if="form.audio_url" :src="form.audio_url" controls style="height:34px"></audio>
            <small v-if="editing==='new'" class="muted">Guarda el recurso primero para generar el audio.</small>
          </div>
          <small class="muted">Si activas ElevenLabs, el audio usará tu voz de marca.</small>
        </div>
        <div class="field field--full"><label>Video con IA (VEO)</label>
          <div class="vid-opts">
            <label>Formato<select v-model="videoOpts.aspect"><option value="16:9">16:9 (horizontal)</option><option value="9:16">9:16 (vertical / reel)</option></select></label>
            <label>Calidad<select v-model="videoOpts.resolution"><option value="">Auto</option><option value="720p">720p</option><option value="1080p">1080p</option></select></label>
            <label>Estilo<input v-model="videoOpts.style" placeholder="Ej. cinematográfico corporativo" /></label>
            <label>Iluminación<input v-model="videoOpts.lighting" placeholder="Ej. natural cálida" /></label>
            <label>Ambiente<input v-model="videoOpts.mood" placeholder="Ej. inspirador, dinámico" /></label>
          </div>
          <div class="audio-gen" style="margin-top:10px">
            <button type="button" class="btn btn--sm" @click="generateVideo" :disabled="videoBusy || (!form.title && !form.body)">{{ videoBusy ? '…' : '🎬 Generar video del artículo' }}</button>
            <button type="button" class="btn btn--ghost btn--sm" v-if="videoOp" @click="checkVideo" :disabled="videoBusy">Consultar estado</button>
            <span v-if="videoMsg" class="muted" style="font-size:.82rem">{{ videoMsg }}</span>
          </div>
          <small class="muted">Se envía todo el artículo al modelo para que el video refleje el contenido completo. La generación tarda 1-3 min.</small>
          <video v-if="form.video_url" :src="form.video_url" controls style="max-width:100%;border-radius:10px;margin-top:8px"></video>
          <input v-model="form.video_url" placeholder="o pega una URL de video" style="margin-top:8px" />
        </div>
        <div class="field"><label>¿Requiere captura de lead?</label><select v-model.number="form.gated"><option :value="0">No (artículo abierto)</option><option :value="1">Sí (descargable)</option></select></div>
      </div>

      <div v-if="needsDoc" class="gate-fields">
        <h3 class="h2-ico-row"><span class="h2-ico">$</span> Documento a entregar</h3>
        <div class="cover-up" style="margin-bottom:10px">
          <div class="cover-up__ctrl">
            <label class="cover-up__file">{{ docUploading ? 'Subiendo…' : '📎 Subir documento (PDF, Excel, Word…)' }}<input type="file" accept=".pdf,.xlsx,.xls,.docx,.doc,.pptx,.csv,.zip" @change="onDoc" hidden /></label>
            <input v-model="form.file_url" placeholder="o pega una URL /assets/docs/..." />
            <small class="muted" v-if="form.file_url">Adjunto: <a :href="form.file_url" target="_blank" rel="noopener" class="link">{{ form.file_url }}</a></small>
            <small class="muted" v-else>Sube el archivo o pega su URL. Máx 25 MB.</small>
          </div>
        </div>
        <div class="form-grid">
          <div class="field"><label>Texto del botón</label><input v-model="form.cta_label" placeholder="Descargar la guía" /></div>
        </div>
        <p class="hint">La descarga inicia al instante tras capturar el lead (el recurso queda como "descargable").</p>
      </div>

      <div class="gate-fields">
        <h3 class="h2-ico-row"><span class="h2-ico">◎</span> SEO y publicación</h3>
        <div class="form-grid">
          <div class="field"><label>SEO título</label><input v-model="form.seo_title" /></div>
          <div class="field"><label>SEO descripción</label><input v-model="form.seo_desc" /></div>
          <div class="field"><label>Destacado</label><select v-model.number="form.featured"><option :value="0">No</option><option :value="1">Sí</option></select></div>
          <div class="field"><label>Estado</label><select v-model.number="form.published"><option :value="1">Publicado</option><option :value="0">Borrador</option></select></div>
        </div>
      </div>

      <template #foot>
        <button class="btn btn--ghost" @click="editing=null">Cancelar</button>
        <button class="btn" @click="save" :disabled="saving">{{ saving ? 'Guardando…' : 'Guardar recurso' }}</button>
      </template>
    </modal>

    <modal v-if="captures" :title="'Capturas · ' + captures.title" @close="captures=null">
      <table class="table--rich">
        <thead><tr><th>Nombre</th><th>Email</th><th>WhatsApp</th><th>Fecha</th></tr></thead>
        <tbody>
          <tr v-for="c in capData" :key="c.id"><td>{{ c.name || '—' }}</td><td>{{ c.email }}</td><td>{{ c.whatsapp || '—' }}</td><td class="muted">{{ (c.created_at||'').slice(0,16) }}</td></tr>
          <tr v-if="!capData.length"><td colspan="4" class="muted center">Sin capturas aún.</td></tr>
        </tbody>
      </table>
    </modal>

    <div v-if="lightbox" class="lightbox" @click="lightbox=''">
      <img :src="lightbox" alt="Portada ampliada" />
      <button class="lightbox__close" @click="lightbox=''" aria-label="Cerrar">✕</button>
    </div>
  </div>`
};
