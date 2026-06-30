import { ref, watch } from 'vue';
import { RouterLink, useRoute } from 'vue-router';

// Navegación agrupada y orientada a la conversión (sesión estratégica).
const MENU = [
  { label: 'Inicio', to: '/' },
  { label: 'Sobre Tonny', to: '/sobre-tonny-dager' },
  {
    label: 'Servicios', children: [
      { label: 'Diagnóstico Tablero de Crecimiento', to: '/diagnostico-tablero-crecimiento', desc: 'Lee tu empresa como un tablero: 11 zonas y tu primera jugada.', featured: true },
      { label: 'Consultoría Estratégica', to: '/consultoria', desc: 'Sesión 1:1 para decidir y crecer con claridad.' },
      { label: 'Mentorías', to: '/mentorias', desc: 'Acompañamiento continuo para líderes y founders.' },
      { label: 'Conferencias & Speaker', to: '/conferencias', desc: 'Charlas y workshops para eventos y empresas.' },
      { label: 'Entrenamientos', to: '/entrenamientos', desc: 'Formación aplicada en IA, automatización y growth.' }
    ]
  },
  {
    label: 'Ecosistema', children: [
      { label: 'ExperientIA', to: '/experientia', desc: 'La firma que implementa tu transformación.' },
      { label: 'AlexIA', to: '/alexia', desc: 'Agentes inteligentes para ventas y atención.' },
      { label: 'Casos', to: '/casos', desc: 'Resultados reales y medibles.' }
    ]
  },
  { label: 'Recursos', to: '/recursos' }
];

export default {
  components: { RouterLink },
  setup() {
    const route = useRoute();
    const mobileOpen = ref(false);

    function lock(on) { document.body.style.overflow = on ? 'hidden' : ''; }
    function toggleMobile() { mobileOpen.value = !mobileOpen.value; lock(mobileOpen.value); }
    function closeMobile() { mobileOpen.value = false; lock(false); }

    // Cierra el overlay al cambiar de ruta o con Escape.
    watch(() => route.fullPath, closeMobile);
    if (typeof document !== 'undefined') {
      document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeMobile(); });
    }

    return { MENU, mobileOpen, toggleMobile, closeMobile };
  },
  template: `
  <header class="header">
    <div class="container header__inner">
      <router-link to="/" class="brand" aria-label="Tonny Dager — inicio" @click="closeMobile">
        <img class="brand__logo" src="/assets/icons/mark.svg" alt="" width="32" height="32" />
        <span class="brand__name">Tonny Dager</span>
      </router-link>

      <!-- Navegación desktop con mega-menú -->
      <nav class="nav" aria-label="Navegación principal">
        <template v-for="item in MENU" :key="item.label">
          <router-link v-if="item.to" :to="item.to" class="nav__link" active-class="is-active" exact-active-class="is-active">{{ item.label }}</router-link>
          <div v-else class="nav__group">
            <button type="button" class="nav__link nav__trigger">{{ item.label }} <span class="nav__chev" aria-hidden="true">▾</span></button>
            <div class="mega">
              <router-link v-for="c in item.children" :key="c.to" :to="c.to" class="mega__item" :class="{ 'mega__item--featured': c.featured }">
                <span class="mega__label">{{ c.label }}</span>
                <span class="mega__desc">{{ c.desc }}</span>
              </router-link>
            </div>
          </div>
        </template>
        <router-link to="/contacto" class="nav__cta">Agenda tu sesión</router-link>
      </nav>

      <button class="nav-toggle" :aria-expanded="String(mobileOpen)" aria-controls="navx"
        :aria-label="mobileOpen ? 'Cerrar menú' : 'Abrir menú'" @click="toggleMobile">
        <span></span><span></span><span></span>
      </button>
    </div>

    <!-- Overlay inmersivo (tablet / móvil) -->
    <div class="navx" id="navx" :class="{ 'is-open': mobileOpen }">
      <div class="navx__inner">
        <template v-for="item in MENU" :key="'m-'+item.label">
          <router-link v-if="item.to" :to="item.to" class="navx__link" @click="closeMobile">{{ item.label }}</router-link>
          <div v-else class="navx__group">
            <p class="navx__group-label">{{ item.label }}</p>
            <router-link v-for="c in item.children" :key="'m-'+c.to" :to="c.to" class="navx__sub" @click="closeMobile">{{ c.label }}</router-link>
          </div>
        </template>
        <router-link to="/contacto" class="btn btn--primary btn--lg navx__cta" @click="closeMobile">Agenda tu sesión estratégica</router-link>
        <p class="navx__foot">Estrategia · IA · Automatización · Growth</p>
      </div>
    </div>
  </header>`
};
