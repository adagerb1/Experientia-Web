import { ref, reactive, onMounted } from 'vue';
import { api } from '../api.js';

export default {
  setup() {
    const form = reactive({ site_name: '', contact_email: '', whatsapp: '', epayco_test: 'true' });
    const error = ref(''); const saved = ref(false); const loading = ref(true);
    onMounted(async () => {
      try { Object.assign(form, (await api.settings()).data); } catch (e) { error.value = e.message; }
      finally { loading.value = false; }
    });
    async function save() {
      error.value = ''; saved.value = false;
      try { await api.saveSettings({ ...form }); saved.value = true; } catch (e) { error.value = e.message; }
    }
    return { form, error, saved, loading, save };
  },
  template: `
  <div>
    <div class="topbar"><h1>Configuración</h1></div>
    <p v-if="error" class="error">{{ error }}</p>
    <div v-if="loading" class="loading">Cargando…</div>
    <div v-else class="panel" style="max-width:520px">
      <div class="field"><label>Nombre del sitio</label><input v-model="form.site_name" /></div>
      <div class="field"><label>Email de contacto</label><input v-model="form.contact_email" type="email" /></div>
      <div class="field"><label>WhatsApp</label><input v-model="form.whatsapp" placeholder="+57..." /></div>
      <div class="field"><label>ePayco modo prueba</label>
        <select v-model="form.epayco_test"><option value="true">Sí (pruebas)</option><option value="false">No (producción)</option></select></div>
      <div class="flex"><button class="btn" @click="save">Guardar</button>
        <span v-if="saved" class="badge badge--green">Guardado ✓</span></div>
    </div>
  </div>`
};
