// Punto de entrada de la SPA pública (Vue 3, sin build / importmap).
import { createApp } from 'vue';
import { router } from './router.js';
import { revealDirective } from './motion.js';
import { initScrollProgress, hideLoader } from './utils.js';
import { initFx, enhanceTitles, initScrollFx, initCurtain } from './fx.js';
import { track, EVENTS } from './tracking.js';
import { captureUtm } from './leadStore.js';

import AppHeader from '../../app/components/AppHeader.js';
import SiteFooter from '../../app/components/SiteFooter.js';
import StickyCTA from '../../app/components/StickyCTA.js';

// Layout raíz por template (RouterView/RouterLink quedan registrados globalmente
// por app.use(router); Transition es built-in). Patrón fiable en el build prod.
const Root = {
  components: { AppHeader, SiteFooter, StickyCTA },
  template: `
    <AppHeader v-if="!$route.meta.bare" />
    <main id="main">
      <router-view v-slot="{ Component }">
        <transition name="view-fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
    <SiteFooter v-if="!$route.meta.bare" />
    <StickyCTA v-if="!$route.meta.bare" />
  `
};

const app = createApp(Root);
app.use(router);
app.directive('reveal', revealDirective);

captureUtm();
router.isReady().then(() => {
  app.mount('#app');
  initScrollProgress();
  initFx();
  initScrollFx();
  initCurtain(router);
  enhanceTitles();
  tameVideos();
  hideLoader();
  track(EVENTS.VIEW_HOME, { path: location.pathname });
});

// Respeta prefers-reduced-motion en cualquier video de fondo del sitio.
function tameVideos() {
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  document.querySelectorAll('video').forEach((v) => { v.removeAttribute('autoplay'); try { v.pause(); } catch (e) {} });
}

// Re-aplica revelado de títulos y control de video en cada cambio de vista.
router.afterEach(() => setTimeout(() => { enhanceTitles(); tameVideos(); }, 60));

// Red de seguridad: nunca dejar al usuario tras el loader.
window.addEventListener('load', () => setTimeout(hideLoader, 3500));
