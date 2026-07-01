import { ref, reactive, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { api } from '../api.js';

export default {
  setup() {
    const router = useRouter();
    const form = reactive({ site_name: '', contact_email: '', whatsapp: '' });
    const error = ref(''); const saved = ref(false); const loading = ref(true); const saving = ref(false);

    onMounted(async () => {
      try {
        const d = (await api.settings()).data || {};
        form.site_name = d.site_name ?? '';
        form.contact_email = d.contact_email ?? '';
        form.whatsapp = d.whatsapp ?? '';
      } catch (e) { error.value = e.message; }
      finally { loading.value = false; }
    });
    async function save() {
      error.value = ''; saved.value = false; saving.value = true;
      try { await api.saveSettings({ ...form }); saved.value = true; setTimeout(() => (saved.value = false), 2600); }
      catch (e) { error.value = e.message; } finally { saving.value = false; }
    }
    const initial = computed(() => (form.site_name || 'T').trim().slice(0, 1).toUpperCase());

    return { form, error, saved, loading, saving, initial, save, goConnectors: () => router.push('/conectores') };
  },
  template: `
  <div class="view view--narrow">
    <div class="topbar"><div><h1>Configuración</h1><p class="topbar__sub">Identidad y contacto del sitio.</p></div></div>
    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="loading" class="skeleton-table"><div class="skeleton-row" v-for="i in 3" :key="i" style="height:60px"></div></div>

    <template v-else>
      <div class="panel panel--glow set-hero">
        <span class="avatar avatar--lg">{{ initial }}</span>
        <div>
          <strong>{{ form.site_name || 'Tonny Dager' }}</strong>
          <p class="muted">{{ form.contact_email || 'hello@tonnydager.com' }}</p>
        </div>
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
        <h2><span class="h2-ico">⚡</span> Pagos e IA</h2>
        <p class="muted" style="margin-bottom:12px">Las pasarelas de pago (ePayco, Wompi) y la inteligencia artificial (OpenAI, Anthropic) se configuran en <b>Conectores</b>.</p>
        <button class="btn btn--ghost btn--sm" @click="goConnectors">Ir a Conectores →</button>
      </div>

      <div class="save-bar">
        <transition name="fade"><span v-if="saved" class="pill pill--green">Guardado ✓</span></transition>
        <button class="btn" @click="save" :disabled="saving">{{ saving ? 'Guardando…' : 'Guardar cambios' }}</button>
      </div>
    </template>
  </div>`
};
