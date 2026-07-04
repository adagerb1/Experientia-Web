import { ref, reactive, computed, onMounted } from 'vue';
import { api } from '../api.js';
import Modal from '../components/Modal.js';
import RichEditor from '../components/RichEditor.js';

const CHANNELS = ['Blog', 'LinkedIn', 'Instagram', 'YouTube', 'Email', 'TikTok', 'Podcast'];
const FORMATS = ['Post', 'Reel', 'Carrusel', 'Artículo', 'Live/Webinar', 'Email', 'Historia', 'Video'];
const CONTENT_STATUS = [['idea', 'Idea'], ['borrador', 'Borrador'], ['programado', 'Programado'], ['publicado', 'Publicado']];

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
    onMounted(load);

    function flash(t) { msg.value = t; setTimeout(() => { if (msg.value === t) msg.value = ''; }, 2500); }

    // ---- Contenido ----
    const cEdit = ref(null); const cSaving = ref(false); const cAiBusy = ref(false); const cAiMsg = ref('');
    const cImgBusy = ref(false); const cImgAspect = ref('16:9');
    const cBlank = () => ({ title: '', channel: 'LinkedIn', format: 'Post', status: 'idea', publish_date: '', url: '', hook: '', copy: '', script: '', image_url: '', okr_ref: '', kr_ref: '', notes: '' });
    const cForm = reactive(cBlank());
    // ¿El copy va en HTML? (blog/artículo) → editor enriquecido.
    const cIsBlog = computed(() => ['Blog', 'Artículo'].includes(cForm.format) || cForm.channel === 'Blog');
    const cIsVideo = computed(() => ['Reel', 'Video', 'Live/Webinar'].includes(cForm.format) || ['YouTube', 'TikTok'].includes(cForm.channel));
    // OKR seleccionado y sus resultados clave (para el select dependiente).
    const cOkrObj = computed(() => okr.value.find((o) => o.objective === cForm.okr_ref));
    const cKrs = computed(() => (cOkrObj.value && Array.isArray(cOkrObj.value.key_results)) ? cOkrObj.value.key_results : []);
    function contentNew() { cEdit.value = 'new'; Object.assign(cForm, cBlank()); cAiMsg.value = ''; }
    function contentOpen(row) { cEdit.value = row.id; Object.assign(cForm, cBlank(), row); cAiMsg.value = ''; }
    async function contentSaveModal() {
      if (!cForm.title.trim()) { error.value = 'Ponle un título a la pieza.'; return; }
      cSaving.value = true;
      try {
        const payload = { title: cForm.title, channel: cForm.channel, format: cForm.format, status: cForm.status,
          publish_date: cForm.publish_date, url: cForm.url, hook: cForm.hook, copy: cForm.copy, script: cForm.script,
          image_url: cForm.image_url, okr_ref: cForm.okr_ref, kr_ref: cForm.kr_ref, notes: cForm.notes };
        if (cEdit.value === 'new') await api.createPlan('contenido', payload);
        else await api.updatePlan('contenido', cEdit.value, payload);
        cEdit.value = null; await load(); flash('Pieza guardada ✓');
      } catch (e) { error.value = e.message; } finally { cSaving.value = false; }
    }
    // Genera la imagen de la pieza con el formato elegido (reusa el generador de portadas).
    async function generateContentImage() {
      if (!cForm.title.trim() && !cForm.hook.trim()) { cAiMsg.value = 'Escribe el título o el gancho para generar la imagen.'; return; }
      cImgBusy.value = true; cAiMsg.value = 'Generando imagen…';
      try {
        const r = await api.alexiaCover({ title: cForm.title, category: cForm.channel, type: cForm.format, excerpt: cForm.hook || cForm.copy, instructions: 'Formato ' + cImgAspect.value + ' para ' + cForm.channel + '. ' + (cForm.copy || '') });
        cForm.image_url = r.data.url; cAiMsg.value = 'Imagen lista ✓';
      } catch (e) { cAiMsg.value = 'Imagen: ' + e.message; } finally { cImgBusy.value = false; }
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

    return { tab, okr, contenido, tarea, loading, error, msg, CHANNELS, FORMATS, CONTENT_STATUS,
      newTask,
      cEdit, cForm, cSaving, cAiBusy, cAiMsg, cImgBusy, cImgAspect, cIsBlog, cIsVideo, cOkrObj, cKrs,
      contentNew, contentOpen, contentSaveModal, contentSetStatus, generateContent, generateContentImage, copyToClipboard,
      contentRemove, contentByStatus, taskAdd, taskToggle, taskSave, taskRemove,
      taskDone, taskPct, phases };
  },
  template: `
  <div class="view view--planner">
    <div class="topbar"><div><h1>Planeación</h1><p class="topbar__sub">Calendario de contenido y checklist de implementación. Los OKR viven ahora en su propio módulo dentro de Estrategia.</p></div>
      <span class="muted" v-if="msg">{{ msg }}</span></div>
    <p v-if="error" class="error">{{ error }}</p>

    <div class="tabs">
      <button :class="{ on: tab==='contenido' }" @click="tab='contenido'">🗓 Contenido</button>
      <button :class="{ on: tab==='tarea' }" @click="tab='tarea'">✓ Checklist</button>
    </div>

    <div v-if="loading" class="skeleton-table"><div class="skeleton-row" v-for="i in 4" :key="i" style="height:70px"></div></div>

    <template v-else>
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

    <!-- Modal editor de contenido -->
    <modal v-if="cEdit" :title="cEdit==='new' ? 'Nueva pieza de contenido' : 'Editar pieza'" wide @close="cEdit=null">
      <div class="form-grid">
        <div class="field field--full"><label>Título / idea</label><input v-model="cForm.title" placeholder="Ej. Si no tienes tablero, estás reaccionando" /></div>
        <div class="field"><label>Canal</label><select v-model="cForm.channel"><option v-for="c in CHANNELS" :key="c" :value="c">{{ c }}</option></select></div>
        <div class="field"><label>Formato</label><select v-model="cForm.format"><option v-for="f in FORMATS" :key="f" :value="f">{{ f }}</option></select></div>
        <div class="field"><label>Estado</label><select v-model="cForm.status"><option v-for="s in CONTENT_STATUS" :key="s[0]" :value="s[0]">{{ s[1] }}</option></select></div>
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
        <p class="muted" style="font-size:.8rem;margin:4px 0 0">AlexIA adapta el formato según el <b>canal y tipo</b>: HTML para blog, texto plano nativo (sin asteriscos) para redes, y guion si es video.</p>
        <p v-if="cAiMsg" class="muted" style="font-size:.82rem;margin:6px 0 0">{{ cAiMsg }}</p>
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
