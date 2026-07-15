import { createApp, h, ref, reactive, computed, watch } from 'vue';
import { createRouter, createWebHistory, RouterView, RouterLink, useRoute } from 'vue-router';
import { auth } from './store.js';
import { api } from './api.js';

import Login from './views/Login.js';
import Dashboard from './views/Dashboard.js';
import Analitica from './views/Analitica.js';
import Alertas from './views/Alertas.js';
import Leads from './views/Leads.js';
import Conversaciones from './views/Conversaciones.js?v=20260715-4';
import TableroDiagnosticos from './views/TableroDiagnosticos.js';
import Pipeline from './views/Pipeline.js';
import Consultas from './views/Consultas.js';
import Reservas from './views/Reservas.js';
import Disponibilidad from './views/Disponibilidad.js';
import Recursos from './views/Recursos.js';
import Casos from './views/Casos.js';
import Bio from './views/Bio.js';
import Faqs from './views/Faqs.js';
import Planeacion from './views/Planeacion.js';
import Okr from './views/Okr.js';
import Conectores from './views/Conectores.js?v=20260715-3';
import Configuracion from './views/Configuracion.js';
import Usuarios from './views/Usuarios.js';
import Roles from './views/Roles.js';
import Perfil from './views/Perfil.js';
import AlexiaWidget from './components/AlexiaWidget.js';
import Modal from './components/Modal.js';

// Menú agrupado (acordeón). Cada item tiene su permiso (perm) para el RBAC.
const NAV_GROUPS = [
  { sec: 'General', icon: '▦', items: [
    { to: '/dashboard', label: 'Dashboard', icon: '▦', perm: 'dashboard' },
    { to: '/analitica', label: 'Analítica', icon: '📊', perm: 'analitica' },
    { to: '/alertas', label: 'Alertas', icon: '🔔', perm: 'alertas' },
  ] },
  { sec: 'Comercial', icon: '◎', items: [
    { to: '/conversaciones', label: 'Conversaciones', icon: '💬', perm: 'conversaciones' },
    { to: '/leads', label: 'Leads', icon: '◎', perm: 'leads' },
    { to: '/tablero', label: 'Diagnósticos Tablero', icon: '⬡', perm: 'tablero' },
    { to: '/pipeline', label: 'Pipeline', icon: '↗', perm: 'pipeline' },
    { to: '/reservas', label: 'Reservas', icon: '◷', perm: 'reservas' },
  ] },
  { sec: 'Agenda', icon: '🗓', items: [
    { to: '/consultas', label: 'Consultas', icon: '✦', perm: 'consultas' },
    { to: '/disponibilidad', label: 'Disponibilidad', icon: '🗓', perm: 'disponibilidad' },
  ] },
  { sec: 'Contenido', icon: '✎', items: [
    { to: '/recursos', label: 'Recursos & Blog', icon: '✎', perm: 'recursos' },
    { to: '/casos', label: 'Casos de éxito', icon: '★', perm: 'casos' },
    { to: '/bio', label: 'Link en Bio', icon: '🔗', perm: 'bio' },
    { to: '/faqs', label: 'Preguntas frecuentes', icon: '❓', perm: 'faqs' },
  ] },
  { sec: 'Estrategia', icon: '🎯', items: [
    { to: '/okr', label: 'OKR', icon: '🎯', perm: 'okr' },
    { to: '/planeacion', label: 'Planeación', icon: '🗓', perm: 'planeacion' },
  ] },
  { sec: 'Sistema', icon: '⚙', items: [
    { to: '/conectores', label: 'Conectores', icon: '⚡', perm: 'conectores' },
    { to: '/usuarios', label: 'Usuarios', icon: '👤', perm: 'usuarios' },
    { to: '/roles', label: 'Roles y permisos', icon: '🛡', perm: 'usuarios' },
    { to: '/configuracion', label: 'Configuración', icon: '⚙', perm: 'configuracion' },
  ] },
];

