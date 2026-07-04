import { ref, reactive, onMounted } from 'vue';
import { api } from '../api.js';
import Modal from '../components/Modal.js';

export default {
  components: { Modal },
  setup() {
    const items = ref([]); const roles = ref([]); const error = ref(''); const loading = ref(true);
    const editing = ref(null); const saving = ref(false); const msg = ref('');
    const blank = () => ({ name: '', email: '', role_id: '', active: 1, password: '' });
    const form = reactive(blank());

    async function load() {
      loading.value = true;
      try {
        items.value = (await api.users()).data || [];
        roles.value = (await api.roles()).data.roles || [];
      } catch (e) { error.value = e.message; } finally { loading.value = false; }
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
      } catch (e) { error.value = e.message; } finally { saving.value = false; }
    }
    async function toggle(u) {
      try { await api.toggleUser(u.id); await load(); } catch (e) { error.value = e.message; }
    }
    const roleLabel = (u) => u.role_label || u.role_name || '—';
    const fmtDate = (d) => d ? d.slice(0, 16).replace('T', ' ') : 'Nunca';

    return { items, roles, error, loading, editing, form, saving, msg, create, edit, save, toggle, roleLabel, fmtDate };
  },
  template: `
  <div class="view view--narrow">
    <div class="topbar"><div><h1>Usuarios</h1><p class="topbar__sub">Accesos al panel. Crea, edita y bloquea usuarios; asigna su rol.</p></div>
      <button class="btn" @click="create">+ Nuevo usuario</button></div>
    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="loading" class="skeleton-table"><div class="skeleton-row" v-for="i in 4" :key="i" style="height:60px"></div></div>

    <div v-else class="panel panel--flush">
      <table class="table--rich">
        <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th>Último acceso</th><th>Estado</th><th></th></tr></thead>
        <tbody>
          <tr v-for="u in items" :key="u.id">
            <td><strong>{{ u.name }}</strong></td>
            <td class="muted">{{ u.email }}</td>
            <td><span class="pill pill--blue">{{ roleLabel(u) }}</span></td>
            <td class="muted">{{ fmtDate(u.last_login_at) }}</td>
            <td><span class="pill" :class="+u.active ? 'pill--green':'pill--red'">{{ +u.active ? 'Activo':'Bloqueado' }}</span></td>
            <td class="flex">
              <button class="btn btn--sm btn--ghost" @click="edit(u)">Editar</button>
              <button class="btn btn--sm btn--ghost" @click="toggle(u)">{{ +u.active ? 'Bloquear' : 'Activar' }}</button>
            </td>
          </tr>
          <tr v-if="!items.length"><td colspan="6" class="muted center">Sin usuarios.</td></tr>
        </tbody>
      </table>
    </div>

    <modal v-if="editing" :title="editing==='new' ? 'Nuevo usuario' : 'Editar usuario'" @close="editing=null">
      <div class="form-grid">
        <div class="field"><label>Nombre</label><input v-model="form.name" /></div>
        <div class="field"><label>Correo</label><input v-model="form.email" type="email" /></div>
        <div class="field"><label>Rol</label>
          <select v-model="form.role_id"><option value="">— Sin rol (acceso total) —</option><option v-for="r in roles" :key="r.id" :value="r.id">{{ r.label }}</option></select></div>
        <div class="field"><label>Estado</label><select v-model.number="form.active"><option :value="1">Activo</option><option :value="0">Bloqueado</option></select></div>
        <div class="field field--full"><label>{{ editing==='new' ? 'Contraseña' : 'Nueva contraseña (dejar vacío para no cambiar)' }}</label>
          <input v-model="form.password" type="password" autocomplete="new-password" placeholder="Mínimo 8 caracteres" /></div>
      </div>
      <template #foot>
        <button class="btn btn--ghost" @click="editing=null">Cancelar</button>
        <button class="btn" @click="save" :disabled="saving">{{ saving ? 'Guardando…' : 'Guardar' }}</button>
      </template>
    </modal>
  </div>`
};
