import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import { api } from '../api.js?v=20260725-1';
import Modal from '../components/Modal.js';
import { EXPERIENCE_MODELS, canonicalExperienceModel } from '../../../app/data/eventLanding.js?v=20260725-1';

const FORMATS = EXPERIENCE_MODELS.map((model) => ({ ...model, desc: model.short }));

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
    title: 'Arquitectura de la experiencia',
    text: 'No estás eligiendo solo una etiqueta. Cada arquitectura cambia las preguntas de AlexIA, la estructura comercial, la landing y el recorrido posterior al registro o pago.',
    tips: ['Captación: registro gratuito y activación inmediata.', 'Evento pago: oferta, reserva o checkout y preparación.', 'Cohorte: hitos, progreso y acompañamiento.', 'Summit: agenda, speakers, entradas y networking.', 'Membresía: onboarding, valor recurrente, participación y renovación.']
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
    title: 'Cómo trabajar con el Plan de AlexIA',
    text: 'Tú conversas únicamente con AlexIA. Ella interpreta tu necesidad, activa el agente especializado correcto y entrega un borrador versionado para que lo revises.',
    example: 'Diseña un taller presencial de 8 horas para 15 empresarios. Debe ser 90% práctico y terminar con un plan comercial de 30 días.',
    field: 'brief',
    tips: ['Describe el resultado esperado.', 'Indica duración, modalidad y restricciones.', 'Puedes pedir ajustes sobre un borrador anterior.', 'Nada se publica sin tu aprobación.']
  },
  artifacts: {
    title: 'Entregables y aprobaciones',
    text: 'Un entregable es un resultado producido por AlexIA: currículo, oferta, página de registro, guion, plan de lanzamiento o revisión. Pertenece a esta experiencia y se reutiliza en sus ediciones. Siempre nace como borrador.',
    tips: ['Aprobar y aplicar: lo conviertes en la versión vigente de la experiencia.', 'Solicitar otra versión: conservas el historial y pides un ajuste.', 'No necesitas completar todas las áreas para publicar.', 'Página de registro, seguridad y calidad sí son obligatorias.']
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
    title: 'Preparación para publicar',
    text: 'Publicar hace visible la página de registro. Antes de hacerlo, la plataforma comprueba la información esencial, una edición programada, la página, la seguridad y la revisión final de calidad.',
    tips: ['La sección Publicación muestra exactamente qué está listo y qué falta.', 'Cada pendiente tiene un botón que te lleva al lugar correcto.', 'Los riesgos de seguridad y calidad deben resolverse y revisarse de nuevo.', 'La publicación nunca es automática desde la IA.']
  }
};

