import { ref, reactive } from 'vue';
import { api } from '../api.js';
import { auth } from '../store.js';

export default {
  setup() {
    const form = reactive({ name: auth.user?.name || '', password: '', password2: '' });
    const saving = ref(false); const error = ref(''); const msg = ref('');

    async function save() {
      error.value = ''; msg.value = '';
      if (form.password && form.password !== form.password2) { error.value = 'Las contraseñas no coinciden.'; return; }
      const data = {};
      if (form.name.trim() && form.name !== auth.user?.name) data.name = form.name.trim();
      if (form.password) data.password = form.password;
      if (!Object.keys(data).length) { msg.value = 'No hay cambios que guardar.'; return; }
      saving.value = true;
      try {
        await api.updateProfile(data);
        if (data.name && auth.user) { auth.user.name = data.name; localStorage.setItem('ngx_user', JSON.stringify(auth.user)); }
        form.password = ''; form.password2 = '';
        msg.value = 'Perfil actualizado ✓';
      } catch (e) { error.value = e.message; } finally { saving.value = false; }
    }
    return { form, saving, error, msg, auth, save };
  },
  template: `
  <div class="view view--narrow">
    <div class="topbar"><div><h1>Mi perfil</h1><p class="topbar__sub">Tus datos de acceso al panel.</p></div></div>

    <div class="panel">
      <div class="profile-head">
        <span class="avatar avatar--lg">{{ (auth.user?.name || 'A').slice(0,1).toUpperCase() }}</span>
        <div>
          <strong style="font-size:1.05rem">{{ auth.user?.name }}</strong>
          <p class="muted" style="margin:2px 0 0">{{ auth.user?.email }}</p>
          <span class="pill pill--blue" style="margin-top:6px">{{ auth.user?.role_label || auth.user?.role || 'Usuario' }}</span>
        </div>
      </div>

      <div class="form-grid" style="margin-top:20px">
        <div class="field field--full"><label>Nombre</label><input v-model="form.name" /></div>
        <div class="field"><label>Nueva contraseña</label><input v-model="form.password" type="password" autocomplete="new-password" placeholder="Mínimo 8 caracteres" /></div>
        <div class="field"><label>Repetir contraseña</label><input v-model="form.password2" type="password" autocomplete="new-password" /></div>
      </div>
      <p v-if="error" class="error">{{ error }}</p>
      <div class="flex between" style="margin-top:8px">
        <span class="muted">{{ msg }}</span>
        <button class="btn" @click="save" :disabled="saving">{{ saving ? 'Guardando…' : 'Guardar cambios' }}</button>
      </div>
    </div>
  </div>`
};
