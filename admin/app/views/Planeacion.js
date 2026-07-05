import { ref, reactive, computed, onMounted } from 'vue';
import { api } from '../api.js';
import Modal from '../components/Modal.js';
import RichEditor from '../components/RichEditor.js';

const CHANNELS = ['Blog', 'LinkedIn', 'Instagram', 'YouTube', 'Email', 'TikTok', 'Podcast'];
const FORMATS = ['Post', 'Reel', 'Carrusel', 'Artículo', 'Live/Webinar', 'Email', 'Historia', 'Video'];

// Matriz editorial (GrowthBoard): distribución objetivo por pilar de contenido.
const PILLARS = [
  ['diagnostico', 'Diagnóstico', 40],
  ['framework', 'Framework', 25],
  ['prueba', 'Prueba', 20],
  ['vision', 'Visión', 10],
  ['oferta', 'Oferta', 5],
];
const PILLAR_LABEL = Object.fromEntries(PILLARS.map(([k, l]) => [k, l]));

// Ciclo de vida completo de una pieza (12 etapas) agrupado en macro-fases.
const STATES = [
  ['idea', 'Idea', 'plan'], ['estrategia', 'En estrategia', 'plan'],
  ['redaccion', 'En redacción', 'prod'], ['diseno', 'En diseño', 'prod'],
  ['revision', 'En revisión', 'control'], ['aprobada', 'Aprobada', 'control'],
  ['programado', 'Programado', 'dist'], ['publicado', 'Publicado', 'dist'],
  ['midiendo', 'Midiendo', 'opt'], ['optimizada', 'Optimizada', 'opt'], ['reutilizada', 'Reutilizada', 'opt'],
  ['archivada', 'Archivada', 'arch'],
];
const PHASES = [
  ['plan', 'Planeación', '💡'], ['prod', 'Producción', '✍'], ['control', 'Control', '✅'],
  ['dist', 'Distribución', '🚀'], ['opt', 'Optimización', '📈'], ['arch', 'Archivo', '📦'],
];
const STATE_MAP = Object.fromEntries(STATES.map(([k, label, phase]) => [k, { label, phase }]));
STATE_MAP['borrador'] = { label: 'Borrador', phase: 'prod' }; // compat con datos heredados

const QUALITY_MIN = 85; // umbral mínimo de calidad recomendado por el blueprint.

