import { ref, onMounted } from 'vue';
import { api } from '../api.js';
import { STATUS_BADGE } from '../store.js';

export default {
  setup() {
    const items = ref([]); const error = ref(''); const loading = ref(true);
    onMounted(async () => {
      try { items.value = (await api.bookings()).data; } catch (e) { error.value = e.message; }
      finally { loading.value = false; }
    });
    const badge = (s) => STATUS_BADGE[s] ? 'badge--' + STATUS_BADGE[s] : '';
    return { items, error, loading, badge };
  },
  template: `
  <div>
    <div class="topbar"><h1>Reservas</h1></div>
    <p v-if="error" class="error">{{ error }}</p>
    <div v-if="loading" class="loading">Cargando…</div>
    <div v-else class="panel">
      <table>
        <thead><tr><th>Ref</th><th>Consulta</th><th>Lead</th><th>Fecha</th><th>Monto</th><th>Estado</th></tr></thead>
        <tbody>
          <tr v-for="b in items" :key="b.id">
            <td>{{ b.reference }}</td><td>{{ b.consultation_name || '—' }}</td>
            <td>{{ b.lead_name || b.lead_email || '—' }}</td><td>{{ (b.scheduled_at||'').slice(0,16) }}</td>
            <td>{{ b.amount }} {{ b.currency }}</td>
            <td><span class="badge" :class="badge(b.status)">{{ b.status }}</span></td>
          </tr>
          <tr v-if="!items.length"><td colspan="6" class="muted">Sin reservas.</td></tr>
        </tbody>
      </table>
    </div>
  </div>`
};
