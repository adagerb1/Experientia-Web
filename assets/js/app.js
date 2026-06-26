// Punto de entrada de la SPA pública (Vue 3, sin build / importmap).
import { createApp } from 'vue';
import { router } from './router.js';
import { revealDirective } from './motion.js';
import { initScrollProgress, hideLoader } from './utils.js';
import { initFx, enhanceTitles } from './fx.js';
import { track, EVENTS } from './tracking.js';

import AppHeader from '../../app/components/AppHeader.js';
import SiteFooter from '../../app/components/SiteFooter.js';
import StickyCTA from '../../app/components/StickyCTA.js';

// Layout raíz por template (RouterView/RouterLink quedan registrados globalmente
// por app.use(router); Transition es built-in). Patrón fiable en el build prod.
const Root = {
  components: { AppHeader, SiteFooter, StickyCTA },
  template: `
    <AppHeader />
    <main id="main">
      <router-view v-slot="{ Component }">
        <transition name="view-fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
    </main>
    <SiteFooter />
    <StickyCTA />
  `
};

const app = createApp(Root);
app.use(router);
app.directive('reveal', revealDirective);

router.isReady().then(() => {
  app.mount('#app');
  initScrollProgress();
  initFx();
  enhanceTitles();
  hideLoader();
  track(EVENTS.VIEW_HOME, { path: location.pathname });
});

// Re-aplica el revelado de títulos en cada cambio de vista.
router.afterEach(() => setTimeout(enhanceTitles, 60));

// Red de seguridad: nunca dejar al usuario tras el loader.
window.addEventListener('load', () => setTimeout(hideLoader, 3500));
