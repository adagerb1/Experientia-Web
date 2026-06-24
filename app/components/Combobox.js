import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';

// Select con búsqueda: escribe para filtrar, navega con teclado, accesible.
// Acepta opciones como strings o { value, label, icon }.
export default {
  props: {
    modelValue: { type: String, default: '' },
    options: { type: Array, default: () => [] },
    placeholder: { type: String, default: 'Selecciona…' },
    name: { type: String, default: '' }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const norm = computed(() => props.options.map(o =>
      typeof o === 'string' ? { value: o, label: o, icon: '' } : o));

    const open = ref(false);
    const query = ref('');
    const active = ref(0);
    const root = ref(null);
    const inputEl = ref(null);

    // Texto mostrado: la query si se está escribiendo, si no la etiqueta seleccionada.
    const selectedLabel = computed(() => {
      const found = norm.value.find(o => o.value === props.modelValue);
      return found ? found.label : props.modelValue;
    });
    const display = ref(selectedLabel.value);
    watch(() => props.modelValue, () => { display.value = selectedLabel.value; });

    const filtered = computed(() => {
      const q = query.value.trim().toLowerCase();
      if (!q) return norm.value;
      return norm.value.filter(o => o.label.toLowerCase().includes(q));
    });

    function openPanel() { open.value = true; query.value = ''; active.value = 0; }
    function close() { open.value = false; display.value = selectedLabel.value; }
    function choose(opt) { emit('update:modelValue', opt.value); display.value = opt.label; open.value = false; }

    function onInput(e) { query.value = e.target.value; display.value = e.target.value; open.value = true; active.value = 0; }

    function onKey(e) {
      if (!open.value && (e.key === 'ArrowDown' || e.key === 'Enter')) { openPanel(); return; }
      if (e.key === 'ArrowDown') { e.preventDefault(); active.value = Math.min(active.value + 1, filtered.value.length - 1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); active.value = Math.max(active.value - 1, 0); }
      else if (e.key === 'Enter') { e.preventDefault(); const o = filtered.value[active.value]; if (o) choose(o); }
      else if (e.key === 'Escape') { close(); }
    }

    function onDocClick(e) { if (root.value && !root.value.contains(e.target)) close(); }
    onMounted(() => document.addEventListener('click', onDocClick));
    onUnmounted(() => document.removeEventListener('click', onDocClick));

    return { open, query, active, root, inputEl, display, filtered, openPanel, close, choose, onInput, onKey };
  },
  template: `
  <div class="combo" :class="{ 'is-open': open }" ref="root">
    <div class="combo__control">
      <input ref="inputEl" class="combo__input" :value="display" :placeholder="placeholder" :name="name"
        autocomplete="off" role="combobox" :aria-expanded="String(open)" aria-autocomplete="list"
        @focus="openPanel" @input="onInput" @keydown="onKey" />
      <span class="combo__caret" aria-hidden="true">▾</span>
    </div>
    <div v-if="open" class="combo__panel" role="listbox">
      <div v-for="(o, i) in filtered" :key="o.value" class="combo__opt"
        :class="{ 'is-active': i === active, 'is-selected': o.value === modelValue }"
        role="option" :aria-selected="String(o.value === modelValue)"
        @mousedown.prevent="choose(o)" @mouseenter="active = i">
        <span v-if="o.icon" class="combo__flag">{{ o.icon }}</span>
        <span>{{ o.label }}</span>
      </div>
      <div v-if="!filtered.length" class="combo__empty">Sin resultados para “{{ query }}”.</div>
    </div>
  </div>`
};
