import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { COUNTRIES } from '../data/countries.js';

// Campo de WhatsApp compuesto: selector de país (bandera + indicativo) + número.
// - Detecta el país por "+" o por la secuencia numérica.
// - Guarda solo dígitos (sin "+"), con el indicativo incluido (formato WhatsApp).
export default {
  props: {
    modelValue: { type: String, default: '' },
    defaultIso: { type: String, default: 'CO' }
  },
  emits: ['update:modelValue'],
  setup(props, { emit }) {
    const byLongestDial = [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length);
    const country = ref(COUNTRIES.find((c) => c.iso === props.defaultIso) || COUNTRIES.find((c) => c.iso === 'CO') || COUNTRIES[0]);
    const number = ref('');
    const open = ref(false);
    const query = ref('');
    const root = ref(null);
    let lock = false;
    const NAT_LEN = 10; // longitud típica del número nacional

    const dialDigits = (c) => c.dial.replace(/\D/g, '');

    const filtered = computed(() => {
      const q = query.value.trim().toLowerCase();
      if (!q) return COUNTRIES;
      return COUNTRIES.filter((c) => c.label.toLowerCase().includes(q) || c.dial.includes(q));
    });

    function emitValue() {
      let nat = number.value.replace(/\D/g, '').replace(/^0+/, '');
      const dd = dialDigits(country.value);
      if (nat.startsWith(dd)) nat = nat.slice(dd.length); // evita duplicar indicativo
      emit('update:modelValue', nat ? dd + nat : '');     // dígitos, sin "+"
    }

    function process() {
      if (lock) return;
      const raw = number.value.trim();
      const hasPlus = raw.startsWith('+');
      const digits = raw.replace(/\D/g, '');
      if (digits && (hasPlus || digits.length > NAT_LEN)) {
        let match = byLongestDial.find((c) => digits.startsWith(dialDigits(c)));
        // Indicativo +1 es compartido: por defecto Estados Unidos.
        if (match && dialDigits(match) === '1') match = COUNTRIES.find((c) => c.iso === 'US') || match;
        if (match) {
          lock = true;
          country.value = match;
          number.value = digits.slice(dialDigits(match).length); // deja solo el nacional
          lock = false;
        }
      }
      emitValue();
    }
    watch(number, process);

    function selectCountry(c) { country.value = c; open.value = false; query.value = ''; emitValue(); }
    function onDocClick(e) { if (root.value && !root.value.contains(e.target)) open.value = false; }
    onMounted(() => document.addEventListener('click', onDocClick));
    onUnmounted(() => document.removeEventListener('click', onDocClick));

    return { country, number, open, query, filtered, root, selectCountry };
  },
  template: `
  <div class="phone" :class="{ 'is-open': open }" ref="root">
    <button type="button" class="phone__cc" @click="open = !open" :aria-expanded="String(open)" aria-label="Indicativo de país">
      <span class="phone__flag">{{ country.icon }}</span>
      <span class="phone__dial">{{ country.dial }}</span>
      <span class="phone__caret" aria-hidden="true">▾</span>
    </button>
    <input class="phone__num" v-model="number" type="tel" inputmode="tel" autocomplete="tel"
      placeholder="Número de WhatsApp" aria-label="Número de WhatsApp" />
    <div v-if="open" class="phone__panel" role="listbox">
      <input class="phone__search" v-model="query" placeholder="Buscar país…" aria-label="Buscar país" @click.stop />
      <button type="button" v-for="c in filtered" :key="c.iso" class="phone__opt"
        :class="{ 'is-selected': c.iso === country.iso }" @click="selectCountry(c)">
        <span class="phone__flag">{{ c.icon }}</span>
        <span class="phone__opt-name">{{ c.label }}</span>
        <span class="phone__dial">{{ c.dial }}</span>
      </button>
    </div>
  </div>`
};
