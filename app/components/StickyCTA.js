import { useRouter } from 'vue-router';
import { store } from '../../assets/js/store.js';

// CTA sticky inferior con etiqueta adaptable (Adaptive CTA).
export default {
  setup() {
    const router = useRouter();
    const go = () => router.push('/agenda');
    return { store, go };
  },
  template: `
  <a class="sticky-cta" :class="{ 'is-visible': store.stickyVisible }" href="/agenda" @click.prevent="go">
    <span>{{ store.stickyLabel }}</span>
    <span class="sticky-cta__arrow" aria-hidden="true">→</span>
  </a>`
};
