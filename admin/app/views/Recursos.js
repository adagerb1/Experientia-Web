import { ref, reactive, computed, onMounted } from 'vue';
import { api } from '../api.js';
import Modal from '../components/Modal.js';
import RichEditor from '../components/RichEditor.js';

const TYPES = ['Artículo', 'Guía', 'Checklist', 'Ebook', 'Plantilla', 'Video'];

export default {
  components: { Modal, RichEditor },
  setup() {
    const items = ref([]); const error = ref(''); const loading = ref(true); const saving = ref(false);
    const editing = ref(null); const captures = ref(null); const capData = ref([]);
    const coverUploading = ref(false); const aiOpen = ref(false); const aiTopic = ref(''); const aiBusy = ref(false); const aiMsg = ref('');
    const blank = () => ({ type: 'Artículo', title: '', slug: '', category: '', author: 'Tonny Dager', read_min: 5,
      excerpt: '', body: '', cover_url: '', gated: 0, file_url: '', cta_label: '', email_subject: '', email_body: '',
      seo_title: '', seo_desc: '', featured: 0, published: 1 });
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

    async function generateAI() {
      if (!aiTopic.value.trim()) return;
      aiBusy.value = true; aiMsg.value = '';
      try {
        const prompt = `Escribe un artículo de blog sobre: "${aiTopic.value.trim()}". Tipo: ${form.type}. Público: empresarios y líderes.`;
        const r = await api.alexia(prompt, 'article');
        if (r.data && r.data.html) { form.body = r.data.html; aiMsg.value = 'Artículo generado ✓ (revísalo y ajústalo)'; aiOpen.value = false; }
      } catch (e) { aiMsg.value = 'AlexIA: ' + e.message; }
      finally { aiBusy.value = false; }
    }

    return { items, error, loading, saving, editing, form, TYPES, kpis, captures, capData,
      coverUploading, aiOpen, aiTopic, aiBusy, aiMsg,
      create, edit, onTitle, save, remove, openCaptures, onCover, generateAI };
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
        <div class="field"><label>Categoría</label><input v-model="form.category" /></div>
        <div class="field"><label>Autor</label><input v-model="form.author" /></div>
        <div class="field"><label>Minutos de lectura</label><input type="number" v-model.number="form.read_min" /></div>
        <div class="field field--full"><label>Resumen (excerpt)</label><textarea v-model="form.excerpt" rows="2"></textarea></div>
        <div class="field field--full">
          <label class="lbl-row">Contenido
            <button type="button" class="btn btn--sm btn--ghost" @click="aiOpen = !aiOpen">✦ Generar con AlexIA</button>
          </label>
          <div v-if="aiOpen" class="ai-gen">
            <input v-model="aiTopic" placeholder="Tema del artículo (ej. cómo elegir tu primer caso de uso de IA)" @keyup.enter="generateAI" />
            <button type="button" class="btn btn--sm" @click="generateAI" :disabled="aiBusy">{{ aiBusy ? 'Generando…' : 'Generar' }}</button>
          </div>
          <p v-if="aiMsg" class="muted" style="font-size:.82rem;margin:4px 0">{{ aiMsg }}</p>
          <rich-editor v-model="form.body" />
        </div>
        <div class="field field--full"><label>Imagen de portada</label>
          <div class="cover-up">
            <img v-if="form.cover_url" :src="form.cover_url" class="cover-up__preview" alt="portada" />
            <div class="cover-up__ctrl">
              <input type="file" accept="image/*" @change="onCover" />
              <input v-model="form.cover_url" placeholder="o pega una URL /assets/..." />
              <small class="muted">Recomendado: 1200×630 px (JPG/PNG/WEBP, máx 5 MB).</small>
            </div>
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
