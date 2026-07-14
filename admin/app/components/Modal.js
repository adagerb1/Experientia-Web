// Modal premium con teleport, transición y cierre por overlay/Escape.
import { onMounted, onBeforeUnmount } from 'vue';

export default {
  props: { title: { type: String, default: '' }, wide: { type: Boolean, default: false } },
  emits: ['close'],
  setup(props, { emit }) {
    const onKey = (e) => { if (e.key === 'Escape') emit('close'); };
    onMounted(() => { document.addEventListener('keydown', onKey); document.body.style.overflow = 'hidden'; });
    onBeforeUnmount(() => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; });
    return { close: () => emit('close') };
  },
  template: `
  <teleport to="body">
    <transition name="modal" appear>
      <div class="modal-bg" @click.self="close">
        <div class="modal" :class="{ 'modal--wide': wide }" role="dialog" aria-modal="true">
          <header class="modal__head">
            <h2>{{ title }}</h2>
            <button class="modal__x" @click="close" aria-label="Cerrar">✕</button>
          </header>
          <div class="modal__body"><slot /></div>
          <footer class="modal__foot" v-if="$slots.foot"><slot name="foot" /></footer>
        </div>
      </div>
    </transition>
  </teleport>`
};
