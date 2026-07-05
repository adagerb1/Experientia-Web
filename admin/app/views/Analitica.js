import { ref, computed, onMounted } from 'vue';
import { api } from '../api.js';
import { BarList, DonutChart, FunnelChart, TrendArea } from '../components/Charts.js';

const money = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);

export default {
  components: { BarList, DonutChart, FunnelChart, TrendArea },
  setup() {
    const data = ref(null); const error = ref(''); const loading = ref(true);
    const attrDim = ref('by_source');

    async function load() {
      loading.value = true;
      try { data.value = (await api.analytics()).data; } catch (e) { error.value = e.message; }
      finally { loading.value = false; }
    }
    onMounted(load);

    const attrRows = computed(() => (data.value?.attribution?.[attrDim.value]) || []);
    const bySource = computed(() => data.value?.attribution?.by_source || []);
    const revenueItems = computed(() => (data.value?.revenue_monthly || []).map((r) => ({ label: r.label, value: Math.round(r.value / 1000) })));
    const leadItems = computed(() => data.value?.leads_monthly || []);
    const campaignRev = computed(() => (data.value?.top_campaigns_revenue || []).map((r) => ({ label: r.label, value: Math.round(r.revenue / 1000) })));

    // KPIs estratégicos (para dirección).
    const strategic = computed(() => {
      const src = bySource.value; if (!src.length) return [];
      const leads = src.reduce((a, r) => a + (r.leads || 0), 0);
      const booked = src.reduce((a, r) => a + (r.booked || 0), 0);
      const revenue = src.reduce((a, r) => a + (r.revenue || 0), 0);
      const conv = leads ? Math.round((booked / leads) * 1000) / 10 : 0;
      const bestSrc = [...src].filter((r) => r.leads >= 3).sort((a, b) => b.conv - a.conv)[0] || src[0];
      const camps = data.value?.top_campaigns_revenue || [];
      return [
        { label: 'Ingreso atribuido', val: money(revenue), period: 'Acumulado', hint: 'Pagos aprobados por origen', tone: 'green' },
        { label: 'Conversión global', val: conv + '%', period: 'Lead → reserva', hint: booked + ' reservas de ' + leads + ' leads', tone: conv >= 10 ? 'green' : (conv > 0 ? 'amber' : 'red') },
        { label: 'Mejor origen', val: bestSrc ? bestSrc.label : '—', period: 'Por conversión', hint: bestSrc ? bestSrc.conv + '% conversión' : 'Sin datos', tone: 'blue' },
        { label: 'Campaña top', val: camps.length ? camps[0].label : '—', period: 'Por ingreso', hint: camps.length ? money(camps[0].revenue) : 'Sin ingresos aún', tone: 'blue' }
      ];
    });

    // Lecturas clave (insights derivados).
    const insights = computed(() => {
      const out = []; const d = data.value; if (!d) return out;
      const src = [...(d.attribution?.by_source || [])].filter((r) => r.leads >= 3).sort((a, b) => b.conv - a.conv);
      if (src.length) out.push(`Tu origen que mejor convierte es <b>${src[0].label}</b> (${src[0].conv}%). Prioriza invertir ahí.`);
      const f = d.funnel || [];
      let worst = null;
      for (let i = 1; i < f.length; i++) { if (worst === null || f[i].step_conv < f[worst].step_conv) worst = i; }
      if (worst) out.push(`La mayor fuga del embudo está entre <b>${f[worst - 1].label}</b> y <b>${f[worst].label}</b> (solo pasa el ${f[worst].step_conv}%). Ahí está tu palanca.`);
      const temp = d.segments?.temperature || [];
      const hot = temp.find((t) => t.label === 'Caliente');
      const totalT = temp.reduce((a, t) => a + t.value, 0);
      if (hot && totalT) out.push(`El <b>${Math.round((hot.value / totalT) * 100)}%</b> de tus leads están calientes: contáctalos antes de 48h.`);
      return out;
    });

    return { data, error, loading, attrDim, attrRows, revenueItems, leadItems, campaignRev, strategic, insights, money, load };
  },
  template: `
  <div class="view">
    <div class="topbar"><div><h1>Analítica de negocio</h1><p class="topbar__sub">De dónde viene el crecimiento: atribución, conversión y segmentos.</p></div>
      <button class="btn btn--ghost btn--sm" @click="load">↻ Actualizar</button></div>
    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="loading" class="skeleton-table"><div class="skeleton-row" v-for="i in 6" :key="i" style="height:80px"></div></div>

    <template v-else-if="data">
      <!-- KPIs estratégicos -->
      <div class="north-grid" v-if="strategic.length">
        <div class="north" :class="'north--'+n.tone" v-for="(n,i) in strategic" :key="i">
          <div class="north__period">{{ n.period }}</div>
          <div class="north__val">{{ n.val }}</div>
          <div class="north__label">{{ n.label }}</div>
          <div class="north__hint">{{ n.hint }}</div>
        </div>
      </div>

      <!-- Lecturas clave -->
      <div class="panel panel--glow insights" v-if="insights.length">
        <h2>Lecturas clave</h2>
        <ul class="insights__list">
          <li v-for="(t,i) in insights" :key="i"><span class="insights__dot">✦</span><span v-html="t"></span></li>
        </ul>
      </div>

      <div class="grid-2">
        <div class="panel">
          <div class="flex between"><h2>Atribución por origen</h2>
            <select v-model="attrDim" class="sel-sm">
              <option value="by_source">Fuente</option>
              <option value="by_medium">Medio</option>
              <option value="by_campaign">Campaña</option>
            </select>
          </div>
          <div class="dt__scroll">
            <table class="table--rich">
              <thead><tr><th>Origen</th><th class="ta-center">Leads</th><th class="ta-center">Reservó</th><th>Conversión</th><th class="ta-right">Ganado</th></tr></thead>
              <tbody>
                <tr v-for="(r,i) in attrRows" :key="i">
                  <td><strong>{{ r.label }}</strong></td><td class="ta-center">{{ r.leads }}</td><td class="ta-center">{{ r.booked }}</td>
                  <td><div class="conv-cell"><div class="conv-bar"><span :style="{ width: Math.min(100,r.conv)+'%' }" :class="r.conv>=15?'is-good':(r.conv>0?'is-mid':'is-low')"></span></div><b>{{ r.conv }}%</b></div></td>
                  <td class="ta-right">{{ money(r.revenue) }}</td>
                </tr>
                <tr v-if="!attrRows.length"><td colspan="5" class="muted center">Sin datos de atribución aún.</td></tr>
              </tbody>
            </table>
          </div>
        </div>
        <div class="panel"><div class="chart-head"><h2>Embudo de conversión</h2><span class="chart-meta">Acumulado · paso a paso del lead al pago</span></div><funnel-chart :items="data.funnel" /></div>
      </div>

      <div class="grid-3">
        <div class="panel"><div class="chart-head"><h2>Temperatura comercial</h2><span class="chart-meta">Distribución de leads</span></div>
          <donut-chart :items="data.segments.temperature" v-if="data.segments.temperature.length" /><p v-else class="muted">Sin leads todavía para segmentar.</p></div>
        <div class="panel"><div class="chart-head"><h2>Por sector</h2><span class="chart-meta">Leads por industria</span></div><bar-list :items="data.segments.sector" /></div>
        <div class="panel"><div class="chart-head"><h2>Por tamaño de empresa</h2><span class="chart-meta">Leads por tamaño</span></div><bar-list :items="data.segments.company_size" /></div>
      </div>

      <div class="grid-3">
        <div class="panel"><h2>Por facturación</h2><bar-list :items="data.segments.revenue" /></div>
        <div class="panel"><h2>Leads por mes</h2><trend-area :items="leadItems" /></div>
        <div class="panel"><h2>Ingresos por mes <small class="muted">(miles COP)</small></h2><trend-area :items="revenueItems" /></div>
      </div>

      <div class="panel" v-if="campaignRev.length">
        <h2>Campañas por ingreso <small class="muted">(miles COP)</small></h2>
        <bar-list :items="campaignRev" suffix="k" />
      </div>
    </template>
  </div>`
};
