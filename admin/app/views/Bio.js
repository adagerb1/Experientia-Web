import { reactive, ref, onMounted } from 'vue';
import { api } from '../api.js';

const STYLES = [
  { v: 'primary', t: 'Principal (destacado)' },
  { v: 'normal', t: 'Normal' },
  { v: 'ghost', t: 'Sutil (borde)' }
];

export default {
  setup() {
    const form = reactive({ name: '', role: '', avatar_url: '', tags: '', message: '', show_pitch: true,
      pitch_title: '', pitch_items: [], buttons: [], footer: '' });
    const loading = ref(true); const saving = ref(false); const error = ref(''); const msg = ref('');
    const avatarUploading = ref(false);

    async function load() {
      loading.value = true;
      try {
        const r = await api.bio();
        Object.assign(form, r.data || {});
        if (!Array.isArray(form.pitch_items)) form.pitch_items = [];
        if (!Array.isArray(form.buttons)) form.buttons = [];
      } catch (e) { error.value = e.message; } finally { loading.value = false; }
    }
    onMounted(load);

    const addButton = () => form.buttons.push({ label: '', url: '', external: false, style: 'normal', event: 'bio_link_clicked' });
    const removeButton = (i) => form.buttons.splice(i, 1);
    const moveButton = (i, d) => {
      const j = i + d; if (j < 0 || j >= form.buttons.length) return;
      const [b] = form.buttons.splice(i, 1); form.buttons.splice(j, 0, b);
    };
    const addPitch = () => { if (form.pitch_items.length < 8) form.pitch_items.push({ title: '', text: '' }); };
    const removePitch = (i) => form.pitch_items.splice(i, 1);

    async function onAvatar(e) {
      const file = e.target.files[0]; if (!file) return;
      avatarUploading.value = true; error.value = '';
      try { form.avatar_url = (await api.uploadImage(file)).data.url; }
      catch (err) { error.value = 'No se pudo subir la foto: ' + err.message; }
      finally { avatarUploading.value = false; e.target.value = ''; }
    }

    async function save() {
      saving.value = true; error.value = ''; msg.value = '';
      try { await api.saveBio({ ...form }); msg.value = 'Guardado ✓ — cambios visibles en tu Link en Bio.'; }
      catch (e) { error.value = e.message; } finally { saving.value = false; }
    }

    const isExternal = (b) => b.external || /^https?:\/\//i.test(b.url || '');

    return { form, loading, saving, error, msg, avatarUploading, STYLES,
      addButton, removeButton, moveButton, addPitch, removePitch, onAvatar, save, isExternal };
  },
  template: `
  <div class="view view--narrow">
    <div class="topbar">
      <div><h1>Link en Bio</h1><p class="topbar__sub">Tu mini-landing para redes. Edítala y compártela en <b>/tablero</b>.</p></div>
      <a href="/tablero" target="_blank" rel="noopener" class="btn btn--ghost btn--sm">Ver página ↗</a>
    </div>
    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="loading" class="skeleton-table"><div class="skeleton-row" v-for="i in 4" :key="i" style="height:60px"></div></div>

    <template v-else>
      <div class="panel">
        <h2>Encabezado</h2>
        <div class="bio-avatar-row">
          <div class="bio-avatar-prev"><img v-if="form.avatar_url" :src="form.avatar_url" alt="avatar" /><span v-else>TD</span></div>
          <label class="cover-up__file">{{ avatarUploading ? 'Subiendo…' : 'Cambiar foto' }}<input type="file" accept="image/*" @change="onAvatar" hidden /></label>
        </div>
        <div class="form-grid">
          <div class="field"><label>Nombre</label><input v-model="form.name" /></div>
          <div class="field"><label>Rol / título</label><input v-model="form.role" /></div>
          <div class="field field--full"><label>Etiquetas <small class="muted">(separadas por · )</small></label><input v-model="form.tags" placeholder="Estrategia · Datos · IA" /></div>
          <div class="field field--full"><label>Mensaje</label><textarea v-model="form.message" rows="2"></textarea></div>
        </div>
      </div>

      <div class="panel">
        <div class="flex between"><h2>Botones / enlaces</h2><button class="btn btn--sm" @click="addButton">+ Añadir</button></div>
        <p v-if="!form.buttons.length" class="muted">Sin botones. Añade el primero.</p>
        <div class="bio-btn-row" v-for="(b, i) in form.buttons" :key="i">
          <div class="bio-btn-row__grid">
            <div class="field"><label>Texto</label><input v-model="b.label" placeholder="Hacer diagnóstico" /></div>
            <div class="field"><label>URL o ruta</label><input v-model="b.url" placeholder="/agenda o https://..." /></div>
            <div class="field"><label>Estilo</label><select v-model="b.style"><option v-for="s in STYLES" :key="s.v" :value="s.v">{{ s.t }}</option></select></div>
            <div class="field field--check"><label class="switch"><input type="checkbox" v-model="b.external" /><span>Abrir en pestaña nueva</span></label>
              <small class="muted" v-if="isExternal(b)">↗ enlace externo</small></div>
          </div>
          <div class="bio-btn-row__ops">
            <button class="btn btn--ghost btn--sm" @click="moveButton(i,-1)" :disabled="i===0" title="Subir">↑</button>
            <button class="btn btn--ghost btn--sm" @click="moveButton(i,1)" :disabled="i===form.buttons.length-1" title="Bajar">↓</button>
            <button class="btn btn--ghost btn--sm" @click="removeButton(i)" title="Eliminar">✕</button>
          </div>
        </div>
      </div>

      <div class="panel">
        <div class="flex between">
          <h2>Bloque "El Tablero en 4 líneas"</h2>
          <label class="switch"><input type="checkbox" v-model="form.show_pitch" /><span>Mostrar</span></label>
        </div>
        <template v-if="form.show_pitch">
          <div class="field"><label>Título del bloque</label><input v-model="form.pitch_title" /></div>
          <div class="bio-pitch-row" v-for="(p, i) in form.pitch_items" :key="i">
            <input v-model="p.title" placeholder="Título (ej. Dirección)" />
            <input v-model="p.text" placeholder="Descripción corta" />
            <button class="btn btn--ghost btn--sm" @click="removePitch(i)" title="Eliminar">✕</button>
          </div>
          <button class="btn btn--ghost btn--sm" @click="addPitch" :disabled="form.pitch_items.length>=8">+ Añadir línea</button>
        </template>
      </div>

      <div class="panel">
        <h2>Pie de página</h2>
        <div class="field"><input v-model="form.footer" placeholder="© 2026 Tonny Dager · ExperientIA" /></div>
      </div>

      <div class="flex between" style="margin-top:16px">
        <span class="muted">{{ msg }}</span>
        <button class="btn" @click="save" :disabled="saving">{{ saving ? 'Guardando…' : 'Guardar Link en Bio' }}</button>
      </div>
    </template>
  </div>`
};
