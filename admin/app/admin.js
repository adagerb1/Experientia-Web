import { createApp, h } from 'vue';
import { createRouter, createWebHistory, RouterView, RouterLink } from 'vue-router';
import { auth } from './store.js';
import { api } from './api.js';

import Login from './views/Login.js';
import Dashboard from './views/Dashboard.js';
import Leads from './views/Leads.js';
import Pipeline from './views/Pipeline.js';
import Consultas from './views/Consultas.js';
import Reservas from './views/Reservas.js';
import Configuracion from './views/Configuracion.js';

const NAV = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/leads', label: 'Leads' },
  { to: '/pipeline', label: 'Pipeline' },
  { to: '/consultas', label: 'Consultas' },
  { to: '/reservas', label: 'Reservas' },
  { to: '/configuracion', label: 'Configuración' }
];

const Layout = {
  components: { RouterView, RouterLink },
  setup() {
    const logout = () => { auth.clear(); location.href = '/admin/login'; };
    return { NAV, auth, logout };
  },
  template: `
  <div class="shell">
    <aside class="sidebar">
      <div class="sidebar__brand"><span></span> Nucleus Admin</div>
      <nav class="sidebar__nav">
        <router-link v-for="n in NAV" :key="n.to" :to="n.to">{{ n.label }}</router-link>
      </nav>
      <div class="sidebar__foot">
        <div>{{ auth.user?.name || auth.user?.email }}</div>
        <button @click="logout">Cerrar sesión</button>
      </div>
    </aside>
    <main class="main"><router-view /></main>
  </div>`
};

const routes = [
  { path: '/login', component: Login, meta: { public: true } },
  {
    path: '/', component: Layout, children: [
      { path: '', redirect: '/dashboard' },
      { path: 'dashboard', component: Dashboard },
      { path: 'leads', component: Leads },
      { path: 'pipeline', component: Pipeline },
      { path: 'consultas', component: Consultas },
      { path: 'reservas', component: Reservas },
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
