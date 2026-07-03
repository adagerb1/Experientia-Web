import { ref, computed, onMounted } from 'vue';
import { api } from '../api.js';
import { STATUS_BADGE } from '../store.js';
import Modal from '../components/Modal.js';
import { DonutChart } from '../components/Charts.js';

export default {
  components: { Modal, DonutChart },
  setup() {
    const items = ref([]); const error = ref(''); const loading = ref(true);
    const q = ref(''); const fStatus = ref(''); const selected = ref(null);
    const opBusy = ref(false); const opMsg = ref(''); const result = ref(''); const reschedule = ref('');

    async function load() {
      loading.value = true;
      try { items.value = (await api.bookings()).data || []; } catch (e) { error.value = e.message; }
      finally { loading.value = false; }
    }
    onMounted(load);

    // Abre el detalle y precarga los campos operativos.
    function open(b) {
      selected.value = b;
      result.value = b.meeting_result || '';
      reschedule.value = '';
      opMsg.value = '';
    }

    // Aplica un cambio operativo (estado, resultado o reprogramación) vía PATCH.
    async function apply(payload, closeAfter) {
      if (!selected.value) return;
      opBusy.value = true; opMsg.value = 'Guardando…';
      try {
        const r = await api.updateBooking(selected.value.id, payload);
        const updated = r.data || {};
        // Refleja el cambio en la fila y en el detalle sin recargar todo.
        const idx = items.value.findIndex((x) => x.id === selected.value.id);
        if (idx >= 0) items.value[idx] = { ...items.value[idx], ...updated };
        selected.value = { ...selected.value, ...updated };
        opMsg.value = 'Actualizado ✓';
        if (closeAfter) selected.value = null;
      } catch (e) { opMsg.value = e.message; } finally { opBusy.value = false; }
    }
    const setStatus = (s) => apply({ status: s });
    const saveResult = () => apply({ meeting_result: result.value, status: 'completed' });
    function doReschedule() {
      if (!reschedule.value) { opMsg.value = 'Elige fecha y hora.'; return; }
      apply({ scheduled_at: reschedule.value, status: 'rescheduled' });
    }
    const isPaid = (b) => (Number(b && b.amount) || 0) > 0;

    const badge = (s) => STATUS_BADGE[s] ? 'badge--' + STATUS_BADGE[s] : '';
    const money = (n, c) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: c || 'COP', maximumFractionDigits: 0 }).format(n || 0);
    const fmtDate = (d) => (d || '').slice(0, 16).replace('T', ' ');
    const statuses = computed(() => [...new Set(items.value.map((b) => b.status).filter(Boolean))]);

    const filtered = computed(() => {
      const term = q.value.trim().toLowerCase();
      return items.value.filter((b) => {
        if (fStatus.value && b.status !== fStatus.value) return false;
        if (term) {
          const hay = `${b.reference || ''} ${b.lead_name || ''} ${b.lead_email || ''} ${b.consultation_name || ''}`.toLowerCase();
          if (!hay.includes(term)) return false;
        }
        return true;
      });
    });
    const kpis = computed(() => {
      const f = filtered.value;
      const confirmed = f.filter((b) => ['confirmed', 'payment_confirmed', 'completed'].includes(b.status)).length;
      const revenue = f.filter((b) => ['confirmed', 'payment_confirmed', 'completed'].includes(b.status)).reduce((a, b) => a + (Number(b.amount) || 0), 0);
      return { total: f.length, confirmed, revenue };
    });
    const byStatus = computed(() => {
      const m = {};
      filtered.value.forEach((b) => { m[b.status] = (m[b.status] || 0) + 1; });
      return Object.entries(m).map(([label, value]) => ({ label, value }));
    });

    return { items, error, loading, q, fStatus, selected, opBusy, opMsg, result, reschedule,
      badge, money, fmtDate, statuses, filtered, kpis, byStatus, load, open, setStatus, saveResult, doReschedule, isPaid };
  },
  template: `
  <div class="view">
    <div class="topbar"><div><h1>Reservas</h1><p class="topbar__sub">Agendamientos, estados de pago e ingresos.</p></div>
      <button class="btn btn--ghost btn--sm" @click="load">↻ Actualizar</button></div>
    <p v-if="error" class="error">{{ error }}</p>

    <template v-if="!loading">
      <div class="grid-2">
        <div>
          <div class="cards cards--tight">
            <div class="stat stat--mini"><div class="stat__num">{{ kpis.total }}</div><div class="stat__label">Reservas</div></div>
            <div class="stat stat--mini"><div class="stat__num">{{ kpis.confirmed }}</div><div class="stat__label">Confirmadas</div></div>
            <div class="stat stat--mini"><div class="stat__num">{{ money(kpis.revenue) }}</div><div class="stat__label">Ingresos</div></div>
          </div>
        </div>
        <div class="panel"><h2>Reservas por estado</h2>
          <donut-chart :items="byStatus" v-if="byStatus.length" /><p v-else class="muted">Sin reservas aún.</p></div>
      </div>

      <div class="toolbar">
        <div class="toolbar__search"><span aria-hidden="true">⌕</span>
          <input v-model="q" type="search" placeholder="Buscar por referencia, lead o consulta…" /></div>
        <select v-model="fStatus"><option value="">Todos los estados</option><option v-for="s in statuses" :key="s" :value="s">{{ s }}</option></select>
      </div>
    </template>

    <div v-if="loading" class="skeleton-table"><div class="skeleton-row" v-for="i in 6" :key="i"></div></div>

    <div v-else class="panel panel--flush">
      <table class="table--rich">
        <thead><tr><th>Ref</th><th>Consulta</th><th>Lead</th><th>Fecha</th><th>Tipo</th><th>Monto</th><th>Estado</th></tr></thead>
        <transition-group tag="tbody" name="row">
          <tr v-for="b in filtered" :key="b.id" @click="open(b)" class="rowclick">
            <td><strong>{{ b.reference }}</strong></td><td>{{ b.consultation_name || '—' }}</td>
            <td>{{ b.lead_name || b.lead_email || '—' }}</td><td class="muted">{{ fmtDate(b.scheduled_at) }}</td>
            <td><span class="pill" :class="isPaid(b) ? 'pill--blue' : 'pill--green'">{{ isPaid(b) ? 'De pago' : 'Gratuita' }}</span></td>
            <td>{{ money(b.amount, b.currency) }}</td>
            <td><span class="badge" :class="badge(b.status)">{{ b.status }}</span></td>
          </tr>
          <tr v-if="!filtered.length" key="empty"><td colspan="7" class="muted center">No hay reservas que coincidan.</td></tr>
        </transition-group>
      </table>
    </div>

    <modal v-if="selected" :title="'Reserva ' + selected.reference" @close="selected = null">
      <div class="kv"><span>Consulta</span>{{ selected.consultation_name || '—' }}</div>
      <div class="kv"><span>Lead</span>{{ selected.lead_name || '—' }}</div>
      <div class="kv"><span>Email</span>{{ selected.lead_email || '—' }}</div>
      <div class="kv"><span>Fecha agendada</span>{{ fmtDate(selected.scheduled_at) || '—' }}</div>
      <div class="kv"><span>Duración</span>{{ selected.duration_min ? selected.duration_min + ' min' : '—' }}</div>
      <div class="kv"><span>Tipo</span><span class="pill" :class="isPaid(selected) ? 'pill--blue' : 'pill--green'">{{ isPaid(selected) ? 'De pago' : 'Gratuita' }}</span> {{ money(selected.amount, selected.currency) }}</div>
      <div class="kv"><span>Estado</span><span class="badge" :class="badge(selected.status)">{{ selected.status }}</span></div>
      <div class="kv" v-if="selected.meeting_link"><span>Enlace</span><a :href="selected.meeting_link" target="_blank" rel="noopener" class="link">Abrir reunión ↗</a></div>
      <div class="kv kv--block" v-if="selected.notes"><span>Preparación</span><div class="notes-box">{{ selected.notes }}</div></div>

      <hr class="sep" />
      <p class="field-label">Flujo de la reunión</p>
      <div class="op-actions">
        <button class="btn btn--ghost btn--sm" @click="setStatus('confirmed')" :disabled="opBusy">Confirmar</button>
        <button class="btn btn--ghost btn--sm" @click="setStatus('no_show')" :disabled="opBusy">No asistió</button>
        <button class="btn btn--ghost btn--sm" @click="setStatus('cancelled')" :disabled="opBusy">Cancelar</button>
      </div>

      <div class="field" style="margin-top:12px">
        <label>Reprogramar</label>
        <div class="flex"><input type="datetime-local" v-model="reschedule" />
          <button class="btn btn--ghost btn--sm" @click="doReschedule" :disabled="opBusy">Mover</button></div>
      </div>

      <div class="field">
        <label>Resultado de la sesión</label>
        <textarea v-model="result" rows="3" placeholder="Qué se acordó, próximos pasos, notas para el pipeline…"></textarea>
        <button class="btn btn--sm" style="margin-top:8px" @click="saveResult" :disabled="opBusy">Marcar completada y guardar</button>
      </div>
      <p v-if="opMsg" class="muted" style="font-size:.85rem">{{ opMsg }}</p>

      <template #foot>
        <span class="muted">Creada {{ fmtDate(selected.created_at) }}</span>
        <a v-if="selected.lead_email" :href="'mailto:'+selected.lead_email" class="btn btn--sm">Escribir al lead</a>
      </template>
    </modal>
  </div>`
};
