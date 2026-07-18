import { ref, reactive, computed, onMounted } from 'vue';
import { api } from '../api.js';

export default {
  setup() {
    const items = ref([]);
    const selected = ref(null);
    const activeId = ref(null);
    const loading = ref(false);
    const busy = ref(false);
    const error = ref('');
    const notice = ref('');
    const tab = ref('studio');
    const stage = ref('blueprint');
    const brief = ref('');
    const form = reactive({ title: '', slug: '', format: 'workshop', summary: '', audience: '' });
    const edition = reactive({ name: 'Primera edición', starts_at: '', ends_at: '', timezone: 'America/Bogota', capacity: 30, registration_open: true });

    const pipeline = computed(() => selected.value?.pipeline || []);
    const artifacts = computed(() => selected.value?.artifacts || []);
    const enrollments = computed(() => selected.value?.enrollments || []);

    function slugify(value) {
      return (value || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }
    async function load() {
      loading.value = true; error.value = '';
      try {
        items.value = (await api.events()).data || [];
        if (activeId.value) await open(activeId.value);
      } catch (e) { error.value = e.message; }
      finally { loading.value = false; }
    }
    async function open(id) {
      activeId.value = id; busy.value = true; error.value = '';
      try { selected.value = (await api.event(id)).data; }
      catch (e) { error.value = e.message; }
      finally { busy.value = false; }
    }
    async function create() {
      if (!form.title) { error.value = 'Escribe un nombre para la experiencia.'; return; }
      busy.value = true; error.value = '';
      try {
        const result = await api.createEvent({ ...form, slug: form.slug || slugify(form.title) });
        Object.assign(form, { title: '', slug: '', format: 'workshop', summary: '', audience: '' });
        activeId.value = result.data.id;
        await load();
        notice.value = 'Experiencia creada. Ahora define la edición y trabaja con AlexIA.';
      } catch (e) { error.value = e.message; }
      finally { busy.value = false; }
    }
    async function addEdition() {
      busy.value = true; error.value = '';
      try {
        await api.createEventEdition(activeId.value, { ...edition });
        await open(activeId.value);
        notice.value = 'Edición creada.';
      } catch (e) { error.value = e.message; }
      finally { busy.value = false; }
    }
    async function runAgent() {
      if (!brief.value.trim()) { error.value = 'Dale a AlexIA un brief para esta etapa.'; return; }
      busy.value = true; error.value = ''; notice.value = '';
      try {
        await api.runEventAgent(activeId.value, { stage: stage.value, brief: brief.value });
        brief.value = '';
        await open(activeId.value);
        notice.value = 'AlexIA generó un borrador. Revísalo antes de aplicarlo.';
      } catch (e) { error.value = e.message; }
      finally { busy.value = false; }
    }
    async function review(artifact, decision) {
      busy.value = true; error.value = '';
      try {
        await api.reviewEventArtifact(activeId.value, artifact.id, { decision });
        await open(activeId.value);
        notice.value = decision === 'applied' ? 'Artefacto aplicado.' : 'Artefacto rechazado.';
      } catch (e) { error.value = e.message; }
      finally { busy.value = false; }
    }
    async function publishExperience() {
      busy.value = true; error.value = '';
      try {
        const result = await api.publishEvent(activeId.value);
        await load();
        notice.value = 'Publicado: ' + result.data.url;
      } catch (e) { error.value = e.message; }
      finally { busy.value = false; }
    }
    function payload(artifact) {
      try { return JSON.parse(artifact.content_json || '{}'); } catch (_) { return {}; }
    }

    onMounted(load);
    return { items, selected, activeId, loading, busy, error, notice, tab, stage, brief, form, edition,
      pipeline, artifacts, enrollments, slugify, open, create, addEdition, runAgent, review, publishExperience, payload };
  },
  template: `
  <section class="page event-admin">
    <header class="page__header event-admin__header">
      <div>
        <p class="eyebrow">Experiencias</p>
        <h1>Eventos & Experiencias</h1>
        <p class="muted">Diseña, promueve y opera experiencias con AlexIA como orquestadora.</p>
      </div>
      <button v-if="selected" class="btn btn--primary" :disabled="busy" @click="publishExperience">Publicar experiencia</button>
    </header>

    <p v-if="error" class="alert alert--danger">{{ error }}</p>
    <p v-if="notice" class="alert alert--success">{{ notice }}</p>

    <div class="event-admin__layout">
      <aside class="card event-admin__sidebar">
        <h2>Experiencias</h2>
        <button v-for="item in items" :key="item.id" class="event-admin__item"
          :class="{ active: activeId === item.id }" @click="open(item.id)">
          <strong>{{ item.title }}</strong>
          <span>{{ item.format }} · {{ item.status }}</span>
          <small>{{ item.enrollments_count || 0 }} participantes</small>
        </button>
        <p v-if="!items.length && !loading" class="muted">Aún no hay experiencias.</p>

        <form class="event-admin__create" @submit.prevent="create">
          <h3>Nueva experiencia</h3>
          <input v-model="form.title" class="input" placeholder="Nombre" @input="form.slug = slugify(form.title)" />
          <input v-model="form.slug" class="input" placeholder="slug" />
          <select v-model="form.format" class="input"><option value="workshop">Taller</option><option value="course">Curso</option><option value="event">Evento</option><option value="community">Comunidad</option></select>
          <textarea v-model="form.summary" class="input" rows="3" placeholder="Promesa y contexto"></textarea>
          <textarea v-model="form.audience" class="input" rows="2" placeholder="Audiencia"></textarea>
          <button class="btn btn--secondary" :disabled="busy">Crear</button>
        </form>
      </aside>

      <main v-if="selected" class="event-admin__main">
        <div class="card event-admin__summary">
          <div><p class="eyebrow">{{ selected.format }}</p><h2>{{ selected.title }}</h2><p>{{ selected.summary }}</p></div>
          <div class="event-admin__stats"><span><strong>{{ selected.editions?.length || 0 }}</strong> ediciones</span><span><strong>{{ enrollments.length }}</strong> participantes</span><span><strong>{{ artifacts.length }}</strong> artefactos</span></div>
        </div>

        <nav class="event-admin__tabs">
          <button :class="{active:tab==='studio'}" @click="tab='studio'">Studio AlexIA</button>
          <button :class="{active:tab==='artifacts'}" @click="tab='artifacts'">Artefactos</button>
          <button :class="{active:tab==='editions'}" @click="tab='editions'">Ediciones</button>
          <button :class="{active:tab==='participants'}" @click="tab='participants'">Participantes</button>
        </nav>

        <section v-if="tab==='studio'" class="card">
          <div class="event-admin__studio-head"><div><p class="eyebrow">Orquestadora</p><h2>Habla solamente con AlexIA</h2><p class="muted">Ella activa el especialista indicado y devuelve un borrador versionado.</p></div><span class="badge">Aprobación humana obligatoria</span></div>
          <div class="event-admin__pipeline">
            <button v-for="step in pipeline" :key="step.key" :class="{active:stage===step.key}" @click="stage=step.key">
              <span>{{ step.label }}</span><small>{{ step.agent }}</small>
            </button>
          </div>
          <textarea v-model="brief" class="input" rows="7" placeholder="Cuéntale a AlexIA qué experiencia quieres construir o qué debe ajustar en esta etapa."></textarea>
          <button class="btn btn--primary" :disabled="busy" @click="runAgent">{{ busy ? 'AlexIA está trabajando…' : 'Generar borrador' }}</button>
        </section>

        <section v-if="tab==='artifacts'" class="event-admin__artifacts">
          <article v-for="artifact in artifacts" :key="artifact.id" class="card event-admin__artifact">
            <header><div><span class="badge">{{ artifact.type }} · v{{ artifact.version }}</span><h3>{{ artifact.title }}</h3></div><span :class="'status status--' + artifact.status">{{ artifact.status }}</span></header>
            <p>{{ payload(artifact).summary }}</p>
            <details><summary>Ver contenido estructurado</summary><pre>{{ JSON.stringify(payload(artifact).payload, null, 2) }}</pre></details>
            <div v-if="artifact.status==='draft'" class="actions"><button class="btn btn--primary" @click="review(artifact,'applied')">Aplicar</button><button class="btn btn--ghost" @click="review(artifact,'rejected')">Rechazar</button></div>
          </article>
          <p v-if="!artifacts.length" class="card muted">AlexIA aún no ha generado artefactos.</p>
        </section>

        <section v-if="tab==='editions'" class="card">
          <h2>Ediciones y cupos</h2>
          <div class="event-admin__editions">
            <article v-for="ed in selected.editions" :key="ed.id"><strong>{{ ed.name }}</strong><span>{{ ed.starts_at || 'Fecha pendiente' }}</span><small>{{ ed.capacity ? ed.capacity + ' cupos' : 'Sin límite' }}</small></article>
          </div>
          <form class="event-admin__edition-form" @submit.prevent="addEdition">
            <input v-model="edition.name" class="input" placeholder="Nombre de la edición" />
            <input v-model="edition.starts_at" class="input" type="datetime-local" />
            <input v-model="edition.ends_at" class="input" type="datetime-local" />
            <input v-model.number="edition.capacity" class="input" type="number" min="0" placeholder="Cupos" />
            <button class="btn btn--secondary" :disabled="busy">Agregar edición</button>
          </form>
        </section>

        <section v-if="tab==='participants'" class="card">
          <h2>Participantes</h2>
          <div class="table-wrap"><table class="table"><thead><tr><th>Nombre</th><th>Correo</th><th>WhatsApp</th><th>Edición</th><th>Estado</th><th>Registro</th></tr></thead>
          <tbody><tr v-for="person in enrollments" :key="person.id"><td>{{ person.name }}</td><td>{{ person.email }}</td><td>{{ person.whatsapp || '—' }}</td><td>{{ person.edition_name }}</td><td>{{ person.status }}</td><td>{{ person.created_at }}</td></tr></tbody></table></div>
          <p v-if="!enrollments.length" class="muted">Todavía no hay participantes.</p>
        </section>
      </main>
      <main v-else class="card event-admin__empty"><h2>Construye tu primera experiencia</h2><p>Empieza por el formulario de la izquierda. AlexIA te acompañará desde el diseño hasta la publicación.</p></main>
    </div>
  </section>`
};
