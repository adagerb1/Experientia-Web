import { ref, onMounted } from 'vue';
import { api } from '../api.js';

export default {
  setup() {
    const data = ref(null); const error = ref('');
    onMounted(async () => {
      try { data.value = (await api.dashboard()).data; }
      catch (e) { error.value = e.message; }
    });
    const money = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
    return { data, error, money };
  },
  template: `
  <div>
    <div class="topbar"><h1>Dashboard</h1></div>
    <p v-if="error" class="error">{{ error }}</p>
    <div v-if="!data && !error" class="loading">Cargando…</div>
    <div v-if="data">
      <div class="cards">
        <div class="stat"><div class="stat__num">{{ data.totals.leads }}</div><div class="stat__label">Leads totales</div></div>
        <div class="stat"><div class="stat__num">{{ data.totals.leads_7d }}</div><div class="stat__label">Leads (7 días)</div></div>
        <div class="stat"><div class="stat__num">{{ data.totals.bookings }}</div><div class="stat__label">Reservas</div></div>
        <div class="stat"><div class="stat__num">{{ data.totals.confirmed }}</div><div class="stat__label">Confirmadas</div></div>
        <div class="stat"><div class="stat__num">{{ money(data.totals.revenue) }}</div><div class="stat__label">Ingresos confirmados</div></div>
      </div>
      <div class="panel">
        <h2>Leads por ruta</h2>
        <table><thead><tr><th>Ruta</th><th>Total</th></tr></thead>
          <tbody><tr v-for="r in data.by_route" :key="r.route"><td>{{ r.route }}</td><td>{{ r.total }}</td></tr>
          <tr v-if="!data.by_route.length"><td colspan="2" class="muted">Sin datos aún.</td></tr></tbody></table>
      </div>
      <div class="panel">
        <h2>Leads recientes</h2>
        <table><thead><tr><th>Nombre</th><th>Email</th><th>Ruta</th><th>Fuente</th><th>Fecha</th></tr></thead>
          <tbody><tr v-for="l in data.recent_leads" :key="l.id">
            <td>{{ l.name || '—' }}</td><td>{{ l.email || '—' }}</td><td>{{ l.recommended_route || '—' }}</td>
            <td>{{ l.source }}</td><td>{{ (l.created_at||'').slice(0,16) }}</td></tr>
          <tr v-if="!data.recent_leads.length"><td colspan="5" class="muted">Sin leads aún.</td></tr></tbody></table>
      </div>
    </div>
  </div>`
};
