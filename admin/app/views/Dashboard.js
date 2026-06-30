import { ref, computed, onMounted } from 'vue';
import { api } from '../api.js';
import { GaugeRing, DonutChart, BarList } from '../components/Charts.js';

const ICONS = { leads: '◎', leads_7d: '↗', bookings: '▦', confirmed: '✓', revenue: '$', tablero: '⬡' };

export default {
  components: { GaugeRing, DonutChart, BarList },
  setup() {
    const data = ref(null); const error = ref(''); const loading = ref(true);
    onMounted(async () => {
      try { data.value = (await api.dashboard()).data; }
      catch (e) { error.value = e.message; }
      finally { loading.value = false; }
    });
    const money = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);

    const stats = computed(() => {
      if (!data.value) return [];
      const t = data.value.totals;
      return [
        { k: 'leads', label: 'Leads totales', val: t.leads },
        { k: 'leads_7d', label: 'Leads (7 días)', val: t.leads_7d },
        { k: 'tablero', label: 'Diagnósticos Tablero', val: t.tablero },
        { k: 'bookings', label: 'Reservas', val: t.bookings },
        { k: 'confirmed', label: 'Confirmadas', val: t.confirmed },
        { k: 'revenue', label: 'Ingresos confirmados', val: money(t.revenue) }
      ];
    });
    const routeItems = computed(() => (data.value?.by_route || []).map((r) => ({ label: r.route, value: Number(r.total) })));
    const levelItems = computed(() => (data.value?.tablero_by_level || []).map((r) => ({ label: r.level || '—', value: Number(r.total) })));
    const lineItems = computed(() => (data.value?.tablero_weak_lines || []).map((r) => ({ label: r.weakest_line, value: Number(r.total) })));

    return { data, error, loading, money, stats, routeItems, levelItems, lineItems, ICONS };
  },
  template: `
  <div class="view">
    <div class="topbar"><div><h1>Dashboard</h1><p class="topbar__sub">Crecimiento, demanda y diagnóstico en una sola vista.</p></div></div>
    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="loading" class="cards">
      <div class="stat stat--skeleton" v-for="i in 6" :key="i"></div>
    </div>

    <transition name="fade">
    <div v-if="data">
      <div class="cards">
        <div class="stat stat--lift" v-for="(s,i) in stats" :key="s.k" :style="{ animationDelay: (i*55)+'ms' }">
          <span class="stat__icon">{{ ICONS[s.k] }}</span>
          <div class="stat__num">{{ s.val }}</div>
          <div class="stat__label">{{ s.label }}</div>
        </div>
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
        <div class="panel">
          <h2>Leads por ruta</h2>
          <donut-chart :items="routeItems" v-if="routeItems.length" />
          <p v-else class="muted">Sin datos de rutas aún.</p>
        </div>
      </div>

      <div class="grid-2">
        <div class="panel">
          <h2>Diagnósticos por nivel de madurez</h2>
          <bar-list :items="levelItems" />
        </div>
        <div class="panel">
          <h2>Líneas más débiles (cancha)</h2>
          <bar-list :items="lineItems" />
        </div>
      </div>

      <div class="panel">
        <h2>Leads recientes</h2>
        <table>
          <thead><tr><th>Nombre</th><th>Email</th><th>Ruta</th><th>Fuente</th><th>Fecha</th></tr></thead>
          <tbody>
            <tr v-for="l in data.recent_leads" :key="l.id">
              <td>{{ l.name || '—' }}</td><td>{{ l.email || '—' }}</td>
              <td><span class="badge">{{ l.recommended_route || '—' }}</span></td>
              <td>{{ l.source }}</td><td class="muted">{{ (l.created_at||'').slice(0,16) }}</td>
            </tr>
            <tr v-if="!data.recent_leads.length"><td colspan="5" class="muted center">Sin leads aún.</td></tr>
          </tbody>
        </table>
      </div>
    </div>
    </transition>
  </div>`
};
