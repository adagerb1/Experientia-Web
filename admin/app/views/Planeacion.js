import { ref, reactive, computed, onMounted } from 'vue';
import { api } from '../api.js';
import Modal from '../components/Modal.js';

const CHANNELS = ['Blog', 'LinkedIn', 'Instagram', 'YouTube', 'Email', 'TikTok', 'Podcast'];
const FORMATS = ['Post', 'Reel', 'Carrusel', 'Artículo', 'Live/Webinar', 'Email', 'Historia', 'Video'];
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

    // Progreso de un resultado clave: numérico (actual/meta) o por estado (texto == meta).
    function krPct(k) {
      if (!k) return 0;
      const cur = parseFloat(String(k.current ?? '').replace(/[^0-9.\-]/g, ''));
      const tgt = parseFloat(String(k.target ?? '').replace(/[^0-9.\-]/g, ''));
      if (!isNaN(cur) && !isNaN(tgt) && tgt !== 0) return Math.max(0, Math.min(100, Math.round((cur / tgt) * 100)));
      // No numérico: se considera logrado si el actual coincide con la meta.
      const c = String(k.current ?? '').trim().toLowerCase(), t = String(k.target ?? '').trim().toLowerCase();
      return (c && t && c === t) ? 100 : 0;
    }
    // Avance total = promedio de los KR (si los hay).
    function autoProgress(krs) {
      const list = (krs || []).filter((k) => k.text && k.text.trim());
      if (!list.length) return null;
      return Math.round(list.reduce((a, k) => a + krPct(k), 0) / list.length);
    }
    const formAutoProgress = computed(() => autoProgress(okrForm.key_results));

    async function okrSave() {
      const krs = okrForm.key_results.filter((k) => k.text.trim());
      const auto = autoProgress(krs);
      const payload = { ...okrForm, progress: auto !== null ? auto : (Number(okrForm.progress) || 0), key_results: krs };
      if (!payload.objective.trim()) { error.value = 'Escribe el objetivo.'; return; }
      try {
        if (okrEdit.value === 'new') await api.createPlan('okr', payload);
        else await api.updatePlan('okr', okrEdit.value, payload);
        okrEdit.value = null; await load(); flash('OKR guardado ✓');
      } catch (e) { error.value = e.message; }
    }
    async function okrRemove(o) { if (!confirm('¿Eliminar este OKR?')) return; await api.deletePlan('okr', o.id); await load(); }

    // ---- Contenido ----
    const cEdit = ref(null); const cSaving = ref(false); const cAiBusy = ref(false); const cAiMsg = ref('');
    const cBlank = () => ({ title: '', channel: 'LinkedIn', format: 'Post', status: 'idea', publish_date: '', url: '', hook: '', copy: '', okr_ref: '', notes: '' });
    const cForm = reactive(cBlank());
    function contentNew() { cEdit.value = 'new'; Object.assign(cForm, cBlank()); cAiMsg.value = ''; }
    function contentOpen(row) { cEdit.value = row.id; Object.assign(cForm, cBlank(), row); cAiMsg.value = ''; }
    async function contentSaveModal() {
      if (!cForm.title.trim()) { error.value = 'Ponle un título a la pieza.'; return; }
      cSaving.value = true;
      try {
        const payload = { title: cForm.title, channel: cForm.channel, format: cForm.format, status: cForm.status,
          publish_date: cForm.publish_date, url: cForm.url, hook: cForm.hook, copy: cForm.copy, okr_ref: cForm.okr_ref, notes: cForm.notes };
        if (cEdit.value === 'new') await api.createPlan('contenido', payload);
        else await api.updatePlan('contenido', cEdit.value, payload);
        cEdit.value = null; await load(); flash('Pieza guardada ✓');
      } catch (e) { error.value = e.message; } finally { cSaving.value = false; }
    }
    // Cambia el estado desde el tablero (kanban) sin abrir el editor.
    async function contentSetStatus(row, status) {
      try { await api.updatePlan('contenido', row.id, { status }); await load(); } catch (e) { error.value = e.message; }
    }
    async function contentRemove(row) { if (!confirm('¿Eliminar «' + row.title + '»?')) return; await api.deletePlan('contenido', row.id); if (cEdit.value === row.id) cEdit.value = null; await load(); }
    async function generateContent() {
      const topic = (cForm.title || cForm.notes || '').trim();
      if (!topic) { cAiMsg.value = 'Escribe el título o una idea para generar.'; return; }
      cAiBusy.value = true; cAiMsg.value = 'Generando con AlexIA…';
      try {
        const r = await api.alexiaContent({ channel: cForm.channel, format: cForm.format, topic, okr: cForm.okr_ref });
        const d = r.data || {};
        if (d.title && !cForm.title) cForm.title = d.title;
        if (d.hook) cForm.hook = d.hook;
        if (d.copy) cForm.copy = d.copy;
        cAiMsg.value = 'Listo ✓ — revisa y ajusta el copy.';
      } catch (e) { cAiMsg.value = 'AlexIA: ' + e.message; } finally { cAiBusy.value = false; }
    }
    function copyToClipboard() {
      try { navigator.clipboard.writeText(cForm.copy || ''); cAiMsg.value = 'Copy copiado al portapapeles ✓'; } catch (e) { cAiMsg.value = 'No se pudo copiar.'; }
    }

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

    return { tab, okr, contenido, tarea, loading, error, msg, CHANNELS, FORMATS, CONTENT_STATUS, OKR_STATUS,
      okrEdit, okrForm, newTask, okrNew, okrOpen, addKr, removeKr, okrSave, okrRemove,
      cEdit, cForm, cSaving, cAiBusy, cAiMsg, contentNew, contentOpen, contentSaveModal, contentSetStatus, generateContent, copyToClipboard,
      contentRemove, contentByStatus, taskAdd, taskToggle, taskSave, taskRemove,
      taskDone, taskPct, phases, okrFilter, quarters, owners, okrFiltered, okrSummary,
      krPct, formAutoProgress };
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
            <ul class="okr-kr okr-kr--bars" v-if="o.key_results && o.key_results.length">
              <li v-for="(k,i) in o.key_results" :key="i">
                <div class="okr-kr__head">
                  <span class="okr-kr__text">{{ k.text }}</span>
                  <span class="okr-kr__val" v-if="k.current || k.target">{{ k.current || '—' }} <em>/ {{ k.target || '—' }}</em></span>
                </div>
                <div class="okr-kr__bar"><span :style="{ width: krPct(k)+'%' }" :class="krPct(k)>=100 ? 'is-done' : ''"></span></div>
              </li>
            </ul>
            <button class="btn btn--ghost btn--sm okr-card__checkin" @click="okrOpen(o)">Actualizar avance</button>
          </div>
          <p v-if="!okrFiltered.length" class="muted">No hay OKR con ese filtro. Crea uno o ajusta el filtro.</p>
        </div>
      </section>

      <!-- Contenido -->
      <section v-show="tab==='contenido'">
        <div class="flex between" style="margin-bottom:6px"><h2>Calendario de contenido</h2><button class="btn btn--sm" @click="contentNew">+ Nueva pieza</button></div>
        <p class="hint" style="margin:0 0 14px">Planifica y produce las piezas del Q3. Abre una pieza para escribir el copy o generarlo con AlexIA.</p>
        <div class="content-board">
          <div class="content-col" v-for="col in contentByStatus" :key="col.k">
            <h4 class="content-col__title">{{ col.label }} <span class="muted">{{ col.items.length }}</span></h4>
            <div class="content-card content-card--v2" v-for="row in col.items" :key="row.id" @click="contentOpen(row)">
              <div class="content-card__t">{{ row.title }}</div>
              <div class="content-card__tags">
                <span class="pill pill--blue">{{ row.channel }}</span>
                <span v-if="row.format" class="pill">{{ row.format }}</span>
                <span v-if="row.copy" class="content-card__has" title="Con copy listo">✎</span>
              </div>
              <div class="content-card__foot">
                <span class="muted">{{ row.publish_date || 'Sin fecha' }}</span>
                <button class="content-card__del" @click.stop="contentRemove(row)" title="Eliminar">✕</button>
              </div>
            </div>
            <p v-if="!col.items.length" class="content-col__empty">—</p>
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
        <div class="field">
          <label>Avance total</label>
          <div class="okr-auto" v-if="formAutoProgress !== null">
            <div class="okr-prog__bar"><span :style="{ width: formAutoProgress+'%' }"></span></div>
            <b>{{ formAutoProgress }}%</b><small class="muted">calculado de los KR</small>
          </div>
          <div v-else class="flex" style="gap:10px;align-items:center">
            <input type="range" min="0" max="100" step="5" v-model.number="okrForm.progress" style="flex:1" /><b>{{ okrForm.progress }}%</b>
          </div>
        </div>
      </div>
      <div class="gate-fields">
        <h3 class="h2-ico-row"><span class="h2-ico">◆</span> Resultados clave <small class="muted" style="font-weight:400">— actualiza el "actual" para reflejar el avance</small></h3>
        <div class="kr-edit" v-for="(k,i) in okrForm.key_results" :key="i">
          <div class="kr-row">
            <input v-model="k.text" placeholder="Resultado clave medible" />
            <input v-model="k.current" placeholder="Actual" class="kr-row__num" />
            <input v-model="k.target" placeholder="Meta" class="kr-row__num" />
            <button class="content-card__del" @click="removeKr(i)">✕</button>
          </div>
          <div class="kr-edit__bar" v-if="k.text"><div class="okr-kr__bar"><span :style="{ width: krPct(k)+'%' }" :class="krPct(k)>=100 ? 'is-done' : ''"></span></div><span class="kr-edit__pct">{{ krPct(k) }}%</span></div>
        </div>
        <button class="btn btn--ghost btn--sm" @click="addKr">+ Añadir resultado clave</button>
      </div>
      <template #foot>
        <button class="btn btn--ghost" @click="okrEdit=null">Cancelar</button>
        <button class="btn" @click="okrSave">Guardar OKR</button>
      </template>
    </modal>

    <!-- Modal editor de contenido -->
    <modal v-if="cEdit" :title="cEdit==='new' ? 'Nueva pieza de contenido' : 'Editar pieza'" wide @close="cEdit=null">
      <div class="form-grid">
        <div class="field field--full"><label>Título / idea</label><input v-model="cForm.title" placeholder="Ej. Si no tienes tablero, estás reaccionando" /></div>
        <div class="field"><label>Canal</label><select v-model="cForm.channel"><option v-for="c in CHANNELS" :key="c" :value="c">{{ c }}</option></select></div>
        <div class="field"><label>Formato</label><select v-model="cForm.format"><option v-for="f in FORMATS" :key="f" :value="f">{{ f }}</option></select></div>
        <div class="field"><label>Estado</label><select v-model="cForm.status"><option v-for="s in CONTENT_STATUS" :key="s[0]" :value="s[0]">{{ s[1] }}</option></select></div>
        <div class="field"><label>Fecha de publicación</label><input type="date" v-model="cForm.publish_date" /></div>
        <div class="field field--full"><label>Objetivo (OKR) que apoya <small class="muted">(opcional)</small></label><input v-model="cForm.okr_ref" placeholder="Ej. Instalar El Tablero como símbolo propietario" /></div>
      </div>

      <div class="ai-gen ai-gen--col" style="margin:6px 0 12px">
        <div class="flex between">
          <label class="lbl-row">✦ Generar con AlexIA</label>
          <button type="button" class="btn btn--sm" @click="generateContent" :disabled="cAiBusy">{{ cAiBusy ? 'Generando…' : '✦ Generar gancho + copy' }}</button>
        </div>
        <p class="muted" style="font-size:.8rem;margin:4px 0 0">Usa el <b>canal, formato y título/idea</b> (y el OKR si lo pones) para escribir un copy listo para publicar con la narrativa del Q3.</p>
        <p v-if="cAiMsg" class="muted" style="font-size:.82rem;margin:6px 0 0">{{ cAiMsg }}</p>
      </div>

      <div class="form-grid">
        <div class="field field--full"><label>Gancho</label><input v-model="cForm.hook" placeholder="Frase que detiene el scroll" /></div>
        <div class="field field--full"><label>Copy (listo para publicar)
          <button type="button" class="btn btn--ghost btn--sm" style="margin-left:8px" @click="copyToClipboard" v-if="cForm.copy">Copiar</button></label>
          <textarea v-model="cForm.copy" rows="10" placeholder="El texto de la pieza. Genéralo con AlexIA o escríbelo tú."></textarea></div>
        <div class="field field--full"><label>Enlace publicado <small class="muted">(cuando salga)</small></label><input v-model="cForm.url" placeholder="https://…" /></div>
        <div class="field field--full"><label>Notas internas</label><textarea v-model="cForm.notes" rows="2"></textarea></div>
      </div>

      <template #foot>
        <button class="btn btn--ghost" @click="cEdit=null">Cancelar</button>
        <button class="btn" @click="contentSaveModal" :disabled="cSaving">{{ cSaving ? 'Guardando…' : 'Guardar pieza' }}</button>
      </template>
    </modal>
  </div>`
};