export default {
  components: { Modal, RichEditor },
  setup() {
    const tab = ref('contenido');
    const okr = ref([]); const contenido = ref([]); const tarea = ref([]);
    const loading = ref(true); const error = ref(''); const msg = ref('');
    const newTask = reactive({ title: '', phase: '', due_date: '' });

    async function load() {
      loading.value = true;
      try { const d = (await api.planner()).data || {}; okr.value = d.okr || []; contenido.value = d.contenido || []; tarea.value = d.tarea || []; }
      catch (e) { error.value = e.message; } finally { loading.value = false; }
    }
    onMounted(() => { load(); loadStudio(); });
    function flash(t) { msg.value = t; setTimeout(() => { if (msg.value === t) msg.value = ''; }, 2500); }

    // ---- Agentes de IA + métricas del estudio ----
    const agents = ref([]); const pipeline = ref({});
    const metricsByPiece = ref({}); const metricsSummary = ref({});
    const aiBusy = ref(false); const aiResult = ref(null); const showAgents = ref(false);
    async function loadStudio() {
      try { const a = (await api.studioAgents()).data || {}; agents.value = a.agents || []; pipeline.value = a.pipeline || {}; } catch (e) { /* IA opcional */ }
      try { const m = (await api.studioMetrics()).data || {}; metricsByPiece.value = m.by_piece || {}; metricsSummary.value = m.summary || {}; } catch (e) { /* sin métricas */ }
    }
    const agentsByPhase = computed(() => PHASES.map(([key, label, icon]) => ({ key, label, icon, list: agents.value.filter((a) => a.phase === key) })));
    const metricOf = (id) => metricsByPiece.value[id] || null;

    // Aplica a la pieza los campos propuestos por un agente.
    function applyFields(fields, notesAppend) {
      const f = fields || {};
      ['title', 'hook', 'copy', 'script', 'pillar', 'campaign', 'publish_date'].forEach((k) => { if (f[k] != null && f[k] !== '') cForm[k] = f[k]; });
      if (f.quality_score != null) cForm.quality_score = f.quality_score;
      if (f.opportunity_score != null) cForm.opportunity_score = f.opportunity_score;
      if (notesAppend) cForm.notes = (cForm.notes ? cForm.notes + '\n' : '') + notesAppend;
    }
    const piecePayload = () => ({ ...cForm, id: cEdit.value !== 'new' ? cEdit.value : null });
    async function runOrchestrate() {
      aiBusy.value = true; aiResult.value = null; cAiMsg.value = 'El estudio está trabajando…';
      try {
        const d = (await api.studioOrchestrate(piecePayload())).data || {};
        applyFields(d.fields, d.notes_append);
        if (d.next_status) cForm.status = d.next_status;
        aiResult.value = { name: d.agent_name || 'Director', icon: d.agent_icon || '🎯', summary: d.summary, next: d.next_status };
        cAiMsg.value = 'Flujo avanzado ✓ Revisa los cambios y guarda.';
      } catch (e) { cAiMsg.value = 'Estudio: ' + e.message; } finally { aiBusy.value = false; }
    }
    async function runAgent(key) {
      aiBusy.value = true; aiResult.value = null; cAiMsg.value = 'Ejecutando agente…';
      try {
        const d = (await api.studioRunAgent(key, piecePayload())).data || {};
        applyFields(d.fields, d.notes_append);
        aiResult.value = { name: d.agent_name, icon: d.agent_icon, summary: d.summary, next: null };
        cAiMsg.value = (d.agent_name || 'Agente') + ' listo ✓';
      } catch (e) { cAiMsg.value = 'Agente: ' + e.message; } finally { aiBusy.value = false; }
    }

    // ---- Adaptación multicanal en un clic ----
    const adaptSel = reactive({}); const adaptBusy = ref(false); const adaptVariants = ref([]);
    const toggleAdapt = (ch) => { adaptSel[ch] = !adaptSel[ch]; };
    async function runAdapt() {
      const targets = CHANNELS.filter((c) => adaptSel[c] && c !== cForm.channel);
      if (!targets.length) { cAiMsg.value = 'Elige al menos un canal distinto al actual.'; return; }
      adaptBusy.value = true; adaptVariants.value = []; cAiMsg.value = 'Adaptando a ' + targets.length + ' canal(es)…';
      try {
        const d = (await api.studioAdapt({ title: cForm.title, copy: cForm.copy, channel: cForm.channel }, targets)).data || {};
        adaptVariants.value = d.variants || []; cAiMsg.value = 'Adaptaciones listas ✓ — créalas como piezas nuevas.';
      } catch (e) { cAiMsg.value = 'Adaptar: ' + e.message; } finally { adaptBusy.value = false; }
    }
    async function createVariant(v) {
      try {
        await api.createPlan('contenido', { title: (cForm.title ? cForm.title + ' · ' : '') + v.channel, channel: v.channel,
          format: v.format || 'Post', status: 'redaccion', hook: v.hook, copy: v.copy, pillar: cForm.pillar,
          campaign: cForm.campaign, okr_ref: cForm.okr_ref, kr_ref: cForm.kr_ref });
        adaptVariants.value = adaptVariants.value.filter((x) => x !== v);
        await load(); flash('Variante ' + v.channel + ' creada ✓');
      } catch (e) { error.value = e.message; }
    }

    // ---- Ingesta de métricas ----
    const metricForm = reactive({ impressions: '', reach: '', engagement: '', clicks: '', conversions: '', captured_at: '' });
    const resetMetricForm = () => Object.assign(metricForm, { impressions: '', reach: '', engagement: '', clicks: '', conversions: '', captured_at: '' });
    const currentMetric = computed(() => (cEdit.value && cEdit.value !== 'new') ? (metricsByPiece.value[cEdit.value] || null) : null);
    async function saveMetric() {
      if (cEdit.value === 'new') { cAiMsg.value = 'Guarda la pieza antes de registrar métricas.'; return; }
      try {
        await api.studioSaveMetrics({ content_id: cEdit.value, channel: cForm.channel, ...metricForm });
        await loadStudio(); resetMetricForm(); flash('Métricas registradas ✓');
      } catch (e) { error.value = e.message; }
    }

    // ---- Content Studio: vistas, filtros y estado ----
    const cView = ref('pipeline'); // pipeline | calendario | matriz
    const filters = reactive({ channel: '', campaign: '', pillar: '' });
    const campaigns = computed(() => [...new Set(contenido.value.map((c) => c.campaign).filter(Boolean))]);
    const filtered = computed(() => contenido.value.filter((c) =>
      (!filters.channel || c.channel === filters.channel) &&
      (!filters.campaign || c.campaign === filters.campaign) &&
      (!filters.pillar || c.pillar === filters.pillar)));

    const statusLabel = (s) => (STATE_MAP[s] ? STATE_MAP[s].label : (s || 'Idea'));
    const statusPhase = (s) => (STATE_MAP[s] ? STATE_MAP[s].phase : 'plan');
    const pillarLabel = (p) => PILLAR_LABEL[p] || '';

    // Tablero por macro-fase (pipeline).
    const board = computed(() => PHASES.map(([key, label, icon]) => ({
      key, label, icon, items: filtered.value.filter((c) => statusPhase(c.status) === key),
    })));

    // Matriz editorial: reparto real por pilar vs. objetivo.
    const matrixTotal = computed(() => filtered.value.filter((c) => c.pillar).length);
    const uncategorized = computed(() => filtered.value.filter((c) => !c.pillar).length);
    const matrix = computed(() => {
      const total = matrixTotal.value || 1;
      return PILLARS.map(([key, label, target]) => {
        const n = filtered.value.filter((c) => c.pillar === key).length;
        const pct = Math.round(n / total * 100);
        return { key, label, target, n, pct, diff: pct - target };
      });
    });

    // Calendario mensual.
    const calMonth = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1));
    const calLabel = computed(() => calMonth.value.toLocaleDateString('es', { month: 'long', year: 'numeric' }));
    function calShift(n) { calMonth.value = new Date(calMonth.value.getFullYear(), calMonth.value.getMonth() + n, 1); }
    function calToday() { const d = new Date(); calMonth.value = new Date(d.getFullYear(), d.getMonth(), 1); }
    const todayIso = new Date().toISOString().slice(0, 10);
    const calWeeks = computed(() => {
      const year = calMonth.value.getFullYear(), month = calMonth.value.getMonth();
      const startDay = (new Date(year, month, 1).getDay() + 6) % 7; // lunes = 0
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const cells = [];
      for (let i = 0; i < startDay; i++) cells.push(null);
      for (let d = 1; d <= daysInMonth; d++) {
        const iso = year + '-' + String(month + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
        cells.push({ d, iso, items: filtered.value.filter((c) => c.publish_date === iso) });
      }
      while (cells.length % 7) cells.push(null);
      const weeks = []; for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
      return weeks;
    });

    // ---- Editor de pieza ----
    const cEdit = ref(null); const cSaving = ref(false); const cAiBusy = ref(false); const cAiMsg = ref('');
    const cImgBusy = ref(false); const cImgAspect = ref('16:9');
    const cBlank = () => ({ title: '', channel: 'LinkedIn', format: 'Post', status: 'idea', publish_date: '', url: '', hook: '', copy: '', script: '', image_url: '', okr_ref: '', kr_ref: '', pillar: '', campaign: '', quality_score: '', opportunity_score: '', notes: '' });
    const cForm = reactive(cBlank());
    const cIsBlog = computed(() => ['Blog', 'Artículo'].includes(cForm.format) || cForm.channel === 'Blog');
    const cIsVideo = computed(() => ['Reel', 'Video', 'Live/Webinar'].includes(cForm.format) || ['YouTube', 'TikTok'].includes(cForm.channel));
    const cOkrObj = computed(() => okr.value.find((o) => o.objective === cForm.okr_ref));
    const cKrs = computed(() => (cOkrObj.value && Array.isArray(cOkrObj.value.key_results)) ? cOkrObj.value.key_results : []);
    const cQualityOk = computed(() => cForm.quality_score !== '' && Number(cForm.quality_score) >= QUALITY_MIN);
    function resetAi() { aiResult.value = null; adaptVariants.value = []; resetMetricForm(); CHANNELS.forEach((c) => { adaptSel[c] = false; }); }
    function contentNew(preset) { cEdit.value = 'new'; Object.assign(cForm, cBlank(), preset || {}); cAiMsg.value = ''; resetAi(); }
    function contentOpen(row) { cEdit.value = row.id; Object.assign(cForm, cBlank(), row); cAiMsg.value = ''; resetAi(); }
    async function contentSaveModal() {
      if (!cForm.title.trim()) { error.value = 'Ponle un título a la pieza.'; return; }
      cSaving.value = true;
      try {
        const payload = { title: cForm.title, channel: cForm.channel, format: cForm.format, status: cForm.status,
          publish_date: cForm.publish_date, url: cForm.url, hook: cForm.hook, copy: cForm.copy, script: cForm.script,
          image_url: cForm.image_url, okr_ref: cForm.okr_ref, kr_ref: cForm.kr_ref, pillar: cForm.pillar, campaign: cForm.campaign,
          quality_score: cForm.quality_score === '' ? 0 : Number(cForm.quality_score),
          opportunity_score: cForm.opportunity_score === '' ? 0 : Number(cForm.opportunity_score), notes: cForm.notes };
        if (cEdit.value === 'new') await api.createPlan('contenido', payload);
        else await api.updatePlan('contenido', cEdit.value, payload);
        cEdit.value = null; await load(); flash('Pieza guardada ✓');
      } catch (e) { error.value = e.message; } finally { cSaving.value = false; }
    }
    async function generateContentImage() {
      if (!cForm.title.trim() && !cForm.hook.trim()) { cAiMsg.value = 'Escribe el título o el gancho para generar la imagen.'; return; }
      cImgBusy.value = true; cAiMsg.value = 'Generando imagen…';
      try {
        const r = await api.alexiaCover({ title: cForm.title, category: cForm.channel, type: cForm.format, excerpt: cForm.hook || cForm.copy, instructions: 'Formato ' + cImgAspect.value + ' para ' + cForm.channel + '. ' + (cForm.copy || '') });
        cForm.image_url = r.data.url; cAiMsg.value = 'Imagen lista ✓';
      } catch (e) { cAiMsg.value = 'Imagen: ' + e.message; } finally { cImgBusy.value = false; }
    }
    // Cambia el estado desde el tablero o el calendario sin abrir el editor.
    async function contentSetStatus(row, status) {
      if (!status || status === row.status) return;
      try { await api.updatePlan('contenido', row.id, { status }); await load(); } catch (e) { error.value = e.message; }
    }
    async function contentRemove(row) { if (!confirm('¿Eliminar «' + row.title + '»?')) return; await api.deletePlan('contenido', row.id); if (cEdit.value === row.id) cEdit.value = null; await load(); }
    async function generateContent() {
      const topic = (cForm.title || cForm.notes || '').trim();
      if (!topic) { cAiMsg.value = 'Escribe el título o una idea para generar.'; return; }
      cAiBusy.value = true; cAiMsg.value = 'Generando con AlexIA…';
      try {
        const r = await api.alexiaContent({ channel: cForm.channel, format: cForm.format, topic, okr: cForm.okr_ref, pillar: pillarLabel(cForm.pillar) });
        const d = r.data || {};
        if (d.title && !cForm.title) cForm.title = d.title;
        if (d.hook) cForm.hook = d.hook;
        if (d.copy) cForm.copy = d.copy;
        if (d.script) cForm.script = d.script;
        cAiMsg.value = 'Listo ✓ — revisa y ajusta el copy' + (d.script ? ' y el guion.' : '.');
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
    const taskDone = computed(() => tarea.value.filter((t) => +t.done).length);
    const taskPct = computed(() => tarea.value.length ? Math.round(taskDone.value * 100 / tarea.value.length) : 0);
    const phases = computed(() => {
      const map = {};
      tarea.value.forEach((t) => { (map[t.phase || 'General'] = map[t.phase || 'General'] || []).push(t); });
      return Object.entries(map).map(([phase, items]) => ({ phase, items,
        done: items.filter((t) => +t.done).length,
        pct: items.length ? Math.round(items.filter((t) => +t.done).length * 100 / items.length) : 0 }));
    });

    return { tab, okr, contenido, tarea, loading, error, msg, CHANNELS, FORMATS, PILLARS, STATES, PHASES, QUALITY_MIN,
      newTask, cView, filters, campaigns, filtered, statusLabel, statusPhase, pillarLabel,
      board, matrix, matrixTotal, uncategorized, calMonth, calLabel, calShift, calToday, calWeeks, todayIso,
      cEdit, cForm, cSaving, cAiBusy, cAiMsg, cImgBusy, cImgAspect, cIsBlog, cIsVideo, cOkrObj, cKrs, cQualityOk,
      contentNew, contentOpen, contentSaveModal, contentSetStatus, generateContent, generateContentImage, copyToClipboard,
      contentRemove, taskAdd, taskToggle, taskSave, taskRemove, taskDone, taskPct, phases,
      agents, pipeline, agentsByPhase, metricsByPiece, metricsSummary, metricOf, aiBusy, aiResult, showAgents,
      runOrchestrate, runAgent, adaptSel, adaptBusy, adaptVariants, toggleAdapt, runAdapt, createVariant,
      metricForm, currentMetric, saveMetric };
  },
  template: `
  <div class="view view--planner">
    <div class="topbar"><div><h1>Content Studio</h1><p class="topbar__sub">Planea, produce y optimiza el contenido: ciclo de vida completo, pilares editoriales, campañas y calidad. Los OKR viven en su módulo de Estrategia.</p></div>
      <span class="muted" v-if="msg">{{ msg }}</span></div>
    <p v-if="error" class="error">{{ error }}</p>

    <div class="tabs">
      <button :class="{ on: tab==='contenido' }" @click="tab='contenido'">🗓 Contenido</button>
      <button :class="{ on: tab==='tarea' }" @click="tab='tarea'">✓ Checklist</button>
    </div>

    <div v-if="loading" class="skeleton-table"><div class="skeleton-row" v-for="i in 4" :key="i" style="height:70px"></div></div>

    <template v-else>
      <!-- Content Studio -->
      <section v-show="tab==='contenido'">
        <div class="cs-toolbar">
          <div class="cs-views">
            <button :class="{ on: cView==='pipeline' }" @click="cView='pipeline'">▦ Pipeline</button>
            <button :class="{ on: cView==='calendario' }" @click="cView='calendario'">🗓 Calendario</button>
            <button :class="{ on: cView==='matriz' }" @click="cView='matriz'">◱ Matriz editorial</button>
          </div>
          <div class="cs-filters">
            <select v-model="filters.channel" class="sel-sm"><option value="">Todos los canales</option><option v-for="c in CHANNELS" :key="c" :value="c">{{ c }}</option></select>
            <select v-model="filters.pillar" class="sel-sm"><option value="">Todos los pilares</option><option v-for="p in PILLARS" :key="p[0]" :value="p[0]">{{ p[1] }}</option></select>
            <select v-model="filters.campaign" class="sel-sm"><option value="">Todas las campañas</option><option v-for="c in campaigns" :key="c" :value="c">{{ c }}</option></select>
            <button class="btn btn--sm" @click="contentNew()">+ Nueva pieza</button>
          </div>
        </div>

        <!-- Vista pipeline (kanban por macro-fase) -->
        <div v-if="cView==='pipeline'" class="cs-board">
          <div class="cs-col" v-for="col in board" :key="col.key">
            <h4 class="cs-col__title"><span>{{ col.icon }} {{ col.label }}</span> <span class="muted">{{ col.items.length }}</span></h4>
            <div class="content-card content-card--v2" v-for="row in col.items" :key="row.id" @click="contentOpen(row)">
              <div class="content-card__t">{{ row.title }}</div>
              <div class="content-card__tags">
                <span class="pill pill--blue">{{ row.channel }}</span>
                <span v-if="row.pillar" class="pill cs-pill" :class="'cs-pill--'+row.pillar">{{ pillarLabel(row.pillar) }}</span>
                <span v-if="row.campaign" class="pill">◆ {{ row.campaign }}</span>
              </div>
              <div class="content-card__tags">
                <span v-if="row.copy" class="content-card__has" title="Con copy listo">✎ copy</span>
                <span v-if="Number(row.quality_score)>0" class="cs-quality" :class="Number(row.quality_score)>=QUALITY_MIN ? 'is-ok' : 'is-low'" :title="'Calidad '+row.quality_score+'/100'">★ {{ row.quality_score }}</span>
                <span v-if="metricOf(row.id)" class="cs-metric" :title="'Impresiones '+metricOf(row.id).impressions+' · Interacciones '+metricOf(row.id).engagement">📊 {{ metricOf(row.id).engagement_rate }}%</span>
              </div>
              <div class="content-card__foot">
                <select class="cs-state" @click.stop @change="contentSetStatus(row, $event.target.value)">
                  <optgroup v-for="ph in PHASES" :key="ph[0]" :label="ph[1]">
                    <option v-for="s in STATES.filter(x=>x[2]===ph[0])" :key="s[0]" :value="s[0]" :selected="row.status===s[0]">{{ s[1] }}</option>
                  </optgroup>
                </select>
                <button class="content-card__del" @click.stop="contentRemove(row)" title="Eliminar">✕</button>
              </div>
              <div class="content-card__date muted">{{ row.publish_date || 'Sin fecha' }}</div>
            </div>
            <p v-if="!col.items.length" class="content-col__empty">—</p>
          </div>
        </div>

        <!-- Vista calendario -->
        <div v-else-if="cView==='calendario'" class="cs-cal">
          <div class="cs-cal__head">
            <button class="btn btn--ghost btn--sm" @click="calShift(-1)">‹</button>
            <b class="cs-cal__label">{{ calLabel }}</b>
            <button class="btn btn--ghost btn--sm" @click="calShift(1)">›</button>
            <button class="btn btn--ghost btn--sm" @click="calToday">Hoy</button>
          </div>
          <div class="cs-cal__grid">
            <div class="cs-cal__dow" v-for="d in ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']" :key="d">{{ d }}</div>
            <template v-for="(week,wi) in calWeeks" :key="wi">
              <div class="cs-cal__cell" v-for="(cell,ci) in week" :key="ci" :class="{ 'is-empty': !cell, 'is-today': cell && cell.iso===todayIso }">
                <template v-if="cell">
                  <div class="cs-cal__daynum">{{ cell.d }}</div>
                  <div class="cs-cal__ev" v-for="ev in cell.items" :key="ev.id" :class="'cs-pill--'+(ev.pillar||'none')" @click="contentOpen(ev)" :title="ev.title + ' · ' + statusLabel(ev.status)">
                    <span class="cs-cal__ev-dot"></span>{{ ev.title }}
                  </div>
                  <button class="cs-cal__add" @click="contentNew({ publish_date: cell.iso, status: 'programado' })" title="Programar pieza este día">+</button>
                </template>
              </div>
            </template>
          </div>
        </div>

        <!-- Vista matriz editorial -->
        <div v-else class="cs-matrix">
          <div class="panel">
            <div class="flex between" style="margin-bottom:4px"><h3 style="margin:0">Matriz editorial</h3><span class="muted">{{ matrixTotal }} piezas con pilar</span></div>
            <p class="hint" style="margin:0 0 16px">Equilibra la mezcla según el marco GrowthBoard: 40% diagnóstico · 25% framework · 20% prueba · 10% visión · 5% oferta.</p>
            <div class="cs-mx" v-for="m in matrix" :key="m.key">
              <div class="cs-mx__label"><span class="cs-dot" :class="'cs-pill--'+m.key"></span>{{ m.label }}</div>
              <div class="cs-mx__track">
                <span class="cs-mx__fill" :class="'cs-pill--'+m.key" :style="{ width: Math.min(100,m.pct)+'%' }"></span>
                <span class="cs-mx__target" :style="{ left: m.target+'%' }" :title="'Objetivo '+m.target+'%'"></span>
              </div>
              <div class="cs-mx__vals"><b>{{ m.pct }}%</b><small class="muted">/ {{ m.target }}%</small>
                <span class="cs-mx__diff" :class="Math.abs(m.diff)<=5 ? 'ok' : (m.diff>0 ? 'over' : 'under')">{{ m.diff>0 ? '+' : '' }}{{ m.diff }}</span>
              </div>
            </div>
            <p v-if="uncategorized" class="muted" style="margin-top:14px;font-size:.82rem">🏷 {{ uncategorized }} pieza(s) sin pilar asignado. Clasifícalas para afinar la mezcla.</p>
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

    <!-- Modal editor de contenido -->
    <modal v-if="cEdit" :title="cEdit==='new' ? 'Nueva pieza de contenido' : 'Editar pieza'" wide @close="cEdit=null">
      <div class="form-grid">
        <div class="field field--full"><label>Título / idea</label><input v-model="cForm.title" placeholder="Ej. Si no tienes tablero, estás reaccionando" /></div>
        <div class="field"><label>Canal</label><select v-model="cForm.channel"><option v-for="c in CHANNELS" :key="c" :value="c">{{ c }}</option></select></div>
        <div class="field"><label>Formato</label><select v-model="cForm.format"><option v-for="f in FORMATS" :key="f" :value="f">{{ f }}</option></select></div>
        <div class="field"><label>Estado <small class="muted">(ciclo de vida)</small></label>
          <select v-model="cForm.status">
            <optgroup v-for="ph in PHASES" :key="ph[0]" :label="ph[1]">
              <option v-for="s in STATES.filter(x=>x[2]===ph[0])" :key="s[0]" :value="s[0]">{{ s[1] }}</option>
            </optgroup>
          </select>
        </div>
        <div class="field"><label>Pilar editorial</label>
          <select v-model="cForm.pillar"><option value="">— Sin pilar —</option><option v-for="p in PILLARS" :key="p[0]" :value="p[0]">{{ p[1] }} ({{ p[2] }}%)</option></select>
        </div>
        <div class="field"><label>Campaña <small class="muted">(opcional)</small></label>
          <input v-model="cForm.campaign" list="cs-campaigns" placeholder="Ej. Lanzamiento Tablero" />
          <datalist id="cs-campaigns"><option v-for="c in campaigns" :key="c" :value="c"></option></datalist>
        </div>
        <div class="field"><label>Fecha de publicación</label><input type="date" v-model="cForm.publish_date" /></div>
        <div class="field"><label>Objetivo (OKR) que apoya <small class="muted">(opcional)</small></label>
          <select v-model="cForm.okr_ref" @change="cForm.kr_ref=''">
            <option value="">— Sin OKR —</option>
            <option v-for="o in okr" :key="o.id" :value="o.objective">{{ o.quarter }} · {{ o.objective }}</option>
          </select>
        </div>
        <div class="field"><label>Resultado clave</label>
          <select v-model="cForm.kr_ref" :disabled="!cKrs.length">
            <option value="">{{ cKrs.length ? '— Elige un KR —' : 'Elige un OKR primero' }}</option>
            <option v-for="(k,i) in cKrs" :key="i" :value="k.text">{{ k.text }}</option>
          </select>
        </div>
      </div>

      <div class="ai-gen ai-gen--col" style="margin:6px 0 12px">
        <div class="flex between">
          <label class="lbl-row">✦ Generar con AlexIA</label>
          <button type="button" class="btn btn--sm" @click="generateContent" :disabled="cAiBusy">{{ cAiBusy ? 'Generando…' : '✦ Generar gancho + copy' + (cIsVideo ? ' + guion' : '') }}</button>
        </div>
        <p class="muted" style="font-size:.8rem;margin:4px 0 0">AlexIA adapta el formato según el <b>canal, tipo y pilar</b>: HTML para blog, texto plano nativo (sin asteriscos) para redes, y guion si es video.</p>
        <p v-if="cAiMsg" class="muted" style="font-size:.82rem;margin:6px 0 0">{{ cAiMsg }}</p>
      </div>

      <!-- Estudio de agentes de IA -->
      <div class="cs-studio">
        <div class="cs-studio__flow">
          <div>
            <b class="cs-studio__stage">Etapa: {{ statusLabel(cForm.status) }}</b>
            <p class="muted" style="font-size:.78rem;margin:2px 0 0">El orquestador ejecuta el agente que corresponde a esta etapa y prepara el siguiente paso.</p>
          </div>
          <div class="flex" style="gap:8px">
            <button type="button" class="btn btn--sm" @click="runOrchestrate" :disabled="aiBusy || !pipeline[cForm.status]">{{ aiBusy ? 'Trabajando…' : '⚡ Avanzar con IA' }}</button>
            <button type="button" class="btn btn--ghost btn--sm" @click="showAgents = !showAgents">{{ showAgents ? 'Ocultar agentes' : '🤖 11 agentes' }}</button>
          </div>
        </div>

        <div v-if="aiResult" class="cs-agent-out">
          <div class="cs-agent-out__head"><span>{{ aiResult.icon }} {{ aiResult.name }}</span><span v-if="aiResult.next" class="pill pill--blue">→ {{ statusLabel(aiResult.next) }}</span></div>
          <p style="white-space:pre-wrap;margin:6px 0 0">{{ aiResult.summary }}</p>
        </div>

        <div v-if="showAgents" class="cs-agents">
          <div class="cs-agents__phase" v-for="ph in agentsByPhase" :key="ph.key" v-show="ph.list.length">
            <h5>{{ ph.icon }} {{ ph.label }}</h5>
            <button type="button" class="cs-agent" v-for="a in ph.list" :key="a.key" @click="runAgent(a.key)" :disabled="aiBusy" :title="a.task">
              <span class="cs-agent__ico">{{ a.icon }}</span>
              <span class="cs-agent__nm">{{ a.name }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Adaptación multicanal -->
      <div class="cs-studio" v-if="cForm.copy">
        <div class="flex between"><label class="lbl-row">🔁 Adaptar a otros canales</label>
          <button type="button" class="btn btn--sm" @click="runAdapt" :disabled="adaptBusy">{{ adaptBusy ? 'Adaptando…' : 'Generar adaptaciones' }}</button></div>
        <div class="cs-chips">
          <button type="button" v-for="c in CHANNELS" :key="c" v-show="c!==cForm.channel" class="cs-chip" :class="{ on: adaptSel[c] }" @click="toggleAdapt(c)">{{ c }}</button>
        </div>
        <div class="cs-variants" v-if="adaptVariants.length">
          <div class="cs-variant" v-for="(v,i) in adaptVariants" :key="i">
            <div class="cs-variant__head"><b>{{ v.channel }}</b><span v-if="v.format" class="pill">{{ v.format }}</span>
              <button type="button" class="btn btn--sm" style="margin-left:auto" @click="createVariant(v)">+ Crear pieza</button></div>
            <p v-if="v.hook" class="muted" style="margin:4px 0 0;font-size:.82rem">{{ v.hook }}</p>
            <p style="white-space:pre-wrap;margin:6px 0 0;font-size:.85rem">{{ v.copy }}</p>
          </div>
        </div>
      </div>

      <!-- Métricas de desempeño -->
      <div class="cs-studio" v-if="cEdit!=='new'">
        <label class="lbl-row">📊 Métricas de desempeño</label>
        <div v-if="currentMetric" class="cs-metrics-now">
          <div><b>{{ currentMetric.impressions.toLocaleString() }}</b><small>Impresiones</small></div>
          <div><b>{{ currentMetric.reach.toLocaleString() }}</b><small>Alcance</small></div>
          <div><b>{{ currentMetric.engagement.toLocaleString() }}</b><small>Interacciones</small></div>
          <div><b>{{ currentMetric.engagement_rate }}%</b><small>Tasa</small></div>
          <div><b>{{ currentMetric.clicks.toLocaleString() }}</b><small>Clics</small></div>
          <div><b>{{ currentMetric.conversions.toLocaleString() }}</b><small>Conversiones</small></div>
        </div>
        <p class="muted" style="font-size:.78rem;margin:8px 0 4px">Registra el corte actual (manual o desde tu herramienta de analítica). Alimenta las etapas Midiendo y Optimizada, y al agente Analista.</p>
        <div class="cs-metric-form">
          <label>Impresiones <input type="number" min="0" v-model="metricForm.impressions" /></label>
          <label>Alcance <input type="number" min="0" v-model="metricForm.reach" /></label>
          <label>Interacciones <input type="number" min="0" v-model="metricForm.engagement" /></label>
          <label>Clics <input type="number" min="0" v-model="metricForm.clicks" /></label>
          <label>Conversiones <input type="number" min="0" v-model="metricForm.conversions" /></label>
          <label>Fecha <input type="date" v-model="metricForm.captured_at" /></label>
          <button type="button" class="btn btn--sm" @click="saveMetric">Registrar</button>
        </div>
      </div>

      <div class="form-grid">
        <div class="field field--full"><label>Gancho</label><input v-model="cForm.hook" placeholder="Frase que detiene el scroll" /></div>
        <div class="field field--full"><label>Copy (listo para publicar) <small class="muted" v-if="cIsBlog">· formato HTML (blog)</small>
          <button type="button" class="btn btn--ghost btn--sm" style="margin-left:8px" @click="copyToClipboard" v-if="cForm.copy && !cIsBlog">Copiar</button></label>
          <rich-editor v-if="cIsBlog" v-model="cForm.copy" />
          <textarea v-else v-model="cForm.copy" rows="9" placeholder="El texto nativo de la red. Genéralo con AlexIA o escríbelo tú."></textarea></div>
        <div class="field field--full" v-if="cIsVideo"><label>Guion del video</label>
          <textarea v-model="cForm.script" rows="6" placeholder="Escenas, voz en off y texto en pantalla. Lo genera AlexIA."></textarea></div>
        <div class="field field--full"><label>Imagen de la pieza</label>
          <div class="flex" style="gap:8px;flex-wrap:wrap;align-items:center">
            <select v-model="cImgAspect" style="max-width:170px"><option value="16:9">16:9 (horizontal)</option><option value="9:16">9:16 (vertical / story)</option><option value="1:1">1:1 (cuadrado)</option><option value="4:5">4:5 (feed)</option></select>
            <button type="button" class="btn btn--sm" @click="generateContentImage" :disabled="cImgBusy">{{ cImgBusy ? 'Generando…' : '✦ Generar imagen' }}</button>
          </div>
          <img v-if="cForm.image_url" :src="cForm.image_url" style="max-width:280px;border-radius:10px;margin-top:8px" alt="imagen de la pieza" />
          <input v-model="cForm.image_url" placeholder="o pega una URL de imagen" style="margin-top:8px" />
        </div>
        <div class="field"><label>Calidad <small class="muted">(0–100, mínimo {{ QUALITY_MIN }})</small></label>
          <div class="cs-score">
            <input type="number" min="0" max="100" v-model="cForm.quality_score" placeholder="—" />
            <span v-if="cForm.quality_score!==''" class="cs-quality" :class="cQualityOk ? 'is-ok' : 'is-low'">{{ cQualityOk ? '✓ Publicable' : 'Por debajo del mínimo' }}</span>
          </div>
        </div>
        <div class="field"><label>Oportunidad <small class="muted">(relevancia 0–100)</small></label>
          <input type="number" min="0" max="100" v-model="cForm.opportunity_score" placeholder="—" />
        </div>
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
