import { ref, reactive, onMounted } from 'vue';
import { api } from '../api.js';

export default {
  setup() {
    const items = ref([]); const error = ref(''); const loading = ref(true); const editing = ref(null);
    const blank = () => ({ name: '', slug: '', short_description: '', duration_min: 60, price: 0, currency: 'COP', modality: 'Virtual', requires_payment: 1, route_key: '', active: 1 });
    const form = reactive(blank());

    async function load() {
      loading.value = true;
      try { items.value = (await api.consultations()).data; } catch (e) { error.value = e.message; }
      finally { loading.value = false; }
    }
    function edit(it) { editing.value = it.id; Object.assign(form, it); }
    function create() { editing.value = 'new'; Object.assign(form, blank()); }
    async function save() {
      try {
        if (editing.value === 'new') await api.saveConsultation({ ...form });
        else await api.updateConsultation(editing.value, { ...form });
        editing.value = null; await load();
      } catch (e) { error.value = e.message; }
    }
    onMounted(load);
    return { items, error, loading, editing, form, edit, create, save };
  },
  template: `
  <div>
    <div class="topbar"><h1>Consultas</h1><button class="btn" @click="create">+ Nueva consulta</button></div>
    <p v-if="error" class="error">{{ error }}</p>
    <div v-if="loading" class="loading">Cargando…</div>
    <div v-else class="panel">
      <table>
        <thead><tr><th>Nombre</th><th>Duración</th><th>Precio</th><th>Pago</th><th>Ruta</th><th>Activa</th><th></th></tr></thead>
        <tbody>
          <tr v-for="c in items" :key="c.id">
            <td>{{ c.name }}</td><td>{{ c.duration_min }} min</td><td>{{ c.price }} {{ c.currency }}</td>
            <td>{{ +c.requires_payment ? 'Sí' : 'No' }}</td><td>{{ c.route_key || '—' }}</td>
            <td><span class="badge" :class="+c.active ? 'badge--green':'badge--red'">{{ +c.active ? 'Activa':'Inactiva' }}</span></td>
            <td><button class="btn btn--sm btn--ghost" @click="edit(c)">Editar</button></td>
          </tr>
          <tr v-if="!items.length"><td colspan="7" class="muted">Sin consultas.</td></tr>
        </tbody>
      </table>
    </div>

    <template v-if="editing">
      <div class="drawer-bg" @click="editing=null"></div>
      <aside class="drawer">
        <h2>{{ editing === 'new' ? 'Nueva consulta' : 'Editar consulta' }}</h2>
        <div class="field"><label>Nombre</label><input v-model="form.name" /></div>
        <div class="field"><label>Slug</label><input v-model="form.slug" placeholder="diagnostico-..." /></div>
        <div class="field"><label>Descripción corta</label><textarea v-model="form.short_description"></textarea></div>
        <div class="field"><label>Duración (min)</label><input type="number" v-model.number="form.duration_min" /></div>
        <div class="field"><label>Precio</label><input type="number" v-model.number="form.price" /></div>
        <div class="field"><label>Moneda</label><input v-model="form.currency" /></div>
        <div class="field"><label>Ruta asociada</label>
          <select v-model="form.route_key">
            <option value="">—</option>
            <option v-for="r in ['growth','automation','ia','mentoria','conferencia','experientia']" :key="r" :value="r">{{ r }}</option>
          </select>
        </div>
        <div class="field"><label>Requiere pago</label>
          <select v-model.number="form.requires_payment"><option :value="1">Sí</option><option :value="0">No</option></select></div>
        <div class="field"><label>Activa</label>
          <select v-model.number="form.active"><option :value="1">Sí</option><option :value="0">No</option></select></div>
        <div class="flex"><button class="btn" @click="save">Guardar</button><button class="btn btn--ghost" @click="editing=null">Cancelar</button></div>
      </aside>
    </template>
  </div>`
};