const Layout = {
  components: { RouterView, RouterLink, AlexiaWidget, Modal },
  setup() {
    const route = useRoute();
    const collapsed = ref(localStorage.getItem('ngx_sidebar') === '1');
    // Tema del panel (light = referencia Lexis por defecto / navy = marca). Preferencia por usuario.
    const theme = ref(localStorage.getItem('ngx_admin_theme') === 'navy' ? 'navy' : 'light');
    function toggleTheme() { theme.value = theme.value === 'navy' ? 'light' : 'navy'; localStorage.setItem('ngx_admin_theme', theme.value); }

    // ---- Conexión con Telegram (bot interno AlexIA) por QR ----
    const tgOpen = ref(false); const tgBusy = ref(false); const tgMsg = ref('');
    const tgStatus = reactive({ active: false, has_bot: false, connected: false, bot_username: '' });
    const tgLink = ref(''); const tgQr = ref('');
    async function loadTgStatus() {
      try { Object.assign(tgStatus, (await api.telegramStatus()).data || {}); } catch (e) { /* silencioso */ }
    }
    async function openTelegram() {
      tgOpen.value = true; tgMsg.value = ''; tgLink.value = ''; tgQr.value = '';
      await loadTgStatus();
      if (!tgStatus.active || !tgStatus.has_bot) { tgMsg.value = 'Primero configura y activa el bot interno de Telegram en Conectores.'; return; }
      tgBusy.value = true;
      try {
        const r = await api.telegramLink();
        tgLink.value = r.data.deep_link;
        // QR generado en el navegador (sin dependencias en el bundle).
        try {
          const mod = await import('https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/+esm');
          const qr = (mod.default || mod)(0, 'M'); qr.addData(tgLink.value); qr.make();
          tgQr.value = qr.createDataURL(6, 10);
        } catch (e) { tgQr.value = ''; }
      } catch (e) { tgMsg.value = e.message; } finally { tgBusy.value = false; }
    }
    async function unlinkTelegram() {
      try { await api.telegramUnlink(); await loadTgStatus(); tgMsg.value = 'Desvinculado.'; } catch (e) { tgMsg.value = e.message; }
    }
    onMountedTg();
    function onMountedTg() { loadTgStatus(); }
    const toggle = () => { collapsed.value = !collapsed.value; localStorage.setItem('ngx_sidebar', collapsed.value ? '1' : '0'); };
    const logout = () => { auth.clear(); location.href = '/admin/login'; };
    const initials = () => (auth.user?.name || auth.user?.email || 'A').trim().slice(0, 1).toUpperCase();

    // Top-bar: fecha y salud operativa (Lexis 3.2).
    const todayLabel = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
    const health = reactive({ level: 'ok', label: 'Operación estable' });
    async function loadHealth() {
      try {
        const a = (await api.alerts()).data || {};
        const list = a.alerts || [];
        const high = list.filter((x) => x.severity === 'high').length;
        if (high) { health.level = 'risk'; health.label = high + (high === 1 ? ' señal crítica' : ' señales críticas'); }
        else if (list.length) { health.level = 'warn'; health.label = list.length + (list.length === 1 ? ' alerta por revisar' : ' alertas por revisar'); }
        else { health.level = 'ok'; health.label = 'Operación estable'; }
      } catch (e) { /* silencioso */ }
    }
    loadHealth();

    // Refresca permisos y rol del usuario desde el servidor (por si cambiaron).
    async function refreshMe() {
      try {
        const r = await api.me();
        if (r && r.data) {
          auth.setPermissions(r.data.permissions);
          if (auth.user) { auth.user.role = r.data.role; auth.user.role_label = r.data.role_label; localStorage.setItem('ngx_user', JSON.stringify(auth.user)); }
        }
      } catch (e) { /* mantiene lo guardado */ }
    }
    refreshMe();

    // Menú filtrado por los permisos del usuario.
    const navGroups = computed(() => NAV_GROUPS
      .map((g) => ({ ...g, items: g.items.filter((n) => auth.can(n.perm)) }))
      .filter((g) => g.items.length));

    // Grupo activo según la ruta actual.
    const activeGroup = computed(() => {
      const g = navGroups.value.find((grp) => grp.items.some((n) => n.to === route.path));
      return g ? g.sec : (navGroups.value[0]?.sec || '');
    });
    // Estado abierto/cerrado por grupo — acordeón: solo un grupo abierto a la vez.
    const open = reactive({});
    NAV_GROUPS.forEach((g) => { open[g.sec] = false; });
    const setOnlyOpen = (sec) => { NAV_GROUPS.forEach((g) => { open[g.sec] = (g.sec === sec); }); };
    const syncActive = () => { setOnlyOpen(activeGroup.value); };
    syncActive();
    watch(() => route.path, syncActive);

    const isOpen = (g) => !collapsed.value && !!open[g.sec];
    const groupActive = (g) => g.sec === activeGroup.value;
    function toggleGroup(g) {
      // Si el menú está colapsado (solo iconos), primero lo expande y abre este grupo.
      if (collapsed.value) { collapsed.value = false; localStorage.setItem('ngx_sidebar', '0'); setOnlyOpen(g.sec); return; }
      // Acordeón: si ya estaba abierto lo cierra; si no, abre este y colapsa los demás.
      if (open[g.sec]) open[g.sec] = false; else setOnlyOpen(g.sec);
    }

    return { navGroups, auth, logout, initials, collapsed, toggle, isOpen, groupActive, toggleGroup,
      tgOpen, tgBusy, tgMsg, tgStatus, tgLink, tgQr, openTelegram, unlinkTelegram, todayLabel, health,
      theme, toggleTheme };
  },
  template: `
  <div class="shell" :class="{ 'shell--collapsed': collapsed }" :data-adm-theme="theme">
    <aside class="sidebar">
      <div class="sidebar__brand"><span></span> <b class="sidebar__word">Tonny Dager</b><small class="sidebar__word">Admin</small></div>
      <nav class="sidebar__nav">
        <div class="navgroup" v-for="g in navGroups" :key="g.sec" :class="{ 'navgroup--open': isOpen(g), 'navgroup--active': groupActive(g) }">
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
      <button class="sidebar__tg" @click="openTelegram" :title="tgStatus.connected ? 'Telegram conectado' : 'Conectar Telegram (AlexIA)'">
        <i class="navi" aria-hidden="true">✈️</i>
        <span class="navtx">{{ tgStatus.connected ? 'Telegram conectado' : 'Conectar Telegram' }}</span>
        <span v-if="tgStatus.connected" class="sidebar__tg-dot navtx" aria-hidden="true">●</span>
      </button>
      <button class="sidebar__collapse" @click="toggleTheme" :title="theme==='navy' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'">
        <span aria-hidden="true">{{ theme==='navy' ? '☀' : '☾' }}</span><span class="navtx">{{ theme==='navy' ? 'Tema claro' : 'Tema oscuro' }}</span>
      </button>
      <button class="sidebar__collapse" @click="toggle" :aria-label="collapsed ? 'Expandir menú' : 'Colapsar menú'" :title="collapsed ? 'Expandir' : 'Colapsar'">
        <span aria-hidden="true">{{ collapsed ? '»' : '«' }}</span><span class="navtx">Colapsar</span>
      </button>
    </aside>

    <modal v-if="tgOpen" title="Conectar Telegram · AlexIA" @close="tgOpen = false">
      <div class="tg-connect">
        <p class="muted" style="margin-top:0">Vincula tu Telegram para consultarle a AlexIA sobre el negocio desde tu celular. La conexión queda asociada a tu usuario y su nivel de acceso.</p>
        <p v-if="tgMsg" class="error">{{ tgMsg }}</p>
        <template v-if="tgStatus.connected">
          <div class="tg-connected">✅ Tu Telegram ya está conectado<span v-if="tgStatus.bot_username"> a @{{ tgStatus.bot_username }}</span>.</div>
          <button class="btn btn--ghost btn--sm" @click="unlinkTelegram">Desvincular</button>
        </template>
        <template v-else-if="tgLink">
          <div class="tg-qr">
            <img v-if="tgQr" :src="tgQr" alt="QR para conectar Telegram" />
            <p v-else class="muted">No se pudo generar el QR. Usa el botón de abajo desde tu celular.</p>
          </div>
          <p class="tg-steps">1. Abre la cámara o Telegram en tu celular y escanea el QR.<br>2. Pulsa <b>Iniciar</b> en el chat del bot. ¡Listo!</p>
          <div class="flex" style="gap:8px;flex-wrap:wrap">
            <a :href="tgLink" target="_blank" rel="noopener" class="btn btn--sm">Abrir en Telegram</a>
            <button class="btn btn--ghost btn--sm" @click="openTelegram">Generar nuevo QR</button>
          </div>
          <p class="muted" style="font-size:.78rem">El enlace expira en 15 minutos por seguridad.</p>
        </template>
        <div v-else-if="tgBusy" class="muted">Generando enlace…</div>
      </div>
    </modal>
    <div class="content">
      <header class="appbar">
        <button class="appbar__toggle" @click="toggle" aria-label="Colapsar o expandir menú">☰</button>
        <div class="appbar__ctx">
          <span class="appbar__date">{{ todayLabel }}</span>
          <span class="appbar__health" :class="'appbar__health--'+health.level" :title="'Salud operativa'"><span class="appbar__health-dot"></span>{{ health.label }}</span>
        </div>
        <div class="appbar__right">
          <router-link to="/perfil" class="appbar__user" title="Mi perfil"><span class="avatar">{{ initials() }}</span><span class="appbar__uname">{{ auth.user?.name || auth.user?.email }}</span></router-link>
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
      { path: 'conversaciones', component: Conversaciones, meta: { perm: 'conversaciones' } },
      { path: 'tablero', component: TableroDiagnosticos },
      { path: 'pipeline', component: Pipeline },
      { path: 'consultas', component: Consultas },
      { path: 'reservas', component: Reservas },
      { path: 'disponibilidad', component: Disponibilidad },
      { path: 'recursos', component: Recursos },
      { path: 'casos', component: Casos },
      { path: 'bio', component: Bio },
      { path: 'faqs', component: Faqs },
      { path: 'okr', component: Okr, meta: { perm: 'okr' } },
      { path: 'planeacion', component: Planeacion },
      { path: 'conectores', component: Conectores },
      { path: 'usuarios', component: Usuarios, meta: { perm: 'usuarios' } },
      { path: 'roles', component: Roles, meta: { perm: 'usuarios' } },
      { path: 'perfil', component: Perfil },
      { path: 'configuracion', component: Configuracion, meta: { perm: 'configuracion' } }
    ]
  }
];

const router = createRouter({ history: createWebHistory('/admin/'), routes });

// Guard: token + permiso por ruta (RBAC).
router.beforeEach((to) => {
  if (!to.meta.public && !auth.isAuthed()) return '/login';
  if (to.path === '/login' && auth.isAuthed()) return '/dashboard';
  if (to.meta.perm && !auth.can(to.meta.perm)) return '/dashboard'; // sin permiso → al dashboard
  return true;
});

createApp({ render: () => h(RouterView) }).use(router).mount('#admin');
