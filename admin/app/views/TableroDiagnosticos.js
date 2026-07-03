import { ref, computed, onMounted } from 'vue';
import { api } from '../api.js';
import { ZONES } from '/app/data/tablero.js';
import Modal from '../components/Modal.js';
import DataTable from '../components/DataTable.js';
import { RadarChart, BarList, GaugeRing } from '../components/Charts.js';

const ZONE_ORDER = ZONES.map((z) => ({ key: z.key, name: z.name }));

function safeParse(v) {
  if (!v) return {};
  if (typeof v === 'object') return v;
  try { return JSON.parse(v); } catch (e) { return {}; }
}
function bandTone(total) {
  if (total <= 25) return 'red';
  if (total <= 40) return 'amber';
  if (total <= 50) return 'blue';
  return 'green';
}

export default {
  components: { Modal, RadarChart, BarList, GaugeRing, DataTable },
  setup() {
    const rows = ref([]); const error = ref(''); const loading = ref(true);
    const selected = ref(null);

    async function load() {
      loading.value = true;
      try { rows.value = (await api.tablero()).data || []; }
      catch (e) { error.value = e.message; }
      finally { loading.value = false; }
    }
    onMounted(load);

    const columns = [
      { key: 'company', label: 'Empresa / Contacto' },
      { key: 'total', label: 'Puntaje', align: 'center', width: '100px', sortValue: (r) => r.total || 0 },
      { key: 'level', label: 'Nivel', filter: true },
      { key: 'weakest_line', label: 'Línea débil', filter: true },
      { key: 'critical_zone', label: 'Zona crítica' },
      { key: 'urgency', label: 'Urgencia', filter: ['alta', 'media', 'baja'], width: '110px' },
      { key: 'created_at', label: 'Fecha', width: '130px' }
    ];

    const kpis = computed(() => {
      const n = rows.value.length;
      const avg = n ? Math.round((rows.value.reduce((a, b) => a + (b.total || 0), 0) / n) * 10) / 10 : 0;
      const top = rows.value.filter((r) => (r.total || 0) >= 41).length;
      const crit = rows.value.filter((r) => (r.total || 0) <= 25).length;
      return { n, avg, top, crit };
    });

    // Datos derivados para el modal.
    const radarAxes = computed(() => {
      if (!selected.value) return [];
      const s = safeParse(selected.value.scores_json);
      return ZONE_ORDER.map((z) => ({ label: z.name, value: Number(s[z.key]) || 0 }));
    });
    const lineBars = computed(() => {
      if (!selected.value) return [];
      const l = safeParse(selected.value.lines_json);
      return Object.values(l).map((x) => ({ label: x.name, value: x.pct }));
    });
    const wa = (n) => n ? `https://wa.me/${String(n).replace(/[^0-9]/g, '')}` : '#';
    const fmtDate = (d) => (d || '').slice(0, 16).replace('T', ' ');

    return { rows, columns, error, loading, selected, kpis, bandTone,
      radarAxes, lineBars, wa, fmtDate, load };
  },
  template: `
  <div class="view">
    <div class="topbar">
      <div><h1>Diagnósticos Tablero</h1><p class="topbar__sub">Lectura de la cancha de crecimiento por empresa.</p></div>
      <button class="btn btn--ghost btn--sm" @click="load">↻ Actualizar</button>
    </div>

    <p v-if="error" class="error">{{ error }}</p>

    <div class="cards cards--tight" v-if="!loading">
      <div class="stat stat--mini"><div class="stat__num">{{ kpis.n }}</div><div class="stat__label">Diagnósticos</div></div>
      <div class="stat stat--mini"><div class="stat__num">{{ kpis.avg }}<small> / 55</small></div><div class="stat__label">Promedio</div></div>
      <div class="stat stat--mini"><div class="stat__num">{{ kpis.top }}</div><div class="stat__label">Listas para escalar</div></div>
      <div class="stat stat--mini"><div class="stat__num">{{ kpis.crit }}</div><div class="stat__label">En modo reacción</div></div>
    </div>

    <div v-if="loading" class="skeleton-table">
      <div class="skeleton-row" v-for="i in 6" :key="i"></div>
    </div>

    <div v-else class="panel panel--flush">
      <data-table :rows="rows" :columns="columns" :page-size="15" :search-keys="['name','email','company','critical_zone']"
        empty-text="No hay diagnósticos que coincidan con el filtro.">
        <template #cell-company="{ row }">
          <div class="cell-lead"><strong>{{ row.company || row.name || 'Lead #' + row.id }}</strong>
          <small>{{ row.name }}<template v-if="row.email"> · {{ row.email }}</template></small></div>
        </template>
        <template #cell-total="{ row }"><span class="score" :class="'score--'+bandTone(row.total)">{{ row.total }}<i>/55</i></span></template>
        <template #cell-level="{ row }"><span class="pill" :class="'pill--'+bandTone(row.total)">{{ row.level || '—' }}</span></template>
        <template #cell-weakest_line="{ row }">{{ row.weakest_line || '—' }}</template>
        <template #cell-critical_zone="{ row }">{{ row.critical_zone || '—' }}</template>
        <template #cell-urgency="{ row }"><span class="tag tag--urg" :class="'tag--'+(row.urgency||'')">{{ row.urgency || '—' }}</span></template>
        <template #cell-created_at="{ row }"><span class="muted">{{ fmtDate(row.created_at) }}</span></template>
        <template #actions="{ row }"><button class="btn btn--sm btn--ghost" @click="selected = row">Ver</button></template>
      </data-table>
    </div>

    <modal v-if="selected" :title="selected.company || selected.name || ('Diagnóstico #' + selected.id)" wide @close="selected = null">
      <div class="diag-detail">
        <div class="diag-detail__main">
          <div class="diag-detail__score">
            <gauge-ring :value="selected.total" :max="55" />
            <div>
              <span class="pill" :class="'pill--'+bandTone(selected.total)">{{ selected.level }}</span>
              <p class="diag-detail__offer">Oferta sugerida<strong>{{ selected.recommended_offer || '—' }}</strong></p>
              <p class="muted" style="font-size:.82rem">Ruta: {{ selected.recommended_route || '—' }}</p>
            </div>
          </div>
          <radar-chart :axes="radarAxes" />
          <div v-if="selected.ai_summary" class="ai-brief">
            <div class="ai-brief__head"><span class="ai-brief__tag">✦ AlexIA</span>
              <span v-if="selected.ai_priority" class="pill" :class="'pill--' + (selected.ai_priority=='alta'?'red':selected.ai_priority=='media'?'amber':'green')">Prioridad {{ selected.ai_priority }}</span></div>
            <p class="ai-brief__summary">{{ selected.ai_summary }}</p>
            <div class="kv" v-if="selected.ai_first_play"><span>Primera jugada</span>{{ selected.ai_first_play }}</div>
            <div class="kv" v-if="selected.ai_next_action"><span>Siguiente acción comercial</span>{{ selected.ai_next_action }}</div>
          </div>
        </div>
        <div class="diag-detail__side">
          <h3>Líneas (cancha)</h3>
          <bar-list :items="lineBars" suffix="%" />
          <h3 style="margin-top:18px">Contexto</h3>
          <div class="kv"><span>Reto</span>{{ selected.challenge || '—' }}</div>
          <div class="kv"><span>Urgencia</span>{{ selected.urgency || '—' }}</div>
          <div class="kv"><span>Zona crítica</span>{{ selected.critical_zone || '—' }}</div>
          <div class="kv"><span>Objetivo 90 días</span>{{ selected.goal_90d || '—' }}</div>
          <h3 style="margin-top:18px">Contacto</h3>
          <div class="kv"><span>Email</span>{{ selected.email || '—' }}</div>
          <div class="kv"><span>País</span>{{ selected.country || '—' }}</div>
          <div class="kv"><span>WhatsApp</span>
            <a v-if="selected.whatsapp" :href="wa(selected.whatsapp)" target="_blank" rel="noopener" class="link">+{{ selected.whatsapp }} ↗</a>
            <template v-else>—</template>
          </div>
        </div>
      </div>
      <template #foot>
        <span class="muted">Recibido {{ fmtDate(selected.created_at) }}</span>
        <a v-if="selected.email" :href="'mailto:'+selected.email" class="btn btn--sm">Responder por email</a>
      </template>
    </modal>
  </div>`
};
