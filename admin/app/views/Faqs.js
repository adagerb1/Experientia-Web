import { ref, reactive, onMounted } from 'vue';
import { api } from '../api.js';
import Modal from '../components/Modal.js';

export default {
  components: { Modal },
  setup() {
    const items = ref([]); const error = ref(''); const loading = ref(true); const saving = ref(false);
    const editing = ref(null); const reordering = ref(false);
    const blank = () => ({ question: '', answer: '', category: '', published: 1, position: 0 });
    const form = reactive(blank());

    async function load() {
      loading.value = true;
      try { items.value = (await api.faqs()).data || []; } catch (e) { error.value = e.message; }
      finally { loading.value = false; }
    }
    onMounted(load);

    function create() { editing.value = 'new'; Object.assign(form, blank()); form.position = items.value.length + 1; }
    function edit(it) { editing.value = it.id; Object.assign(form, it); }
    async function save() {
      if (!form.question.trim()) { error.value = 'Escribe la pregunta.'; return; }
      saving.value = true; error.value = '';
      try {
        if (editing.value === 'new') await api.saveFaq({ ...form });
        else await api.updateFaq(editing.value, { ...form });
        editing.value = null; await load();
      } catch (e) { error.value = e.message; } finally { saving.value = false; }
    }
    async function remove(it) { if (!confirm('¿Eliminar esta pregunta?')) return; await api.deleteFaq(it.id); await load(); }
    async function move(i, dir) {
      const j = i + dir; if (j < 0 || j >= items.value.length || reordering.value) return;
      reordering.value = true;
      const a = items.value[i], b = items.value[j];
      try { await api.updateFaq(a.id, { position: +b.position || j }); await api.updateFaq(b.id, { position: +a.position || i }); await load(); }
      catch (e) { error.value = e.message; } finally { reordering.value = false; }
    }

    return { items, error, loading, saving, editing, form, reordering, create, edit, save, remove, move };
  },
  template: `
  <div class="view view--narrow">
    <div class="topbar"><div><h1>Preguntas frecuentes</h1><p class="topbar__sub">Refuerzan tu SEO y GEO. Se muestran en el sitio con datos estructurados (FAQPage).</p></div>
      <button class="btn" @click="create">+ Nueva pregunta</button></div>
    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="loading" class="skeleton-table"><div class="skeleton-row" v-for="i in 5" :key="i" style="height:60px"></div></div>

    <div v-else class="panel panel--flush">
      <table class="table--rich">
        <thead><tr><th style="width:70px">Orden</th><th>Pregunta</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          <tr v-for="(f, i) in items" :key="f.id">
            <td><div class="ord-ctrl">
              <button class="ord-btn" @click="move(i,-1)" :disabled="i===0 || reordering">↑</button>
              <button class="ord-btn" @click="move(i,1)" :disabled="i===items.length-1 || reordering">↓</button>
            </div></td>
            <td><strong>{{ f.question }}</strong><br><small class="muted">{{ (f.answer||'').slice(0,90) }}{{ (f.answer||'').length>90?'…':'' }}</small></td>
            <td><span class="pill" :class="+f.published ? 'pill--green':'pill--red'">{{ +f.published ? 'Publicada':'Oculta' }}</span></td>
            <td class="flex"><button class="btn btn--sm btn--ghost" @click="edit(f)">Editar</button><button class="btn btn--sm btn--ghost" @click="remove(f)">✕</button></td>
          </tr>
          <tr v-if="!items.length"><td colspan="4" class="muted center">Aún no hay preguntas.</td></tr>
        </tbody>
      </table>
    </div>

    <modal v-if="editing" :title="editing==='new' ? 'Nueva pregunta' : 'Editar pregunta'" @close="editing=null">
      <div class="form-grid">
        <div class="field field--full"><label>Pregunta</label><input v-model="form.question" placeholder="¿…?" /></div>
        <div class="field field--full"><label>Respuesta</label><textarea v-model="form.answer" rows="5" placeholder="Respuesta clara y directa (ayuda al SEO/GEO)."></textarea></div>
        <div class="field"><label>Categoría <small class="muted">(opcional)</small></label><input v-model="form.category" placeholder="Ej. Servicios" /></div>
        <div class="field"><label>Estado</label><select v-model.number="form.published"><option :value="1">Publicada</option><option :value="0">Oculta</option></select></div>
      </div>
      <template #foot>
        <button class="btn btn--ghost" @click="editing=null">Cancelar</button>
        <button class="btn" @click="save" :disabled="saving">{{ saving ? 'Guardando…' : 'Guardar' }}</button>
      </template>
    </modal>
  </div>`
};
