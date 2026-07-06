import { ref, reactive, computed, onMounted } from 'vue';
import { api } from '../api.js';
import Modal from '../components/Modal.js';
import DataTable from '../components/DataTable.js';
import Help from '../components/Help.js';

export default {
  components: { Modal, DataTable, Help },
  setup() {
    const items = ref([]); const roles = ref([]); const error = ref(''); const loading = ref(true);
    const editing = ref(null); const saving = ref(false); const msg = ref('');
    const blank = () => ({ name: '', email: '', role_id: '', active: 1, password: '' });
    const form = reactive(blank());
    const roleLabelOf = (u) => u.role_label || u.role_name || '—';
    const rows = computed(() => items.value.map((u) => ({ ...u, _role: roleLabelOf(u), _estado: +u.active ? 'Activo' : 'Bloqueado' })));
    const columns = [
      { key: 'name', label: 'Nombre' },
      { key: 'email', label: 'Correo' },
      { key: '_role', label: 'Rol', filter: true, width: '160px' },
      { key: 'last_login_at', label: 'Último acceso', width: '150px', sortValue: (r) => r.last_login_at || '' },
      { key: '_estado', label: 'Estado', filter: ['Activo', 'Bloqueado'], width: '120px' }
    ];

    async function load() {
      loading.value = true; error.value = '';
      try {
        items.value = (await api.users()).data || [];
        roles.value = (await api.roles()).data.roles || [];
      } catch (e) { error.value = 'No fue posible cargar los usuarios: ' + e.message; } finally { loading.value = false; }
    }
    onMounted(load);

    function create() { editing.value = 'new'; Object.assign(form, blank()); msg.value = ''; }
    function edit(u) { editing.value = u.id; Object.assign(form, { name: u.name, email: u.email, role_id: u.role_id || '', active: +u.active, password: '' }); msg.value = ''; }
    async function save() {
      if (!form.name.trim() || !form.email.trim()) { error.value = 'Nombre y correo son obligatorios.'; return; }
      saving.value = true; error.value = '';
      try {
        if (editing.value === 'new') await api.saveUser({ ...form });
        else await api.updateUser(editing.value, { ...form });
        editing.value = null; await load();
      } catch (e) { error.value = 'No fue posible guardar el usuario: ' + e.message; } finally { saving.value = false; }
    }
    async function toggle(u) {
      try { await api.toggleUser(u.id); await load(); } catch (e) { error.value = 'No fue posible cambiar el estado del usuario: ' + e.message; }
    }
    const fmtDate = (d) => d ? d.slice(0, 16).replace('T', ' ') : 'Nunca';

    return { items, rows, columns, roles, error, loading, editing, form, saving, msg, create, edit, save, toggle, fmtDate };
  },
  template: `
  <div class="view view--full">
    <div class="topbar"><div><h1>Usuarios</h1><p class="topbar__sub">Accesos al panel. Crea, edita y bloquea usuarios; asigna su rol.</p></div>
      <button class="btn" @click="create">+ Nuevo usuario</button></div>
    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="loading" class="skeleton-table"><div class="skeleton-row" v-for="i in 4" :key="i" style="height:60px"></div></div>

    <div v-else class="panel panel--flush">
      <data-table :rows="rows" :columns="columns" :page-size="20" empty-icon="👤" empty-text="Aún no hay usuarios del panel. Crea el primero y asígnale un rol.">
        <template #empty-action><button class="btn btn--sm" @click="create">+ Crear el primer usuario</button></template>
        <template #cell-name="{ row }"><strong>{{ row.name }}</strong></template>
        <template #cell-email="{ row }"><span class="muted">{{ row.email }}</span></template>
        <template #cell-_role="{ row }"><span class="pill pill--blue">{{ row._role }}</span></template>
        <template #cell-last_login_at="{ row }"><span class="muted">{{ fmtDate(row.last_login_at) }}</span></template>
        <template #cell-_estado="{ row }"><span class="pill" :class="+row.active ? 'pill--green':'pill--red'">{{ row._estado }}</span></template>
        <template #actions="{ row }">
          <div class="row-acts">
            <button class="btn btn--sm btn--ghost" @click="edit(row)">Editar</button>
            <button class="btn btn--sm btn--ghost" :class="{ 'btn--danger': +row.active }" @click="toggle(row)">{{ +row.active ? 'Bloquear' : 'Activar' }}</button>
          </div>
        </template>
      </data-table>
    </div>

    <modal v-if="editing" :title="editing==='new' ? 'Nuevo usuario' : 'Editar usuario'" @close="editing=null">
      <div class="form-grid">
        <div class="field"><label>Nombre <help text="Nombre de la persona que usará el panel. Aparece en la barra superior y en la auditoría." /></label><input v-model="form.name" /></div>
        <div class="field"><label>Correo <help text="Correo con el que inicia sesión. Debe ser único." /></label><input v-model="form.email" type="email" /></div>
        <div class="field"><label>Rol <help text="Define qué módulos y acciones puede ver y hacer. «Sin rol» da acceso total (úsalo solo para administradores). Gestiona los roles en «Roles y permisos»." /></label>
          <select v-model="form.role_id"><option value="">— Sin rol (acceso total) —</option><option v-for="r in roles" :key="r.id" :value="r.id">{{ r.label }}</option></select></div>
        <div class="field"><label>Estado <help text="Activo = puede entrar al panel. Bloqueado = conserva su cuenta e historial pero no puede iniciar sesión (alternativa segura a eliminar)." /></label><select v-model.number="form.active"><option :value="1">Activo</option><option :value="0">Bloqueado</option></select></div>
        <div class="field field--full"><label>{{ editing==='new' ? 'Contraseña' : 'Nueva contraseña (dejar vacío para no cambiar)' }} <help text="Mínimo 8 caracteres. Al editar, déjala vacía para conservar la contraseña actual." /></label>
          <input v-model="form.password" type="password" autocomplete="new-password" placeholder="Mínimo 8 caracteres" /></div>
      </div>
      <template #foot>
        <button class="btn btn--ghost" @click="editing=null">Cancelar</button>
        <button class="btn" @click="save" :disabled="saving">{{ saving ? 'Guardando…' : 'Guardar' }}</button>
      </template>
    </modal>
  </div>`
};
