import { ref, reactive, computed, onMounted } from 'vue';
import { api } from '../api.js?v=20260719-2';
import Modal from '../components/Modal.js';

const FORMATS = [
  { key: 'workshop', icon: '✦', label: 'Taller', desc: 'Práctico, intensivo y orientado a producir un resultado concreto.' },
  { key: 'course', icon: '▤', label: 'Curso', desc: 'Aprendizaje organizado en módulos, lecciones y progreso.' },
  { key: 'event', icon: '◉', label: 'Evento', desc: 'Encuentro presencial, virtual o híbrido con una agenda definida.' },
  { key: 'community', icon: '◎', label: 'Comunidad', desc: 'Experiencia continua con contenidos, interacción y acceso.' }
];

const HELP = {
  module: {
    title: '¿Qué puedes construir aquí?',
    text: 'Este módulo convierte una idea en una experiencia lista para promocionar y operar. No necesitas conocer términos técnicos: completa la información inicial y AlexIA te guiará en el resto del recorrido.',
    tips: ['Crea la experiencia base.', 'Define al menos una edición con fecha y cupos.', 'Pídele a AlexIA los entregables de cada etapa.', 'Revisa los borradores y publica cuando la puerta de calidad esté completa.']
  },
  title: {
    title: 'Nombre de la experiencia',
    text: 'Es el nombre comercial que verá tu audiencia. Debe ser fácil de recordar y comunicar el tema o la transformación principal.',
    example: 'Marketing para Vender+',
    field: 'title',
    tips: ['Procura usar entre 2 y 7 palabras.', 'Evita nombres demasiado genéricos.', 'Puedes añadir un subtítulo después en la landing.']
  },
  format: {
    title: 'Tipo de experiencia',
    text: 'Selecciona la estructura que más se parece a lo que vas a ofrecer. Esta decisión ayuda a AlexIA a organizar el currículo, los tiempos y la operación.',
    tips: ['Taller: resultado práctico en una o pocas sesiones.', 'Curso: aprendizaje por módulos.', 'Evento: agenda y participación en una fecha.', 'Comunidad: acceso y acompañamiento continuo.']
  },
  slug: {
    title: 'Dirección pública o slug',
    text: 'Es la parte final del enlace público. Se genera automáticamente a partir del nombre y normalmente no necesitas cambiarla.',
    example: 'marketing-para-vender',
    field: 'slug',
    tips: ['Usa letras minúsculas y guiones.', 'No incluyas espacios, tildes ni símbolos.', 'El enlace final será tonnydager.com/eventos/tu-slug.']
  },
  summary: {
    title: 'Promesa y contexto',
    text: 'Explica qué cambio concreto vivirá la persona y por qué esta experiencia es relevante. No es el programa completo; es una promesa clara y creíble.',
    example: 'Una jornada práctica para que empresarios conviertan sus ideas y contenidos en una ruta comercial clara, aplicable y medible.',
    field: 'summary',
    tips: ['Empieza por el resultado, no por la metodología.', 'Sé específico sin prometer resultados imposibles.', 'Una o dos frases son suficientes en esta etapa.']
  },
  audience: {
    title: 'Audiencia ideal',
    text: 'Describe para quién está pensada la experiencia, su contexto y el problema que necesita resolver. AlexIA usará esta información en la oferta, el contenido y la landing.',
    example: 'Empresarios, emprendedores y líderes comerciales que publican contenido, pero todavía no tienen un sistema claro para convertirlo en oportunidades de venta.',
    field: 'audience',
    tips: ['Menciona el rol o tipo de persona.', 'Incluye su situación actual.', 'Evita decir que es para todo el mundo.']
  },
  journey: {
    title: 'Ruta de construcción',
    text: 'La ruta muestra el orden recomendado. Puedes explorar todas las áreas, pero completar cada momento en secuencia reduce vacíos y evita publicar una experiencia incompleta.',
    tips: ['Base: identidad y promesa.', 'Edición: fechas, zona horaria y cupos.', 'Studio: entregables generados por AlexIA.', 'Revisión: aprobación humana.', 'Publicación: landing y controles de calidad aplicados.']
  },
  studio: {
    title: 'Cómo trabajar con Studio AlexIA',
    text: 'Tú conversas únicamente con AlexIA. Ella interpreta tu necesidad, activa el agente especializado correcto y entrega un borrador versionado para que lo revises.',
    example: 'Diseña un taller presencial de 8 horas para 15 empresarios. Debe ser 90% práctico y terminar con un plan comercial de 30 días.',
    field: 'brief',
    tips: ['Describe el resultado esperado.', 'Indica duración, modalidad y restricciones.', 'Puedes pedir ajustes sobre un borrador anterior.', 'Nada se publica sin tu aprobación.']
  },
  artifacts: {
    title: 'Artefactos y aprobaciones',
    text: 'Un artefacto es un entregable producido por AlexIA: currículo, oferta, landing, guion, plan de lanzamiento o revisión. Siempre nace como borrador.',
    tips: ['Aplicar: lo aceptas como versión vigente.', 'Rechazar: no se usará.', 'Puedes generar una nueva versión con instrucciones de ajuste.', 'Seguridad y calidad son obligatorias antes de publicar.']
  },
  editions: {
    title: 'Ediciones, fechas y cupos',
    text: 'Una misma experiencia puede repetirse varias veces. Cada edición tiene sus propias fechas, zona horaria, capacidad e inscripciones.',
    example: 'Cohorte Cartagena · 25 de julio de 2026 · 15 cupos',
    tips: ['Crea una edición aunque la fecha aún sea tentativa.', 'Usa cupo 0 solamente si no existe límite.', 'La zona horaria evita errores en experiencias virtuales.']
  },
  participants: {
    title: 'Participantes y relación comercial',
    text: 'Cada inscripción pública queda registrada aquí y también crea o actualiza un Lead con origen en la experiencia, además de su oportunidad en el Pipeline.',
    tips: ['El correo identifica registros repetidos.', 'El control de cupos es automático.', 'WhatsApp y empresa enriquecen el perfil comercial.', 'Los accesos restringidos se habilitarán en la siguiente fase.']
  },
  publish: {
    title: 'Puerta de publicación',
    text: 'Publicar hace visible la landing. Para proteger la calidad, el sistema exige que landing, seguridad y calidad estén aplicadas; las dos últimas deben aprobar explícitamente la publicación.',
    tips: ['Revisa textos, fechas y cupos.', 'Confirma que los riesgos estén resueltos.', 'Haz una inscripción de prueba después de publicar.', 'La publicación nunca es automática desde la IA.']
  }
};

