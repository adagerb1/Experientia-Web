import { ref, reactive, computed, onMounted } from 'vue';
import { api } from '../api.js';
import Modal from '../components/Modal.js';

const ROUTES = ['growth', 'automation', 'ia', 'mentoria', 'conferencia', 'experientia', 'tablero_diagnostico', 'sprint_fuga_cero', 'tablero_implementacion', 'acompanamiento_mensual'];

export default {
  components: { Modal },
  setup() {
    const items = ref([]); const error = ref(''); const loading = ref(true); const editing = ref(null); const saving = ref(false);
    const blank = () => ({ name: '', slug: '', short_description: '', duration_min: 60, price: 0, currency: 'COP', modality: 'Virtual', requires_payment: 1, route_key: '', active: 1 });
    const form = reactive(blank());

    async function load() {
      loading.value = true;
      try { items.value = (await api.consultations()).data || []; } catch (e) { error.value = e.message; }
      finally { loading.value = false; }
    }
    onMounted(load);

    const money = (n, c) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: c || 'COP', maximumFractionDigits: 0 }).format(n || 0);
    const kpis = computed(() => ({
      total: items.value.length,
      active: items.value.filter((c) => +c.active).length,
      paid: items.value.filter((c) => +c.requires_payment).length
    }));

    function edit(it) { editing.value = it.id; Object.assign(form, it); }
    function create() { editing.value = 'new'; Object.assign(form, blank()); }
    async function save() {
      saving.value = true;
      try {
        if (editing.value === 'new') await api.saveConsultation({ ...form });
        else await api.updateConsultation(editing.value, { ...form });
        editing.value = null; await load();
      } catch (e) { error.value = e.message; } finally { saving.value = false; }
    }
    return { items, error, loading, editing, form, saving, ROUTES, money, kpis, edit, create, save };
  },
  template: `
  <div class="view">
    <div class="topbar"><div><h1>Consultas</h1><p class="topbar__sub">Tipos de sesión configurables, precio y disponibilidad.</p></div>
      <button class="btn" @click="create">+ Nueva consulta</button></div>
    <p v-if="error" class="error">{{ error }}</p>

    <div class="cards cards--tight" v-if="!loading">
      <div class="stat stat--mini"><div class="stat__num">{{ kpis.total }}</div><div class="stat__label">Consultas</div></div>
      <div class="stat stat--mini"><div class="stat__num">{{ kpis.active }}</div><div class="stat__label">Activas</div></div>
      <div class="stat stat--mini"><div class="stat__num">{{ kpis.paid }}</div><div class="stat__label">Con pago</div></div>
    </div>

    <div v-if="loading" class="skeleton-table"><div class="skeleton-row" v-for="i in 5" :key="i"></div></div>

    <div v-else class="panel panel--flush">
      <table class="table--rich">
        <thead><tr><th>Nombre</th><th>Duración</th><th>Precio</th><th>Pago</th><th>Ruta</th><th>Estado</th><th></th></tr></thead>
        <transition-group tag="tbody" name="row">
          <tr v-for="c in items" :key="c.id">
            <td><strong>{{ c.name }}</strong></td><td>{{ c.duration_min }} min</td><td>{{ money(c.price, c.currency) }}</td>
            <td>{{ +c.requires_payment ? 'Sí' : 'No' }}</td><td><span class="badge">{{ c.route_key || '—' }}</span></td>
            <td><span class="pill" :class="+c.active ? 'pill--green':'pill--red'">{{ +c.active ? 'Activa':'Inactiva' }}</span></td>
            <td><button class="btn btn--sm btn--ghost" @click="edit(c)">Editar</button></td>
          </tr>
          <tr v-if="!items.length" key="empty"><td colspan="7" class="muted center">Sin consultas.</td></tr>
        </transition-group>
      </table>
    </div>

    <modal v-if="editing" :title="editing === 'new' ? 'Nueva consulta' : 'Editar consulta'" @close="editing = null">
      <div class="form-grid">
        <div class="field"><label>Nombre</label><input v-model="form.name" /></div>
        <div class="field"><label>Slug</label><input v-model="form.slug" placeholder="diagnostico-..." /></div>
        <div class="field field--full"><label>Descripción corta</label><textarea v-model="form.short_description" rows="2"></textarea></div>
        <div class="field"><label>Duración (min)</label><input type="number" v-model.number="form.duration_min" /></div>
        <div class="field"><label>Precio</label><input type="number" v-model.number="form.price" /></div>
        <div class="field"><label>Moneda</label><input v-model="form.currency" /></div>
        <div class="field"><label>Modalidad</label><input v-model="form.modality" /></div>
        <div class="field"><label>Ruta asociada</label>
          <select v-model="form.route_key"><option value="">—</option><option v-for="r in ROUTES" :key="r" :value="r">{{ r }}</option></select></div>
        <div class="field"><label>Requiere pago</label>
          <select v-model.number="form.requires_payment"><option :value="1">Sí</option><option :value="0">No</option></select></div>
        <div class="field"><label>Activa</label>
          <select v-model.number="form.active"><option :value="1">Sí</option><option :value="0">No</option></select></div>
      </div>
      <template #foot>
        <button class="btn btn--ghost" @click="editing = null">Cancelar</button>
        <button class="btn" @click="save" :disabled="saving">{{ saving ? 'Guardando…' : 'Guardar' }}</button>
      </template>
    </modal>
  </div>`
};
