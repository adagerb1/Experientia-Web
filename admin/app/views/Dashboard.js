import { ref, computed, onMounted } from 'vue';
import { RouterLink } from 'vue-router';
import { api } from '../api.js';
import { GaugeRing, DonutChart, BarList, TrendArea, FunnelChart } from '../components/Charts.js';

const ALERT_ICON = { hot_lead: '🔥', booking_unconfirmed: '⏰', payment_stuck: '💳', diagnostic_no_booking: '⬡', meeting_no_result: '📝' };

export default {
  components: { GaugeRing, DonutChart, BarList, TrendArea, FunnelChart, RouterLink },
  setup() {
    const data = ref(null); const alerts = ref(null); const error = ref(''); const loading = ref(true); const updatedAt = ref(null);
    async function load() {
      loading.value = !data.value;
      try {
        const [d, a] = await Promise.all([api.dashboard(), api.alerts().catch(() => ({ data: null }))]);
        data.value = d.data; alerts.value = a.data; updatedAt.value = new Date();
      } catch (e) { error.value = e.message; } finally { loading.value = false; }
    }
    onMounted(load);

    const money = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
    const compact = (n) => new Intl.NumberFormat('es-CO', { notation: 'compact', maximumFractionDigits: 1 }).format(n || 0);
    const today = new Date().toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long' });
    const updatedLabel = computed(() => updatedAt.value ? updatedAt.value.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' }) : '');

    // Métricas norte (decisión C-level).
    const north = computed(() => {
      const t = data.value?.totals; if (!t) return [];
      const conv = t.leads ? Math.round((t.confirmed / t.leads) * 1000) / 10 : 0;
      const ticket = t.confirmed ? t.revenue / t.confirmed : 0;
      const bookRate = t.leads ? Math.round((t.bookings / t.leads) * 1000) / 10 : 0;
      return [
        { label: 'Ingresos confirmados', val: money(t.revenue), hint: 'Pagos aprobados', tone: 'green' },
        { label: 'Ticket promedio', val: money(ticket), hint: 'Por reunión confirmada', tone: 'blue' },
        { label: 'Conversión lead → pago', val: conv + '%', hint: t.confirmed + ' de ' + t.leads + ' leads', tone: conv >= 5 ? 'green' : (conv > 0 ? 'amber' : 'red') },
        { label: 'Tasa de reserva', val: bookRate + '%', hint: t.bookings + ' reservas', tone: 'blue' }
      ];
    });
    const secondary = computed(() => {
      const t = data.value?.totals; if (!t) return [];
      return [
        { label: 'Leads totales', val: t.leads, sub: t.leads_7d ? '+' + t.leads_7d + ' esta semana' : '' },
        { label: 'Diagnósticos', val: t.tablero, sub: (t.tablero_avg || 0) + ' / 55 prom.' },
        { label: 'Reservas', val: t.bookings },
        { label: 'Confirmadas', val: t.confirmed }
      ];
    });
    const routeItems = computed(() => (data.value?.by_route || []).map((r) => ({ label: r.route, value: Number(r.total) })));
    const levelItems = computed(() => (data.value?.tablero_by_level || []).map((r) => ({ label: r.level || '—', value: Number(r.total) })));
    const lineItems = computed(() => (data.value?.tablero_weak_lines || []).map((r) => ({ label: r.weakest_line, value: Number(r.total) })));
    const topAlerts = computed(() => (alerts.value?.alerts || []).slice(0, 5));
    const alertIcon = (t) => ALERT_ICON[t] || '•';

    return { data, alerts, error, loading, money, compact, north, secondary, routeItems, levelItems, lineItems,
      topAlerts, alertIcon, today, updatedLabel, load };
  },
  template: `
  <div class="view">
    <div class="topbar">
      <div><h1>Dashboard</h1><p class="topbar__sub">{{ today }} · el pulso del negocio en una sola vista.</p></div>
      <div class="flex">
        <span v-if="updatedLabel" class="tag" title="Última actualización">Actualizado {{ updatedLabel }}</span>
        <button class="btn btn--ghost btn--sm" @click="load">↻</button>
      </div>
    </div>
    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="loading" class="cards"><div class="stat stat--skeleton" v-for="i in 4" :key="i"></div></div>

    <transition name="fade">
    <div v-if="data">
      <!-- Métricas norte -->
      <div class="north-grid">
        <div class="north" :class="'north--'+n.tone" v-for="(n,i) in north" :key="i" :style="{ animationDelay: (i*55)+'ms' }">
          <div class="north__val">{{ n.val }}</div>
          <div class="north__label">{{ n.label }}</div>
          <div class="north__hint">{{ n.hint }}</div>
        </div>
      </div>

      <!-- Prioridades + embudo -->
      <div class="grid-2">
        <div class="panel panel--glow">
          <div class="flex between"><h2>Prioridades de hoy</h2>
            <router-link to="/alertas" class="link" style="font-size:.85rem">Ver todas →</router-link></div>
          <div class="dash-alerts" v-if="topAlerts.length">
            <router-link :to="a.entity==='lead' ? '/leads' : '/reservas'" class="dash-alert" :class="'sev-'+a.severity" v-for="(a,i) in topAlerts" :key="i">
              <span class="dash-alert__ico">{{ alertIcon(a.type) }}</span>
              <span class="dash-alert__body"><strong>{{ a.title }}</strong><small>{{ a.detail }}</small></span>
            </router-link>
          </div>
          <p v-else class="muted center" style="padding:24px">✓ Todo al día. Sin prioridades urgentes.</p>
        </div>
        <div class="panel">
          <h2>Embudo comercial</h2>
          <funnel-chart :items="data.funnel || []" />
        </div>
      </div>

      <!-- Métricas de apoyo -->
      <div class="cards cards--tight">
        <div class="stat stat--mini" v-for="s in secondary" :key="s.label">
          <div class="stat__num">{{ s.val }}</div><div class="stat__label">{{ s.label }}</div>
          <span v-if="s.sub" class="stat__delta">{{ s.sub }}</span>
        </div>
      </div>

      <div class="grid-2">
        <div class="panel"><h2>Leads por semana (últimas 8)</h2><trend-area :items="data.weekly_leads || []" /></div>
        <div class="panel"><h2>Leads por ruta</h2>
          <donut-chart :items="routeItems" v-if="routeItems.length" /><p v-else class="muted">Sin datos aún.</p></div>
      </div>

      <div class="grid-2">
        <div class="panel panel--glow">
          <h2>Madurez promedio del Tablero</h2>
          <div class="gauge-block">
            <gauge-ring :value="data.totals.tablero_avg || 0" :max="55" />
            <div class="gauge-block__legend">
              <p>Promedio sobre <b>{{ data.totals.tablero }}</b> diagnóstico(s).</p>
              <ul class="scale-legend">
                <li><span class="dot dot--red"></span>11–25 · Modo reacción</li>
                <li><span class="dot dot--amber"></span>26–40 · Con fugas</li>
                <li><span class="dot dot--blue"></span>41–50 · Lista para escalar</li>
                <li><span class="dot dot--green"></span>51–55 · Optimizable</li>
              </ul>
            </div>
          </div>
        </div>
        <div class="panel"><h2>Líneas más débiles (cancha)</h2><bar-list :items="lineItems" /></div>
      </div>

      <div class="panel"><h2>Diagnósticos por nivel de madurez</h2><bar-list :items="levelItems" /></div>
    </div>
    </transition>
  </div>`
};
