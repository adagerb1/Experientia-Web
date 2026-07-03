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
    const revenueItems = computed(() => (data.value?.revenue_monthly || []).map((r) => ({ label: r.label, value: Math.round(r.value / 1000) })));
    const leadItems = computed(() => data.value?.leads_monthly || []);
    const campaignRev = computed(() => (data.value?.top_campaigns_revenue || []).map((r) => ({ label: r.label, value: Math.round(r.revenue / 1000) })));

    return { data, error, loading, attrDim, attrRows, revenueItems, leadItems, campaignRev, money, load };
  },
  template: `
  <div class="view">
    <div class="topbar"><div><h1>Analítica de negocio</h1><p class="topbar__sub">Atribución, segmentos y embudo de conversión.</p></div>
      <button class="btn btn--ghost btn--sm" @click="load">↻ Actualizar</button></div>
    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="loading" class="skeleton-table"><div class="skeleton-row" v-for="i in 6" :key="i" style="height:80px"></div></div>

    <template v-else-if="data">
      <div class="grid-2">
        <div class="panel">
          <div class="flex between"><h2>Atribución por origen</h2>
            <select v-model="attrDim" class="sel-sm">
              <option value="by_source">Fuente (utm_source)</option>
              <option value="by_medium">Medio (utm_medium)</option>
              <option value="by_campaign">Campaña (utm_campaign)</option>
            </select>
          </div>
          <table class="table--rich">
            <thead><tr><th>Origen</th><th>Leads</th><th>Reservaron</th><th>Conv.</th><th>Ganado</th></tr></thead>
            <tbody>
              <tr v-for="(r,i) in attrRows" :key="i">
                <td><strong>{{ r.label }}</strong></td><td>{{ r.leads }}</td><td>{{ r.booked }}</td>
                <td><span class="pill" :class="r.conv >= 15 ? 'pill--green' : (r.conv > 0 ? 'pill--amber' : 'pill--red')">{{ r.conv }}%</span></td>
                <td>{{ money(r.revenue) }}</td>
              </tr>
              <tr v-if="!attrRows.length"><td colspan="5" class="muted center">Sin datos de atribución aún.</td></tr>
            </tbody>
          </table>
        </div>

        <div class="panel"><h2>Embudo de conversión</h2>
          <funnel-chart :items="data.funnel" />
        </div>
      </div>

      <div class="grid-3">
        <div class="panel"><h2>Temperatura comercial</h2>
          <donut-chart :items="data.segments.temperature" v-if="data.segments.temperature.length" />
          <p v-else class="muted">Sin leads aún.</p>
        </div>
        <div class="panel"><h2>Por sector</h2><bar-list :items="data.segments.sector" /></div>
        <div class="panel"><h2>Por tamaño de empresa</h2><bar-list :items="data.segments.company_size" /></div>
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
