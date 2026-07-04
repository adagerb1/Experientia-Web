import { ref, reactive, computed, onMounted } from 'vue';
import { api } from '../api.js';
import Modal from '../components/Modal.js';

// Ciclo actual por defecto (trimestre).
function currentQuarter() {
  const d = new Date(); return d.getFullYear() + '-Q' + (Math.floor(d.getMonth() / 3) + 1);
}

// Un resultado clave nuevo con la estructura completa de la metodología.
const blankKr = () => ({ text: '', metric: '', unit: '', start: '', current: '', target: '', direction: 'up' });

// Progreso 0..100 de un KR, fiel a OKRs: (actual-inicial)/(meta-inicial).
// Soporta métricas que suben (direction 'up') o bajan (direction 'down'),
// y resultados binarios/cualitativos (texto: actual == meta => 100%).
function krPct(k) {
  if (!k) return 0;
  const num = (v) => { const n = parseFloat(String(v ?? '').replace(/[^0-9.\-]/g, '')); return isNaN(n) ? null : n; };
  const start = num(k.start), cur = num(k.current), tgt = num(k.target);
  if (cur !== null && tgt !== null) {
    const base = start === null ? 0 : start;
    if (tgt === base) return cur >= tgt ? 100 : 0;
    let pct;
    if ((k.direction || 'up') === 'down') pct = (base - cur) / (base - tgt) * 100;
    else pct = (cur - base) / (tgt - base) * 100;
    return Math.max(0, Math.min(100, Math.round(pct)));
  }
  // No numérico: logrado si el actual coincide con la meta.
  const c = String(k.current ?? '').trim().toLowerCase(), t = String(k.target ?? '').trim().toLowerCase();
  return (c && t && c === t) ? 100 : 0;
}

// Avance del objetivo = promedio de sus KR (los que tengan enunciado).
function objProgress(krs) {
  const list = (krs || []).filter((k) => (k.text || '').trim());
  if (!list.length) return null;
  return Math.round(list.reduce((a, k) => a + krPct(k), 0) / list.length);
}

// Salud del objetivo según el avance (semáforo de OKRs).
function healthOf(pct) {
  if (pct >= 70) return { key: 'ontrack', label: 'En camino', cls: 'ok' };
  if (pct >= 40) return { key: 'risk', label: 'En riesgo', cls: 'warn' };
  return { key: 'behind', label: 'Atrasado', cls: 'bad' };
}

const OWNER_PRESETS = ['Tonny Dager', 'ExperientIA', 'Conjunto'];

