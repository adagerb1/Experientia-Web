import { ref, computed, onMounted } from 'vue';
import { api } from '../api.js';
import { ZONES } from '/app/data/tablero.js';
import Modal from '../components/Modal.js';
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
  components: { Modal, RadarChart, BarList, GaugeRing },
  setup() {
    const rows = ref([]); const error = ref(''); const loading = ref(true);
    const q = ref(''); const fLevel = ref(''); const fUrg = ref(''); const fLine = ref('');
    const sortKey = ref('id'); const sortDir = ref('desc');
    const selected = ref(null);

    async function load() {
      loading.value = true;
      try { rows.value = (await api.tablero()).data || []; }
      catch (e) { error.value = e.message; }
      finally { loading.value = false; }
    }
    onMounted(load);

    const levels = computed(() => [...new Set(rows.value.map((r) => r.level).filter(Boolean))]);
    const lines = computed(() => [...new Set(rows.value.map((r) => r.weakest_line).filter(Boolean))]);

    const filtered = computed(() => {
      const term = q.value.trim().toLowerCase();
      let out = rows.value.filter((r) => {
        if (fLevel.value && r.level !== fLevel.value) return false;
        if (fUrg.value && (r.urgency || '') !== fUrg.value) return false;
        if (fLine.value && r.weakest_line !== fLine.value) return false;
        if (term) {
          const hay = `${r.name || ''} ${r.email || ''} ${r.company || ''} ${r.critical_zone || ''}`.toLowerCase();
          if (!hay.includes(term)) return false;
        }
        return true;
      });
      const dir = sortDir.value === 'asc' ? 1 : -1;
      out = [...out].sort((a, b) => {
        const x = a[sortKey.value], y = b[sortKey.value];
        if (sortKey.value === 'total') return ((a.total || 0) - (b.total || 0)) * dir;
        return String(x ?? '').localeCompare(String(y ?? '')) * dir;
      });
      return out;
    });

    const kpis = computed(() => {
      const n = filtered.value.length;
      const avg = n ? Math.round((filtered.value.reduce((a, b) => a + (b.total || 0), 0) / n) * 10) / 10 : 0;
      const top = filtered.value.filter((r) => (r.total || 0) >= 41).length;
      const crit = filtered.value.filter((r) => (r.total || 0) <= 25).length;
      return { n, avg, top, crit };
    });

    function setSort(k) {
      if (sortKey.value === k) sortDir.value = sortDir.value === 'asc' ? 'desc' : 'asc';
      else { sortKey.value = k; sortDir.value = k === 'total' ? 'desc' : 'asc'; }
    }
    function clearFilters() { q.value = ''; fLevel.value = ''; fUrg.value = ''; fLine.value = ''; }

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

    return { rows, error, loading, q, fLevel, fUrg, fLine, sortKey, sortDir, selected,
      levels, lines, filtered, kpis, setSort, clearFilters, bandTone,
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

    <div class="toolbar">
      <div class="toolbar__search">
        <span aria-hidden="true">⌕</span>
        <input v-model="q" type="search" placeholder="Buscar por nombre, empresa, email o zona…" />
      </div>
      <select v-model="fLevel"><option value="">Todos los niveles</option><option v-for="l in levels" :key="l" :value="l">{{ l }}</option></select>
      <select v-model="fUrg"><option value="">Toda urgencia</option><option value="alta">Alta</option><option value="media">Media</option><option value="baja">Baja</option></select>
      <select v-model="fLine"><option value="">Toda línea débil</option><option v-for="l in lines" :key="l" :value="l">{{ l }}</option></select>
      <button class="btn btn--ghost btn--sm" @click="clearFilters" v-if="q||fLevel||fUrg||fLine">Limpiar</button>
    </div>

    <div v-if="loading" class="skeleton-table">
      <div class="skeleton-row" v-for="i in 6" :key="i"></div>
    </div>

    <div v-else class="panel panel--flush">
      <table class="table--rich">
        <thead><tr>
          <th @click="setSort('name')" class="sortable">Empresa / Contacto</th>
          <th @click="setSort('total')" class="sortable">Puntaje</th>
          <th>Nivel</th>
          <th>Línea débil</th>
          <th>Zona crítica</th>
          <th>Urgencia</th>
          <th @click="setSort('created_at')" class="sortable">Fecha</th>
        </tr></thead>
        <transition-group tag="tbody" name="row">
          <tr v-for="r in filtered" :key="r.id" @click="selected = r" class="rowclick">
            <td>
              <div class="cell-lead"><strong>{{ r.company || r.name || 'Lead #' + r.id }}</strong>
              <small>{{ r.name }}<template v-if="r.email"> · {{ r.email }}</template></small></div>
            </td>
            <td><span class="score" :class="'score--'+bandTone(r.total)">{{ r.total }}<i>/55</i></span></td>
            <td><span class="pill" :class="'pill--'+bandTone(r.total)">{{ r.level || '—' }}</span></td>
            <td>{{ r.weakest_line || '—' }}</td>
            <td>{{ r.critical_zone || '—' }}</td>
            <td><span class="tag tag--urg" :class="'tag--'+(r.urgency||'')">{{ r.urgency || '—' }}</span></td>
            <td class="muted">{{ fmtDate(r.created_at) }}</td>
          </tr>
          <tr v-if="!filtered.length" key="empty"><td colspan="7" class="muted center">No hay diagnósticos que coincidan con el filtro.</td></tr>
        </transition-group>
      </table>
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
