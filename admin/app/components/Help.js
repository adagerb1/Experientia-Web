import { ref } from 'vue';

// Ayuda contextual reutilizable para campos de formulario: un botón "?" que al
// pulsarlo muestra una explicación breve (patrón usado también en Conectores).
// Uso: <label>Campo <help text="Qué va aquí y para qué sirve." /></label>
export default {
  props: { text: { type: String, required: true } },
  setup() {
    const open = ref(false);
    return { open };
  },
  template: `
  <span class="fhelp">
    <button type="button" class="fhelp__btn" @click.stop="open = !open" :aria-expanded="open" :aria-label="open ? 'Ocultar ayuda' : 'Mostrar ayuda'">?</button>
    <transition name="fade"><span v-if="open" class="fhelp__pop" @click.stop>{{ text }}</span></transition>
  </span>`
};
