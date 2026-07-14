import { ref, reactive, onMounted } from 'vue';
import { api } from '../api.js';
import Modal from '../components/Modal.js';
import Help from '../components/Help.js';

export default {
  components: { Modal, Help },
  setup() {
    const roles = ref([]); const catalog = ref({}); const error = ref(''); const loading = ref(true);
    const editing = ref(null); const saving = ref(false);
    const form = reactive({ label: '', permissions: [] });

    async function load() {
      loading.value = true;
      try { const d = (await api.roles()).data || {}; roles.value = d.roles || []; catalog.value = d.catalog || {}; }
      catch (e) { error.value = 'No fue posible cargar los roles: ' + e.message; } finally { loading.value = false; }
    }
    onMounted(load);

    function create() { editing.value = 'new'; Object.assign(form, { label: '', permissions: [] }); }
    function edit(r) { editing.value = r.id; Object.assign(form, { label: r.label, permissions: [...(r.permissions || [])], is_admin: r.is_admin }); }
    const has = (p) => form.permissions.includes(p);
    const toggle = (p) => { const i = form.permissions.indexOf(p); if (i >= 0) form.permissions.splice(i, 1); else form.permissions.push(p); };
    function toggleGroup(keys) {
      const all = keys.every((k) => form.permissions.includes(k));
      keys.forEach((k) => { const i = form.permissions.indexOf(k); if (all && i >= 0) form.permissions.splice(i, 1); else if (!all && i < 0) form.permissions.push(k); });
    }
    async function save() {
      if (!form.label.trim()) { error.value = 'Ponle un nombre al rol.'; return; }
      saving.value = true; error.value = '';
      try {
        if (editing.value === 'new') await api.saveRole({ label: form.label, permissions: form.permissions });
        else await api.updateRole(editing.value, { label: form.label, permissions: form.permissions });
        editing.value = null; await load();
      } catch (e) { error.value = 'No fue posible guardar el rol: ' + e.message; } finally { saving.value = false; }
    }
    async function remove(r) {
      if (r.is_admin) return;
      if (!confirm('¿Eliminar el rol «' + r.label + '»?')) return;
      try { await api.deleteRole(r.id); await load(); } catch (e) { error.value = 'No fue posible eliminar el rol: ' + e.message; }
    }

    return { roles, catalog, error, loading, editing, form, saving, create, edit, save, remove, has, toggle, toggleGroup };
  },
  template: `
  <div class="view view--narrow">
    <div class="topbar"><div><h1>Roles y permisos</h1><p class="topbar__sub">Define qué puede ver y hacer cada rol dentro del panel.</p></div>
      <button class="btn" @click="create">+ Nuevo rol</button></div>
    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="loading" class="skeleton-table"><div class="skeleton-row" v-for="i in 3" :key="i" style="height:64px"></div></div>

    <div v-else class="role-grid">
      <div class="panel role-card" v-for="r in roles" :key="r.id">
        <div class="flex between">
          <div><strong>{{ r.label }}</strong> <span class="pill" v-if="r.is_admin">Admin</span>
            <p class="muted" style="font-size:.8rem;margin:2px 0 0">{{ r.users }} usuario(s)</p></div>
          <div class="flex"><button class="btn btn--sm btn--ghost" @click="edit(r)">{{ r.is_admin ? 'Ver' : 'Editar' }}</button>
            <button v-if="!r.is_admin" class="btn btn--sm btn--ghost" @click="remove(r)">✕</button></div>
        </div>
        <p class="muted" style="font-size:.82rem;margin-top:10px">{{ r.is_admin ? 'Acceso total a todo el panel.' : (r.permissions.length + ' permiso(s) asignado(s)') }}</p>
      </div>
    </div>

    <modal v-if="editing" :title="editing==='new' ? 'Nuevo rol' : (form.is_admin ? 'Rol administrador' : 'Editar rol')" wide @close="editing=null">
      <div class="field"><label>Nombre del rol <help text="Nombre visible del rol (ej. «Editor de contenido», «Comercial»). Luego marcas abajo a qué opciones del panel tiene acceso." /></label><input v-model="form.label" :disabled="form.is_admin" placeholder="Ej. Editor de contenido" /></div>
      <p v-if="form.is_admin" class="hint">El rol administrador siempre tiene acceso total; sus permisos no se editan.</p>
      <template v-else>
        <h3 class="h2-ico-row" style="margin-top:16px"><span class="h2-ico">◎</span> Permisos por opción</h3>
        <div class="perm-groups">
          <div class="perm-group" v-for="(perms, group) in catalog" :key="group">
            <div class="perm-group__head">
              <strong>{{ group }}</strong>
              <button type="button" class="btn btn--ghost btn--sm" @click="toggleGroup(Object.keys(perms))">Alternar todo</button>
            </div>
            <label class="perm-item" v-for="(label, key) in perms" :key="key">
              <input type="checkbox" :checked="has(key)" @change="toggle(key)" /><span>{{ label }}</span>
            </label>
          </div>
        </div>
      </template>
      <template #foot>
        <button class="btn btn--ghost" @click="editing=null">Cancelar</button>
        <button v-if="!form.is_admin" class="btn" @click="save" :disabled="saving">{{ saving ? 'Guardando…' : 'Guardar rol' }}</button>
      </template>
    </modal>
  </div>`
};
