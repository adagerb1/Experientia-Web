import { ref, computed, onMounted } from 'vue';
import { api } from '../api.js';
import DataTable from '../components/DataTable.js';

export default {
  components: { DataTable },
  setup() {
    const raw = ref([]); const error = ref(''); const loading = ref(true);
    const selected = ref(null);
    const temp = (s) => (s >= 60 ? 'caliente' : (s >= 30 ? 'tibio' : 'frío'));
    const tempClass = (s) => (s >= 60 ? 'badge--red' : (s >= 30 ? 'badge--amber' : ''));

    // Enriquece cada lead con la temperatura (para filtrar/ordenar).
    const leads = computed(() => raw.value.map((l) => ({ ...l, _temp: temp(+l.lead_score || 0) })));

    const columns = [
      { key: 'lead_score', label: 'Score', align: 'center', width: '90px', sortValue: (r) => +r.lead_score || 0 },
      { key: '_temp', label: 'Temp.', filter: ['caliente', 'tibio', 'frío'], width: '100px' },
      { key: 'name', label: 'Nombre' },
      { key: 'company', label: 'Empresa' },
      { key: 'recommended_route', label: 'Ruta', filter: true },
      { key: 'urgency', label: 'Urgencia', filter: true, width: '110px' },
      { key: 'utm_source', label: 'Origen', filter: true },
      { key: 'created_at', label: 'Fecha', width: '120px', sortValue: (r) => r.created_at || '' }
    ];

    async function load() {
      loading.value = true; error.value = '';
      try { raw.value = (await api.leads()).data || []; } catch (e) { error.value = 'No fue posible cargar los leads: ' + e.message; }
      finally { loading.value = false; }
    }
    async function open(id) {
      try { selected.value = (await api.lead(id)).data; } catch (e) { error.value = 'No fue posible abrir el lead: ' + e.message; }
    }
    onMounted(load);

    const kpis = computed(() => {
      const l = leads.value;
      return { total: l.length,
        hot: l.filter((x) => +x.lead_score >= 60).length,
        week: l.filter((x) => x.created_at && (Date.now() - new Date(x.created_at).getTime()) < 6048e5).length };
    });
    const fmtDate = (d) => (d || '').slice(0, 10);

    // ---- Exportación (CSV, Excel, PDF y público para Meta Ads) ----
    const expOpen = ref(false);
    const EXPORT_COLS = [
      ['name', 'Nombre'], ['email', 'Correo'], ['whatsapp', 'WhatsApp'], ['company', 'Empresa'],
      ['sector', 'Sector'], ['recommended_route', 'Ruta'], ['urgency', 'Urgencia'], ['lead_score', 'Score'],
      ['_temp', 'Temperatura'], ['utm_source', 'Origen'], ['utm_medium', 'Medio'], ['utm_campaign', 'Campaña'], ['created_at', 'Fecha']
    ];
    const stamp = () => new Date().toISOString().slice(0, 10);
    function download(name, content, mime) {
      const blob = new Blob(['﻿', content], { type: mime });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click();
      a.remove(); setTimeout(() => URL.revokeObjectURL(url), 1500);
    }
    const esc = (v) => { const s = String(v ?? ''); return /[",\n;]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
    function exportCsv() {
      const head = EXPORT_COLS.map((c) => c[1]).join(',');
      const body = leads.value.map((l) => EXPORT_COLS.map((c) => esc(l[c[0]])).join(',')).join('\n');
      download('leads-' + stamp() + '.csv', head + '\n' + body, 'text/csv;charset=utf-8;');
      expOpen.value = false;
    }
    function exportExcel() {
      // HTML que Excel abre nativamente como hoja de cálculo (.xls).
      const rows = leads.value.map((l) => '<tr>' + EXPORT_COLS.map((c) => '<td>' + String(l[c[0]] ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</td>').join('') + '</tr>').join('');
      const html = '<html><head><meta charset="utf-8"></head><body><table border="1"><thead><tr>' +
        EXPORT_COLS.map((c) => '<th>' + c[1] + '</th>').join('') + '</tr></thead><tbody>' + rows + '</tbody></table></body></html>';
      download('leads-' + stamp() + '.xls', html, 'application/vnd.ms-excel');
      expOpen.value = false;
    }
    function exportPdf() {
      // Abre una vista imprimible; el usuario elige «Guardar como PDF».
      const rows = leads.value.map((l) => '<tr>' + EXPORT_COLS.map((c) => '<td>' + String(l[c[0]] ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;') + '</td>').join('') + '</tr>').join('');
      const w = window.open('', '_blank');
      if (!w) { error.value = 'Permite las ventanas emergentes para exportar a PDF.'; return; }
      w.document.write('<html><head><meta charset="utf-8"><title>Leads ' + stamp() + '</title>' +
        '<style>body{font-family:Segoe UI,system-ui,sans-serif;padding:24px;color:#172033}h1{font-size:18px}' +
        'table{border-collapse:collapse;width:100%;font-size:11px}th,td{border:1px solid #e2e8f0;padding:6px 8px;text-align:left}' +
        'th{background:#13213c;color:#fff}</style></head><body><h1>Leads · ' + stamp() + ' (' + leads.value.length + ')</h1>' +
        '<table><thead><tr>' + EXPORT_COLS.map((c) => '<th>' + c[1] + '</th>').join('') + '</tr></thead><tbody>' + rows + '</tbody></table>' +
        '<script>window.onload=function(){window.print()}<\/script></body></html>');
      w.document.close(); expOpen.value = false;
    }
    function exportMeta() {
      // Público personalizado para Meta Ads: email + teléfono normalizados + nombre.
      // Meta hace el hashing al subir el archivo; entregamos datos normalizados.
      const norm = (s) => String(s ?? '').trim().toLowerCase();
      const phone = (s) => { const d = String(s ?? '').replace(/[^0-9]/g, ''); return d ? d : ''; };
      const head = 'email,phone,fn,ln,country';
      const body = leads.value.filter((l) => l.email || l.whatsapp).map((l) => {
        const parts = String(l.name || '').trim().split(/\s+/);
        const fn = norm(parts[0] || ''); const ln = norm(parts.slice(1).join(' '));
        return [esc(norm(l.email)), esc(phone(l.whatsapp)), esc(fn), esc(ln), 'co'].join(',');
      }).join('\n');
      download('meta-audiencia-leads-' + stamp() + '.csv', head + '\n' + body, 'text/csv;charset=utf-8;');
      expOpen.value = false;
    }

    return { leads, columns, error, loading, selected, open, temp, tempClass, kpis, fmtDate,
      expOpen, exportCsv, exportExcel, exportPdf, exportMeta };
  },
  template: `
  <div class="view view--full">
    <div class="topbar"><div><h1>Leads</h1><p class="topbar__sub">Contactos captados, calificados por temperatura comercial.</p></div>
      <div class="export" v-if="!loading && leads.length">
        <button class="btn btn--ghost btn--sm" @click="expOpen = !expOpen">⤓ Exportar ▾</button>
        <div v-if="expOpen" class="export__backdrop" @click="expOpen = false"></div>
        <transition name="fade"><div v-if="expOpen" class="export__menu">
          <button @click="exportCsv"><b>CSV</b><small>Datos separados por comas (.csv)</small></button>
          <button @click="exportExcel"><b>Excel</b><small>Hoja de cálculo (.xls)</small></button>
          <button @click="exportPdf"><b>PDF</b><small>Vista imprimible / guardar como PDF</small></button>
          <button @click="exportMeta"><b>Público Meta Ads</b><small>CSV para audiencia de remarketing</small></button>
        </div></transition>
      </div>
    </div>
    <p v-if="error" class="error">{{ error }}</p>

    <div class="cards cards--tight" v-if="!loading">
      <div class="stat stat--mini"><div class="stat__num">{{ kpis.total }}</div><div class="stat__label">Leads</div><span class="stat__period">Acumulado</span></div>
      <div class="stat stat--mini"><div class="stat__num">{{ kpis.hot }}</div><div class="stat__label">Calientes</div><span class="stat__period">Score ≥ 60 · prioridad</span></div>
      <div class="stat stat--mini"><div class="stat__num">{{ kpis.week }}</div><div class="stat__label">Nuevos</div><span class="stat__period">Últimos 7 días</span></div>
    </div>

    <div v-if="loading" class="skeleton-table"><div class="skeleton-row" v-for="i in 6" :key="i"></div></div>
    <div v-else class="panel panel--flush">
      <data-table :rows="leads" :columns="columns" :page-size="15" empty-icon="◎" empty-text="Aún no hay leads. Aparecerán aquí en cuanto alguien complete un formulario del sitio.">
        <template #cell-lead_score="{ row }"><span class="badge" :class="tempClass(+row.lead_score)">{{ +row.lead_score || 0 }}</span></template>
        <template #cell-_temp="{ row }"><span class="pill" :class="+row.lead_score>=60 ? 'pill--red' : (+row.lead_score>=30 ? 'pill--amber' : 'pill--blue')">{{ row._temp }}</span></template>
        <template #cell-name="{ row }"><a href="#" class="link" @click.prevent="open(row.id)">{{ row.name || '—' }}</a><br><small class="muted">{{ row.email || '' }}</small></template>
        <template #cell-company="{ row }">{{ row.company || '—' }}</template>
        <template #cell-recommended_route="{ row }"><span class="badge">{{ row.recommended_route || '—' }}</span></template>
        <template #cell-urgency="{ row }">{{ row.urgency || '—' }}</template>
        <template #cell-utm_source="{ row }">{{ row.utm_source || '—' }}</template>
        <template #cell-created_at="{ row }"><span class="muted">{{ fmtDate(row.created_at) }}</span></template>
        <template #actions="{ row }"><button class="btn btn--sm btn--ghost" @click="open(row.id)">Ver</button></template>
      </data-table>
    </div>

    <template v-if="selected">
      <div class="drawer-bg" @click="selected = null"></div>
      <aside class="drawer">
        <div class="flex between"><h2>{{ selected.name || 'Lead #' + selected.id }}</h2><button class="btn btn--ghost btn--sm" @click="selected=null">Cerrar</button></div>
        <div class="drawer__row"><span>Email</span>{{ selected.email || '—' }}</div>
        <div class="drawer__row"><span>WhatsApp</span>{{ selected.whatsapp || '—' }}</div>
        <div class="drawer__row"><span>Empresa</span>{{ selected.company || '—' }}</div>
        <div class="drawer__row"><span>Ruta recomendada</span>{{ selected.recommended_route || '—' }}</div>
        <div class="drawer__row"><span>Urgencia</span>{{ selected.urgency || '—' }}</div>
        <div class="drawer__row"><span>Calificación comercial</span><span class="badge" :class="tempClass(+selected.lead_score)">{{ temp(+selected.lead_score) }} · {{ +selected.lead_score }}/100</span></div>
        <div class="drawer__row" v-if="selected.sector"><span>Sector · Tamaño · Facturación</span>{{ selected.sector }} · {{ selected.company_size || '—' }} · {{ selected.revenue_range || '—' }}</div>
        <div class="drawer__row" v-if="selected.website"><span>Sitio web</span>{{ selected.website }}</div>
        <div class="drawer__row"><span>Origen (UTM)</span>{{ selected.utm_source || '—' }} / {{ selected.utm_medium || '—' }} / {{ selected.utm_campaign || '—' }}</div>
        <div class="drawer__row" v-if="selected.consent"><span>Consentimiento</span>✓ autorizado</div>
        <div class="drawer__row"><span>Fuente</span>{{ selected.source }}</div>
        <div class="drawer__row" v-if="selected.opportunity"><span>Etapa pipeline</span>{{ selected.opportunity.stage_key }}</div>
        <h2 style="margin-top:18px;font-size:1rem">Respuestas</h2>
        <div class="drawer__row" v-for="a in selected.answers" :key="a.field"><span>{{ a.field }}</span>{{ a.value }}</div>
        <p v-if="!selected.answers || !selected.answers.length" class="muted">Sin respuestas de microdiagnóstico.</p>
        <h2 style="margin-top:18px;font-size:1rem">Reservas</h2>
        <div class="drawer__row" v-for="b in selected.bookings" :key="b.id"><span>{{ b.reference }}</span>{{ (b.scheduled_at||'').slice(0,16) }} · {{ b.status }}</div>
        <p v-if="!selected.bookings || !selected.bookings.length" class="muted">Sin reservas.</p>
      </aside>
    </template>
  </div>`
};
