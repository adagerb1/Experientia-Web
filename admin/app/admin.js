import { createApp, h, ref, reactive, computed, watch } from 'vue';
import { createRouter, createWebHistory, RouterView, RouterLink, useRoute } from 'vue-router';
import { auth } from './store.js';
import { api } from './api.js';

import Login from './views/Login.js';
import Dashboard from './views/Dashboard.js';
import Analitica from './views/Analitica.js';
import Alertas from './views/Alertas.js';
import Leads from './views/Leads.js';
import TableroDiagnosticos from './views/TableroDiagnosticos.js';
import Pipeline from './views/Pipeline.js';
import Consultas from './views/Consultas.js';
import Reservas from './views/Reservas.js';
import Disponibilidad from './views/Disponibilidad.js';
import Recursos from './views/Recursos.js';
import Casos from './views/Casos.js';
import Bio from './views/Bio.js';
import Planeacion from './views/Planeacion.js';
import Conectores from './views/Conectores.js';
import Configuracion from './views/Configuracion.js';
import AlexiaWidget from './components/AlexiaWidget.js';

// Menú agrupado (acordeón). Cada grupo se despliega/colapsa de forma independiente.
const NAV_GROUPS = [
  { sec: 'General', icon: '▦', items: [
    { to: '/dashboard', label: 'Dashboard', icon: '▦' },
    { to: '/analitica', label: 'Analítica', icon: '📊' },
    { to: '/alertas', label: 'Alertas', icon: '🔔' },
  ] },
  { sec: 'Comercial', icon: '◎', items: [
    { to: '/leads', label: 'Leads', icon: '◎' },
    { to: '/tablero', label: 'Diagnósticos Tablero', icon: '⬡' },
    { to: '/pipeline', label: 'Pipeline', icon: '↗' },
    { to: '/reservas', label: 'Reservas', icon: '◷' },
  ] },
  { sec: 'Agenda', icon: '🗓', items: [
    { to: '/consultas', label: 'Consultas', icon: '✦' },
    { to: '/disponibilidad', label: 'Disponibilidad', icon: '🗓' },
  ] },
  { sec: 'Contenido', icon: '✎', items: [
    { to: '/recursos', label: 'Recursos & Blog', icon: '✎' },
    { to: '/casos', label: 'Casos de éxito', icon: '★' },
    { to: '/bio', label: 'Link en Bio', icon: '🔗' },
  ] },
  { sec: 'Estrategia', icon: '🎯', items: [
    { to: '/planeacion', label: 'Planeación', icon: '🎯' },
  ] },
  { sec: 'Sistema', icon: '⚙', items: [
    { to: '/conectores', label: 'Conectores', icon: '⚡' },
    { to: '/configuracion', label: 'Configuración', icon: '⚙' },
  ] },
];

const Layout = {
  components: { RouterView, RouterLink, AlexiaWidget },
  setup() {
    const route = useRoute();
    const collapsed = ref(localStorage.getItem('ngx_sidebar') === '1');
    const toggle = () => { collapsed.value = !collapsed.value; localStorage.setItem('ngx_sidebar', collapsed.value ? '1' : '0'); };
    const logout = () => { auth.clear(); location.href = '/admin/login'; };
    const initials = () => (auth.user?.name || auth.user?.email || 'A').trim().slice(0, 1).toUpperCase();

    // Grupo activo según la ruta actual.
    const activeGroup = computed(() => {
      const g = NAV_GROUPS.find((grp) => grp.items.some((n) => n.to === route.path));
      return g ? g.sec : NAV_GROUPS[0].sec;
    });
    // Estado abierto/cerrado por grupo (arranca con el grupo activo abierto).
    const open = reactive({});
    NAV_GROUPS.forEach((g) => { open[g.sec] = false; });
    const syncActive = () => { open[activeGroup.value] = true; };
    syncActive();
    watch(() => route.path, syncActive);

    const isOpen = (g) => !collapsed.value && !!open[g.sec];
    const groupActive = (g) => g.sec === activeGroup.value;
    function toggleGroup(g) {
      // Si el menú está colapsado (solo iconos), primero lo expande.
      if (collapsed.value) { collapsed.value = false; localStorage.setItem('ngx_sidebar', '0'); open[g.sec] = true; return; }
      open[g.sec] = !open[g.sec];
    }

    return { NAV_GROUPS, auth, logout, initials, collapsed, toggle, isOpen, groupActive, toggleGroup };
  },
  template: `
  <div class="shell" :class="{ 'shell--collapsed': collapsed }">
    <aside class="sidebar">
      <div class="sidebar__brand"><span></span> <b class="sidebar__word">Tonny Dager</b><small class="sidebar__word">Admin</small></div>
      <nav class="sidebar__nav">
        <div class="navgroup" v-for="g in NAV_GROUPS" :key="g.sec" :class="{ 'navgroup--open': isOpen(g), 'navgroup--active': groupActive(g) }">
          <button class="navgroup__head" @click="toggleGroup(g)" :title="g.sec">
            <i class="navi" aria-hidden="true">{{ g.icon }}</i>
            <span class="navtx">{{ g.sec }}</span>
            <span class="navgroup__chev navtx" aria-hidden="true">▾</span>
          </button>
          <div class="navgroup__items" v-show="isOpen(g)">
            <router-link v-for="n in g.items" :key="n.to" :to="n.to" :title="n.label">
              <i class="navi" aria-hidden="true">{{ n.icon }}</i><span class="navtx">{{ n.label }}</span>
            </router-link>
          </div>
        </div>
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
      { path: 'analitica', component: Analitica },
      { path: 'alertas', component: Alertas },
      { path: 'leads', component: Leads },
      { path: 'tablero', component: TableroDiagnosticos },
      { path: 'pipeline', component: Pipeline },
      { path: 'consultas', component: Consultas },
      { path: 'reservas', component: Reservas },
      { path: 'disponibilidad', component: Disponibilidad },
      { path: 'recursos', component: Recursos },
      { path: 'casos', component: Casos },
      { path: 'bio', component: Bio },
      { path: 'planeacion', component: Planeacion },
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
