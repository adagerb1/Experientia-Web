import { ref, reactive, computed, onMounted } from 'vue';
import { api } from '../api.js';
import Modal from '../components/Modal.js';

const CHANNELS = ['Blog', 'LinkedIn', 'Instagram', 'YouTube', 'Email', 'TikTok', 'Podcast'];
const CONTENT_STATUS = [['idea', 'Idea'], ['borrador', 'Borrador'], ['programado', 'Programado'], ['publicado', 'Publicado']];
const OKR_STATUS = [['activo', 'Activo'], ['en_riesgo', 'En riesgo'], ['logrado', 'Logrado']];

function currentQuarter() {
  const d = new Date(); return d.getFullYear() + '-Q' + (Math.floor(d.getMonth() / 3) + 1);
}

export default {
  components: { Modal },
  setup() {
    const tab = ref('okr');
    const okr = ref([]); const contenido = ref([]); const tarea = ref([]);
    const loading = ref(true); const error = ref(''); const msg = ref('');
    const okrEdit = ref(null);
    const okrForm = reactive({ objective: '', quarter: currentQuarter(), owner: '', status: 'activo', progress: 0, key_results: [] });
    const newTask = reactive({ title: '', phase: '', due_date: '' });

    async function load() {
      loading.value = true;
      try { const d = (await api.planner()).data || {}; okr.value = d.okr || []; contenido.value = d.contenido || []; tarea.value = d.tarea || []; }
      catch (e) { error.value = e.message; } finally { loading.value = false; }
    }
    onMounted(load);

    function flash(t) { msg.value = t; setTimeout(() => { if (msg.value === t) msg.value = ''; }, 2500); }

    // ---- OKR ----
    function okrNew() { okrEdit.value = 'new'; Object.assign(okrForm, { objective: '', quarter: currentQuarter(), owner: '', status: 'activo', progress: 0, key_results: [{ text: '', target: '', current: '' }] }); }
    function okrOpen(o) { okrEdit.value = o.id; Object.assign(okrForm, { ...o, key_results: Array.isArray(o.key_results) && o.key_results.length ? o.key_results.map((k) => ({ ...k })) : [{ text: '', target: '', current: '' }] }); }
    const addKr = () => okrForm.key_results.push({ text: '', target: '', current: '' });
    const removeKr = (i) => okrForm.key_results.splice(i, 1);
    async function okrSave() {
      const payload = { ...okrForm, progress: Number(okrForm.progress) || 0, key_results: okrForm.key_results.filter((k) => k.text.trim()) };
      if (!payload.objective.trim()) { error.value = 'Escribe el objetivo.'; return; }
      try {
        if (okrEdit.value === 'new') await api.createPlan('okr', payload);
        else await api.updatePlan('okr', okrEdit.value, payload);
        okrEdit.value = null; await load(); flash('OKR guardado ✓');
      } catch (e) { error.value = e.message; }
    }
    async function okrRemove(o) { if (!confirm('¿Eliminar este OKR?')) return; await api.deletePlan('okr', o.id); await load(); }

    // ---- Contenido ----
    async function contentAdd() {
      try { await api.createPlan('contenido', { title: 'Nueva pieza', channel: 'Blog', status: 'idea' }); await load(); }
      catch (e) { error.value = e.message; }
    }
    async function contentSave(row) {
      try { await api.updatePlan('contenido', row.id, { title: row.title, channel: row.channel, status: row.status, publish_date: row.publish_date, url: row.url, notes: row.notes }); flash('Guardado ✓'); }
      catch (e) { error.value = e.message; }
    }
    async function contentRemove(row) { if (!confirm('¿Eliminar «' + row.title + '»?')) return; await api.deletePlan('contenido', row.id); await load(); }

    // ---- Checklist ----
    async function taskAdd() {
      if (!newTask.title.trim()) { error.value = 'Escribe el nombre de la tarea antes de añadir.'; return; }
      error.value = '';
      try {
        await api.createPlan('tarea', { title: newTask.title.trim(), phase: (newTask.phase || 'General').trim(), due_date: newTask.due_date });
        Object.assign(newTask, { title: '', phase: '', due_date: '' });
        await load(); flash('Tarea añadida ✓');
      } catch (e) { error.value = e.message; }
    }
    async function taskToggle(t) {
      t.done = t.done ? 0 : 1;
      try { await api.updatePlan('tarea', t.id, { done: t.done }); } catch (e) { error.value = e.message; }
    }
    async function taskSave(t) { try { await api.updatePlan('tarea', t.id, { title: t.title, phase: t.phase, due_date: t.due_date }); flash('Guardado ✓'); } catch (e) { error.value = e.message; } }
    async function taskRemove(t) { await api.deletePlan('tarea', t.id); await load(); }

    // Filtros y resumen de OKR.
    const okrFilter = reactive({ quarter: '', owner: '' });
    const quarters = computed(() => [...new Set(okr.value.map((o) => o.quarter).filter(Boolean))].sort().reverse());
    const owners = computed(() => [...new Set(okr.value.map((o) => o.owner).filter(Boolean))]);
    const okrFiltered = computed(() => okr.value.filter((o) =>
      (!okrFilter.quarter || o.quarter === okrFilter.quarter) && (!okrFilter.owner || o.owner === okrFilter.owner)));
    const okrSummary = computed(() => {
      const f = okrFiltered.value;
      const avg = f.length ? Math.round(f.reduce((a, o) => a + (Number(o.progress) || 0), 0) / f.length) : 0;
      return { total: f.length, avg,
        risk: f.filter((o) => o.status === 'en_riesgo').length,
        done: f.filter((o) => o.status === 'logrado').length };
    });

    const contentByStatus = computed(() => CONTENT_STATUS.map(([k, label]) => ({ k, label, items: contenido.value.filter((c) => c.status === k) })));
    const taskDone = computed(() => tarea.value.filter((t) => +t.done).length);
    const taskPct = computed(() => tarea.value.length ? Math.round(taskDone.value * 100 / tarea.value.length) : 0);
    const phases = computed(() => {
      const map = {};
      tarea.value.forEach((t) => { (map[t.phase || 'General'] = map[t.phase || 'General'] || []).push(t); });
      return Object.entries(map).map(([phase, items]) => ({ phase, items,
        done: items.filter((t) => +t.done).length,
        pct: items.length ? Math.round(items.filter((t) => +t.done).length * 100 / items.length) : 0 }));
    });

    return { tab, okr, contenido, tarea, loading, error, msg, CHANNELS, CONTENT_STATUS, OKR_STATUS,
      okrEdit, okrForm, newTask, okrNew, okrOpen, addKr, removeKr, okrSave, okrRemove,
      contentAdd, contentSave, contentRemove, contentByStatus, taskAdd, taskToggle, taskSave, taskRemove,
      taskDone, taskPct, phases, okrFilter, quarters, owners, okrFiltered, okrSummary };
  },
  template: `
  <div class="view view--planner">
    <div class="topbar"><div><h1>Planeación</h1><p class="topbar__sub">OKR trimestrales, calendario de contenido y checklist de implementación.</p></div>
      <span class="muted" v-if="msg">{{ msg }}</span></div>
    <p v-if="error" class="error">{{ error }}</p>

    <div class="tabs">
      <button :class="{ on: tab==='okr' }" @click="tab='okr'">🎯 OKR</button>
      <button :class="{ on: tab==='contenido' }" @click="tab='contenido'">🗓 Contenido</button>
      <button :class="{ on: tab==='tarea' }" @click="tab='tarea'">✓ Checklist</button>
    </div>

    <div v-if="loading" class="skeleton-table"><div class="skeleton-row" v-for="i in 4" :key="i" style="height:70px"></div></div>

    <template v-else>
      <!-- OKR -->
      <section v-show="tab==='okr'">
        <div class="flex between" style="margin-bottom:12px"><h2>Objetivos y resultados clave</h2><button class="btn btn--sm" @click="okrNew">+ Nuevo OKR</button></div>

        <div class="okr-summary" v-if="okr.length">
          <div class="okr-summary__ring" :style="{ '--p': okrSummary.avg }"><span>{{ okrSummary.avg }}%</span></div>
          <div class="okr-summary__stats">
            <div><b>{{ okrSummary.total }}</b><small>Objetivos</small></div>
            <div><b>{{ okrSummary.done }}</b><small>Logrados</small></div>
            <div><b>{{ okrSummary.risk }}</b><small>En riesgo</small></div>
          </div>
          <div class="okr-filters">
            <select v-model="okrFilter.quarter" class="sel-sm"><option value="">Todos los trimestres</option><option v-for="q in quarters" :key="q" :value="q">{{ q }}</option></select>
            <select v-model="okrFilter.owner" class="sel-sm"><option value="">Todos los responsables</option><option v-for="o in owners" :key="o" :value="o">{{ o }}</option></select>
          </div>
        </div>

        <div class="okr-grid">
          <div class="panel okr-card" v-for="o in okrFiltered" :key="o.id"
            :class="'okr-card--' + (o.owner==='ExperientIA' ? 'exp' : (o.owner==='Conjunto' ? 'joint' : 'tonny'))">
            <div class="okr-card__head">
              <div class="okr-card__tags"><span class="pill pill--blue">{{ o.quarter }}</span>
                <span v-if="o.owner" class="pill">{{ o.owner }}</span>
                <span class="pill" :class="o.status==='logrado' ? 'pill--green' : (o.status==='en_riesgo' ? 'pill--red' : 'pill--amber')">{{ o.status==='en_riesgo' ? 'En riesgo' : (o.status==='logrado' ? 'Logrado' : 'Activo') }}</span></div>
              <div class="flex"><button class="btn btn--sm btn--ghost" @click="okrOpen(o)">Editar</button><button class="btn btn--sm btn--ghost" @click="okrRemove(o)">✕</button></div>
            </div>
            <h3 class="okr-card__obj">{{ o.objective }}</h3>
            <div class="okr-prog"><div class="okr-prog__bar"><span :style="{ width: (o.progress||0)+'%' }"></span></div><b>{{ o.progress||0 }}%</b></div>
            <ul class="okr-kr" v-if="o.key_results && o.key_results.length">
              <li v-for="(k,i) in o.key_results" :key="i">
                <span class="okr-kr__text">{{ k.text }}</span>
                <span class="okr-kr__val" v-if="k.current || k.target">{{ k.current || '—' }} <em>/ {{ k.target || '—' }}</em></span>
              </li>
            </ul>
          </div>
          <p v-if="!okrFiltered.length" class="muted">No hay OKR con ese filtro. Crea uno o ajusta el filtro.</p>
        </div>
      </section>

      <!-- Contenido -->
      <section v-show="tab==='contenido'">
        <div class="flex between" style="margin-bottom:12px"><h2>Calendario de contenido</h2><button class="btn btn--sm" @click="contentAdd">+ Añadir pieza</button></div>
        <div class="content-board">
          <div class="content-col" v-for="col in contentByStatus" :key="col.k">
            <h4 class="content-col__title">{{ col.label }} <span class="muted">{{ col.items.length }}</span></h4>
            <div class="content-card" v-for="row in col.items" :key="row.id">
              <input class="content-card__title" v-model="row.title" @change="contentSave(row)" />
              <div class="content-card__meta">
                <select v-model="row.channel" @change="contentSave(row)"><option v-for="c in CHANNELS" :key="c" :value="c">{{ c }}</option></select>
                <select v-model="row.status" @change="contentSave(row)"><option v-for="s in CONTENT_STATUS" :key="s[0]" :value="s[0]">{{ s[1] }}</option></select>
              </div>
              <input type="date" v-model="row.publish_date" @change="contentSave(row)" />
              <input class="content-card__url" v-model="row.url" @change="contentSave(row)" placeholder="URL (opcional)" />
              <button class="content-card__del" @click="contentRemove(row)" title="Eliminar">✕</button>
            </div>
          </div>
        </div>
      </section>

      <!-- Checklist -->
      <section v-show="tab==='tarea'">
        <div class="flex between" style="margin-bottom:8px"><h2>Checklist de implementación</h2><b>{{ taskDone }}/{{ tarea.length }} · {{ taskPct }}%</b></div>
        <div class="okr-prog" style="margin-bottom:14px"><div class="okr-prog__bar"><span :style="{ width: taskPct+'%' }"></span></div></div>
        <div class="panel">
          <div class="flex" style="gap:8px;margin-bottom:14px;flex-wrap:wrap">
            <input v-model="newTask.title" placeholder="Nueva tarea…" style="flex:2;min-width:180px" @keyup.enter="taskAdd" />
            <input v-model="newTask.phase" placeholder="Fase (ej. Fase 1)" style="flex:1;min-width:120px" @keyup.enter="taskAdd" />
            <input type="date" v-model="newTask.due_date" />
            <button class="btn btn--sm" @click="taskAdd">Añadir</button>
          </div>
          <div v-for="p in phases" :key="p.phase" class="task-phase">
            <div class="task-phase__head">
              <h4 class="task-phase__title">{{ p.phase }}</h4>
              <span class="task-phase__count">{{ p.done }}/{{ p.items.length }}</span>
              <div class="okr-prog__bar task-phase__bar"><span :style="{ width: p.pct+'%' }"></span></div>
            </div>
            <div class="task-row" v-for="t in p.items" :key="t.id" :class="{ 'task-row--done': +t.done }">
              <label class="task-check"><input type="checkbox" :checked="+t.done" @change="taskToggle(t)" /><span></span></label>
              <input class="task-row__title" v-model="t.title" @change="taskSave(t)" />
              <input type="date" v-model="t.due_date" @change="taskSave(t)" />
              <button class="content-card__del" @click="taskRemove(t)" title="Eliminar">✕</button>
            </div>
          </div>
          <p v-if="!tarea.length" class="muted">Sin tareas aún. Añade la primera arriba.</p>
        </div>
      </section>
    </template>

    <!-- Modal OKR -->
    <modal v-if="okrEdit" :title="okrEdit==='new' ? 'Nuevo OKR' : 'Editar OKR'" wide @close="okrEdit=null">
      <div class="form-grid">
        <div class="field field--full"><label>Objetivo</label><input v-model="okrForm.objective" placeholder="Ej. Consolidar el canal de agenda como fuente #1 de reuniones" /></div>
        <div class="field"><label>Trimestre</label><input v-model="okrForm.quarter" placeholder="2026-Q3" /></div>
        <div class="field"><label>Responsable</label><input v-model="okrForm.owner" /></div>
        <div class="field"><label>Estado</label><select v-model="okrForm.status"><option v-for="s in OKR_STATUS" :key="s[0]" :value="s[0]">{{ s[1] }}</option></select></div>
        <div class="field"><label>Progreso: {{ okrForm.progress }}%</label><input type="range" min="0" max="100" step="5" v-model.number="okrForm.progress" /></div>
      </div>
      <div class="gate-fields">
        <h3 class="h2-ico-row"><span class="h2-ico">◆</span> Resultados clave</h3>
        <div class="kr-row" v-for="(k,i) in okrForm.key_results" :key="i">
          <input v-model="k.text" placeholder="Resultado clave medible" />
          <input v-model="k.current" placeholder="Actual" class="kr-row__num" />
          <input v-model="k.target" placeholder="Meta" class="kr-row__num" />
          <button class="content-card__del" @click="removeKr(i)">✕</button>
        </div>
        <button class="btn btn--ghost btn--sm" @click="addKr">+ Añadir resultado clave</button>
      </div>
      <template #foot>
        <button class="btn btn--ghost" @click="okrEdit=null">Cancelar</button>
        <button class="btn" @click="okrSave">Guardar OKR</button>
      </template>
    </modal>
  </div>`
};
