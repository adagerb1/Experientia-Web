import { ref, reactive, computed, onMounted } from 'vue';
import { api } from '../api.js';
import Modal from '../components/Modal.js';
import Help from '../components/Help.js';

const ROUTES = ['growth', 'automation', 'ia', 'mentoria', 'conferencia', 'experientia', 'tablero_diagnostico', 'sprint_fuga_cero', 'tablero_implementacion', 'acompanamiento_mensual'];

export default {
  components: { Modal, Help },
  setup() {
    const items = ref([]); const error = ref(''); const loading = ref(true); const editing = ref(null); const saving = ref(false);
    const blank = () => ({ name: '', slug: '', short_description: '', duration_min: 60, price: 0, currency: 'COP', modality: 'Virtual', requires_payment: 1, route_key: '', active: 1, position: 0 });
    const form = reactive(blank());
    const reordering = ref(false);

    async function load() {
      loading.value = true; error.value = '';
      try { items.value = (await api.consultations()).data || []; } catch (e) { error.value = 'No fue posible cargar las consultas: ' + e.message; }
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
    function create() {
      editing.value = 'new'; Object.assign(form, blank());
      form.position = items.value.length ? Math.max(...items.value.map((c) => +c.position || 0)) + 1 : 1;
    }

    // Reordena: intercambia la posición con el vecino y persiste ambos.
    async function move(index, dir) {
      const j = index + dir;
      if (j < 0 || j >= items.value.length || reordering.value) return;
      reordering.value = true;
      const a = items.value[index], b = items.value[j];
      const pa = +a.position || 0, pb = +b.position || 0;
      // Si empatan (todas en 0), asigna posiciones por su orden actual antes de intercambiar.
      const posA = pa === pb ? index : pa, posB = pa === pb ? j : pb;
      try {
        await api.updateConsultation(a.id, { position: posB });
        await api.updateConsultation(b.id, { position: posA });
        await load();
      } catch (e) { error.value = 'No fue posible reordenar: ' + e.message; } finally { reordering.value = false; }
    }
    async function save() {
      saving.value = true; error.value = '';
      try {
        if (editing.value === 'new') await api.saveConsultation({ ...form });
        else await api.updateConsultation(editing.value, { ...form });
        editing.value = null; await load();
      } catch (e) { error.value = 'No fue posible guardar la consulta: ' + e.message; } finally { saving.value = false; }
    }
    return { items, error, loading, editing, form, saving, reordering, ROUTES, money, kpis, edit, create, save, move };
  },
  template: `
  <div class="view">
    <div class="topbar"><div><h1>Consultas</h1><p class="topbar__sub">Tipos de sesión configurables, precio y disponibilidad.</p></div>
      <button class="btn" @click="create">+ Nueva consulta</button></div>
    <p v-if="error" class="error">{{ error }}</p>

    <div class="cards cards--tight" v-if="!loading">
      <div class="stat stat--mini"><div class="stat__num">{{ kpis.total }}</div><div class="stat__label">Consultas</div><span class="stat__period">Configuradas</span></div>
      <div class="stat stat--mini"><div class="stat__num">{{ kpis.active }}</div><div class="stat__label">Activas</div><span class="stat__period">Visibles en el sitio</span></div>
      <div class="stat stat--mini"><div class="stat__num">{{ kpis.paid }}</div><div class="stat__label">Con pago</div><span class="stat__period">Requieren cobro</span></div>
    </div>

    <div v-if="loading" class="skeleton-table"><div class="skeleton-row" v-for="i in 5" :key="i"></div></div>

    <div v-else class="panel panel--flush">
      <p class="hint" style="margin:0 0 10px">El orden de esta lista es el que verán los visitantes en el sitio. Usa ↑ ↓ para reordenar.</p>
      <table class="table--rich">
        <thead><tr><th style="width:70px">Orden</th><th>Nombre</th><th>Duración</th><th>Precio</th><th>Pago</th><th>Ruta</th><th>Estado</th><th></th></tr></thead>
        <transition-group tag="tbody" name="row">
          <tr v-for="(c, i) in items" :key="c.id">
            <td>
              <div class="ord-ctrl">
                <button class="ord-btn" @click="move(i,-1)" :disabled="i===0 || reordering" title="Subir">↑</button>
                <button class="ord-btn" @click="move(i,1)" :disabled="i===items.length-1 || reordering" title="Bajar">↓</button>
              </div>
            </td>
            <td><strong>{{ c.name }}</strong></td><td>{{ c.duration_min }} min</td><td>{{ money(c.price, c.currency) }}</td>
            <td>{{ +c.requires_payment ? 'Sí' : 'No' }}</td><td><span class="badge">{{ c.route_key || '—' }}</span></td>
            <td><span class="pill" :class="+c.active ? 'pill--green':'pill--red'">{{ +c.active ? 'Activa':'Inactiva' }}</span></td>
            <td><button class="btn btn--sm btn--ghost" @click="edit(c)">Editar</button></td>
          </tr>
          <tr v-if="!items.length" key="empty"><td colspan="8">
            <div class="dt__empty">
              <span class="dt__empty-ico">✦</span>
              <p>Aún no hay tipos de consulta. Crea el primero para ofrecerlo en el sitio.</p>
              <button class="btn btn--sm" @click="create">+ Crear la primera consulta</button>
            </div>
          </td></tr>
        </transition-group>
      </table>
    </div>

    <modal v-if="editing" :title="editing === 'new' ? 'Nueva consulta' : 'Editar consulta'" @close="editing = null">
      <div class="form-grid">
        <div class="field"><label>Nombre <help text="Nombre visible de la sesión en el sitio y en la reserva. Ej.: «Lectura estratégica» o «Diagnóstico Tablero»." /></label><input v-model="form.name" /></div>
        <div class="field"><label>Slug <help text="Identificador para la URL (sin espacios ni tildes). Ej.: diagnostico-tablero. Debe ser único." /></label><input v-model="form.slug" placeholder="diagnostico-..." /></div>
        <div class="field field--full"><label>Descripción corta <help text="Una o dos líneas que explican el valor de la sesión. Aparece bajo el nombre en la agenda del sitio." /></label><textarea v-model="form.short_description" rows="2"></textarea></div>
        <div class="field"><label>Duración (min) <help text="Minutos que dura la sesión. Define el tamaño de los espacios disponibles en la agenda." /></label><input type="number" v-model.number="form.duration_min" /></div>
        <div class="field"><label>Precio <help text="Valor a cobrar por la sesión. Usa 0 si es gratuita (ver «Requiere pago»)." /></label><input type="number" v-model.number="form.price" /></div>
        <div class="field"><label>Moneda <help text="Código de la moneda del precio. Ej.: COP, USD." /></label><input v-model="form.currency" /></div>
        <div class="field"><label>Modalidad <help text="Cómo se realiza la sesión: Virtual, Presencial o Híbrida." /></label><input v-model="form.modality" /></div>
        <div class="field"><label>Ruta asociada <help text="Conecta esta consulta con una de tus rutas de servicio (growth, automation, tablero_diagnostico…). El microdiagnóstico del sitio recomienda una ruta a cada lead; la consulta con esa misma ruta es la que se le ofrece para agendar. También ayuda a atribuir el recorrido diagnóstico → ruta → reserva. Déjala vacía si esta sesión no pertenece a una ruta específica." /></label>
          <select v-model="form.route_key"><option value="">— Sin ruta —</option><option v-for="r in ROUTES" :key="r" :value="r">{{ r }}</option></select></div>
        <div class="field"><label>Requiere pago <help text="Sí = el lead debe pagar para confirmar la reserva (usa la pasarela activa). No = reserva gratuita." /></label>
          <select v-model.number="form.requires_payment"><option :value="1">Sí</option><option :value="0">No</option></select></div>
        <div class="field"><label>Activa <help text="Sí = visible y reservable en el sitio. No = oculta (no se ofrece), sin borrarla." /></label>
          <select v-model.number="form.active"><option :value="1">Sí</option><option :value="0">No</option></select></div>
        <div class="field"><label>Orden de presentación <help text="Número que define la posición en la lista del sitio (menor aparece primero). También puedes reordenar con las flechas ↑ ↓." /></label><input type="number" v-model.number="form.position" /></div>
      </div>
      <template #foot>
        <button class="btn btn--ghost" @click="editing = null">Cancelar</button>
        <button class="btn" @click="save" :disabled="saving">{{ saving ? 'Guardando…' : 'Guardar' }}</button>
      </template>
    </modal>
  </div>`
};
