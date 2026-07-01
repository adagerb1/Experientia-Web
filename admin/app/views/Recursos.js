import { ref, reactive, computed, onMounted } from 'vue';
import { api } from '../api.js';
import Modal from '../components/Modal.js';
import RichEditor from '../components/RichEditor.js';

const TYPES = ['Artículo', 'Guía', 'Checklist', 'Ebook', 'Plantilla', 'Video'];
const CATEGORIES = ['IA aplicada a negocios', 'Automatización', 'Growth', 'Estrategia', 'Marketing estratégico',
  'CRM', 'Ventas', 'Experiencia de cliente', 'Agentes inteligentes', 'Datos y analítica', 'Liderazgo', 'Transformación digital'];

export default {
  components: { Modal, RichEditor },
  setup() {
    const items = ref([]); const error = ref(''); const loading = ref(true); const saving = ref(false);
    const editing = ref(null); const captures = ref(null); const capData = ref([]);
    const coverUploading = ref(false); const coverBusy = ref(false); const audioBusy = ref(false);
    const coverPreview = ref(''); const previewBusy = ref(false);
    const aiOpen = ref(false); const aiInstructions = ref(''); const aiBusy = ref(false); const aiMsg = ref('');
    const blank = () => ({ type: 'Artículo', title: '', slug: '', category: CATEGORIES[0], author: 'Tonny Dager', read_min: 5,
      excerpt: '', body: '', cover_url: '', gated: 0, file_url: '', cta_label: '', email_subject: '', email_body: '',
      seo_title: '', seo_desc: '', featured: 0, published: 1, audio_url: '' });
    const form = reactive(blank());

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

    function slugify(s) { return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''); }
    function create() { editing.value = 'new'; Object.assign(form, blank()); }
    function edit(it) { editing.value = it.id; Object.assign(form, blank(), it); }
    function onTitle() { if (editing.value === 'new' && !form.slug) form.slug = slugify(form.title); }
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
      try { form.cover_url = (await api.alexiaCover({ title: form.title, category: form.category })).data.url; coverPreview.value = ''; }
      catch (e) { error.value = 'Portada: ' + e.message; }
      finally { coverBusy.value = false; }
    }

    // Previsualiza el estilo de portada (candidato) antes de fijarla.
    async function previewCover() {
      if (!form.title.trim()) { error.value = 'Escribe primero el título.'; return; }
      previewBusy.value = true;
      try { coverPreview.value = (await api.alexiaCover({ title: form.title, category: form.category })).data.url; }
      catch (e) { error.value = 'Portada: ' + e.message; }
      finally { previewBusy.value = false; }
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

    return { items, error, loading, saving, editing, form, TYPES, CATEGORIES, kpis, captures, capData,
      coverUploading, coverBusy, audioBusy, coverPreview, previewBusy, aiOpen, aiInstructions, aiBusy, aiMsg,
      create, edit, onTitle, save, remove, openCaptures, onCover, generateAI, generateCover, generateAudio,
      previewCover, useCoverPreview, discardCoverPreview };
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
      <table class="table--rich">
        <thead><tr><th>Título</th><th>Tipo</th><th>Categoría</th><th>Tipo acceso</th><th>Capturas</th><th>Estado</th><th></th></tr></thead>
        <transition-group tag="tbody" name="row">
          <tr v-for="r in items" :key="r.id">
            <td><strong>{{ r.title }}</strong><br><small class="muted">/recursos/{{ r.slug }}</small></td>
            <td>{{ r.type }}</td><td>{{ r.category || '—' }}</td>
            <td><span class="pill" :class="+r.gated ? 'pill--amber':'pill--blue'">{{ +r.gated ? 'Con captura' : 'Abierto' }}</span></td>
            <td><a v-if="+r.captures" class="link" @click.prevent="openCaptures(r)" href="#">{{ r.captures }}</a><span v-else class="muted">0</span></td>
            <td><span class="pill" :class="+r.published ? 'pill--green':'pill--red'">{{ +r.published ? 'Publicado':'Borrador' }}</span></td>
            <td class="flex"><button class="btn btn--sm btn--ghost" @click="edit(r)">Editar</button><button class="btn btn--sm btn--ghost" @click="remove(r)">✕</button></td>
          </tr>
          <tr v-if="!items.length" key="empty"><td colspan="7" class="muted center">Aún no hay recursos.</td></tr>
        </transition-group>
      </table>
    </div>

    <modal v-if="editing" :title="editing==='new' ? 'Nuevo recurso' : 'Editar recurso'" wide @close="editing=null">
      <div class="form-grid">
        <div class="field"><label>Título</label><input v-model="form.title" @input="onTitle" /></div>
        <div class="field"><label>Slug (URL)</label><input v-model="form.slug" placeholder="mi-articulo" /></div>
        <div class="field"><label>Tipo</label><select v-model="form.type"><option v-for="t in TYPES" :key="t" :value="t">{{ t }}</option></select></div>
        <div class="field"><label>Categoría</label><select v-model="form.category"><option v-for="c in CATEGORIES" :key="c" :value="c">{{ c }}</option></select></div>
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
          <div class="cover-up">
            <img v-if="form.cover_url" :src="form.cover_url" class="cover-up__preview" alt="portada" />
            <div class="cover-up__ctrl">
              <div class="flex" style="flex-wrap:wrap;gap:8px">
                <button type="button" class="btn btn--ghost btn--sm" @click="previewCover" :disabled="previewBusy || coverBusy">{{ previewBusy ? 'Generando…' : '👁 Previsualizar estilo' }}</button>
                <button type="button" class="btn btn--sm" @click="generateCover" :disabled="coverBusy || previewBusy">{{ coverBusy ? 'Generando…' : '✦ Generar portada' }}</button>
                <label class="cover-up__file">Subir imagen<input type="file" accept="image/*" @change="onCover" hidden /></label>
              </div>
              <input v-model="form.cover_url" placeholder="o pega una URL /assets/..." />
              <small class="muted">Se genera/optimiza a 1200×630 px, ligera para web.</small>
            </div>
          </div>
          <div v-if="coverPreview" class="cover-candidate">
            <img :src="coverPreview" alt="previsualización de estilo" />
            <div class="cover-candidate__actions">
              <p class="muted" style="font-size:.82rem;margin:0">Previsualización de estilo. ¿La usamos como portada?</p>
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
        </div>
        <div class="field"><label>¿Requiere captura de lead?</label><select v-model.number="form.gated"><option :value="0">No (artículo abierto)</option><option :value="1">Sí (descargable)</option></select></div>
      </div>

      <div v-if="+form.gated" class="gate-fields">
        <h3 class="h2-ico-row"><span class="h2-ico">$</span> Descarga directa</h3>
        <div class="form-grid">
          <div class="field field--full"><label>Archivo a entregar (URL del PDF)</label><input v-model="form.file_url" placeholder="/assets/docs/mi-guia.pdf" /></div>
          <div class="field"><label>Texto del botón</label><input v-model="form.cta_label" placeholder="Descargar la guía" /></div>
        </div>
        <p class="hint">La descarga inicia al instante tras capturar el lead. El archivo debe estar subido en <code>/assets/docs/</code>.</p>
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
  </div>`
};
