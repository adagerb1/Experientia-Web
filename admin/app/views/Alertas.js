import { ref, onMounted } from 'vue';
import { api } from '../api.js';

const ICON = { hot_lead: '🔥', booking_unconfirmed: '⏰', payment_stuck: '💳', diagnostic_no_booking: '⬡', meeting_no_result: '📝' };
const LINK = { lead: '/leads', booking: '/reservas', payment: '/reservas' };

export default {
  setup() {
    const alerts = ref([]); const counts = ref({ high: 0, medium: 0, low: 0 });
    const error = ref(''); const loading = ref(true);

    async function load() {
      loading.value = true;
      try { const r = (await api.alerts()).data || {}; alerts.value = r.alerts || []; counts.value = r.counts || { high: 0, medium: 0, low: 0 }; }
      catch (e) { error.value = e.message; } finally { loading.value = false; }
    }
    onMounted(load);

    const icon = (t) => ICON[t] || '•';
    const sevClass = (s) => s === 'high' ? 'alert--high' : (s === 'medium' ? 'alert--medium' : 'alert--low');
    const linkFor = (a) => LINK[a.entity] || null;
    return { alerts, counts, error, loading, icon, sevClass, linkFor, load };
  },
  template: `
  <div class="view view--narrow">
    <div class="topbar"><div><h1>Alertas</h1><p class="topbar__sub">Lo que necesita tu atención hoy, priorizado.</p></div>
      <button class="btn btn--ghost btn--sm" @click="load">↻ Actualizar</button></div>
    <p v-if="error" class="error">{{ error }}</p>

    <div class="cards cards--tight" v-if="!loading">
      <div class="stat stat--mini"><div class="stat__num">{{ counts.high }}</div><div class="stat__label">Urgentes</div></div>
      <div class="stat stat--mini"><div class="stat__num">{{ counts.medium }}</div><div class="stat__label">Importantes</div></div>
      <div class="stat stat--mini"><div class="stat__num">{{ counts.low }}</div><div class="stat__label">Menores</div></div>
    </div>

    <div v-if="loading" class="skeleton-table"><div class="skeleton-row" v-for="i in 5" :key="i" style="height:64px"></div></div>

    <template v-else>
      <div v-if="!alerts.length" class="panel center" style="padding:40px">
        <p style="font-size:2rem;margin:0">✓</p><p class="muted">Todo al día. No hay alertas pendientes.</p>
      </div>
      <div v-else class="alert-list">
        <div class="alert-item" :class="sevClass(a.severity)" v-for="(a,i) in alerts" :key="i">
          <span class="alert-item__icon">{{ icon(a.type) }}</span>
          <div class="alert-item__body">
            <strong>{{ a.title }}</strong>
            <span class="muted">{{ a.detail }}</span>
          </div>
          <router-link v-if="linkFor(a)" :to="linkFor(a)" class="btn btn--sm btn--ghost">Ir →</router-link>
        </div>
      </div>
    </template>
  </div>`
};
