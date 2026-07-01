import { ref, reactive, computed, onMounted } from 'vue';
import { api } from '../api.js';

export default {
  setup() {
    const form = reactive({ site_name: '', contact_email: '', whatsapp: '', epayco_test: 'true' });
    const error = ref(''); const saved = ref(false); const loading = ref(true); const saving = ref(false);

    onMounted(async () => {
      try { Object.assign(form, (await api.settings()).data); } catch (e) { error.value = e.message; }
      finally { loading.value = false; }
    });
    async function save() {
      error.value = ''; saved.value = false; saving.value = true;
      try { await api.saveSettings({ ...form }); saved.value = true; setTimeout(() => (saved.value = false), 2600); }
      catch (e) { error.value = e.message; } finally { saving.value = false; }
    }
    const initial = computed(() => (form.site_name || 'T').trim().slice(0, 1).toUpperCase());
    const isProd = computed(() => String(form.epayco_test) === 'false');

    return { form, error, saved, loading, saving, initial, isProd, save };
  },
  template: `
  <div class="view view--narrow">
    <div class="topbar"><div><h1>Configuración</h1><p class="topbar__sub">Identidad, contacto e integración de pagos.</p></div></div>
    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="loading" class="skeleton-table"><div class="skeleton-row" v-for="i in 4" :key="i" style="height:60px"></div></div>

    <template v-else>
      <div class="panel panel--glow set-hero">
        <span class="avatar avatar--lg">{{ initial }}</span>
        <div>
          <strong>{{ form.site_name || 'Tonny Dager' }}</strong>
          <p class="muted">{{ form.contact_email || 'hello@tonnydager.com' }}</p>
        </div>
        <span class="pill" :class="isProd ? 'pill--green' : 'pill--amber'">ePayco {{ isProd ? 'Producción' : 'Pruebas' }}</span>
      </div>

      <div class="panel">
        <h2><span class="h2-ico">◎</span> Identidad</h2>
        <div class="field"><label>Nombre del sitio</label><input v-model="form.site_name" /></div>
      </div>

      <div class="panel">
        <h2><span class="h2-ico">✉</span> Contacto</h2>
        <div class="form-grid">
          <div class="field"><label>Email de contacto</label><input v-model="form.contact_email" type="email" /></div>
          <div class="field"><label>WhatsApp</label><input v-model="form.whatsapp" placeholder="+57..." /></div>
        </div>
      </div>

      <div class="panel">
        <h2><span class="h2-ico">$</span> Pagos (ePayco)</h2>
        <div class="field"><label>Modo</label>
          <select v-model="form.epayco_test">
            <option value="true">Pruebas (sandbox)</option>
            <option value="false">Producción (cobros reales)</option>
          </select></div>
        <p class="hint" v-if="isProd">⚠ En producción los cobros son reales. Verifica llaves en <code>config/payments.php</code>.</p>
      </div>

      <div class="save-bar">
        <transition name="fade"><span v-if="saved" class="pill pill--green">Guardado ✓</span></transition>
        <button class="btn" @click="save" :disabled="saving">{{ saving ? 'Guardando…' : 'Guardar cambios' }}</button>
      </div>
    </template>
  </div>`
};
