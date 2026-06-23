import { ref, onMounted } from 'vue';
import { api } from '../api.js';

export default {
  setup() {
    const leads = ref([]); const error = ref(''); const loading = ref(true);
    const selected = ref(null);
    async function load() {
      loading.value = true;
      try { leads.value = (await api.leads()).data; } catch (e) { error.value = e.message; }
      finally { loading.value = false; }
    }
    async function open(id) {
      try { selected.value = (await api.lead(id)).data; } catch (e) { error.value = e.message; }
    }
    onMounted(load);
    return { leads, error, loading, selected, open };
  },
  template: `
  <div>
    <div class="topbar"><h1>Leads</h1></div>
    <p v-if="error" class="error">{{ error }}</p>
    <div v-if="loading" class="loading">Cargando…</div>
    <div v-else class="panel">
      <table>
        <thead><tr><th>ID</th><th>Nombre</th><th>Email</th><th>Empresa</th><th>Ruta</th><th>Urgencia</th><th>Fuente</th></tr></thead>
        <tbody>
          <tr v-for="l in leads" :key="l.id" @click="open(l.id)" style="cursor:pointer">
            <td>{{ l.id }}</td><td>{{ l.name || '—' }}</td><td>{{ l.email || '—' }}</td>
            <td>{{ l.company || '—' }}</td><td><span class="badge">{{ l.recommended_route || '—' }}</span></td>
            <td>{{ l.urgency || '—' }}</td><td>{{ l.source }}</td>
          </tr>
          <tr v-if="!leads.length"><td colspan="7" class="muted">Sin leads aún.</td></tr>
        </tbody>
      </table>
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
