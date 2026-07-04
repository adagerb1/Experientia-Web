import { computed } from 'vue';
import { RouterLink } from 'vue-router';

// Modal de detalle premium para tarjetas del sitio (casos de uso, temas, programas…).
// item: { kicker?, title, icon?, pain?, promise?, points?[], note?, cta_label?, cta_to? }
export default {
  components: { RouterLink },
  props: { item: { type: Object, default: null } },
  emits: ['close'],
  setup(props, { emit }) {
    const open = computed(() => !!props.item);
    const close = () => emit('close');
    return { open, close };
  },
  template: `
  <teleport to="body">
    <transition name="imodal">
      <div v-if="open" class="imodal" @click.self="close">
        <div class="imodal__card" role="dialog" aria-modal="true">
          <button class="imodal__x" @click="close" aria-label="Cerrar">✕</button>
          <div class="imodal__head">
            <span v-if="item.icon" class="imodal__icon" aria-hidden="true">{{ item.icon }}</span>
            <div>
              <p v-if="item.kicker" class="imodal__kicker">{{ item.kicker }}</p>
              <h3 class="imodal__title">{{ item.title }}</h3>
            </div>
          </div>

          <p v-if="item.pain" class="imodal__pain">{{ item.pain }}</p>
          <p v-if="item.promise" class="imodal__promise">{{ item.promise }}</p>

          <ul v-if="item.points && item.points.length" class="imodal__points">
            <li v-for="(p, i) in item.points" :key="i"><span aria-hidden="true">✓</span>{{ p }}</li>
          </ul>

          <p v-if="item.note" class="imodal__note">{{ item.note }}</p>

          <div class="imodal__actions">
            <router-link :to="item.cta_to || '/agenda'" class="btn btn--primary" @click="close">{{ item.cta_label || 'Agendar una conversación' }}</router-link>
            <button class="btn btn--ghost" @click="close">Cerrar</button>
          </div>
        </div>
      </div>
    </transition>
  </teleport>`
};