export default {
  components: { Modal },
  setup() {
    const okr = ref([]);
    const loading = ref(true); const error = ref(''); const msg = ref('');
    const edit = ref(null);
    const form = reactive({ objective: '', description: '', quarter: currentQuarter(), owner: '', status: 'activo', confidence: 5, progress: 0, key_results: [] });
    const filter = reactive({ quarter: '', owner: '' });

    async function load() {
      loading.value = true;
      try { const d = (await api.planner()).data || {}; okr.value = d.okr || []; }
      catch (e) { error.value = e.message; } finally { loading.value = false; }
    }
    onMounted(load);
    function flash(t) { msg.value = t; setTimeout(() => { if (msg.value === t) msg.value = ''; }, 2500); }

    // --- Edición ---
    function newObjective() {
      edit.value = 'new';
      Object.assign(form, { objective: '', description: '', quarter: currentQuarter(), owner: '', status: 'activo', confidence: 5, progress: 0, key_results: [blankKr()] });
    }
    function open(o) {
      edit.value = o.id;
      Object.assign(form, {
        objective: o.objective || '', description: o.description || '', quarter: o.quarter || currentQuarter(),
        owner: o.owner || '', status: o.status || 'activo', confidence: o.confidence != null ? Number(o.confidence) : 5, progress: o.progress || 0,
        key_results: Array.isArray(o.key_results) && o.key_results.length ? o.key_results.map((k) => ({ ...blankKr(), ...k })) : [blankKr()],
      });
    }
    const addKr = () => { if (form.key_results.length < 5) form.key_results.push(blankKr()); };
    const removeKr = (i) => form.key_results.splice(i, 1);
    const formProgress = computed(() => objProgress(form.key_results));
    const formHealth = computed(() => healthOf(formProgress.value ?? 0));

    async function save() {
      const krs = form.key_results.filter((k) => (k.text || '').trim());
      if (!form.objective.trim()) { error.value = 'Escribe el objetivo (la ambición cualitativa).'; return; }
      if (!krs.length) { error.value = 'Un objetivo necesita al menos un resultado clave medible.'; return; }
      const auto = objProgress(krs);
      const payload = {
        objective: form.objective.trim(), description: form.description, quarter: form.quarter, owner: form.owner,
        status: form.status, confidence: Number(form.confidence) || 0,
        progress: auto !== null ? auto : (Number(form.progress) || 0), key_results: krs,
      };
      error.value = '';
      try {
        if (edit.value === 'new') await api.createPlan('okr', payload);
        else await api.updatePlan('okr', edit.value, payload);
        edit.value = null; await load(); flash('Objetivo guardado ✓');
      } catch (e) { error.value = e.message; }
    }
    async function remove(o) { if (!confirm('¿Eliminar este objetivo y sus resultados clave?')) return; await api.deletePlan('okr', o.id); await load(); }

    // --- Check-in rápido: actualiza el "actual" de un KR sin abrir el editor ---
    const checkin = reactive({ id: null });
    const checkForm = reactive({ krs: [], objective: '', comment: '' });
    function openCheckin(o) {
      checkin.id = o.id; checkForm.objective = o.objective; checkForm.comment = '';
      checkForm.krs = (o.key_results || []).map((k) => ({ ...blankKr(), ...k }));
    }
    const checkProgress = computed(() => objProgress(checkForm.krs));
    async function saveCheckin() {
      const o = okr.value.find((x) => x.id === checkin.id); if (!o) return;
      const auto = objProgress(checkForm.krs);
      const status = auto >= 100 ? 'logrado' : (healthOf(auto ?? 0).key === 'behind' ? 'en_riesgo' : o.status || 'activo');
      try {
        await api.updatePlan('okr', o.id, { key_results: checkForm.krs, progress: auto ?? 0, status });
        checkin.id = null; await load(); flash('Avance registrado ✓');
      } catch (e) { error.value = e.message; }
    }

    // --- Filtros y resumen ---
    const quarters = computed(() => [...new Set(okr.value.map((o) => o.quarter).filter(Boolean))].sort().reverse());
    const owners = computed(() => [...new Set(okr.value.map((o) => o.owner).filter(Boolean))]);
    const filtered = computed(() => okr.value.filter((o) =>
      (!filter.quarter || o.quarter === filter.quarter) && (!filter.owner || o.owner === filter.owner)));
    const summary = computed(() => {
      const f = filtered.value;
      const withPct = f.map((o) => objProgress(o.key_results) ?? (Number(o.progress) || 0));
      const avg = withPct.length ? Math.round(withPct.reduce((a, p) => a + p, 0) / withPct.length) : 0;
      return {
        total: f.length, avg,
        done: withPct.filter((p) => p >= 100).length,
        risk: withPct.filter((p) => p < 40).length,
        krTotal: f.reduce((a, o) => a + (o.key_results || []).length, 0),
      };
    });

    // Ayudantes de presentación por objetivo.
    const pctOf = (o) => objProgress(o.key_results) ?? (Number(o.progress) || 0);
    const ownerClass = (owner) => owner === 'ExperientIA' ? 'exp' : (owner === 'Conjunto' ? 'joint' : 'tonny');

    return {
      okr, loading, error, msg, edit, form, filter, quarters, owners, filtered, summary,
      OWNER_PRESETS, newObjective, open, addKr, removeKr, formProgress, formHealth, save, remove,
      krPct, healthOf, pctOf, ownerClass,
      checkin, checkForm, openCheckin, checkProgress, saveCheckin,
    };
  },
  template: `
  <div class="view view--okr">
    <div class="topbar">
      <div><h1>OKR · Estrategia</h1><p class="topbar__sub">Objetivos ambiciosos y resultados clave medibles. Un objetivo inspira; sus KR lo hacen verificable.</p></div>
      <div class="flex" style="gap:10px;align-items:center">
        <span class="muted" v-if="msg">{{ msg }}</span>
        <button class="btn" @click="newObjective">+ Nuevo objetivo</button>
      </div>
    </div>
    <p v-if="error" class="error">{{ error }}</p>

    <div v-if="loading" class="skeleton-table"><div class="skeleton-row" v-for="i in 3" :key="i" style="height:120px"></div></div>

    <template v-else>
      <!-- Resumen del ciclo -->
      <div class="okr-summary okr-summary--wide" v-if="okr.length">
        <div class="okr-summary__ring" :style="{ '--p': summary.avg }"><span>{{ summary.avg }}%</span></div>
        <div class="okr-summary__stats">
          <div><b>{{ summary.total }}</b><small>Objetivos</small></div>
          <div><b>{{ summary.krTotal }}</b><small>Resultados clave</small></div>
          <div><b>{{ summary.done }}</b><small>Logrados</small></div>
          <div><b :class="{ 'txt-risk': summary.risk }">{{ summary.risk }}</b><small>Atrasados</small></div>
        </div>
        <div class="okr-filters">
          <select v-model="filter.quarter" class="sel-sm"><option value="">Todos los ciclos</option><option v-for="q in quarters" :key="q" :value="q">{{ q }}</option></select>
          <select v-model="filter.owner" class="sel-sm"><option value="">Todos los responsables</option><option v-for="o in owners" :key="o" :value="o">{{ o }}</option></select>
        </div>
      </div>

      <div v-if="!okr.length" class="empty-state">
        <div class="empty-state__ico">🎯</div>
        <h3>Aún no hay objetivos</h3>
        <p class="muted">Define tu primer objetivo del ciclo y sus 3–5 resultados clave medibles.</p>
        <button class="btn" @click="newObjective">+ Crear el primer objetivo</button>
      </div>

      <!-- Tarjetas de objetivos -->
      <div class="okr-grid okr-grid--lg">
        <div class="panel okr-card okr-card--v2" v-for="o in filtered" :key="o.id" :class="'okr-card--' + ownerClass(o.owner)">
          <div class="okr-card__head">
            <div class="okr-card__tags">
              <span class="pill pill--blue">{{ o.quarter }}</span>
              <span v-if="o.owner" class="pill">{{ o.owner }}</span>
              <span class="okr-health" :class="'okr-health--' + healthOf(pctOf(o)).cls">● {{ pctOf(o) >= 100 ? 'Logrado' : healthOf(pctOf(o)).label }}</span>
            </div>
            <div class="okr-card__acts">
              <button class="btn btn--sm btn--ghost" @click="open(o)">Editar</button>
              <button class="btn btn--sm btn--ghost" @click="remove(o)" title="Eliminar">✕</button>
            </div>
          </div>

          <h3 class="okr-card__obj">{{ o.objective }}</h3>
          <p v-if="o.description" class="okr-card__desc muted">{{ o.description }}</p>

          <div class="okr-meter">
            <div class="okr-meter__bar"><span :style="{ width: pctOf(o) + '%' }" :class="'is-' + healthOf(pctOf(o)).cls"></span></div>
            <b>{{ pctOf(o) }}%</b>
          </div>
          <div class="okr-card__conf" v-if="o.confidence != null && o.confidence !== ''">
            <span class="muted">Confianza del responsable</span>
            <span class="conf-dots"><i v-for="n in 10" :key="n" :class="{ on: n <= Number(o.confidence) }"></i></span>
            <b>{{ o.confidence }}/10</b>
          </div>

          <ul class="okr-kr okr-kr--bars" v-if="o.key_results && o.key_results.length">
            <li v-for="(k,i) in o.key_results" :key="i">
              <div class="okr-kr__head">
                <span class="okr-kr__text">{{ k.text }}</span>
                <span class="okr-kr__val" v-if="k.current || k.target">{{ k.current || '—' }} <em>/ {{ k.target || '—' }}</em><small v-if="k.unit"> {{ k.unit }}</small></span>
              </div>
              <div class="okr-kr__bar"><span :style="{ width: krPct(k) + '%' }" :class="krPct(k) >= 100 ? 'is-done' : ''"></span></div>
            </li>
          </ul>

          <button class="btn btn--ghost btn--sm okr-card__checkin" @click="openCheckin(o)">↻ Registrar avance (check-in)</button>
        </div>
        <p v-if="okr.length && !filtered.length" class="muted">No hay objetivos con ese filtro.</p>
      </div>
    </template>

    <!-- Modal editar objetivo -->
    <modal v-if="edit" :title="edit === 'new' ? 'Nuevo objetivo' : 'Editar objetivo'" wide @close="edit = null">
      <div class="form-grid">
        <div class="field field--full"><label>Objetivo <small class="muted">— cualitativo, ambicioso, inspirador</small></label>
          <input v-model="form.objective" placeholder="Ej. Consolidar a Tonny como la autoridad #1 en crecimiento empresarial" /></div>
        <div class="field field--full"><label>Por qué importa <small class="muted">(opcional)</small></label>
          <textarea v-model="form.description" rows="2" placeholder="El contexto o la razón estratégica de este objetivo."></textarea></div>
        <div class="field"><label>Ciclo</label><input v-model="form.quarter" placeholder="2026-Q3" /></div>
        <div class="field"><label>Responsable</label>
          <input v-model="form.owner" list="okr-owners" placeholder="Responsable del objetivo" />
          <datalist id="okr-owners"><option v-for="o in OWNER_PRESETS" :key="o" :value="o"></option></datalist>
        </div>
        <div class="field"><label>Estado del ciclo</label>
          <select v-model="form.status"><option value="activo">Activo</option><option value="en_riesgo">En riesgo</option><option value="logrado">Logrado</option></select>
        </div>
        <div class="field"><label>Confianza <small class="muted">{{ form.confidence }}/10</small></label>
          <input type="range" min="0" max="10" step="1" v-model.number="form.confidence" />
        </div>
        <div class="field field--full">
          <label>Avance calculado</label>
          <div class="okr-auto" v-if="formProgress !== null">
            <div class="okr-meter__bar"><span :style="{ width: formProgress + '%' }" :class="'is-' + formHealth.cls"></span></div>
            <b>{{ formProgress }}%</b>
            <span class="okr-health" :class="'okr-health--' + formHealth.cls">● {{ formHealth.label }}</span>
            <small class="muted">promedio de los resultados clave</small>
          </div>
          <p v-else class="muted">Añade resultados clave medibles para calcular el avance.</p>
        </div>
      </div>

      <div class="gate-fields">
        <h3 class="h2-ico-row"><span class="h2-ico">◆</span> Resultados clave <small class="muted" style="font-weight:400">— 3 a 5, medibles, con línea base y meta</small></h3>
        <div class="kr-edit kr-edit--v2" v-for="(k,i) in form.key_results" :key="i">
          <div class="kr-row kr-row--v2">
            <input class="kr-row__text" v-model="k.text" placeholder="Resultado clave (ej. Impresiones acumuladas en LinkedIn)" />
            <select v-model="k.direction" class="kr-row__dir" title="¿La métrica debe subir o bajar?">
              <option value="up">↑ subir</option><option value="down">↓ bajar</option>
            </select>
            <button class="content-card__del" @click="removeKr(i)" title="Quitar">✕</button>
          </div>
          <div class="kr-row kr-row--nums">
            <label>Inicial <input v-model="k.start" placeholder="0" class="kr-row__num" /></label>
            <label>Actual <input v-model="k.current" placeholder="0" class="kr-row__num" /></label>
            <label>Meta <input v-model="k.target" placeholder="100" class="kr-row__num" /></label>
            <label>Unidad <input v-model="k.unit" placeholder="ej. leads, %, USD" class="kr-row__unit" /></label>
          </div>
          <div class="kr-edit__bar" v-if="k.text"><div class="okr-kr__bar"><span :style="{ width: krPct(k) + '%' }" :class="krPct(k) >= 100 ? 'is-done' : ''"></span></div><span class="kr-edit__pct">{{ krPct(k) }}%</span></div>
        </div>
        <button v-if="form.key_results.length < 5" class="btn btn--ghost btn--sm" @click="addKr">+ Añadir resultado clave</button>
        <p v-else class="muted" style="font-size:.8rem;margin:8px 0 0">Máximo 5 resultados clave por objetivo (recomendación de la metodología).</p>
      </div>

      <template #foot>
        <button class="btn btn--ghost" @click="edit = null">Cancelar</button>
        <button class="btn" @click="save">Guardar objetivo</button>
      </template>
    </modal>

    <!-- Modal check-in -->
    <modal v-if="checkin.id" title="Check-in de avance" @close="checkin.id = null">
      <p class="muted" style="margin-top:0">{{ checkForm.objective }}</p>
      <div class="checkin-krs">
        <div class="checkin-kr" v-for="(k,i) in checkForm.krs" :key="i">
          <div class="checkin-kr__head"><span>{{ k.text }}</span><b>{{ krPct(k) }}%</b></div>
          <div class="flex" style="gap:8px;align-items:center">
            <input v-model="k.current" class="kr-row__num" placeholder="Actual" />
            <span class="muted">/ {{ k.target || '—' }} <small v-if="k.unit">{{ k.unit }}</small></span>
            <div class="okr-kr__bar" style="flex:1"><span :style="{ width: krPct(k) + '%' }" :class="krPct(k) >= 100 ? 'is-done' : ''"></span></div>
          </div>
        </div>
      </div>
      <div class="checkin-total">Avance del objetivo: <b>{{ checkProgress }}%</b></div>
      <template #foot>
        <button class="btn btn--ghost" @click="checkin.id = null">Cancelar</button>
        <button class="btn" @click="saveCheckin">Guardar avance</button>
      </template>
    </modal>
  </div>`
};
