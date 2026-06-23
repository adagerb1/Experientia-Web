import { ref } from 'vue';
import { RouterLink } from 'vue-router';
import { NAV, CTA_PRIMARY } from '../data/site.js';

export default {
  components: { RouterLink },
  setup() {
    const open = ref(false);
    const toggle = () => { open.value = !open.value; };
    const close = () => { open.value = false; };
    return { open, toggle, close, NAV, CTA_PRIMARY };
  },
  template: `
  <header class="header">
    <div class="container header__inner">
      <router-link to="/" class="brand" aria-label="Tonny Dager — inicio" @click="close">
        <span class="brand__mark" aria-hidden="true"></span>
        <span class="brand__name">Tonny Dager<small>Nucleus Growth Experience</small></span>
      </router-link>

      <nav class="nav" :class="{ 'is-open': open }" id="nav" aria-label="Navegación principal">
        <router-link v-for="item in NAV" :key="item.to" :to="item.to" class="nav__link"
          active-class="is-active" exact-active-class="is-active" @click="close">{{ item.label }}</router-link>
        <router-link :to="CTA_PRIMARY.to" class="nav__cta" @click="close">Hablar con Tonny</router-link>
      </nav>

      <button class="nav-toggle" :aria-expanded="String(open)" aria-controls="nav"
        :aria-label="open ? 'Cerrar menú' : 'Abrir menú'" @click="toggle">
        <span></span><span></span><span></span>
      </button>
    </div>
  </header>`
};
