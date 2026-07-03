import { createApp, h, ref } from 'vue';
import { createRouter, createWebHistory, RouterView, RouterLink } from 'vue-router';
import { auth } from './store.js';
import { api } from './api.js';

import Login from './views/Login.js';
import Dashboard from './views/Dashboard.js';
import Leads from './views/Leads.js';
import TableroDiagnosticos from './views/TableroDiagnosticos.js';
import Pipeline from './views/Pipeline.js';
import Consultas from './views/Consultas.js';
import Reservas from './views/Reservas.js';
import Disponibilidad from './views/Disponibilidad.js';
import Recursos from './views/Recursos.js';
import Casos from './views/Casos.js';
import Conectores from './views/Conectores.js';
import Configuracion from './views/Configuracion.js';
import AlexiaWidget from './components/AlexiaWidget.js';

const NAV = [
  { to: '/dashboard', label: 'Dashboard', icon: '▦' },
  { sec: 'Comercial' },
  { to: '/leads', label: 'Leads', icon: '◎' },
  { to: '/tablero', label: 'Diagnósticos Tablero', icon: '⬡' },
  { to: '/pipeline', label: 'Pipeline', icon: '↗' },
  { to: '/reservas', label: 'Reservas', icon: '◷' },
  { sec: 'Agenda' },
  { to: '/consultas', label: 'Consultas', icon: '✦' },
  { to: '/disponibilidad', label: 'Disponibilidad', icon: '🗓' },
  { sec: 'Contenido' },
  { to: '/recursos', label: 'Recursos & Blog', icon: '✎' },
  { to: '/casos', label: 'Casos de éxito', icon: '★' },
  { sec: 'Sistema' },
  { to: '/conectores', label: 'Conectores', icon: '⚡' },
  { to: '/configuracion', label: 'Configuración', icon: '⚙' }
];

const Layout = {
  components: { RouterView, RouterLink, AlexiaWidget },
  setup() {
    const collapsed = ref(localStorage.getItem('ngx_sidebar') === '1');
    const toggle = () => { collapsed.value = !collapsed.value; localStorage.setItem('ngx_sidebar', collapsed.value ? '1' : '0'); };
    const logout = () => { auth.clear(); location.href = '/admin/login'; };
    const initials = () => (auth.user?.name || auth.user?.email || 'A').trim().slice(0, 1).toUpperCase();
    return { NAV, auth, logout, initials, collapsed, toggle };
  },
  template: `
  <div class="shell" :class="{ 'shell--collapsed': collapsed }">
    <aside class="sidebar">
      <div class="sidebar__brand"><span></span> <b class="sidebar__word">Tonny Dager</b><small class="sidebar__word">Admin</small></div>
      <nav class="sidebar__nav">
        <template v-for="(n, i) in NAV" :key="n.to || 's' + i">
          <span v-if="n.sec" class="sidebar__sec navtx">{{ n.sec }}</span>
          <router-link v-else :to="n.to" :title="n.label">
            <i class="navi" aria-hidden="true">{{ n.icon }}</i><span class="navtx">{{ n.label }}</span>
          </router-link>
        </template>
      </nav>
      <button class="sidebar__collapse" @click="toggle" :aria-label="collapsed ? 'Expandir menú' : 'Colapsar menú'" :title="collapsed ? 'Expandir' : 'Colapsar'">
        <span aria-hidden="true">{{ collapsed ? '»' : '«' }}</span><span class="navtx">Colapsar</span>
      </button>
    </aside>
    <div class="content">
      <header class="appbar">
        <button class="appbar__toggle" @click="toggle" aria-label="Colapsar o expandir menú">☰</button>
        <div class="appbar__right">
          <span class="appbar__user"><span class="avatar">{{ initials() }}</span><span class="appbar__uname">{{ auth.user?.name || auth.user?.email }}</span></span>
          <button class="btn btn--ghost btn--sm" @click="logout">Cerrar sesión</button>
        </div>
      </header>
      <main class="main">
        <router-view v-slot="{ Component }">
          <transition name="view" mode="out-in"><component :is="Component" /></transition>
        </router-view>
      </main>
    </div>
    <alexia-widget />
  </div>`
};

const routes = [
  { path: '/login', component: Login, meta: { public: true } },
  {
    path: '/', component: Layout, children: [
      { path: '', redirect: '/dashboard' },
      { path: 'dashboard', component: Dashboard },
      { path: 'leads', component: Leads },
      { path: 'tablero', component: TableroDiagnosticos },
      { path: 'pipeline', component: Pipeline },
      { path: 'consultas', component: Consultas },
      { path: 'reservas', component: Reservas },
      { path: 'disponibilidad', component: Disponibilidad },
      { path: 'recursos', component: Recursos },
      { path: 'casos', component: Casos },
      { path: 'conectores', component: Conectores },
      { path: 'configuracion', component: Configuracion }
    ]
  }
];

const router = createRouter({ history: createWebHistory('/admin/'), routes });

// Guard: rutas privadas requieren token.
router.beforeEach((to) => {
  if (!to.meta.public && !auth.isAuthed()) return '/login';
  if (to.path === '/login' && auth.isAuthed()) return '/dashboard';
  return true;
});

createApp({ render: () => h(RouterView) }).use(router).mount('#admin');