export default {
  components: { Modal },
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
    const creating = ref(false);
    const wizardStep = ref(1);
    const help = ref(null);
    const form = reactive({ title: '', slug: '', format: 'workshop', summary: '', audience: '' });
    const edition = reactive({ name: 'Primera edición', starts_at: '', ends_at: '', timezone: 'America/Bogota', capacity: 30, registration_open: true });

    const pipeline = computed(() => selected.value?.pipeline || []);
    const artifacts = computed(() => selected.value?.artifacts || []);
    const enrollments = computed(() => selected.value?.enrollments || []);
    const appliedTypes = computed(() => new Set(artifacts.value.filter((a) => a.status === 'applied').map((a) => a.type)));
    const journey = computed(() => {
      if (!selected.value) return [];
      const hasEdition = (selected.value.editions || []).length > 0;
      const hasDraft = artifacts.value.length > 0;
      const hasApplied = artifacts.value.some((a) => a.status === 'applied');
      return [
        { key: 'base', number: 1, label: 'Base creada', desc: 'Nombre, formato y promesa', done: true, action: 'summary' },
        { key: 'edition', number: 2, label: 'Programación', desc: 'Edición, fecha y cupos', done: hasEdition, action: 'editions' },
        { key: 'studio', number: 3, label: 'Construcción', desc: 'Trabajo guiado por AlexIA', done: hasDraft, action: 'studio' },
        { key: 'review', number: 4, label: 'Revisión', desc: 'Artefactos aprobados', done: hasApplied, action: 'artifacts' },
        { key: 'publish', number: 5, label: 'Publicación', desc: 'Landing disponible', done: selected.value.status === 'published', action: 'publish' }
      ];
    });
    const progress = computed(() => {
      if (!journey.value.length) return 0;
      return Math.round((journey.value.filter((s) => s.done).length / journey.value.length) * 100);
    });
    const currentFormat = computed(() => FORMATS.find((f) => f.key === form.format));
    const currentStage = computed(() => pipeline.value.find((p) => p.key === stage.value));

    function slugify(value) {
      return (value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }
    function fieldId(name) { return 'event-field-' + name; }
    function openHelp(key, custom = null) { help.value = custom || { key, ...HELP[key] }; }
    function closeHelp() { help.value = null; }
    function applyHelpExample() {
      if (!help.value?.field || !help.value?.example) return;
      const target = help.value.field;
      if (target === 'brief') brief.value = help.value.example;
      else form[target] = help.value.example;
      if (target === 'title') form.slug = slugify(help.value.example);
      closeHelp();
      requestAnimationFrame(() => document.getElementById(fieldId(target))?.focus());
    }
    function resetForm() {
      Object.assign(form, { title: '', slug: '', format: 'workshop', summary: '', audience: '' });
      wizardStep.value = 1;
    }
    function startCreate() {
      resetForm();
      creating.value = true;
      selected.value = null;
      activeId.value = null;
      error.value = '';
      notice.value = '';
    }
    function cancelCreate() {
      creating.value = false;
      if (items.value.length) open(items.value[0].id);
    }
    function nextWizard() {
      error.value = '';
      if (wizardStep.value === 1 && !form.title.trim()) {
        error.value = 'Primero escribe el nombre de la experiencia.';
        document.getElementById(fieldId('title'))?.focus();
        return;
      }
      if (wizardStep.value === 2 && (!form.summary.trim() || !form.audience.trim())) {
        error.value = 'Completa la promesa y la audiencia para que AlexIA tenga un buen punto de partida.';
        return;
      }
      wizardStep.value = Math.min(3, wizardStep.value + 1);
    }
    function previousWizard() { wizardStep.value = Math.max(1, wizardStep.value - 1); }
    function goJourney(step) {
      if (step.action === 'publish') { openHelp('publish'); return; }
      tab.value = step.action === 'summary' ? 'studio' : step.action;
      document.querySelector('.event-admin__workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    function stageStatus(step) {
      if (appliedTypes.value.has(step.artifact)) return 'applied';
      if (artifacts.value.some((a) => a.type === step.artifact)) return 'draft';
      return 'pending';
    }
    function stageHelp(step) {
      openHelp('stage', {
        title: step.label,
        text: 'AlexIA activará al agente ' + step.agent + ' para construir este entregable. Dale contexto del resultado que esperas y de las decisiones ya tomadas.',
        example: 'Revisa lo que ya está aprobado y crea una propuesta clara para ' + step.label.toLowerCase() + '. Señala vacíos, riesgos y decisiones pendientes.',
        field: 'brief',
        tips: ['Selecciona esta etapa.', 'Describe lo que quieres obtener o ajustar.', 'Genera el borrador.', 'Revísalo en Artefactos antes de aplicarlo.']
      });
    }

    async function load() {
      loading.value = true;
      error.value = '';
      try {
        if (typeof api.events !== 'function') throw new Error('El navegador conserva una versión anterior del módulo. Recarga la página para actualizar los archivos.');
        items.value = (await api.events()).data || [];
        if (activeId.value) await open(activeId.value);
        else if (items.value.length && !creating.value) await open(items.value[0].id);
        else if (!items.value.length) creating.value = true;
      } catch (e) { error.value = e.message; }
      finally { loading.value = false; }
    }
    async function open(id) {
      creating.value = false;
      activeId.value = id;
      busy.value = true;
      error.value = '';
      try { selected.value = (await api.event(id)).data; }
      catch (e) { error.value = e.message; }
      finally { busy.value = false; }
    }
    async function create() {
      busy.value = true;
      error.value = '';
      try {
        const result = await api.createEvent({ ...form, slug: form.slug || slugify(form.title) });
        activeId.value = result.data.id;
        creating.value = false;
        await load();
        tab.value = 'editions';
        notice.value = 'La base quedó creada. El siguiente paso es programar la primera edición.';
      } catch (e) { error.value = e.message; }
      finally { busy.value = false; }
    }
    async function addEdition() {
      busy.value = true;
      error.value = '';
      try {
        await api.createEventEdition(activeId.value, { ...edition });
        await open(activeId.value);
        tab.value = 'studio';
        notice.value = 'Edición creada. Ahora cuéntale a AlexIA qué quieres construir.';
      } catch (e) { error.value = e.message; }
      finally { busy.value = false; }
    }
    async function runAgent() {
      if (!brief.value.trim()) {
        error.value = 'Dale a AlexIA un brief para esta etapa. Usa la ayuda ? si necesitas un ejemplo.';
        return;
      }
      busy.value = true;
      error.value = '';
      notice.value = '';
      try {
        await api.runEventAgent(activeId.value, { stage: stage.value, brief: brief.value });
        brief.value = '';
        await open(activeId.value);
        tab.value = 'artifacts';
        notice.value = 'AlexIA generó un borrador. Revísalo antes de aplicarlo.';
      } catch (e) { error.value = e.message; }
      finally { busy.value = false; }
    }
    async function review(artifact, decision) {
      busy.value = true;
      error.value = '';
      try {
        await api.reviewEventArtifact(activeId.value, artifact.id, { decision });
        await open(activeId.value);
        notice.value = decision === 'applied' ? 'Artefacto aplicado como versión vigente.' : 'Artefacto rechazado. Puedes pedir una nueva versión a AlexIA.';
      } catch (e) { error.value = e.message; }
      finally { busy.value = false; }
    }
    async function publishExperience() {
      busy.value = true;
      error.value = '';
      try {
        const result = await api.publishEvent(activeId.value);
        await load();
        notice.value = 'Experiencia publicada en ' + result.data.url;
      } catch (e) {
        error.value = e.message;
        openHelp('publish');
      } finally { busy.value = false; }
    }
    function payload(artifact) {
      try { return JSON.parse(artifact.content_json || '{}'); } catch (_) { return {}; }
    }
    function formatDate(value) {
      if (!value) return 'Fecha por definir';
      try { return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value.replace(' ', 'T'))); }
      catch (_) { return value; }
    }

    onMounted(load);
    return {
      FORMATS, items, selected, activeId, loading, busy, error, notice, tab, stage, brief, creating, wizardStep, help,
      form, edition, pipeline, artifacts, enrollments, journey, progress, currentFormat, currentStage, appliedTypes,
      slugify, fieldId, openHelp, closeHelp, applyHelpExample, startCreate, cancelCreate, nextWizard, previousWizard,
      goJourney, stageStatus, stageHelp, open, create, addEdition, runAgent, review, publishExperience, payload, formatDate
    };
  },
  template: `
  <section class="event-admin">
    <header class="event-admin__topbar">
      <div class="event-admin__heading">
        <span class="event-admin__brandmark">E</span>
        <div>
          <div class="event-admin__eyebrow">Centro de experiencias</div>
          <h1>Eventos & Experiencias</h1>
          <p>De una idea a una experiencia promocionada, operada y medible.</p>
        </div>
      </div>
      <div class="event-admin__top-actions">
        <button class="event-help-trigger event-help-trigger--labeled" @click="openHelp('module')" aria-label="Abrir guía del módulo"><span>?</span> ¿Cómo funciona?</button>
        <button v-if="selected" class="btn btn--primary" :disabled="busy" @click="publishExperience">Publicar experiencia</button>
      </div>
    </header>

    <div v-if="loading" class="event-admin__loading"><span></span><p>Preparando tu espacio de trabajo…</p></div>
    <template v-else>
      <div v-if="error" class="event-feedback event-feedback--error"><span>!</span><div><strong>Necesitamos revisar algo</strong><p>{{ error }}</p></div><button @click="error=''">×</button></div>
      <div v-if="notice" class="event-feedback event-feedback--success"><span>✓</span><div><strong>Listo</strong><p>{{ notice }}</p></div><button @click="notice=''">×</button></div>

      <div class="event-admin__shell">
        <aside class="event-admin__rail">
          <div class="event-admin__rail-head">
            <div><span>Tu portafolio</span><strong>{{ items.length }} {{ items.length === 1 ? 'experiencia' : 'experiencias' }}</strong></div>
            <button class="event-help-trigger" @click="openHelp('journey')" aria-label="Ayuda sobre el recorrido">?</button>
          </div>

          <button class="event-admin__new" @click="startCreate"><span>＋</span><div><strong>Nueva experiencia</strong><small>Comenzar paso a paso</small></div></button>

          <div class="event-admin__list">
            <button v-for="item in items" :key="item.id" class="event-admin__item" :class="{ active: activeId === item.id && !creating }" @click="open(item.id)">
              <span class="event-admin__item-icon">{{ item.format === 'course' ? '▤' : item.format === 'community' ? '◎' : item.format === 'event' ? '◉' : '✦' }}</span>
              <span class="event-admin__item-copy"><strong>{{ item.title }}</strong><small>{{ item.status === 'published' ? 'Publicada' : 'En construcción' }} · {{ item.enrollments_count || 0 }} participantes</small></span>
              <span class="event-admin__item-arrow">›</span>
            </button>
            <div v-if="!items.length" class="event-admin__rail-empty"><span>◇</span><p>Tu primera experiencia aparecerá aquí.</p></div>
          </div>

          <div class="event-admin__roadmap-mini">
            <strong>Ruta recomendada</strong>
            <ol><li>Crear la base</li><li>Programar edición</li><li>Construir con AlexIA</li><li>Revisar y publicar</li></ol>
          </div>
        </aside>

        <div class="event-admin__workspace">
          <section v-if="creating" class="event-create">
            <div class="event-create__intro">
              <div>
                <span class="event-create__kicker">Asistente de creación</span>
                <h2>Construyamos una experiencia que la gente entienda y quiera vivir</h2>
                <p>No tienes que tenerlo todo resuelto. Empieza con lo que sabes; AlexIA profundizará contigo después.</p>
              </div>
              <div class="event-create__step-ring"><strong>{{ wizardStep }}</strong><span>de 3</span></div>
            </div>

            <div class="event-create__progress">
              <button v-for="n in 3" :key="n" :class="{active:wizardStep===n,done:wizardStep>n}" @click="n < wizardStep && (wizardStep=n)">
                <span>{{ wizardStep > n ? '✓' : n }}</span><div><strong>{{ n===1 ? 'Identidad' : n===2 ? 'Transformación' : 'Confirmación' }}</strong><small>{{ n===1 ? 'Nombre y formato' : n===2 ? 'Promesa y audiencia' : 'Revisa la base' }}</small></div>
              </button>
            </div>

            <form class="event-create__body" @submit.prevent="wizardStep < 3 ? nextWizard() : create()">
              <section v-if="wizardStep===1" class="event-create__panel">
                <header><div><span>Paso 1</span><h3>Dale identidad a tu experiencia</h3><p>Elige el punto de partida. Luego podrás enriquecerlo con AlexIA.</p></div></header>
                <div class="event-field">
                  <div class="event-field__label"><label :for="fieldId('title')">Nombre de la experiencia</label><button type="button" class="event-help-trigger" @click="openHelp('title')" aria-label="Ayuda para el nombre">?</button></div>
                  <input :id="fieldId('title')" v-model="form.title" class="input event-field__control" placeholder="Ej. Marketing para Vender+" @input="form.slug = slugify(form.title)" autocomplete="off" />
                  <small>Busca un nombre claro, memorable y fácil de compartir.</small>
                </div>
                <div class="event-field">
                  <div class="event-field__label"><label>¿Qué vas a crear?</label><button type="button" class="event-help-trigger" @click="openHelp('format')" aria-label="Ayuda para escoger formato">?</button></div>
                  <div class="event-format-grid">
                    <button v-for="type in FORMATS" :key="type.key" type="button" :class="{active:form.format===type.key}" @click="form.format=type.key">
                      <span>{{ type.icon }}</span><strong>{{ type.label }}</strong><small>{{ type.desc }}</small><i>{{ form.format===type.key ? '✓' : '' }}</i>
                    </button>
                  </div>
                </div>
                <details class="event-advanced">
                  <summary>Opciones avanzadas</summary>
                  <div class="event-field">
                    <div class="event-field__label"><label :for="fieldId('slug')">Dirección pública</label><button type="button" class="event-help-trigger" @click="openHelp('slug')" aria-label="Ayuda sobre dirección pública">?</button></div>
                    <div class="event-slug"><span>tonnydager.com/eventos/</span><input :id="fieldId('slug')" v-model="form.slug" class="input" /></div>
                  </div>
                </details>
              </section>

              <section v-if="wizardStep===2" class="event-create__panel">
                <header><div><span>Paso 2</span><h3>Define la transformación</h3><p>Estas dos respuestas alimentan la estrategia, la oferta y el contenido.</p></div></header>
                <div class="event-create__two">
                  <div class="event-field event-field--large">
                    <div class="event-field__label"><label :for="fieldId('summary')">¿Qué cambio promete?</label><button type="button" class="event-help-trigger" @click="openHelp('summary')" aria-label="Ayuda para la promesa">?</button></div>
                    <textarea :id="fieldId('summary')" v-model="form.summary" class="input event-field__control" rows="7" placeholder="Describe el resultado que la persona podrá alcanzar…"></textarea>
                    <div class="event-field__counter">{{ form.summary.length }} caracteres</div>
                  </div>
                  <div class="event-field event-field--large">
                    <div class="event-field__label"><label :for="fieldId('audience')">¿Para quién es?</label><button type="button" class="event-help-trigger" @click="openHelp('audience')" aria-label="Ayuda para la audiencia">?</button></div>
                    <textarea :id="fieldId('audience')" v-model="form.audience" class="input event-field__control" rows="7" placeholder="Describe a la persona, su contexto y su necesidad…"></textarea>
                    <div class="event-field__counter">{{ form.audience.length }} caracteres</div>
                  </div>
                </div>
                <button type="button" class="event-example-banner" @click="openHelp('summary')"><span>✦</span><div><strong>¿No sabes cómo redactarlo?</strong><small>Abre un ejemplo explicado y úsalo como punto de partida.</small></div><b>Ver ejemplo ›</b></button>
              </section>

              <section v-if="wizardStep===3" class="event-create__panel">
                <header><div><span>Paso 3</span><h3>Esta será la base para AlexIA</h3><p>Confirma que representa tu idea. Después podrás editar y ampliar todo.</p></div></header>
                <div class="event-review">
                  <div class="event-review__hero"><span>{{ currentFormat?.icon }}</span><div><small>{{ currentFormat?.label }}</small><h3>{{ form.title }}</h3><p>{{ form.summary }}</p></div></div>
                  <dl><div><dt>Audiencia</dt><dd>{{ form.audience }}</dd></div><div><dt>Enlace previsto</dt><dd>tonnydager.com/eventos/{{ form.slug }}</dd></div><div><dt>Siguiente paso</dt><dd>Crear la primera edición y comenzar la arquitectura con AlexIA.</dd></div></dl>
                </div>
                <div class="event-create__assurance"><span>🔒</span><div><strong>Nada se publicará todavía</strong><p>La experiencia se guardará como borrador. Tú aprobarás cada artefacto y decidirás cuándo publicarla.</p></div></div>
              </section>

              <footer class="event-create__actions">
                <button v-if="items.length || wizardStep>1" type="button" class="btn btn--ghost" @click="wizardStep>1 ? previousWizard() : cancelCreate()">{{ wizardStep>1 ? '← Volver' : 'Cancelar' }}</button>
                <span></span>
                <button v-if="wizardStep<3" class="btn btn--primary">Continuar <b>→</b></button>
                <button v-else class="btn btn--primary" :disabled="busy">{{ busy ? 'Creando…' : 'Crear experiencia y continuar' }}</button>
              </footer>
            </form>
          </section>

          <template v-else-if="selected">
            <section class="event-overview">
              <div class="event-overview__main">
                <span class="event-overview__type">{{ selected.format }}</span>
                <h2>{{ selected.title }}</h2>
                <p>{{ selected.summary || 'Aún no has definido la promesa de esta experiencia.' }}</p>
                <div class="event-overview__meta"><span>{{ selected.status === 'published' ? '● Publicada' : '◌ En construcción' }}</span><span>/eventos/{{ selected.slug }}</span></div>
              </div>
              <div class="event-overview__score"><div class="event-progress-ring" :style="{ '--progress': progress + '%' }"><strong>{{ progress }}%</strong></div><span>Avance general</span></div>
            </section>

            <section class="event-journey">
              <header><div><span>Tu ruta</span><h3>Siguiente mejor acción</h3></div><button class="event-help-trigger" @click="openHelp('journey')" aria-label="Ayuda sobre la ruta">?</button></header>
              <div class="event-journey__steps">
                <button v-for="step in journey" :key="step.key" :class="{done:step.done,active:!step.done && journey.findIndex(s=>!s.done)===journey.indexOf(step)}" @click="goJourney(step)">
                  <span>{{ step.done ? '✓' : step.number }}</span><div><strong>{{ step.label }}</strong><small>{{ step.desc }}</small></div><i>›</i>
                </button>
              </div>
            </section>

            <nav class="event-tabs" aria-label="Áreas de la experiencia">
              <button :class="{active:tab==='studio'}" @click="tab='studio'"><span>✦</span> Studio AlexIA</button>
              <button :class="{active:tab==='artifacts'}" @click="tab='artifacts'"><span>◇</span> Artefactos <b>{{ artifacts.length }}</b></button>
              <button :class="{active:tab==='editions'}" @click="tab='editions'"><span>◷</span> Ediciones <b>{{ selected.editions?.length || 0 }}</b></button>
              <button :class="{active:tab==='participants'}" @click="tab='participants'"><span>◎</span> Participantes <b>{{ enrollments.length }}</b></button>
            </nav>

            <section v-if="tab==='studio'" class="event-panel event-studio">
              <header class="event-panel__head">
                <div><span class="event-panel__kicker">Orquestadora central</span><h3>Cuéntale a AlexIA qué necesitas</h3><p>Ella coordina los especialistas. Tú no tienes que escoger ni administrar agentes por separado.</p></div>
                <button class="event-help-trigger event-help-trigger--labeled" @click="openHelp('studio')"><span>?</span> Guía y ejemplo</button>
              </header>
              <div class="event-studio__body">
                <aside class="event-stage-list">
                  <div class="event-stage-list__title"><strong>Etapas de construcción</strong><small>Selecciona una para trabajar</small></div>
                  <button v-for="(step,index) in pipeline" :key="step.key" :class="{active:stage===step.key}" @click="stage=step.key">
                    <span>{{ index+1 }}</span><div><strong>{{ step.label }}</strong><small>{{ stageStatus(step)==='applied' ? 'Aprobado' : stageStatus(step)==='draft' ? 'Borrador disponible' : 'Pendiente' }}</small></div>
                    <i :class="'is-' + stageStatus(step)">{{ stageStatus(step)==='applied' ? '✓' : stageStatus(step)==='draft' ? '•' : '' }}</i>
                    <b class="event-stage-help" @click.stop="stageHelp(step)">?</b>
                  </button>
                </aside>
                <div class="event-studio__composer">
                  <div class="event-studio__agent"><span>✦</span><div><small>AlexIA activará</small><strong>{{ currentStage?.agent || 'Agente especializado' }}</strong></div><em>Aprobación humana</em></div>
                  <label :for="fieldId('brief')">¿Qué quieres construir o ajustar?</label>
                  <textarea :id="fieldId('brief')" v-model="brief" class="input" rows="10" placeholder="Ej. Diseña la arquitectura de un taller presencial de 8 horas para empresarios…"></textarea>
                  <div class="event-studio__composer-foot"><button class="event-text-action" @click="openHelp('studio')">Ver cómo escribir un buen brief</button><button class="btn btn--primary" :disabled="busy" @click="runAgent">{{ busy ? 'AlexIA está trabajando…' : 'Generar borrador' }} <b>✦</b></button></div>
                </div>
              </div>
            </section>

            <section v-if="tab==='artifacts'" class="event-panel">
              <header class="event-panel__head"><div><span class="event-panel__kicker">Entregables versionados</span><h3>Revisa antes de aplicar</h3><p>Cada resultado de AlexIA permanece como borrador hasta que tú tomes una decisión.</p></div><button class="event-help-trigger event-help-trigger--labeled" @click="openHelp('artifacts')"><span>?</span> ¿Qué es un artefacto?</button></header>
              <div v-if="artifacts.length" class="event-artifact-grid">
                <article v-for="artifact in artifacts" :key="artifact.id" class="event-artifact">
                  <header><div><span>{{ artifact.type }} · versión {{ artifact.version }}</span><h4>{{ artifact.title }}</h4></div><b :class="'is-' + artifact.status">{{ artifact.status === 'applied' ? 'Aplicado' : artifact.status === 'rejected' ? 'Rechazado' : 'Borrador' }}</b></header>
                  <p>{{ payload(artifact).summary || 'Sin resumen disponible.' }}</p>
                  <details><summary>Ver contenido completo <span>⌄</span></summary><pre>{{ JSON.stringify(payload(artifact).payload, null, 2) }}</pre></details>
                  <footer v-if="artifact.status==='draft'"><button class="btn btn--ghost" @click="review(artifact,'rejected')">Solicitar otra versión</button><button class="btn btn--primary" @click="review(artifact,'applied')">Aprobar y aplicar</button></footer>
                </article>
              </div>
              <div v-else class="event-empty-state"><span>◇</span><h4>Todavía no hay entregables</h4><p>Ve a Studio AlexIA, selecciona una etapa y genera el primer borrador.</p><button class="btn btn--primary" @click="tab='studio'">Ir a Studio AlexIA</button></div>
            </section>

            <section v-if="tab==='editions'" class="event-panel">
              <header class="event-panel__head"><div><span class="event-panel__kicker">Programación y capacidad</span><h3>Ediciones, fechas y cupos</h3><p>Repite la misma experiencia en fechas o cohortes diferentes sin reconstruirla.</p></div><button class="event-help-trigger event-help-trigger--labeled" @click="openHelp('editions')"><span>?</span> Guía de ediciones</button></header>
              <div class="event-edition-layout">
                <div>
                  <div v-if="selected.editions?.length" class="event-edition-list">
                    <article v-for="ed in selected.editions" :key="ed.id"><span>◷</span><div><strong>{{ ed.name }}</strong><p>{{ formatDate(ed.starts_at) }}</p><small>{{ ed.timezone }} · {{ ed.capacity ? ed.capacity + ' cupos' : 'Sin límite de cupos' }}</small></div><b>{{ ed.registration_open == 1 ? 'Inscripciones abiertas' : 'Cerradas' }}</b></article>
                  </div>
                  <div v-else class="event-empty-state event-empty-state--compact"><span>◷</span><h4>Aún no has programado una edición</h4><p>Completa el formulario para definir cuándo ocurrirá y cuántas personas podrán registrarse.</p></div>
                </div>
                <form class="event-edition-form" @submit.prevent="addEdition">
                  <div class="event-edition-form__title"><div><span>Nueva edición</span><strong>Programa la próxima cohorte</strong></div><button type="button" class="event-help-trigger" @click="openHelp('editions')">?</button></div>
                  <label>Nombre de la edición<input v-model="edition.name" class="input" placeholder="Ej. Cohorte Cartagena · Julio" /></label>
                  <div class="event-edition-form__two"><label>Inicio<input v-model="edition.starts_at" class="input" type="datetime-local" /></label><label>Finalización<input v-model="edition.ends_at" class="input" type="datetime-local" /></label></div>
                  <div class="event-edition-form__two"><label>Zona horaria<select v-model="edition.timezone" class="input"><option>America/Bogota</option><option>America/Mexico_City</option><option>America/New_York</option><option>Europe/Madrid</option></select></label><label>Cupos<input v-model.number="edition.capacity" class="input" type="number" min="0" /></label></div>
                  <label class="event-switch"><input v-model="edition.registration_open" type="checkbox" /><span></span><div><strong>Abrir inscripciones</strong><small>Las personas podrán registrarse al publicar.</small></div></label>
                  <button class="btn btn--primary" :disabled="busy">{{ busy ? 'Guardando…' : 'Guardar edición y continuar' }}</button>
                </form>
              </div>
            </section>

            <section v-if="tab==='participants'" class="event-panel">
              <header class="event-panel__head"><div><span class="event-panel__kicker">Comunidad y CRM</span><h3>Participantes registrados</h3><p>Las inscripciones también alimentan Leads y Pipeline automáticamente.</p></div><button class="event-help-trigger event-help-trigger--labeled" @click="openHelp('participants')"><span>?</span> ¿Cómo se registran?</button></header>
              <div v-if="enrollments.length" class="table-wrap"><table class="table event-participant-table"><thead><tr><th>Participante</th><th>Contacto</th><th>Edición</th><th>Estado</th><th>Registro</th></tr></thead><tbody><tr v-for="person in enrollments" :key="person.id"><td><strong>{{ person.name }}</strong><small>{{ person.company || 'Empresa sin registrar' }}</small></td><td><span>{{ person.email }}</span><small>{{ person.whatsapp || 'WhatsApp pendiente' }}</small></td><td>{{ person.edition_name }}</td><td><b>{{ person.status }}</b></td><td>{{ formatDate(person.created_at) }}</td></tr></tbody></table></div>
              <div v-else class="event-empty-state"><span>◎</span><h4>Los participantes aparecerán aquí</h4><p>Cuando publiques la landing y alguien complete el formulario, se creará su registro, Lead y oportunidad comercial.</p></div>
            </section>
          </template>
        </div>
      </div>
    </template>

    <Modal v-if="help" :title="help.title" @close="closeHelp">
      <div class="event-help-modal">
        <p class="event-help-modal__lead">{{ help.text }}</p>
        <div v-if="help.tips?.length" class="event-help-modal__steps"><strong>Cómo hacerlo bien</strong><ol><li v-for="tip in help.tips" :key="tip">{{ tip }}</li></ol></div>
        <div v-if="help.example" class="event-help-modal__example"><span>Ejemplo</span><p>“{{ help.example }}”</p></div>
      </div>
      <template #foot><button class="btn btn--ghost" @click="closeHelp">Entendido</button><button v-if="help.field && help.example" class="btn btn--primary" @click="applyHelpExample">Usar este ejemplo</button></template>
    </Modal>
  </section>`
};
