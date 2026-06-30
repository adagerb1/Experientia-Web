import { ref, computed, reactive, onMounted } from 'vue';
import { api } from '../api.js';
import Modal from '../components/Modal.js';
import { BarList } from '../components/Charts.js';

export default {
  components: { Modal, BarList },
  setup() {
    const stages = ref([]); const error = ref(''); const loading = ref(true); const saving = ref(false);
    const selected = ref(null);
    const edit = reactive({ value: 0, next_action: '', stage_key: '' });
    const note = ref(''); const noteMsg = ref('');

    async function load() {
      loading.value = true;
      try { stages.value = (await api.pipeline()).data || []; } catch (e) { error.value = e.message; }
      finally { loading.value = false; }
    }
    onMounted(load);

    const money = (n) => new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'COP', maximumFractionDigits: 0 }).format(n || 0);
    const allOpps = computed(() => stages.value.flatMap((s) => s.opportunities || []));
    const kpis = computed(() => {
      const opps = allOpps.value;
      const value = opps.reduce((a, o) => a + (Number(o.value) || 0), 0);
      const won = stages.value.find((s) => s.stage_key === 'ganado')?.opportunities.length || 0;
      return { total: opps.length, value, won };
    });
    const byStage = computed(() => stages.value.filter((s) => s.opportunities.length).map((s) => ({ label: s.name, value: s.opportunities.length })));
    const stageIndex = (key) => stages.value.findIndex((s) => s.stage_key === key);

    async function move(opp, stageKey) {
      try { await api.moveOpportunity(opp.id, { stage_key: stageKey }); await load(); }
      catch (e) { error.value = e.message; }
    }
    function open(o) {
      selected.value = o; noteMsg.value = '';
      edit.value = Number(o.value) || 0; edit.next_action = o.next_action || ''; edit.stage_key = o.stage_key;
    }
    async function saveOpp() {
      saving.value = true;
      try {
        await api.moveOpportunity(selected.value.id, { value: edit.value, next_action: edit.next_action, stage_key: edit.stage_key });
        selected.value = null; await load();
      } catch (e) { error.value = e.message; } finally { saving.value = false; }
    }
    async function addNote() {
      if (!note.value.trim()) return;
      try { await api.addNote(selected.value.id, note.value.trim()); note.value = ''; noteMsg.value = 'Nota agregada ✓'; }
      catch (e) { error.value = e.message; }
    }

    return { stages, error, loading, saving, selected, edit, note, noteMsg,
      money, kpis, byStage, stageIndex, move, open, saveOpp, addNote };
  },
  template: `
  <div class="view">
    <div class="topbar"><div><h1>Pipeline</h1><p class="topbar__sub">Oportunidades por etapa, valor y siguientes acciones.</p></div>
      <button class="btn btn--ghost btn--sm" @click="load">↻ Actualizar</button></div>
    <p v-if="error" class="error">{{ error }}</p>

    <template v-if="!loading">
      <div class="cards cards--tight">
        <div class="stat stat--mini"><div class="stat__num">{{ kpis.total }}</div><div class="stat__label">Oportunidades</div></div>
        <div class="stat stat--mini"><div class="stat__num">{{ money(kpis.value) }}</div><div class="stat__label">Valor en pipeline</div></div>
        <div class="stat stat--mini"><div class="stat__num">{{ kpis.won }}</div><div class="stat__label">Ganadas</div></div>
      </div>
      <div class="panel" v-if="byStage.length">
        <h2>Distribución por etapa</h2>
        <bar-list :items="byStage" />
      </div>
    </template>

    <div v-if="loading" class="board">
      <div class="col" v-for="i in 5" :key="i"><div class="skeleton-row" style="height:22px;margin:0 0 12px"></div>
        <div class="skeleton-row" v-for="j in 2" :key="j" style="height:70px"></div></div>
    </div>

    <div v-else class="board">
      <div class="col" v-for="(s, idx) in stages" :key="s.stage_key">
        <h3>{{ s.name }} <span class="count">{{ s.opportunities.length }}</span></h3>
        <transition-group name="row">
          <div class="opp opp--accent" v-for="o in s.opportunities" :key="o.id" @click="open(o)">
            <strong>{{ o.lead_name || o.title || 'Lead #' + o.lead_id }}</strong>
            <small>{{ o.lead_email || '' }}</small>
            <div class="opp__meta">
              <span v-if="o.value" class="tag">{{ money(o.value) }}</span>
              <span v-if="o.recommended_route" class="badge">{{ o.recommended_route }}</span>
            </div>
            <div class="flex" style="margin-top:8px" v-if="idx < stages.length - 1">
              <button class="btn btn--sm btn--ghost" @click.stop="move(o, stages[idx+1].stage_key)">Avanzar →</button>
            </div>
          </div>
        </transition-group>
        <p v-if="!s.opportunities.length" class="muted col__empty">Sin oportunidades</p>
      </div>
    </div>

    <modal v-if="selected" :title="selected.lead_name || ('Oportunidad #' + selected.id)" @close="selected = null">
      <div class="kv"><span>Email</span>{{ selected.lead_email || '—' }}</div>
      <div class="kv"><span>Ruta recomendada</span>{{ selected.recommended_route || '—' }}</div>
      <div class="field" style="margin-top:14px"><label>Etapa</label>
        <select v-model="edit.stage_key"><option v-for="s in stages" :key="s.stage_key" :value="s.stage_key">{{ s.name }}</option></select></div>
      <div class="field"><label>Valor estimado (COP)</label><input type="number" v-model.number="edit.value" /></div>
      <div class="field"><label>Siguiente acción</label><textarea v-model="edit.next_action" rows="2"></textarea></div>
      <h3 style="margin:16px 0 8px;font-size:.9rem">Agregar nota</h3>
      <div class="field"><textarea v-model="note" rows="2" placeholder="Registrar avance, acuerdo o seguimiento…"></textarea></div>
      <div class="flex"><button class="btn btn--ghost btn--sm" @click="addNote">Guardar nota</button><span class="muted" v-if="noteMsg">{{ noteMsg }}</span></div>
      <template #foot>
        <button class="btn btn--ghost" @click="selected = null">Cerrar</button>
        <button class="btn" @click="saveOpp" :disabled="saving">{{ saving ? 'Guardando…' : 'Guardar cambios' }}</button>
      </template>
    </modal>
  </div>`
};