const REVIEW_GUIDES = {
  landing: {
    title: 'Landing y recorrido de conversión',
    intro: 'AlexIA no debe pedirte que diseñes la página. Solo necesita decisiones comerciales y evidencia real; el renderer profesional se encarga del diseño, la jerarquía y la adaptación móvil.',
    questions: [
      '¿Cuál es el objetivo principal: registro gratuito, lista de espera, aplicación, reserva o venta directa?',
      '¿Cuál es la transformación principal y qué resultado visible se lleva la persona?',
      '¿Cuáles son agenda, sesiones, entregables, metodología y soporte incluidos?',
      '¿Qué planes, precios, monedas, bonos, condiciones y enlaces de checkout están confirmados?',
      '¿Qué credenciales, métricas, casos o testimonios reales y verificables pueden mostrarse?',
      '¿La experiencia usa marca Tonny Dager, ExperientIA o ambas? ¿Qué fotos, video o piezas aprobadas existen?',
      '¿Qué objeciones debe resolver la página y cuál será el mismo CTA en todo el recorrido?',
      '¿Qué debe ocurrir inmediatamente después del registro: correo, WhatsApp, calendario, preparación o acceso?'
    ]
  },
  security: {
    title: 'Seguridad, privacidad y acceso',
    intro: 'AlexIA necesita decisiones verificables, no conocimientos técnicos. Responde lo que ya esté definido; si algo no aplica, indícalo expresamente.',
    questions: [
      '¿Quién es responsable de los datos y cuál es la URL o texto de la política de privacidad?',
      '¿Qué datos se solicitarán, para qué se usarán y qué consentimientos aceptará el participante?',
      '¿El evento es gratuito o pago? Si es pago, ¿qué pasarela, política de cancelación y política de reembolso aplican?',
      '¿Cómo recibirá cada participante el acceso y cómo evitarás publicar enlaces privados o reutilizables?',
      '¿Qué roles del equipo podrán ver datos, pagos, participantes y enlaces de acceso?',
      '¿Qué canal de soporte y plan de contingencia se usarán si falla la plataforma o un enlace?'
    ]
  },
  quality: {
    title: 'Calidad y experiencia del participante',
    intro: 'AlexIA debe comprobar que la promesa, el contenido y la operación forman un recorrido coherente y ejecutable.',
    questions: [
      '¿Cuál es la propuesta de valor en una frase: para quién es, qué problema resuelve y qué resultado concreto entrega?',
      '¿Qué resultados observables obtendrá el participante y qué contenidos o actividades los producen?',
      '¿Qué canales, mensajes, calendario y llamados a la acción usarás para comunicar y vender la experiencia?',
      '¿Qué nivel previo esperas y cómo adaptarás el contenido a distintas expectativas o niveles?',
      '¿Qué ocurrirá después del evento: materiales, grabación, encuesta, certificado, seguimiento y responsables?',
      '¿Cuál es el plan B para plataforma, internet, enlaces, presentación, audio o facilitador?'
    ]
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
    const showEditionForm = ref(false);
    const editorSelection = ref(null);
    const editorValue = ref('');
    const editorInstruction = ref('');
    const editorKey = ref(1);
    const editorBusy = ref(false);
    const previewMode = ref('desktop');
    const sourceBusy = ref(false);
    const editingOfferId = ref(null);
    const form = reactive({ title: '', slug: '', format: 'paid_event', summary: '', audience: '' });
    const edition = reactive({ name: 'Primera edición', starts_at: '', ends_at: '', timezone: 'America/Bogota', capacity: 30, registration_open: true });
    const offer = reactive({
      edition_id: '', name: 'Acceso general', description: '', price: 0, currency: 'COP',
      payment_mode: 'connector', payment_provider: 'wompi', checkout_url: '', active: true
    });

    const pipeline = computed(() => selected.value?.pipeline || []);
    const artifacts = computed(() => selected.value?.artifacts || []);
    const enrollments = computed(() => selected.value?.enrollments || []);
    const offers = computed(() => (selected.value?.offers || []).filter((item) => Number(item.active) === 1));
    const paymentGateways = computed(() => selected.value?.payment_gateways || []);
    const landingPayload = computed(() => {
      try {
        const content = JSON.parse(selected.value?.landing?.content_json || '{}');
        return content.payload || {};
      } catch (_) { return {}; }
    });
    const editorUrl = computed(() => {
      if (!selected.value?.slug || !selected.value?.landing) return '';
      return `/eventos/${encodeURIComponent(selected.value.slug)}?editor=1&experience_id=${encodeURIComponent(selected.value.id)}&draft=${encodeURIComponent(selected.value.landing.id)}&v=${editorKey.value}`;
    });
    const appliedTypes = computed(() => new Set(artifacts.value.filter((a) => a.status === 'applied').map((a) => a.type)));
    const readiness = computed(() => selected.value?.readiness || { ready: false, progress: 0, completed: 0, total: 5, checks: [], blocking: [] });
    const requiredStages = computed(() => pipeline.value.filter((step) => step.required));
    const recommendedStages = computed(() => pipeline.value.filter((step) => !step.required));
    const coverage = computed(() => pipeline.value.length
      ? Math.round((pipeline.value.filter((step) => stageStatus(step) === 'applied').length / pipeline.value.length) * 100)
      : 0);
    const nextMissing = computed(() => readiness.value.blocking?.[0] || null);
    const journey = computed(() => {
      if (!selected.value) return [];
      const hasEdition = (selected.value.editions || []).length > 0;
      const hasPlan = appliedTypes.value.has('blueprint') || artifacts.value.length > 0;
      const hasApplied = artifacts.value.some((a) => a.status === 'applied');
      return [
        { key: 'base', number: 1, label: 'Definir', desc: 'Idea, promesa y audiencia', done: true, action: 'studio' },
        { key: 'edition', number: 2, label: 'Programar', desc: 'Fecha, cohorte y cupos', done: hasEdition, action: 'editions' },
        { key: 'studio', number: 3, label: 'Construir', desc: 'AlexIA coordina especialistas', done: hasPlan, action: 'studio' },
        { key: 'review', number: 4, label: 'Aprobar', desc: 'Entregables vigentes', done: hasApplied, action: 'artifacts' },
        { key: 'publish', number: 5, label: 'Publicar', desc: 'Comprobar y abrir registros', done: selected.value.status === 'published', action: 'publish' }
      ];
    });
    const progress = computed(() => readiness.value.progress || 0);
    const currentFormat = computed(() => FORMATS.find((f) => f.key === canonicalExperienceModel(form.format)) || FORMATS[1]);
    const currentStage = computed(() => pipeline.value.find((p) => p.key === stage.value));
    const currentBlockingCheck = computed(() => readiness.value.checks?.find((check) => check.stage === stage.value && !check.complete) || null);
    const currentReviewGuide = computed(() => REVIEW_GUIDES[stage.value] || null);

    function slugify(value) {
      return (value || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    }
    function modelFor(value) { return FORMATS.find((model) => model.key === canonicalExperienceModel(value)) || FORMATS[1]; }
    function modelLabel(value) { return modelFor(value).label; }
    function modelIcon(value) { return modelFor(value).icon; }
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
      Object.assign(form, { title: '', slug: '', format: 'paid_event', summary: '', audience: '' });
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
      tab.value = step.action;
      document.querySelector('.event-admin__workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    function goToCheck(check) {
      if (!check) return;
      tab.value = check.action || 'publish';
      if (check.stage) {
        stage.value = check.stage;
        if (check.action === 'artifacts') {
          notice.value = 'La nueva versión ya está lista. Revísala y selecciona “Aprobar y aplicar” para completar el control.';
        } else {
          if (REVIEW_GUIDES[check.stage] && !brief.value.trim()) brief.value = buildReviewBrief(check);
          notice.value = REVIEW_GUIDES[check.stage]
            ? 'AlexIA preparó una guía con las preguntas necesarias. Responde lo que conozcas y ella volverá a evaluar el control.'
            : '';
        }
      }
      const selector = check.action === 'artifacts' ? '.event-artifact-grid' : (check.stage ? '.event-studio__composer' : '.event-panel');
      requestAnimationFrame(() => document.querySelector(selector)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
    function openPublication() {
      tab.value = 'publish';
      requestAnimationFrame(() => document.querySelector('.event-publication')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
    function stageStatus(step) {
      const check = readiness.value.checks?.find((item) => item.stage === step.key);
      if (check?.artifact_status === 'draft') return check.declared_ready ? 'draft' : 'blocked';
      if (check && !check.complete && check.artifact_id) return 'blocked';
      if (appliedTypes.value.has(step.artifact)) return 'applied';
      if (artifacts.value.some((a) => a.type === step.artifact)) return 'draft';
      return 'pending';
    }
    function stageHelp(step) {
      openHelp('stage', {
        title: step.label,
        text: step.description || ('AlexIA coordinará a ' + step.agent + ' para construir este entregable.'),
        example: step.example || ('Revisa lo aprobado y crea una propuesta clara para ' + step.label.toLowerCase() + '.'),
        field: 'brief',
        tips: [step.required ? 'Este control es obligatorio para publicar.' : 'Esta área es recomendada; puedes volver a ella cuando la necesites.', 'Describe restricciones, fechas y decisiones ya tomadas.', 'Genera el borrador.', 'Revísalo en Entregables antes de aprobarlo.']
      });
    }
    function buildReviewBrief(check = currentBlockingCheck.value) {
      const guide = REVIEW_GUIDES[check?.stage || stage.value];
      if (!guide) return currentStage.value?.example || '';
      const risks = check?.risks?.length
        ? check.risks.map((risk, index) => `${index + 1}. ${risk}`).join('\n')
        : 'No hay riesgos previos detallados; realiza la revisión completa.';
      const requiredInputs = check?.required_inputs?.length
        ? check.required_inputs.map((item, index) => `${index + 1}. ${item}`).join('\n')
        : 'Responde las preguntas siguientes con la información confirmada.';
      const questions = guide.questions.map((question, index) => `${index + 1}. ${question}\nRespuesta: `).join('\n\n');
      return `AlexIA, ayúdame a cerrar la revisión de ${guide.title.toLowerCase()} de “${selected.value?.title || 'esta experiencia'}”.\n\nRiesgos señalados en la revisión anterior:\n${risks}\n\nInformación puntual solicitada:\n${requiredInputs}\n\nMis respuestas y decisiones:\n${questions}\n\nVuelve a evaluar exclusivamente bloqueos concretos. Si falta información, haz preguntas precisas. Si no queda ningún bloqueo crítico, marca ready_to_publish en true y deja las mejoras opcionales como recomendaciones no bloqueantes.`;
    }
    function useReviewTemplate(check = currentBlockingCheck.value) {
      brief.value = buildReviewBrief(check);
      requestAnimationFrame(() => document.getElementById(fieldId('brief'))?.focus());
    }
    function briefForAgent() {
      const check = currentBlockingCheck.value;
      if (!check?.risks?.length || !REVIEW_GUIDES[stage.value]) return brief.value;
      return `${brief.value}\n\nContexto automático de la revisión vigente:\n${check.risks.map((risk, index) => `${index + 1}. ${risk}`).join('\n')}`;
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
      try {
        selected.value = (await api.event(id)).data;
        showEditionForm.value = !(selected.value.editions || []).length;
        if (!offer.edition_id && selected.value.editions?.length) offer.edition_id = selected.value.editions[0].id;
        const readyGateway = selected.value.payment_gateways?.find((gateway) => gateway.active && gateway.configured);
        if (readyGateway && !selected.value.payment_gateways?.some((gateway) => gateway.provider === offer.payment_provider && gateway.active && gateway.configured)) {
          offer.payment_provider = readyGateway.provider;
        }
        editorSelection.value = null;
      }
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
        showEditionForm.value = false;
        Object.assign(edition, { name: 'Nueva edición', starts_at: '', ends_at: '', timezone: 'America/Bogota', capacity: 30, registration_open: true });
        tab.value = 'editions';
        notice.value = 'Edición creada correctamente. No necesitas crear otra para avanzar.';
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
        await api.runEventAgent(activeId.value, { stage: stage.value, brief: briefForAgent() });
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
        notice.value = decision === 'applied' ? 'Entregable aprobado como versión vigente.' : 'Entregable descartado. Puedes pedir una nueva versión a AlexIA.';
      } catch (e) { error.value = e.message; }
      finally { busy.value = false; }
    }
    async function publishExperience() {
      if (!readiness.value.ready) {
        openPublication();
        notice.value = 'Te llevamos a la lista de preparación. Completa los controles señalados antes de publicar.';
        return;
      }
      busy.value = true;
      error.value = '';
      try {
        const result = await api.publishEvent(activeId.value);
        await load();
        notice.value = 'Experiencia publicada en ' + result.data.url;
      } catch (e) {
        if (e.status === 409) {
          await open(activeId.value);
          openPublication();
          error.value = 'La preparación cambió. Revisa los controles pendientes antes de volver a publicar.';
        } else error.value = e.message;
      } finally { busy.value = false; }
    }
    function payload(artifact) {
      try { return JSON.parse(artifact.content_json || '{}'); } catch (_) { return {}; }
    }
    function artifactNeedsResolution(artifact) {
      const content = payload(artifact);
      return artifact?.status === 'applied'
        && ['landing', 'security', 'quality'].includes(artifact.type)
        && (content.ready_to_publish !== true || (artifact.type === 'landing' && !['2.0', '3.0'].includes(content.payload?.schema_version)));
    }
    function artifactCanApply(artifact) {
      if (!['landing', 'security', 'quality'].includes(artifact?.type)) return true;
      const content = payload(artifact);
      return content.ready_to_publish === true
        && (artifact.type !== 'landing' || ['2.0', '3.0'].includes(content.payload?.schema_version));
    }
    function resolveArtifact(artifact) {
      const content = payload(artifact);
      const check = {
        stage: artifact.type,
        risks: Array.isArray(content.risks) ? content.risks : [],
        required_inputs: Array.isArray(content.required_inputs) ? content.required_inputs : [],
      };
      tab.value = 'studio';
      stage.value = artifact.type;
      useReviewTemplate(check);
      notice.value = 'AlexIA preparó una nueva revisión con los asuntos que debe resolver este entregable.';
      requestAnimationFrame(() => document.querySelector('.event-studio__composer')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
    function formatDate(value) {
      if (!value) return 'Fecha por definir';
      try { return new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value.replace(' ', 'T'))); }
      catch (_) { return value; }
    }
    function formatMoney(value, currency = 'COP') {
      try {
        return new Intl.NumberFormat('es-CO', {
          style: 'currency', currency: currency || 'COP', maximumFractionDigits: 0
        }).format(Number(value || 0));
      } catch (_) { return `${value || 0} ${currency || 'COP'}`; }
    }
    function dateTimeLocalValue(value) {
      if (!value) return '';
      const date = new Date(String(value).replace(' ', 'T'));
      if (!Number.isFinite(date.getTime())) return '';
      const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
      return local.toISOString().slice(0, 16);
    }
    function fixedCountdownValue(value) {
      const date = new Date(String(value || ''));
      return Number.isFinite(date.getTime()) ? date.toISOString() : '';
    }

    function onEditorMessage(event) {
      if (event.origin !== location.origin || event.data?.type !== 'event-editor-select') return;
      editorSelection.value = {
        path: String(event.data.path || ''),
        label: String(event.data.label || 'Elemento'),
        kind: String(event.data.kind || 'text'),
      };
      editorValue.value = typeof event.data.value === 'string' ? event.data.value : JSON.stringify(event.data.value ?? '', null, 2);
      editorInstruction.value = '';
    }
    function refreshEditor() {
      editorKey.value += 1;
      editorSelection.value = null;
    }
    async function saveEditor(mode = 'direct', value = editorValue.value) {
      if (!editorSelection.value?.path) {
        error.value = 'Primero selecciona un elemento dentro de la previsualización.';
        return;
      }
      if (mode === 'ai' && !editorInstruction.value.trim()) {
        error.value = 'Escribe la instrucción que AlexIA debe aplicar solo a este elemento.';
        return;
      }
      editorBusy.value = true;
      error.value = '';
      try {
        await api.editEventLanding(activeId.value, {
          path: editorSelection.value.path,
          mode,
          value: mode === 'direct' ? value : undefined,
          instruction: mode === 'ai' ? editorInstruction.value : undefined,
        });
        await open(activeId.value);
        tab.value = 'editor';
        refreshEditor();
        notice.value = mode === 'ai'
          ? 'AlexIA corrigió únicamente el elemento seleccionado. La landing quedó como borrador para aprobación.'
          : 'Cambio guardado en el borrador. La revisión final deberá ejecutarse de nuevo antes de publicar.';
      } catch (e) { error.value = e.message; }
      finally { editorBusy.value = false; }
    }
    async function applyEditorMediaFile(file) {
      if (!file || !editorSelection.value) return;
      const expectedKind = editorSelection.value.kind;
      if (!['image', 'video', 'audio'].includes(expectedKind) || !String(file.type || '').startsWith(expectedKind + '/')) {
        error.value = `Adjunta un archivo de ${expectedKind === 'image' ? 'imagen' : expectedKind === 'video' ? 'video' : 'audio'} válido.`;
        return;
      }
      editorBusy.value = true;
      error.value = '';
      try {
        const result = editorSelection.value.kind === 'image'
          ? await api.uploadImage(file)
          : await api.uploadMedia(file);
        const url = result.data?.url;
        if (!url) throw new Error('La carga terminó sin una URL utilizable.');
        await saveEditor('direct', url);
      } catch (e) { error.value = e.message; editorBusy.value = false; }
    }
    async function uploadEditorMedia(event) {
      const file = event.target.files?.[0];
      event.target.value = '';
      await applyEditorMediaFile(file);
    }
    async function dropEditorMedia(event) {
      const file = event.dataTransfer?.files?.[0];
      await applyEditorMediaFile(file);
    }
    async function generateEditorImage() {
      if (editorSelection.value?.kind !== 'image') return;
      editorBusy.value = true;
      error.value = '';
      try {
        const result = await api.alexiaCover({
          title: selected.value.title,
          category: 'Experiencia comercial',
          type: 'event',
          excerpt: selected.value.summary,
          instructions: `${editorInstruction.value || 'Crea una imagen comercial premium coherente con la experiencia.'} Uso exacto: ${editorSelection.value.label}. Sin texto ni logos.`,
          aspect: editorSelection.value.path === 'hero.media.url' ? '3:2' : '4:5',
          style: 'fotografía editorial C-Level, sofisticada, humana y realista',
          quality: 'alta',
          lighting: 'cinematográfica natural',
          mood: 'confianza, movimiento y aspiración creíble',
        });
        const url = result.data?.url;
        if (!url) throw new Error('El especialista visual no devolvió una imagen.');
        await saveEditor('direct', url);
      } catch (e) { error.value = e.message; editorBusy.value = false; }
    }
    async function setLandingValue(path, value, label = 'Configuración comercial') {
      editorSelection.value = { path, label, kind: typeof value === 'boolean' ? 'toggle' : 'text' };
      editorValue.value = value;
      await saveEditor('direct', value);
    }
    function mediaAccept(kind) {
      if (kind === 'image') return 'image/jpeg,image/png,image/webp,image/gif';
      if (kind === 'video') return 'video/mp4,video/webm';
      if (kind === 'audio') return 'audio/mpeg,audio/mp4,audio/wav,audio/ogg';
      return '';
    }
    function resetOffer() {
      editingOfferId.value = null;
      const readyGateway = paymentGateways.value.find((gateway) => gateway.active && gateway.configured);
      Object.assign(offer, {
        edition_id: selected.value?.editions?.[0]?.id || '', name: 'Acceso general', description: '',
        price: 0, currency: 'COP', payment_mode: 'connector', payment_provider: readyGateway?.provider || 'wompi',
        checkout_url: '', active: true
      });
    }
    function editOffer(item) {
      editingOfferId.value = item.id;
      Object.assign(offer, {
        edition_id: item.edition_id, name: item.name, description: item.description || '',
        price: Number(item.price || 0), currency: item.currency || 'COP',
        payment_mode: item.payment_mode || 'connector',
        payment_provider: item.payment_provider || 'wompi',
        checkout_url: item.checkout_url || '', active: Number(item.active) === 1
      });
    }
    async function saveOffer() {
      busy.value = true;
      error.value = '';
      try {
        if (editingOfferId.value) await api.updateEventOffer(activeId.value, editingOfferId.value, { ...offer });
        else await api.saveEventOffer(activeId.value, { ...offer });
        await open(activeId.value);
        tab.value = 'commerce';
        resetOffer();
        notice.value = 'Oferta y pasarela guardadas. AlexIA podrá utilizarlas en la landing y el checkout.';
      } catch (e) { error.value = e.message; }
      finally { busy.value = false; }
    }
    async function archiveOffer(item) {
      if (!window.confirm(`¿Archivar “${item.name}”? Dejará de mostrarse y venderse, pero conservará su historial.`)) return;
      busy.value = true;
      try {
        await api.archiveEventOffer(activeId.value, item.id);
        await open(activeId.value);
        tab.value = 'commerce';
        notice.value = 'Oferta archivada.';
      } catch (e) { error.value = e.message; }
      finally { busy.value = false; }
    }
    async function uploadSource(event) {
      const file = event.target.files?.[0];
      event.target.value = '';
      if (!file) return;
      sourceBusy.value = true;
      error.value = '';
      notice.value = '';
      try {
        const uploaded = await api.uploadDoc(file);
        const result = await api.ingestEventSource(activeId.value, {
          url: uploaded.data?.url,
          name: uploaded.data?.name || file.name,
        });
        await open(activeId.value);
        tab.value = 'studio';
        const missing = result.data?.missing_decisions?.length || 0;
        notice.value = `AlexIA leyó “${file.name}” y lo incorporó como fuente factual.${missing ? ` Detectó ${missing} decisiones que todavía debes confirmar.` : ''}`;
      } catch (e) { error.value = e.message; }
      finally { sourceBusy.value = false; }
    }

    onMounted(() => {
      window.addEventListener('message', onEditorMessage);
      load();
    });
    onUnmounted(() => window.removeEventListener('message', onEditorMessage));
    return {
      FORMATS, items, selected, activeId, loading, busy, error, notice, tab, stage, brief, creating, wizardStep, help,
      form, edition, offer, offers, paymentGateways, landingPayload, pipeline, requiredStages, recommendedStages, artifacts, enrollments, journey, progress, coverage,
      readiness, nextMissing, currentFormat, currentStage, currentBlockingCheck, currentReviewGuide, appliedTypes, showEditionForm,
      editorSelection, editorValue, editorInstruction, editorKey, editorBusy, previewMode, sourceBusy, editorUrl, editingOfferId,
      slugify, fieldId, openHelp, closeHelp, applyHelpExample, startCreate, cancelCreate, nextWizard, previousWizard,
      modelLabel, modelIcon, goJourney, goToCheck, openPublication, stageStatus, stageHelp, buildReviewBrief, useReviewTemplate, open, create, addEdition, runAgent, review, publishExperience, payload, artifactNeedsResolution, artifactCanApply, resolveArtifact, formatDate, formatMoney,
      refreshEditor, saveEditor, uploadEditorMedia, dropEditorMedia, generateEditorImage, setLandingValue, mediaAccept, resetOffer, editOffer, saveOffer, archiveOffer, uploadSource,
      dateTimeLocalValue, fixedCountdownValue
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
        <button v-if="selected" class="btn" :class="readiness.ready ? 'btn--primary' : 'btn--ghost'" :disabled="busy" @click="openPublication">
          {{ selected.status === 'published' ? 'Ver estado de publicación' : readiness.ready ? 'Lista para publicar' : 'Revisar antes de publicar' }}
        </button>
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
              <span class="event-admin__item-icon">{{ modelIcon(item.format) }}</span>
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
                      <span>{{ type.icon }}</span><strong>{{ type.label }}</strong><small>{{ type.desc }}</small><em>{{ type.flow.join(' → ') }}</em><i>{{ form.format===type.key ? '✓' : '' }}</i>
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
                <div class="event-create__assurance"><span>🔒</span><div><strong>Nada se publicará todavía</strong><p>La experiencia se guardará como borrador. Tú aprobarás cada entregable y decidirás cuándo publicarla.</p></div></div>
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
                <span class="event-overview__type">{{ modelLabel(selected.format) }}</span>
                <h2>{{ selected.title }}</h2>
                <p>{{ selected.summary || 'Aún no has definido la promesa de esta experiencia.' }}</p>
                <div class="event-overview__meta"><span>{{ selected.status === 'published' ? '● Publicada' : '◌ En construcción' }}</span><span>/eventos/{{ selected.slug }}</span><a v-if="selected.status === 'published'" :href="'/eventos/' + selected.slug" target="_blank" rel="noopener">Ver landing ↗</a></div>
              </div>
              <div class="event-overview__score"><div class="event-progress-ring" :style="{ '--progress': progress + '%' }"><strong>{{ progress }}%</strong></div><span>Preparación para publicar</span></div>
            </section>

            <section class="event-journey">
              <header>
                <div><span>Tu ruta</span><h3>{{ nextMissing ? 'Siguiente paso: ' + nextMissing.label : selected.status === 'published' ? 'La experiencia está publicada' : 'Todo está listo para publicar' }}</h3></div>
                <div class="event-journey__actions"><button v-if="nextMissing" class="event-next-action" @click="goToCheck(nextMissing)">Resolver ahora →</button><button class="event-help-trigger" @click="openHelp('journey')" aria-label="Ayuda sobre la ruta">?</button></div>
              </header>
              <div class="event-journey__steps">
                <button v-for="step in journey" :key="step.key" :class="{done:step.done,active:!step.done && journey.findIndex(s=>!s.done)===journey.indexOf(step)}" @click="goJourney(step)">
                  <span>{{ step.done ? '✓' : step.number }}</span><div><strong>{{ step.label }}</strong><small>{{ step.desc }}</small></div><i>›</i>
                </button>
              </div>
            </section>

            <nav class="event-tabs" aria-label="Áreas de la experiencia">
              <button :class="{active:tab==='studio'}" @click="tab='studio'"><span>✦</span> Plan con AlexIA</button>
              <button :class="{active:tab==='editor'}" @click="tab='editor'"><span>▣</span> Editor visual</button>
              <button :class="{active:tab==='artifacts'}" @click="tab='artifacts'"><span>◇</span> Entregables <b>{{ artifacts.length }}</b></button>
              <button :class="{active:tab==='editions'}" @click="tab='editions'"><span>◷</span> Fechas y cohortes <b>{{ selected.editions?.length || 0 }}</b></button>
              <button :class="{active:tab==='commerce'}" @click="tab='commerce'"><span>◆</span> Oferta y pagos <b>{{ offers.length }}</b></button>
              <button :class="{active:tab==='participants'}" @click="tab='participants'"><span>◎</span> Participantes <b>{{ enrollments.length }}</b></button>
              <button :class="{active:tab==='publish'}" @click="tab='publish'"><span>✓</span> Publicación <b>{{ readiness.completed }}/{{ readiness.total }}</b></button>
            </nav>

            <section v-if="tab==='editor'" class="event-panel event-visual-editor">
              <header class="event-panel__head">
                <div><span class="event-panel__kicker">Borrador interactivo</span><h3>Edita la landing sobre la landing</h3><p>Haz clic en un texto, imagen, video o audio. Corrige directamente, pídele el ajuste a AlexIA o reemplaza el archivo sin salir de esta pantalla.</p></div>
                <div class="event-editor-toolbar"><span v-if="selected.landing" :class="'is-' + selected.landing.status">{{ selected.landing.status === 'applied' ? 'Versión aplicada' : 'Borrador activo' }} · v{{ selected.landing.version }}</span><div class="event-editor-devices"><button :class="{active:previewMode==='desktop'}" title="Escritorio" aria-label="Vista de escritorio" @click="previewMode='desktop'">▱</button><button :class="{active:previewMode==='tablet'}" title="Tablet" aria-label="Vista de tablet" @click="previewMode='tablet'">▯</button><button :class="{active:previewMode==='mobile'}" title="Móvil" aria-label="Vista móvil" @click="previewMode='mobile'">▯</button></div><button class="btn btn--ghost btn--sm" :disabled="editorBusy || !selected.landing" @click="refreshEditor">Actualizar vista</button></div>
              </header>
              <div v-if="!selected.landing" class="event-empty-state">
                <span>▣</span><h4>Primero crea la página con AlexIA</h4><p>El editor visual trabaja sobre un borrador estructurado. Ve al especialista Landing y recorrido de conversión para generar la primera versión.</p>
                <button class="btn btn--primary" @click="tab='studio';stage='landing'">Crear landing con AlexIA</button>
              </div>
              <template v-else>
                <div class="event-editor-config">
                  <div><strong>Tácticas de conversión</strong><small>Son configurables, transparentes y dependen de datos reales.</small></div>
                  <label><span>VSL</span><input type="checkbox" :checked="landingPayload.conversion?.vsl?.enabled" @change="setLandingValue('conversion.vsl.enabled',$event.target.checked,'Activar VSL')" /></label>
                  <label><span>Audio</span><input type="checkbox" :checked="landingPayload.conversion?.audio_invite?.enabled" @change="setLandingValue('conversion.audio_invite.enabled',$event.target.checked,'Activar audio')" /></label>
                  <label><span>Actividad real</span><input type="checkbox" :checked="landingPayload.conversion?.social_proof?.enabled" @change="setLandingValue('conversion.social_proof.enabled',$event.target.checked,'Prueba social real')" /></label>
                  <label v-if="landingPayload.conversion?.social_proof?.enabled">Señal
                    <select :value="landingPayload.conversion?.social_proof?.mode || 'aggregate'" @change="setLandingValue('conversion.social_proof.mode',$event.target.value,'Fuente de actividad real')"><option value="aggregate">Registros totales</option><option value="live_presence">Personas viendo ahora</option><option value="recent_registrations">Registros de hoy</option></select>
                  </label>
                  <label v-if="landingPayload.conversion?.social_proof?.enabled">Mostrar desde
                    <input type="number" min="1" max="10000" :value="landingPayload.conversion?.social_proof?.display_threshold || 5" @change="setLandingValue('conversion.social_proof.display_threshold',Number($event.target.value),'Umbral de actividad')" />
                  </label>
                  <label><span>Cupos reales</span><input type="checkbox" :checked="landingPayload.conversion?.scarcity?.show_remaining_seats !== false" @change="setLandingValue('conversion.scarcity.show_remaining_seats',$event.target.checked,'Mostrar cupos restantes')" /></label>
                  <label v-if="landingPayload.conversion?.scarcity?.show_remaining_seats !== false">Avisar cuando queden
                    <input type="number" min="1" max="10000" :value="landingPayload.conversion?.scarcity?.show_when_remaining_lte || 30" @change="setLandingValue('conversion.scarcity.show_when_remaining_lte',Number($event.target.value),'Umbral de cupos')" />
                  </label>
                  <label>Temporizador
                    <select :value="landingPayload.conversion?.urgency?.mode || 'none'" @change="setLandingValue('conversion.urgency.mode',$event.target.value,'Tipo de temporizador')"><option value="none">Sin temporizador</option><option value="fixed">Fecha fija</option><option value="evergreen">Evergreen por sesión</option></select>
                  </label>
                  <label v-if="landingPayload.conversion?.urgency?.mode==='evergreen'">Minutos
                    <input type="number" min="5" max="1440" :value="landingPayload.conversion?.urgency?.evergreen_minutes || 15" @change="setLandingValue('conversion.urgency.evergreen_minutes',Number($event.target.value),'Duración evergreen')" />
                  </label>
                  <label v-if="landingPayload.conversion?.urgency?.mode==='fixed'">Finaliza
                    <input type="datetime-local" :value="dateTimeLocalValue(landingPayload.conversion?.urgency?.ends_at)" @change="setLandingValue('conversion.urgency.ends_at',fixedCountdownValue($event.target.value),'Fecha final del temporizador')" />
                  </label>
                  <label v-if="landingPayload.conversion?.urgency?.mode!=='none'">Al finalizar
                    <select :value="landingPayload.conversion?.urgency?.expiry_action || 'message'" @change="setLandingValue('conversion.urgency.expiry_action',$event.target.value,'Acción al finalizar')"><option value="message">Mostrar aviso y mantener registro</option><option value="hide_cta">Cerrar CTA e inscripción</option></select>
                  </label>
                </div>
                <div class="event-editor-layout" :class="{'has-selection':editorSelection}">
                  <div class="event-editor-canvas">
                    <div class="event-editor-viewport" :class="'is-' + previewMode">
                      <div class="event-editor-browser"><span></span><span></span><span></span><strong>/eventos/{{ selected.slug }}</strong><em>{{ previewMode === 'desktop' ? 'Escritorio' : previewMode === 'tablet' ? 'Tablet' : 'Móvil' }}</em></div>
                      <iframe :key="editorKey" :src="editorUrl" :title="'Editor de ' + selected.title"></iframe>
                    </div>
                  </div>
                  <aside class="event-editor-inspector">
                    <template v-if="editorSelection">
                      <header><div><small>Elemento seleccionado</small><strong>{{ editorSelection.label }}</strong><code>{{ editorSelection.path }}</code></div><button @click="editorSelection=null">×</button></header>
                      <div v-if="['image','video','audio'].includes(editorSelection.kind)" class="event-editor-media">
                        <img v-if="editorSelection.kind==='image' && editorValue" :src="editorValue" alt="" />
                        <video v-else-if="editorSelection.kind==='video' && editorValue" :src="editorValue" controls></video>
                        <audio v-else-if="editorSelection.kind==='audio' && editorValue" :src="editorValue" controls></audio>
                        <div v-else><span>＋</span><p>Aún no hay un archivo asignado.</p></div>
                        <label class="event-editor-upload" @dragover.prevent @drop.prevent="dropEditorMedia"><input type="file" :accept="mediaAccept(editorSelection.kind)" @change="uploadEditorMedia" /><span>{{ editorValue ? 'Arrastra o reemplaza el archivo' : 'Arrastra o adjunta el archivo' }}</span><small>Se optimiza y adapta automáticamente.</small></label>
                        <button v-if="editorSelection.kind==='image'" class="btn btn--ghost btn--sm" :disabled="editorBusy" @click="generateEditorImage">✦ Crear imagen comercial con IA</button>
                        <label>O pega una URL segura<input v-model="editorValue" class="input" placeholder="https://…" /></label>
                        <button class="btn btn--primary" :disabled="editorBusy" @click="saveEditor('direct')">{{ editorBusy ? 'Guardando…' : 'Usar esta URL' }}</button>
                      </div>
                      <div v-else class="event-editor-copy">
                        <label>Contenido del elemento<textarea v-model="editorValue" class="input" rows="7"></textarea></label>
                        <button class="btn btn--primary" :disabled="editorBusy" @click="saveEditor('direct')">{{ editorBusy ? 'Guardando…' : 'Guardar cambio exacto' }}</button>
                      </div>
                      <div class="event-editor-ai">
                        <span>✦ AlexIA · ajuste contextual</span>
                        <p>La instrucción se aplicará solo al elemento seleccionado y conservará el propósito comercial del bloque.</p>
                        <textarea v-model="editorInstruction" class="input" rows="5" :placeholder="editorSelection.kind==='image' ? 'Ej. Que se vea más premium, con empresarios latinoamericanos y sin texto…' : 'Ej. Hazlo más concreto, con foco en el resultado y menos de 12 palabras…'"></textarea>
                        <button v-if="!['video','audio'].includes(editorSelection.kind)" class="btn btn--ghost" :disabled="editorBusy" @click="editorSelection.kind==='image' ? generateEditorImage() : saveEditor('ai')">{{ editorBusy ? 'AlexIA está trabajando…' : editorSelection.kind==='image' ? 'Generar con esta instrucción' : 'Corregir justo aquí' }}</button>
                      </div>
                      <p class="event-editor-note">Cada cambio crea o actualiza un borrador. No modifica la versión pública hasta que lo apruebes.</p>
                    </template>
                    <div v-else class="event-editor-empty"><span>↖</span><strong>Selecciona algo en la página</strong><p>Los elementos editables se resaltan al pasar el cursor. Haz clic para abrir sus controles aquí.</p></div>
                  </aside>
                </div>
              </template>
            </section>

            <section v-if="tab==='studio'" class="event-panel event-studio">
              <header class="event-panel__head">
                <div><span class="event-panel__kicker">Orquestadora central</span><h3>Construye la experiencia con AlexIA</h3><p>Selecciona el área que quieres trabajar. AlexIA coordina al especialista indicado y conserva todo dentro de {{ selected.title }}.</p></div>
                <button class="event-help-trigger event-help-trigger--labeled" @click="openHelp('studio')"><span>?</span> Guía y ejemplo</button>
              </header>
              <div class="event-source-intake">
                <div><span>PDF → brief estructurado</span><strong>¿Ya tienes el evento pensado en un documento?</strong><p>Adjúntalo una sola vez. AlexIA extrae hechos, agenda, audiencia, oferta, logística y decisiones pendientes; los especialistas lo usarán como contexto sin tratar instrucciones incrustadas como órdenes.</p></div>
                <label :class="{busy:sourceBusy}"><input type="file" accept="application/pdf,.pdf" :disabled="sourceBusy" @change="uploadSource" /><b>{{ sourceBusy ? 'AlexIA está leyendo el PDF…' : 'Adjuntar y leer PDF' }}</b><small>Máximo 20 MB para análisis · el original queda asociado a esta experiencia</small></label>
              </div>
              <div class="event-studio__explain">
                <div><strong>No tienes que completar todas las áreas</strong><p>Las áreas recomendadas elevan la calidad. Para publicar, los controles marcados como obligatorios sí deben quedar aprobados.</p></div>
                <div><span>{{ requiredStages.length }}</span><small>obligatorias</small></div><div><span>{{ recommendedStages.length }}</span><small>recomendadas</small></div><div><span>{{ coverage }}%</span><small>cobertura total</small></div>
              </div>
              <div class="event-studio__body">
                <aside class="event-stage-list">
                  <div class="event-stage-list__title"><strong>Áreas de construcción</strong><small>Selecciona una; no son formularios aislados</small></div>
                  <button v-for="(step,index) in pipeline" :key="step.key" :class="{active:stage===step.key}" @click="stage=step.key">
                    <span>{{ index+1 }}</span><div><strong>{{ step.label }}</strong><small>{{ stageStatus(step)==='applied' ? 'Aprobado' : stageStatus(step)==='blocked' ? 'Requiere respuestas' : stageStatus(step)==='draft' ? 'Borrador por revisar' : step.required ? 'Obligatorio · pendiente' : 'Recomendado · pendiente' }}</small></div>
                    <i :class="'is-' + stageStatus(step)">{{ stageStatus(step)==='applied' ? '✓' : stageStatus(step)==='blocked' ? '!' : stageStatus(step)==='draft' ? '•' : '' }}</i>
                    <b class="event-stage-help" @click.stop="stageHelp(step)">?</b>
                  </button>
                </aside>
                <div class="event-studio__composer">
                  <div class="event-studio__agent"><span>✦</span><div><small>AlexIA coordinará a</small><strong>{{ currentStage?.agent || 'Especialista indicado' }}</strong></div><em :class="{required:currentStage?.required}">{{ currentStage?.required ? 'Obligatorio' : 'Recomendado' }}</em></div>
                  <div class="event-studio__stage-context"><strong>{{ currentStage?.label }}</strong><p>{{ currentStage?.description }}</p></div>
                  <div v-if="currentReviewGuide && currentBlockingCheck" class="event-resolution-guide">
                    <header><span>✦</span><div><small>AlexIA te acompaña</small><strong>No tienes que descubrir qué escribir</strong></div></header>
                    <p>{{ currentReviewGuide.intro }}</p>
                    <div v-if="currentBlockingCheck.risks?.length" class="event-resolution-guide__risks"><strong>Lo que debemos resolver ahora</strong><ul><li v-for="risk in currentBlockingCheck.risks" :key="risk">{{ risk }}</li></ul></div>
                    <div class="event-resolution-guide__questions"><strong>Información que AlexIA necesita</strong><ol><li v-for="question in currentReviewGuide.questions" :key="question">{{ question }}</li></ol></div>
                    <button type="button" class="btn btn--ghost btn--sm" @click="useReviewTemplate(currentBlockingCheck)">Preparar mis respuestas con AlexIA</button>
                  </div>
                  <label :for="fieldId('brief')">{{ currentStage?.question || '¿Qué necesitas construir o ajustar?' }}</label>
                  <textarea :id="fieldId('brief')" v-model="brief" class="input" rows="10" :placeholder="currentStage?.example || 'Describe el resultado esperado, las restricciones y lo que ya está decidido.'"></textarea>
                  <button v-if="currentStage?.example && !brief" type="button" class="event-brief-example" @click="brief=currentStage.example"><span>✦</span><div><strong>¿No sabes qué escribir?</strong><small>Usar un ejemplo específico para {{ currentStage.label.toLowerCase() }}</small></div><b>Usar ejemplo →</b></button>
                  <div class="event-studio__composer-foot"><button class="event-text-action" @click="stageHelp(currentStage)">Qué obtendrás y cómo pedirlo</button><button class="btn btn--primary" :disabled="busy" @click="runAgent">{{ busy ? 'AlexIA está trabajando…' : stageStatus(currentStage)==='pending' ? 'Crear primer borrador' : 'Generar nueva versión' }} <b>✦</b></button></div>
                </div>
              </div>
            </section>

            <section v-if="tab==='artifacts'" class="event-panel">
              <header class="event-panel__head"><div><span class="event-panel__kicker">Entregables versionados</span><h3>Revisa y aprueba lo que construye AlexIA</h3><p>Cada resultado permanece como borrador hasta que tú lo apruebas. Nunca se publica automáticamente.</p></div><button class="event-help-trigger event-help-trigger--labeled" @click="openHelp('artifacts')"><span>?</span> ¿Cómo funcionan?</button></header>
              <div class="event-scope-note"><span>◇</span><div><strong>Estos entregables pertenecen a “{{ selected.title }}”</strong><p>Se reutilizan en todas sus fechas o cohortes. Una edición solo representa cuándo ocurre, sus cupos y sus participantes.</p></div></div>
              <div v-if="artifacts.length" class="event-artifact-grid">
                <article v-for="artifact in artifacts" :key="artifact.id" class="event-artifact">
                  <header><div><span>{{ artifact.type }} · versión {{ artifact.version }}</span><h4>{{ artifact.title }}</h4></div><b :class="artifactNeedsResolution(artifact) ? 'is-warning' : 'is-' + artifact.status">{{ artifactNeedsResolution(artifact) ? 'Aplicado · requiere respuestas' : artifact.status === 'applied' ? 'Aplicado' : artifact.status === 'superseded' ? 'Versión anterior' : artifact.status === 'rejected' ? 'Rechazado' : 'Borrador' }}</b></header>
                  <p>{{ payload(artifact).summary || 'Sin resumen disponible.' }}</p>
                  <div v-if="payload(artifact).risks?.length" class="event-artifact__review event-artifact__review--risk"><strong>Asuntos por resolver</strong><ul><li v-for="risk in payload(artifact).risks" :key="risk">{{ risk }}</li></ul></div>
                  <div v-if="payload(artifact).required_inputs?.length" class="event-artifact__review"><strong>Información que AlexIA necesita</strong><ul><li v-for="item in payload(artifact).required_inputs" :key="item">{{ item }}</li></ul></div>
                  <div v-if="payload(artifact).quality_score != null" class="event-artifact__score"><span>Calidad estructural</span><strong>{{ payload(artifact).quality_score }}/100</strong></div>
                  <details><summary>Ver contenido completo <span>⌄</span></summary><pre>{{ JSON.stringify(payload(artifact).payload, null, 2) }}</pre></details>
                  <footer v-if="artifact.status==='draft'"><button class="btn btn--ghost" @click="review(artifact,'rejected')">Descartar borrador</button><button v-if="artifactCanApply(artifact)" class="btn btn--primary" @click="review(artifact,'applied')">Aprobar y aplicar</button><button v-else class="btn btn--primary" @click="resolveArtifact(artifact)">Resolver con AlexIA</button></footer>
                </article>
              </div>
              <div v-else class="event-empty-state"><span>◇</span><h4>Todavía no hay entregables</h4><p>Ve a Plan con AlexIA, selecciona un área y genera el primer borrador.</p><button class="btn btn--primary" @click="tab='studio'">Ir al Plan con AlexIA</button></div>
            </section>

            <section v-if="tab==='editions'" class="event-panel">
              <header class="event-panel__head"><div><span class="event-panel__kicker">Programación y capacidad</span><h3>Fechas y cohortes</h3><p>Una edición es una realización concreta de {{ selected.title }}. Crear una nueva no avanza el proceso: solo agrega otra fecha o grupo.</p></div><button class="event-help-trigger event-help-trigger--labeled" @click="openHelp('editions')"><span>?</span> ¿Cuándo creo otra?</button></header>
              <div class="event-edition-meaning"><div><span>Experiencia</span><strong>{{ selected.title }}</strong><small>Contenido, oferta y entregables comunes</small></div><i>→</i><div><span>Edición o cohorte</span><strong>Fecha + cupos + participantes</strong><small>Puedes tener una o varias</small></div></div>
              <div class="event-edition-layout" :class="{'event-edition-layout--single':!showEditionForm}">
                <div>
                  <div v-if="selected.editions?.length" class="event-edition-list">
                    <article v-for="ed in selected.editions" :key="ed.id"><span>◷</span><div><strong>{{ ed.name }}</strong><p>{{ formatDate(ed.starts_at) }}</p><small>{{ ed.timezone }} · {{ ed.capacity ? ed.capacity + ' cupos' : 'Sin límite de cupos' }}</small></div><b>{{ ed.registration_open == 1 ? 'Inscripciones abiertas' : 'Cerradas' }}</b></article>
                  </div>
                  <div v-else class="event-empty-state event-empty-state--compact"><span>◷</span><h4>Aún no has programado una edición</h4><p>Completa el formulario para definir cuándo ocurrirá y cuántas personas podrán registrarse.</p></div>
                  <button v-if="selected.editions?.length && !showEditionForm" class="event-add-edition" @click="showEditionForm=true"><span>＋</span><div><strong>Crear otra edición</strong><small>Úsalo solo para una nueva fecha, ciudad o cohorte</small></div></button>
                </div>
                <form v-if="showEditionForm" class="event-edition-form" @submit.prevent="addEdition">
                  <div class="event-edition-form__title"><div><span>{{ selected.editions?.length ? 'Otra edición' : 'Primera edición' }}</span><strong>Programa una fecha o cohorte</strong></div><button type="button" class="event-help-trigger" @click="openHelp('editions')">?</button></div>
                  <label>Nombre de la edición<input v-model="edition.name" class="input" placeholder="Ej. Cohorte Cartagena · Julio" /></label>
                  <div class="event-edition-form__two"><label>Inicio<input v-model="edition.starts_at" class="input" type="datetime-local" /></label><label>Finalización<input v-model="edition.ends_at" class="input" type="datetime-local" /></label></div>
                  <div class="event-edition-form__two"><label>Zona horaria<select v-model="edition.timezone" class="input"><option>America/Bogota</option><option>America/Mexico_City</option><option>America/New_York</option><option>Europe/Madrid</option></select></label><label>Cupos<input v-model.number="edition.capacity" class="input" type="number" min="0" /></label></div>
                  <label class="event-switch"><input v-model="edition.registration_open" type="checkbox" /><span></span><div><strong>Abrir inscripciones</strong><small>Las personas podrán registrarse al publicar.</small></div></label>
                  <div class="event-edition-form__actions"><button v-if="selected.editions?.length" type="button" class="btn btn--ghost" @click="showEditionForm=false">Cancelar</button><button class="btn btn--primary" :disabled="busy">{{ busy ? 'Guardando…' : 'Guardar esta edición' }}</button></div>
                </form>
              </div>
            </section>

            <section v-if="tab==='commerce'" class="event-panel event-commerce">
              <header class="event-panel__head">
                <div><span class="event-panel__kicker">Monetización por experiencia</span><h3>Oferta, precios y pasarela</h3><p>Define qué compra la persona y qué pasarela procesa cada acceso. El registro y el Lead se crean antes de enviar al checkout para no perder la oportunidad.</p></div>
                <button class="btn btn--ghost btn--sm" @click="resetOffer">＋ Nueva oferta</button>
              </header>
              <div class="event-commerce__gateways">
                <div><strong>Pasarelas disponibles</strong><small>Solo se pueden seleccionar conectores activos y configurados.</small></div>
                <span v-for="gateway in paymentGateways" :key="gateway.provider" :class="{ready:gateway.active && gateway.configured}"><i></i>{{ gateway.label }} · {{ gateway.active && gateway.configured ? 'lista' : 'pendiente' }}</span>
              </div>
              <div class="event-commerce__layout">
                <div>
                  <div v-if="offers.length" class="event-offer-list">
                    <article v-for="item in offers" :key="item.id" :class="{active:editingOfferId===item.id}">
                      <div><small>{{ item.edition_name }}</small><strong>{{ item.name }}</strong><p>{{ item.description || 'Sin descripción comercial.' }}</p></div>
                      <div class="event-offer-list__price"><strong>{{ formatMoney(item.price,item.currency) }}</strong><span>{{ item.payment_provider === 'external' ? 'Checkout externo' : item.payment_provider }}</span></div>
                      <footer><button class="event-text-action" @click="editOffer(item)">Editar</button><button class="event-text-action is-danger" @click="archiveOffer(item)">Archivar</button></footer>
                    </article>
                  </div>
                  <div v-else class="event-empty-state event-empty-state--compact"><span>◆</span><h4>Aún no hay ofertas activas</h4><p>Para una experiencia gratuita no es necesario crear una. Para venta, reserva o membresía, configura al menos un acceso.</p></div>
                </div>
                <form class="event-offer-form" @submit.prevent="saveOffer">
                  <header><div><span>{{ editingOfferId ? 'Editar oferta' : 'Nueva oferta' }}</span><strong>Qué podrá elegir la persona</strong></div><button v-if="editingOfferId" type="button" @click="resetOffer">×</button></header>
                  <label>Edición o cohorte<select v-model="offer.edition_id" class="input" required><option value="" disabled>Selecciona una edición</option><option v-for="ed in selected.editions" :key="ed.id" :value="ed.id">{{ ed.name }}</option></select></label>
                  <label>Nombre del acceso<input v-model="offer.name" class="input" required placeholder="Ej. Entrada presencial · Early bird" /></label>
                  <label>Descripción<textarea v-model="offer.description" class="input" rows="3" placeholder="Qué incluye y para quién es esta opción."></textarea></label>
                  <div class="event-offer-form__two"><label>Precio<input v-model.number="offer.price" class="input" type="number" min="1" step="0.01" required /></label><label>Moneda<select v-model="offer.currency" class="input"><option>COP</option><option>USD</option><option>EUR</option><option>MXN</option></select></label></div>
                  <fieldset><legend>¿Cómo se procesa el pago?</legend>
                    <label class="event-radio"><input v-model="offer.payment_mode" type="radio" value="connector" /><span><strong>Pasarela conectada</strong><small>Wompi o ePayco confirma el pago automáticamente.</small></span></label>
                    <label class="event-radio"><input v-model="offer.payment_mode" type="radio" value="external" /><span><strong>Checkout externo</strong><small>Usa una URL HTTPS de otra plataforma.</small></span></label>
                  </fieldset>
                  <label v-if="offer.payment_mode==='connector'">Pasarela<select v-model="offer.payment_provider" class="input"><option v-for="gateway in paymentGateways.filter(g=>g.active && g.configured)" :key="gateway.provider" :value="gateway.provider">{{ gateway.label }}</option></select></label>
                  <label v-else>URL del checkout externo<input v-model="offer.checkout_url" class="input" type="url" required placeholder="https://checkout…" /></label>
                  <div v-if="offer.payment_mode==='connector' && !paymentGateways.some(g=>g.active && g.configured)" class="event-offer-form__warning">Activa y prueba Wompi o ePayco en Conectores antes de guardar esta oferta.</div>
                  <footer><button v-if="editingOfferId" type="button" class="btn btn--ghost" @click="resetOffer">Cancelar</button><button class="btn btn--primary" :disabled="busy || !offer.edition_id || (offer.payment_mode==='connector' && !paymentGateways.some(g=>g.active && g.configured))">{{ busy ? 'Guardando…' : editingOfferId ? 'Actualizar oferta' : 'Crear oferta' }}</button></footer>
                </form>
              </div>
            </section>

            <section v-if="tab==='participants'" class="event-panel">
              <header class="event-panel__head"><div><span class="event-panel__kicker">Comunidad y CRM</span><h3>Participantes registrados</h3><p>Las inscripciones también alimentan Leads y Pipeline automáticamente.</p></div><button class="event-help-trigger event-help-trigger--labeled" @click="openHelp('participants')"><span>?</span> ¿Cómo se registran?</button></header>
              <div v-if="enrollments.length" class="table-wrap"><table class="table event-participant-table"><thead><tr><th>Participante</th><th>Contacto</th><th>Edición</th><th>Estado</th><th>Registro</th></tr></thead><tbody><tr v-for="person in enrollments" :key="person.id"><td><strong>{{ person.name }}</strong><small>{{ person.company || 'Empresa sin registrar' }}</small></td><td><span>{{ person.email }}</span><small>{{ person.whatsapp || 'WhatsApp pendiente' }}</small></td><td>{{ person.edition_name }}</td><td><b>{{ person.status }}</b></td><td>{{ formatDate(person.created_at) }}</td></tr></tbody></table></div>
              <div v-else class="event-empty-state"><span>◎</span><h4>Los participantes aparecerán aquí</h4><p>Cuando publiques la landing y alguien complete el formulario, se creará su registro, Lead y oportunidad comercial.</p></div>
            </section>

            <section v-if="tab==='publish'" class="event-panel event-publication">
              <header class="event-panel__head">
                <div><span class="event-panel__kicker">Revisión guiada</span><h3>{{ readiness.ready ? 'Todo está preparado' : 'Completa lo pendiente antes de publicar' }}</h3><p>Esta lista es la fuente real del estado. No necesitas interpretar mensajes técnicos ni adivinar qué falta.</p></div>
                <button class="event-help-trigger event-help-trigger--labeled" @click="openHelp('publish')"><span>?</span> ¿Qué comprueba?</button>
              </header>
              <div class="event-publication__summary" :class="{ready:readiness.ready}">
                <div class="event-publication__meter"><div class="event-progress-ring" :style="{ '--progress': readiness.progress + '%' }"><strong>{{ readiness.progress }}%</strong></div></div>
                <div><span>{{ readiness.ready ? 'LISTA PARA PUBLICAR' : 'PREPARACIÓN EN CURSO' }}</span><h4>{{ readiness.completed }} de {{ readiness.total }} controles completados</h4><p>{{ readiness.ready ? 'La página puede abrirse al público. La decisión final sigue siendo tuya.' : 'Resuelve los controles marcados. Cada botón te lleva directamente al lugar correcto.' }}</p></div>
              </div>
              <div class="event-publication__checks">
                <article v-for="check in readiness.checks" :key="check.key" :class="{complete:check.complete,blocked:!check.complete}">
                  <span>{{ check.complete ? '✓' : '!' }}</span>
                  <div><div class="event-publication__check-title"><strong>{{ check.label }}</strong><b>{{ check.complete ? 'Completado' : 'Pendiente obligatorio' }}</b><em v-if="check.quality_score != null">{{ check.quality_score }}/100 calidad estructural</em></div><p>{{ check.detail }}</p><ul v-if="check.risks?.length"><li v-for="risk in check.risks" :key="risk">{{ risk }}</li></ul><div v-if="check.required_inputs?.length" class="event-publication__needed"><strong>AlexIA necesita que confirmes:</strong><span v-for="item in check.required_inputs" :key="item">{{ item }}</span></div></div>
                  <button v-if="!check.complete" class="btn btn--ghost btn--sm" @click="goToCheck(check)">{{ check.action === 'artifacts' ? 'Revisar y aplicar' : ['landing','security','quality'].includes(check.key) ? 'Resolver con AlexIA' : check.stage ? 'Abrir esta revisión' : 'Completar ahora' }} →</button>
                </article>
              </div>
              <div class="event-publication__final">
                <div><strong>{{ selected.status === 'published' ? 'La experiencia ya está visible' : readiness.ready ? 'Confirmación final' : 'Publicación bloqueada de forma segura' }}</strong><p>{{ selected.status === 'published' ? '/eventos/' + selected.slug : readiness.ready ? 'Al publicar, la página de registro quedará disponible para recibir participantes.' : 'El botón se habilitará cuando los cinco controles estén completos.' }}</p></div>
                <button class="btn btn--primary" :disabled="busy || !readiness.ready || selected.status === 'published'" @click="publishExperience">{{ busy ? 'Publicando…' : selected.status === 'published' ? 'Ya publicada' : 'Publicar experiencia ahora' }}</button>
              </div>
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
