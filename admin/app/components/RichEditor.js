import { ref, watch, onMounted } from 'vue';
import { api } from '../api.js';

// Editor enriquecido (WYSIWYG) sin dependencias: contenteditable + toolbar.
// v-model = HTML. Permite negrita, títulos, listas, enlaces e imágenes.
export default {
  props: { modelValue: { type: String, default: '' } },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const el = ref(null);
    const fileInput = ref(null);
    const uploading = ref(false);

    onMounted(() => { if (el.value) el.value.innerHTML = props.modelValue || ''; });
    // Sincroniza cambios externos (p. ej. artículo generado por AlexIA) sin romper el cursor.
    watch(() => props.modelValue, (v) => {
      if (el.value && document.activeElement !== el.value && (v || '') !== el.value.innerHTML) {
        el.value.innerHTML = v || '';
      }
    });

    function sync() { emit('update:modelValue', el.value ? el.value.innerHTML : ''); }
    function exec(cmd, val = null) { el.value.focus(); document.execCommand(cmd, false, val); sync(); }
    function block(tag) { el.value.focus(); document.execCommand('formatBlock', false, tag); sync(); }
    function link() { const url = prompt('URL del enlace:'); if (url) exec('createLink', url); }

    function pickImage() { fileInput.value.click(); }
    async function onFile(e) {
      const file = e.target.files[0];
      if (!file) return;
      uploading.value = true;
      try {
        const r = await api.uploadImage(file);
        const url = r.data.url;
        el.value.focus();
        document.execCommand('insertHTML', false, `<img src="${url}" alt="" style="max-width:100%;border-radius:10px" />`);
        sync();
      } catch (err) { alert('No se pudo subir la imagen: ' + err.message); }
      finally { uploading.value = false; e.target.value = ''; }
    }

    return { el, fileInput, uploading, exec, block, link, pickImage, onFile, sync };
  },
  template: `
  <div class="rte">
    <div class="rte__bar">
      <button type="button" @click="block('p')" title="Párrafo">P</button>
      <button type="button" @click="block('h2')" title="Subtítulo">H2</button>
      <span class="rte__sep"></span>
      <button type="button" @click="exec('bold')" title="Negrita"><b>B</b></button>
      <button type="button" @click="exec('italic')" title="Itálica"><i>I</i></button>
      <span class="rte__sep"></span>
      <button type="button" @click="exec('insertUnorderedList')" title="Lista">• Lista</button>
      <button type="button" @click="link()" title="Enlace">🔗</button>
      <button type="button" @click="pickImage()" title="Insertar imagen" :disabled="uploading">{{ uploading ? '…' : '🖼 Imagen' }}</button>
      <span class="rte__sep"></span>
      <button type="button" @click="exec('removeFormat')" title="Quitar formato">✕ formato</button>
      <input ref="fileInput" type="file" accept="image/*" hidden @change="onFile" />
    </div>
    <div ref="el" class="rte__area" contenteditable="true" @input="sync" @blur="sync"></div>
  </div>`
};
