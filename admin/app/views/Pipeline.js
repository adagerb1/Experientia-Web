import { ref, onMounted } from 'vue';
import { api } from '../api.js';

export default {
  setup() {
    const stages = ref([]); const error = ref(''); const loading = ref(true);
    async function load() {
      loading.value = true;
      try { stages.value = (await api.pipeline()).data; } catch (e) { error.value = e.message; }
      finally { loading.value = false; }
    }
    // Avanza una oportunidad a la siguiente etapa.
    async function move(opp, stageKey) {
      try { await api.moveOpportunity(opp.id, { stage_key: stageKey }); await load(); }
      catch (e) { error.value = e.message; }
    }
    onMounted(load);
    return { stages, error, loading, move };
  },
  template: `
  <div>
    <div class="topbar"><h1>Pipeline</h1></div>
    <p v-if="error" class="error">{{ error }}</p>
    <div v-if="loading" class="loading">Cargando…</div>
    <div v-else class="board">
      <div class="col" v-for="(s, idx) in stages" :key="s.stage_key">
        <h3>{{ s.name }} <span>{{ s.opportunities.length }}</span></h3>
        <div class="opp" v-for="o in s.opportunities" :key="o.id">
          <strong>{{ o.lead_name || o.title || 'Lead #' + o.lead_id }}</strong>
          <small>{{ o.lead_email || '' }}</small>
          <small v-if="o.recommended_route">Ruta: {{ o.recommended_route }}</small>
          <div class="flex" style="margin-top:8px" v-if="idx < stages.length - 1">
            <button class="btn btn--sm btn--ghost" @click="move(o, stages[idx+1].stage_key)">Avanzar →</button>
          </div>
        </div>
        <p v-if="!s.opportunities.length" class="muted" style="font-size:.8rem">—</p>
      </div>
    </div>
  </div>`
};
