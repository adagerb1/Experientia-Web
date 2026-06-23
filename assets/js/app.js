// Punto de entrada de la SPA pública (Vue 3, sin build / importmap).
import { createApp, h } from 'vue';
import { RouterView } from 'vue-router';
import { router } from './router.js';
import { revealDirective } from './motion.js';
import { initScrollProgress, hideLoader } from './utils.js';
import { track, EVENTS } from './tracking.js';

import AppHeader from '../../app/components/AppHeader.js';
import SiteFooter from '../../app/components/SiteFooter.js';
import StickyCTA from '../../app/components/StickyCTA.js';

const Root = {
  components: { AppHeader, SiteFooter, StickyCTA, RouterView },
  render() {
    return h('div', { class: 'app-shell' }, [
      h(AppHeader),
      h('main', { id: 'main' }, [
        h(RouterView, null, {
          default: ({ Component }) =>
            h('transition', { name: 'view-fade', mode: 'out-in' }, () => (Component ? h(Component) : null))
        })
      ]),
      h(SiteFooter),
      h(StickyCTA)
    ]);
  }
};

const app = createApp(Root);
app.use(router);
app.directive('reveal', revealDirective);

router.isReady().then(() => {
  app.mount('#app');
  initScrollProgress();
  hideLoader();
  track(EVENTS.VIEW_HOME, { path: location.pathname });
});

// Red de seguridad: nunca dejar al usuario tras el loader.
window.addEventListener('load', () => setTimeout(hideLoader, 3500));
