import { ref, reactive, computed, onMounted, onUnmounted } from 'vue';
import { api } from '../api.js?v=20260727-1';
import Modal from '../components/Modal.js';
import { auth } from '../store.js';
import { EXPERIENCE_MODELS, canonicalExperienceModel } from '../../../app/data/eventLanding.js?v=20260727-2';

const FORMATS = EXPERIENCE_MODELS.map((model) => ({ ...model, desc: model.short }));

const HELP = {
  module: {
    title: '¿Qué puedes construir aquí?',
    text: 'Este módulo convierte una idea en una experiencia lista para promocionar y operar. No necesitas conocer términos técnicos: completa la información inicial y AlexIA te guiará en el resto del recorrido.',
    tips: ['Describe lo que quieres una sola vez o adjunta un PDF.', 'AlexIA coordina las once áreas y conserva el contexto.', 'Puedes publicar una primera landing y mejorarla por iteraciones.', 'Fechas, oferta y automatizaciones se agregan solo cuando las necesites.']
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
    text: 'La ruta propone un siguiente paso, pero no es una camisa de fuerza. Puedes publicar una versión útil, verla en producción y volver a mejorarla cuando quieras.',
    tips: ['Crear: brief, contenido y landing.', 'Configurar: fechas, oferta y mensajes cuando apliquen.', 'Publicar: una versión completa y recuperable de lo que ya existe.', 'Las recomendaciones orientan; solo los errores técnicos bloquean.']
  },
  studio: {
    title: 'Cómo trabajar con el Plan de AlexIA',
    text: 'Cuéntale a AlexIA el objetivo completo una sola vez o adjunta un PDF. Ella coordina las once áreas, conserva la memoria del evento y entrega una primera versión integral.',
    example: 'Diseña un taller presencial de 8 horas para 15 empresarios. Debe ser 90% práctico y terminar con un plan comercial de 30 días.',
    field: 'brief',
    tips: ['Describe el resultado esperado.', 'Indica lo que ya sabes; AlexIA señalará lo que falta sin inventarlo.', 'Después puedes ajustar únicamente el área que elijas.', 'Cada ajuste recibe el contexto completo de la experiencia.']
  },
  artifacts: {
    title: 'Entregables y aprobaciones',
    text: 'Un entregable es un resultado producido por AlexIA: currículo, oferta, página de registro, guion, plan de lanzamiento o revisión. Pertenece a esta experiencia y se reutiliza en sus ediciones. Siempre nace como borrador.',
    tips: ['Aprobar y aplicar: lo conviertes en la versión vigente de la experiencia.', 'Solicitar otra versión: conservas el historial y pides un ajuste.', 'No necesitas completar todas las áreas para publicar.', 'La landing es el único entregable técnico necesario para una primera publicación.']
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
    text: 'Publicar toma una fotografía completa del borrador actual. Puedes hacerlo desde el editor visual en cuanto exista una landing válida; los demás controles son recomendaciones para mejorarla.',
    tips: ['Publica una primera versión para verla funcionando.', 'Cada publicación conserva historial y permite volver a una versión anterior.', 'Las recomendaciones no bloquean la iteración.', 'AlexIA nunca publica sin una acción explícita tuya.']
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
    const globalBrief = ref('');
    const orchestrationBusy = ref(false);
    const orchestrationStatus = ref('');
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
    const editingEditionId = ref(null);
    const editorSource = ref('draft');
    const actionDialog = ref(null);
    const releaseNotes = ref('');
    const deletion = reactive({ step: 'impact', code: '', email_hint: '', expires_at: '' });
    const regeneration = reactive({ scope: 'complete', brief: '' });
    const form = reactive({ title: '', slug: '', format: 'paid_event', summary: '', audience: '' });
    const edition = reactive({ name: 'Primera edición', starts_at: '', ends_at: '', timezone: 'America/Bogota', capacity: 30, registration_open: true, status: 'scheduled' });
    const offer = reactive({
      edition_id: '', name: 'Acceso general', description: '', price: 0, currency: 'COP',
      payment_mode: 'connector', payment_provider: 'wompi', checkout_url: '', active: true
    });

    const pipeline = computed(() => selected.value?.pipeline || []);
    const artifacts = computed(() => selected.value?.artifacts || []);
    const enrollments = computed(() => selected.value?.enrollments || []);
    const offers = computed(() => (selected.value?.offers || []).filter((item) => Number(item.active) === 1));
    const paymentGateways = computed(() => selected.value?.payment_gateways || []);
    const automationRules = computed(() => selected.value?.automation_rules || []);
    const releases = computed(() => selected.value?.releases || []);
    const canDelete = computed(() => auth.can('eventos.delete'));
    const publicSlug = computed(() =>
      selected.value?.current_release?.manifest?.experience?.slug
      || selected.value?.public_slug
      || selected.value?.slug
      || ''
    );
    const landingPayload = computed(() => {
      try {
        const content = JSON.parse(selected.value?.landing?.content_json || '{}');
        return content.payload || {};
      } catch (_) { return {}; }
    });
    const editorUrl = computed(() => {
      const artifact = editorSource.value === 'published' ? selected.value?.published_landing : selected.value?.landing;
      const slug = editorSource.value === 'published' ? publicSlug.value : selected.value?.slug;
      if (!slug || !artifact) return '';
      return `/eventos/${encodeURIComponent(slug)}?editor=1&experience_id=${encodeURIComponent(selected.value.id)}&preview=${editorSource.value}&artifact=${encodeURIComponent(artifact.id)}&v=${editorKey.value}`;
    });
    const appliedTypes = computed(() => new Set(artifacts.value.filter((a) => a.status === 'applied').map((a) => a.type)));
    const readiness = computed(() => selected.value?.readiness || { ready: false, can_publish: false, progress: 0, completed: 0, total: 3, optional_completed: 0, optional_total: 3, checks: [], blocking: [], recommendations: [], has_changes: false, publication_action: 'launch' });
    const requiredStages = computed(() => pipeline.value.filter((step) => step.required));
    const recommendedStages = computed(() => pipeline.value.filter((step) => !step.required));
    const coverage = computed(() => pipeline.value.length
      ? Math.round((pipeline.value.filter((step) => stageStatus(step) === 'applied').length / pipeline.value.length) * 100)
      : 0);
    const nextMissing = computed(() => readiness.value.blocking?.[0] || null);
    const workspaceGroup = computed(() => {
      if (['studio', 'editor', 'artifacts'].includes(tab.value)) return 'create';
      if (['editions', 'commerce', 'automation'].includes(tab.value)) return 'configure';
      return 'operate';
    });
    const workspaceTabs = computed(() => ({
      create: [
        { key: 'studio', icon: '✦', label: 'AlexIA' },
        { key: 'editor', icon: '▣', label: 'Editor visual' },
        { key: 'artifacts', icon: '◇', label: 'Versiones', count: artifacts.value.length },
      ],
      configure: [
        { key: 'editions', icon: '◷', label: 'Fechas', count: selected.value?.editions?.length || 0 },
        { key: 'commerce', icon: '◆', label: 'Oferta y pagos', count: offers.value.length },
        { key: 'automation', icon: '↻', label: 'Automatizaciones', count: automationRules.value.filter((rule) => Number(rule.active) === 1).length },
      ],
      operate: [
        { key: 'publish', icon: '✓', label: 'Publicar' },
        { key: 'participants', icon: '◎', label: 'Participantes', count: enrollments.value.length },
      ],
    }[workspaceGroup.value]));
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
        { key: 'publish', number: 5, label: 'Publicar', desc: 'Comprobar y abrir registros', done: Boolean(selected.value.current_release), action: 'publish' }
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
      wizardStep.value = Math.min(3, wizardStep.value + 1);
    }
    function previousWizard() { wizardStep.value = Math.max(1, wizardStep.value - 1); }
    function goJourney(step) {
      tab.value = step.action;
      document.querySelector('.event-admin__workspace')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    function openWorkspace(group) {
      tab.value = ({ create: 'studio', configure: 'editions', operate: 'publish' })[group] || 'studio';
    }
    function goToCheck(check) {
      if (!check) return;
      tab.value = check.action || 'publish';
      const firstLanding = check.key === 'landing' && !check.artifact_id;
      if (check.stage) {
        stage.value = check.stage;
        if (firstLanding) {
          notice.value = 'Describe la experiencia una sola vez o adjunta un PDF. AlexIA coordinará las once áreas y creará la landing.';
        } else if (check.action === 'artifacts') {
          notice.value = 'La nueva versión ya está lista. Revísala y selecciona “Aprobar y aplicar” para completar el control.';
        } else {
          if (REVIEW_GUIDES[check.stage] && !brief.value.trim()) brief.value = buildReviewBrief(check);
          notice.value = REVIEW_GUIDES[check.stage]
            ? 'AlexIA preparó una guía con las preguntas necesarias. Responde lo que conozcas y ella volverá a evaluar el control.'
            : '';
          }
      }
      const selector = firstLanding
        ? '.event-alexia-start'
        : check.action === 'artifacts'
          ? '.event-artifact-grid'
          : (check.stage ? '.event-studio__composer' : '.event-panel');
      requestAnimationFrame(() => document.querySelector(selector)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
    function openPublication() {
      tab.value = 'publish';
      requestAnimationFrame(() => document.querySelector('.event-publication')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
    function primaryAction() {
      if (readiness.value.can_publish && readiness.value.has_changes) {
        publishExperience();
        return;
      }
      if (selected.value?.current_release && !readiness.value.has_changes) {
        window.open('/eventos/' + encodeURIComponent(publicSlug.value), '_blank', 'noopener');
        return;
      }
      if (nextMissing.value?.key === 'landing') {
        tab.value = 'studio';
        stage.value = 'landing';
        requestAnimationFrame(() => document.querySelector('.event-alexia-start')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
        return;
      }
      openPublication();
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
        editorSource.value = 'draft';
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
        tab.value = 'studio';
        notice.value = 'La experiencia quedó creada. Cuéntale a AlexIA qué quieres lograr o adjunta un PDF; la fecha puede definirse después.';
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
        Object.assign(edition, { name: 'Nueva edición', starts_at: '', ends_at: '', timezone: 'America/Bogota', capacity: 30, registration_open: true, status: 'scheduled' });
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
    function jobStages(job) {
      if (Array.isArray(job?.stages)) return job.stages;
      try {
        const parsed = JSON.parse(job?.stages_json || '[]');
        return Array.isArray(parsed) ? parsed : [];
      } catch (_) { return []; }
    }
    function jobCompletedStages(job) {
      if (Array.isArray(job?.completed_stages)) return job.completed_stages;
      try {
        const parsed = JSON.parse(job?.completed_stages_json || '[]');
        return Array.isArray(parsed) ? parsed : [];
      } catch (_) { return []; }
    }
    async function processOrchestrationJob(job) {
      const stages = jobStages(job);
      const total = stages.length || 11;
      const initial = jobCompletedStages(job).length;
      for (let index = initial; index < total + 1; index += 1) {
        orchestrationStatus.value = `AlexIA está coordinando las áreas · ${Math.min(index + 1, total)}/${total}`;
        const response = await api.processEventRegeneration(activeId.value, job.id);
        const result = response.data || {};
        if (result.failed) throw new Error(result.error || `No fue posible completar ${result.stage || 'una de las áreas'}.`);
        if (result.cancelled) throw new Error('La construcción se canceló porque la experiencia ya no está activa.');
        if (result.completed) return true;
        if (!result.processed) return false;
      }
      return false;
    }
    async function buildCompleteExperience(input = globalBrief.value) {
      const instructions = String(input || '').trim();
      if (!instructions) {
        error.value = 'Cuéntale a AlexIA qué quieres construir o adjunta un PDF.';
        return;
      }
      orchestrationBusy.value = true;
      busy.value = true;
      error.value = '';
      notice.value = '';
      orchestrationStatus.value = 'AlexIA está organizando el contexto de toda la experiencia…';
      try {
        const queued = await api.regenerateEvent(activeId.value, {
          scope: 'complete',
          brief: instructions,
        });
        const job = queued.data || {};
        const completed = await processOrchestrationJob(job);
        if (!completed) {
          throw new Error('La construcción quedó en pausa. Puedes reanudarla desde el indicador de progreso.');
        }
        globalBrief.value = '';
        await open(activeId.value);
        tab.value = selected.value?.landing ? 'editor' : 'studio';
        notice.value = 'AlexIA construyó una primera versión coordinando las once áreas. Ya puedes verla, publicar la landing o ajustar solamente el área que necesites.';
      } catch (e) {
        await open(activeId.value);
        tab.value = 'studio';
        error.value = e.message;
      } finally {
        orchestrationStatus.value = '';
        orchestrationBusy.value = false;
        busy.value = false;
      }
    }
    async function continueRegeneration(job) {
      orchestrationBusy.value = true;
      busy.value = true;
      error.value = '';
      notice.value = '';
      try {
        const completed = await processOrchestrationJob(job);
        await open(activeId.value);
        tab.value = completed && selected.value?.landing ? 'editor' : 'studio';
        notice.value = completed
          ? 'AlexIA completó las once áreas. Ya puedes revisar la landing o publicarla.'
          : 'La construcción sigue guardada y podrá continuar desde este mismo punto.';
      } catch (e) {
        await open(activeId.value);
        tab.value = 'studio';
        error.value = e.message;
      } finally {
        orchestrationStatus.value = '';
        orchestrationBusy.value = false;
        busy.value = false;
      }
    }
    async function review(artifact, decision) {
      busy.value = true;
      error.value = '';
      try {
        await api.reviewEventArtifact(activeId.value, artifact.id, { decision });
        await open(activeId.value);
        notice.value = decision === 'applied'
          ? 'Entregable aprobado para el próximo release. La versión pública permanece intacta hasta “Publicar cambios”.'
          : 'Entregable descartado. Puedes pedir una nueva versión a AlexIA.';
      } catch (e) { error.value = e.message; }
      finally { busy.value = false; }
    }
    async function publishExperience() {
      if (!readiness.value.can_publish) {
        openPublication();
        notice.value = 'Falta únicamente un requisito técnico. Te llevamos al punto exacto para resolverlo.';
        return;
      }
      busy.value = true;
      error.value = '';
      try {
        if (!readiness.value.has_changes) {
          notice.value = 'La versión pública ya coincide con todo lo aprobado.';
          return;
        }
        const action = readiness.value.publication_action;
        const result = await api.publishEvent(activeId.value, { notes: releaseNotes.value });
        await load();
        releaseNotes.value = '';
        notice.value = `${action === 'republish' ? 'Cambios publicados' : 'Experiencia lanzada'} como release v${result.data.version} en ${result.data.url}`;
      } catch (e) {
        if (e.status === 409) {
          await open(activeId.value);
          error.value = e.message || 'No fue posible crear el release. Revisa el requisito señalado.';
        } else error.value = e.message;
      } finally { busy.value = false; }
    }
    function payload(artifact) {
      try { return JSON.parse(artifact.content_json || '{}'); } catch (_) { return {}; }
    }
    function artifactNeedsResolution(artifact) {
      const content = payload(artifact);
      return artifact?.type === 'landing'
        && !['2.0', '3.0'].includes(content.payload?.schema_version);
    }
    function artifactCanApply(artifact) {
      if (artifact?.type !== 'landing') return true;
      const content = payload(artifact);
      return ['2.0', '3.0'].includes(content.payload?.schema_version);
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
      if (editorSource.value === 'published') return;
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
    function setEditorSource(source) {
      if (source === 'published' && !selected.value?.published_landing) return;
      editorSource.value = source;
      refreshEditor();
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
        const missing = result.data?.missing_decisions?.length || 0;
        await buildCompleteExperience(
          `Construye una primera versión completa usando como fuente principal el PDF “${file.name}”. `
          + 'Coordina las once áreas, conserva únicamente hechos verificables del documento y deja como recomendaciones las decisiones que aún no estén confirmadas.'
          + (missing ? ` El análisis inicial encontró ${missing} decisiones pendientes; no las inventes.` : '')
        );
      } catch (e) { error.value = e.message; }
      finally { sourceBusy.value = false; }
    }

    function openAction(mode) {
      actionDialog.value = mode;
      error.value = '';
      if (mode === 'delete') Object.assign(deletion, {
        step: 'impact', code: '', email_hint: '', expires_at: ''
      });
      if (mode === 'regenerate') Object.assign(regeneration, { scope: 'complete', brief: '' });
    }
    function closeAction() { actionDialog.value = null; }
    async function duplicateExperience() {
      busy.value = true;
      try {
        const title = String(document.getElementById('event-duplicate-title')?.value || '').trim();
        const result = await api.duplicateEvent(activeId.value, title ? { title } : {});
        closeAction();
        await load();
        await open(result.data.id);
        notice.value = 'Experiencia duplicada como borrador independiente; nada fue publicado.';
      } catch (e) { error.value = e.message; }
      finally { busy.value = false; }
    }
    async function archiveExperience() {
      if (!window.confirm(`¿Archivar “${selected.value.title}”? Se cerrarán sus inscripciones, pero se conservará toda la trazabilidad.`)) return;
      busy.value = true;
      try {
        await api.archiveEvent(activeId.value);
        await load();
        notice.value = 'Experiencia archivada; puedes restaurarla después.';
      } catch (e) { error.value = e.message; }
      finally { busy.value = false; }
    }
    async function restoreExperience() {
      busy.value = true;
      try {
        await api.restoreEvent(activeId.value);
        await load();
        notice.value = 'Experiencia restaurada.';
      } catch (e) { error.value = e.message; }
      finally { busy.value = false; }
    }
    async function sendDeletionCode() {
      busy.value = true;
      try {
        const result = await api.requestEventDeletion(activeId.value);
        Object.assign(deletion, {
          step: 'verify',
          email_hint: result.data.email_hint || '',
          expires_at: result.data.expires_at || '',
          code: ''
        });
        requestAnimationFrame(() => document.querySelector('.event-otp-input')?.focus());
      } catch (e) { error.value = e.message; }
      finally { busy.value = false; }
    }
    async function confirmDeletion() {
      busy.value = true;
      try {
        await api.confirmEventDeletion(activeId.value, { code: deletion.code.replace(/\D/g, '') });
        closeAction();
        await load();
        notice.value = 'Experiencia enviada a la papelera. Podrá recuperarse durante 30 días.';
      } catch (e) { error.value = e.message; }
      finally { busy.value = false; }
    }
    async function regenerateExperience() {
      const request = { ...regeneration };
      closeAction();
      if (request.scope === 'complete') {
        await buildCompleteExperience(request.brief || 'Revisa toda la experiencia actual y genera una versión integral, coherente y mejorada sin inventar datos.');
        return;
      }
      busy.value = true;
      try {
        await api.regenerateEvent(activeId.value, request);
        await open(activeId.value);
        tab.value = 'studio';
        notice.value = 'Regeneración programada. AlexIA creará nuevos borradores por etapas sin tocar el release público.';
      } catch (e) { error.value = e.message; }
      finally { busy.value = false; }
    }
    async function retryRegeneration(job) {
      orchestrationBusy.value = true;
      busy.value = true;
      error.value = '';
      try {
        const response = await api.retryEventRegeneration(activeId.value, job.id);
        const completed = await processOrchestrationJob(response.data || job);
        await open(activeId.value);
        tab.value = completed && selected.value?.landing ? 'editor' : 'studio';
        notice.value = completed ? 'AlexIA completó la experiencia.' : 'Regeneración reanudada desde la etapa fallida.';
      } catch (e) { error.value = e.message; }
      finally {
        orchestrationStatus.value = '';
        orchestrationBusy.value = false;
        busy.value = false;
      }
    }
    async function rollbackRelease(release) {
      if (!window.confirm(`¿Restaurar el contenido del release v${release.version}? Se publicará como un release nuevo y el actual quedará en el historial.`)) return;
      busy.value = true;
      try {
        const result = await api.rollbackEvent(activeId.value, release.id, { notes: `Rollback administrativo a v${release.version}` });
        await open(activeId.value);
        tab.value = 'publish';
        notice.value = `Release v${result.data.version} publicado a partir de v${release.version}.`;
      } catch (e) { error.value = e.message; }
      finally { busy.value = false; }
    }
    function editEdition(item) {
      editingEditionId.value = item.id;
      Object.assign(edition, {
        name: item.name,
        starts_at: dateTimeLocalValue(item.starts_at),
        ends_at: dateTimeLocalValue(item.ends_at),
        timezone: item.timezone || 'America/Bogota',
        capacity: Number(item.capacity || 0),
        registration_open: Number(item.registration_open) === 1,
        status: item.status || 'scheduled'
      });
      showEditionForm.value = true;
    }
    function cancelEditionEdit() {
      editingEditionId.value = null;
      Object.assign(edition, { name: 'Nueva edición', starts_at: '', ends_at: '', timezone: 'America/Bogota', capacity: 30, registration_open: true, status: 'scheduled' });
      showEditionForm.value = false;
    }
    async function saveEdition() {
      if (!editingEditionId.value) return addEdition();
      busy.value = true;
      try {
        await api.updateEventEdition(activeId.value, editingEditionId.value, { ...edition });
        await open(activeId.value);
        cancelEditionEdit();
        tab.value = 'editions';
        notice.value = 'Edición actualizada. El QA quedó pendiente antes de publicar cambios.';
      } catch (e) { error.value = e.message; }
      finally { busy.value = false; }
    }
    async function duplicateEdition(item) {
      busy.value = true;
      try {
        await api.duplicateEventEdition(activeId.value, item.id);
        await open(activeId.value);
        tab.value = 'editions';
        notice.value = 'Edición duplicada con fechas por definir e inscripciones cerradas.';
      } catch (e) { error.value = e.message; }
      finally { busy.value = false; }
    }
    async function archiveEdition(item) {
      if (!window.confirm(`¿Archivar la edición “${item.name}”? Participantes y pagos se conservarán.`)) return;
      busy.value = true;
      try {
        await api.archiveEventEdition(activeId.value, item.id);
        await open(activeId.value);
        tab.value = 'editions';
        notice.value = 'Edición archivada.';
      } catch (e) { error.value = e.message; }
      finally { busy.value = false; }
    }
    async function saveAutomation(rule) {
      busy.value = true;
      try {
        await api.updateEventAutomation(activeId.value, rule.id, {
          trigger_key: rule.trigger_key,
          template_key: rule.template_key,
          channel: rule.channel,
          delay_minutes: Number(rule.delay_minutes || 0),
          relationship_type: rule.relationship_type || '',
          target_url: rule.target_url || '',
          target_label: rule.target_label || '',
          config: rule.config || {},
          active: Boolean(Number(rule.active))
        });
        await open(activeId.value);
        tab.value = 'automation';
        notice.value = 'Automatización guardada.';
      } catch (e) { error.value = e.message; }
      finally { busy.value = false; }
    }
    function statusLabel(value) {
      return ({ published: 'Publicada', draft: 'En construcción', archived: 'Archivada', pending_deletion: 'En papelera', purged: 'Eliminada' }[value] || value);
    }
    function triggerLabel(value) {
      return ({
        registration_completed: 'Registro completado',
        payment_pending: 'Pago pendiente',
        payment_confirmed: 'Pago confirmado',
        event_reminder_24h: 'Recordatorio 24 horas',
        event_reminder_2h: 'Recordatorio 2 horas',
        event_followup: 'Seguimiento posterior',
        upsell_offer: 'Upselling',
        renewal_offer: 'Renovación',
        referral_request: 'Referidos'
      }[value] || value);
    }
    function regenerationProgress(job) {
      return `${jobCompletedStages(job).length}/${jobStages(job).length}`;
    }

    onMounted(() => {
      window.addEventListener('message', onEditorMessage);
      load();
    });
    onUnmounted(() => window.removeEventListener('message', onEditorMessage));
    return {
      FORMATS, items, selected, activeId, loading, busy, error, notice, tab, stage, brief, globalBrief, orchestrationBusy, orchestrationStatus, creating, wizardStep, help,
      form, edition, offer, offers, paymentGateways, automationRules, releases, canDelete, publicSlug, landingPayload, pipeline, requiredStages, recommendedStages, artifacts, enrollments, journey, progress, coverage,
      readiness, nextMissing, workspaceGroup, workspaceTabs, currentFormat, currentStage, currentBlockingCheck, currentReviewGuide, appliedTypes, showEditionForm,
      editorSelection, editorValue, editorInstruction, editorKey, editorBusy, previewMode, sourceBusy, editorUrl, editorSource, editingOfferId, editingEditionId,
      actionDialog, releaseNotes, deletion, regeneration,
      slugify, fieldId, openHelp, closeHelp, applyHelpExample, startCreate, cancelCreate, nextWizard, previousWizard,
      modelLabel, modelIcon, goJourney, goToCheck, openWorkspace, openPublication, primaryAction, stageStatus, stageHelp, buildReviewBrief, useReviewTemplate, open, create, addEdition, runAgent, buildCompleteExperience, continueRegeneration, review, publishExperience, payload, artifactNeedsResolution, artifactCanApply, resolveArtifact, formatDate, formatMoney,
      refreshEditor, setEditorSource, saveEditor, uploadEditorMedia, dropEditorMedia, generateEditorImage, setLandingValue, mediaAccept, resetOffer, editOffer, saveOffer, archiveOffer, uploadSource,
      openAction, closeAction, duplicateExperience, archiveExperience, restoreExperience, sendDeletionCode, confirmDeletion,
      regenerateExperience, retryRegeneration, rollbackRelease, editEdition, cancelEditionEdit, saveEdition, duplicateEdition, archiveEdition,
      saveAutomation, statusLabel, triggerLabel, regenerationProgress, dateTimeLocalValue, fixedCountdownValue
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
        <button v-if="selected" class="btn" :class="readiness.can_publish && readiness.has_changes ? 'btn--primary' : 'btn--ghost'" :disabled="busy" @click="primaryAction">
          {{ selected.current_release ? (readiness.has_changes ? 'Publicar cambios' : 'Ver landing pública') : readiness.can_publish ? 'Publicar landing' : 'Crear landing' }}
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
              <span class="event-admin__item-copy"><strong>{{ item.title }}</strong><small>{{ statusLabel(item.status) }} · {{ item.enrollments_count || 0 }} participantes · {{ item.releases_count || 0 }} releases</small></span>
              <span class="event-admin__item-arrow">›</span>
            </button>
            <div v-if="!items.length" class="event-admin__rail-empty"><span>◇</span><p>Tu primera experiencia aparecerá aquí.</p></div>
          </div>

          <div class="event-admin__roadmap-mini">
            <strong>Ruta recomendada</strong>
            <ol><li>Crear la idea</li><li>Construir con AlexIA</li><li>Ver en el editor</li><li>Publicar e iterar</li></ol>
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
                <header><div><span>Paso 2 · opcional</span><h3>Define la transformación si ya la tienes clara</h3><p>Puedes dejar estos campos vacíos y contárselo todo a AlexIA en un solo brief o PDF.</p></div></header>
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
                  <div class="event-review__hero"><span>{{ currentFormat?.icon }}</span><div><small>{{ currentFormat?.label }}</small><h3>{{ form.title }}</h3><p>{{ form.summary || 'AlexIA construirá la promesa a partir de tu brief.' }}</p></div></div>
                  <dl><div><dt>Audiencia</dt><dd>{{ form.audience || 'AlexIA la propondrá a partir del brief.' }}</dd></div><div><dt>Enlace previsto</dt><dd>tonnydager.com/eventos/{{ form.slug }}</dd></div><div><dt>Siguiente paso</dt><dd>Contarle a AlexIA qué quieres lograr o adjuntar un PDF para coordinar las once áreas.</dd></div></dl>
                </div>
                <div class="event-create__assurance"><span>🔒</span><div><strong>Nada se publicará todavía</strong><p>La experiencia se guardará como borrador. Tú decides cuándo publicar y qué áreas opcionales quieres mejorar.</p></div></div>
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
                <div class="event-overview__meta"><span>{{ statusLabel(selected.status) }}</span><span>/eventos/{{ selected.current_release ? publicSlug : selected.slug }}</span><a v-if="selected.current_release && selected.status==='published'" :href="'/eventos/' + publicSlug" target="_blank" rel="noopener">Ver landing ↗</a></div>
                <div class="event-overview__actions">
                  <button class="btn btn--ghost btn--sm" :disabled="busy || selected.status==='purged'" @click="openAction('duplicate')">Duplicar</button>
                  <button class="btn btn--ghost btn--sm" :disabled="busy || selected.deleted_at || selected.archived_at || selected.status==='purged'" @click="openAction('regenerate')">✦ Regenerar</button>
                  <button v-if="selected.archived_at || selected.deleted_at" class="btn btn--ghost btn--sm" :disabled="busy || selected.status==='purged'" @click="restoreExperience">Restaurar</button>
                  <button v-else class="btn btn--ghost btn--sm" :disabled="busy" @click="archiveExperience">Archivar</button>
                  <button v-if="canDelete && !selected.deleted_at && selected.status!=='purged'" class="event-text-action is-danger" :disabled="busy" @click="openAction('delete')">Enviar a papelera</button>
                </div>
              </div>
              <div class="event-overview__score"><div class="event-progress-ring" :style="{ '--progress': progress + '%' }"><strong>{{ progress }}%</strong></div><span>Preparación para publicar</span></div>
            </section>

            <section class="event-journey">
              <header>
                <div><span>Siguiente acción</span><h3>{{ nextMissing ? nextMissing.label : readiness.has_changes ? 'Tu borrador puede publicarse ahora' : 'La versión pública está al día' }}</h3><p>{{ nextMissing ? nextMissing.detail : readiness.has_changes ? 'Las recomendaciones restantes no bloquean esta iteración.' : 'Puedes seguir mejorando cualquier área cuando lo necesites.' }}</p></div>
                <div class="event-journey__actions">
                  <button v-if="nextMissing" class="event-next-action" @click="goToCheck(nextMissing)">Resolver requisito →</button>
                  <button v-else-if="readiness.has_changes" class="btn btn--primary btn--sm" :disabled="busy" @click="publishExperience">{{ busy ? 'Publicando…' : selected.current_release ? 'Publicar cambios' : 'Publicar landing' }}</button>
                  <button v-if="selected.landing" class="btn btn--ghost btn--sm" @click="tab='editor'">Abrir editor</button>
                  <button class="event-help-trigger" @click="openHelp('journey')" aria-label="Ayuda sobre la ruta">?</button>
                </div>
              </header>
            </section>

            <nav class="event-workspaces" aria-label="Flujo principal">
              <button :class="{active:workspaceGroup==='create'}" @click="openWorkspace('create')"><span>1</span><div><strong>Crear con AlexIA</strong><small>Idea, contenido y landing</small></div></button>
              <button :class="{active:workspaceGroup==='configure'}" @click="openWorkspace('configure')"><span>2</span><div><strong>Configurar</strong><small>Fechas, oferta y mensajes</small></div></button>
              <button :class="{active:workspaceGroup==='operate'}" @click="openWorkspace('operate')"><span>3</span><div><strong>Publicar y operar</strong><small>Release y participantes</small></div></button>
            </nav>
            <nav class="event-tabs event-tabs--secondary" aria-label="Opciones de esta etapa">
              <button v-for="item in workspaceTabs" :key="item.key" :class="{active:tab===item.key}" @click="tab=item.key"><span>{{ item.icon }}</span>{{ item.label }}<b v-if="item.count != null">{{ item.count }}</b></button>
            </nav>

            <section v-if="tab==='editor'" class="event-panel event-visual-editor">
              <header class="event-panel__head">
                <div><span class="event-panel__kicker">Borrador interactivo</span><h3>Edita la landing sobre la landing</h3><p>Haz clic en un texto, imagen, video o audio. Corrige directamente, pídele el ajuste a AlexIA o reemplaza el archivo sin salir de esta pantalla.</p></div>
                <div class="event-editor-toolbar">
                  <div class="event-editor-source">
                    <button :class="{active:editorSource==='draft'}" @click="setEditorSource('draft')">Borrador {{ selected.landing ? 'v'+selected.landing.version : '' }}</button>
                    <button v-if="selected.published_landing" :class="{active:editorSource==='published'}" @click="setEditorSource('published')">Publicada {{ selected.current_release ? 'release v'+selected.current_release.version : '' }}</button>
                  </div>
                  <div class="event-editor-devices"><button :class="{active:previewMode==='desktop'}" title="Escritorio" aria-label="Vista de escritorio" @click="previewMode='desktop'">▱</button><button :class="{active:previewMode==='tablet'}" title="Tablet" aria-label="Vista de tablet" @click="previewMode='tablet'">▯</button><button :class="{active:previewMode==='mobile'}" title="Móvil" aria-label="Vista móvil" @click="previewMode='mobile'">▯</button></div><button class="btn btn--ghost btn--sm" :disabled="editorBusy || !selected.landing" @click="refreshEditor">Actualizar vista</button><button v-if="editorSource==='draft' && readiness.can_publish && readiness.has_changes" class="btn btn--primary btn--sm" :disabled="busy || editorBusy" @click="publishExperience">{{ busy ? 'Publicando…' : selected.current_release ? 'Publicar cambios' : 'Publicar ahora' }}</button>
                </div>
              </header>
              <div class="event-scope-note" :class="{'is-public':editorSource==='published'}"><span>{{ editorSource==='published' ? '●' : '◌' }}</span><div><strong>{{ editorSource==='published' ? 'Estás viendo exactamente el release público' : 'Estás editando el próximo borrador' }}</strong><p>{{ editorSource==='published' ? 'Esta vista es de solo lectura. Cambia a Borrador para editar sin afectar producción.' : 'Guarda los cambios y publícalos desde esta misma pantalla cuando quieras ver la siguiente iteración.' }}</p></div></div>
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
                  <label :title="selected.commercial_channels?.whatsapp?.ready ? 'Activa el acceso público a la AlexIA comercial.' : 'Primero configura y verifica el número público en Conectores.'">
                    <span>WhatsApp AlexIA</span>
                    <input
                      type="checkbox"
                      :disabled="!selected.commercial_channels?.whatsapp?.ready"
                      :checked="landingPayload.conversion?.assistant_whatsapp?.enabled"
                      @change="setLandingValue('conversion.assistant_whatsapp.enabled',$event.target.checked,'Botón de WhatsApp de AlexIA')"
                    />
                  </label>
                  <p v-if="!selected.commercial_channels?.whatsapp?.ready" class="event-editor-config__notice">Configura el número público de WhatsApp en Conectores para habilitar este botón.</p>
                  <label v-if="landingPayload.conversion?.assistant_whatsapp?.enabled" class="event-editor-config__wide">Mensaje inicial para AlexIA
                    <input
                      type="text"
                      maxlength="500"
                      :value="landingPayload.conversion?.assistant_whatsapp?.message || ''"
                      :placeholder="'Hola AlexIA, quiero información sobre ' + selected.title + '.'"
                      @change="setLandingValue('conversion.assistant_whatsapp.message',$event.target.value,'Mensaje inicial de WhatsApp')"
                    />
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
                      <div class="event-editor-browser"><span></span><span></span><span></span><strong>/eventos/{{ editorSource==='published' ? publicSlug : selected.slug }}</strong><em>{{ previewMode === 'desktop' ? 'Escritorio' : previewMode === 'tablet' ? 'Tablet' : 'Móvil' }}</em></div>
                      <iframe :key="editorKey" :src="editorUrl" :title="'Editor de ' + selected.title"></iframe>
                    </div>
                  </div>
                  <aside class="event-editor-inspector">
                    <div v-if="editorSource==='published'" class="event-editor-empty"><span>🔒</span><strong>Release público de solo lectura</strong><p>Úsalo para comparar. Ningún clic ni instrucción puede modificarlo.</p><button class="btn btn--ghost btn--sm" @click="setEditorSource('draft')">Volver al borrador</button></div>
                    <template v-else-if="editorSelection">
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
                      <p class="event-editor-note">Cada cambio crea o actualiza un borrador. La versión pública solo cambia cuando pulsas “Publicar cambios”.</p>
                    </template>
                    <div v-else class="event-editor-empty"><span>↖</span><strong>Selecciona algo en la página</strong><p>Los elementos editables se resaltan al pasar el cursor. Haz clic para abrir sus controles aquí.</p></div>
                  </aside>
                </div>
              </template>
            </section>

            <section v-if="tab==='studio'" class="event-panel event-studio">
              <header class="event-panel__head">
                <div><span class="event-panel__kicker">Orquestadora central</span><h3>Cuéntale una vez a AlexIA</h3><p>Describe la experiencia completa en tus palabras. AlexIA coordina las once áreas y te entrega una primera versión para revisar, editar o publicar.</p></div>
                <div class="flex"><button class="btn btn--ghost btn--sm" :disabled="busy" @click="openAction('regenerate')">✦ Regenerar arquitectura</button><button class="event-help-trigger event-help-trigger--labeled" @click="openHelp('studio')"><span>?</span> Guía y ejemplo</button></div>
              </header>
              <div class="event-alexia-start">
                <div class="event-alexia-start__copy"><span>✦</span><div><strong>¿Qué quieres crear?</strong><p>Puedes escribir libremente: objetivo, público, modalidad, fecha, oferta y cualquier restricción. No necesitas organizarlo por áreas.</p></div></div>
                <textarea v-model="globalBrief" class="input" rows="6" placeholder="Ej. Quiero un evento presencial sobre marketing para empresarios. Será práctico, durará una jornada y debe terminar con un plan de acción. Todavía no he definido el precio…"></textarea>
                <div class="event-alexia-start__actions">
                  <small>Lo no definido quedará como recomendación; AlexIA no inventará datos.</small>
                  <button class="btn btn--primary" :disabled="orchestrationBusy || !globalBrief.trim()" @click="buildCompleteExperience()">{{ orchestrationBusy ? 'Construyendo…' : 'Construir experiencia completa' }} <b>✦</b></button>
                </div>
                <div v-if="orchestrationStatus" class="event-orchestration-progress"><span></span><strong>{{ orchestrationStatus }}</strong><small>Puedes continuar si una etapa se pausa; el progreso queda guardado.</small></div>
              </div>
              <div v-if="selected.regeneration_jobs?.length" class="event-regeneration-list">
                <article v-for="job in selected.regeneration_jobs.slice(0,3)" :key="job.id">
                  <div><strong>Regeneración {{ job.scope }} · #{{ job.id }}</strong><small>{{ job.status }}{{ job.current_stage ? ' · ' + job.current_stage : '' }}</small></div>
                  <span>{{ regenerationProgress(job) }} etapas</span>
                  <button v-if="job.status==='queued'" class="btn btn--ghost btn--sm" :disabled="orchestrationBusy" @click="continueRegeneration(job)">Continuar ahora</button>
                  <button v-if="job.status==='failed'" class="btn btn--ghost btn--sm" :disabled="orchestrationBusy" @click="retryRegeneration(job)">Reintentar</button>
                </article>
              </div>
              <div class="event-source-intake">
                <div><span>PDF → experiencia completa</span><strong>¿Ya tienes la información en un documento?</strong><p>Adjúntalo una sola vez. AlexIA extrae los hechos y coordina automáticamente las once áreas; lo que falte queda señalado, no inventado.</p></div>
                <label :class="{busy:sourceBusy}"><input type="file" accept="application/pdf,.pdf" :disabled="sourceBusy || orchestrationBusy" @change="uploadSource" /><b>{{ sourceBusy ? 'AlexIA está leyendo y construyendo…' : 'Adjuntar PDF y construir' }}</b><small>Máximo 20 MB · el original queda asociado como fuente factual</small></label>
              </div>
              <details class="event-advanced-work">
                <summary><span>⚙</span><div><strong>Ajustar un área específica</strong><small>Abre esta sección solo cuando quieras ampliar o corregir una de las once áreas.</small></div><b>Ver áreas</b></summary>
              <div class="event-studio__explain">
                <div><strong>Las once áreas son flexibles</strong><p>Trabaja solo las que necesites. La landing básica es el único entregable necesario para crear un release; todo lo demás puede mejorar después.</p></div>
                <div><span>{{ requiredStages.length }}</span><small>esencial</small></div><div><span>{{ recommendedStages.length }}</span><small>opcionales</small></div><div><span>{{ coverage }}%</span><small>cobertura actual</small></div>
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
                  <div class="event-studio__agent"><span>✦</span><div><small>AlexIA coordinará a</small><strong>{{ currentStage?.agent || 'Especialista indicado' }}</strong></div><em :class="{required:currentStage?.required}">{{ currentStage?.required ? 'Landing esencial' : 'Área opcional' }}</em></div>
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
              </details>
            </section>

            <section v-if="tab==='artifacts'" class="event-panel">
              <header class="event-panel__head"><div><span class="event-panel__kicker">Entregables versionados</span><h3>Revisa y aprueba lo que construye AlexIA</h3><p>Aprobar convierte un borrador en candidato del próximo release; la versión pública solo cambia con “Publicar cambios”.</p></div><button class="event-help-trigger event-help-trigger--labeled" @click="openHelp('artifacts')"><span>?</span> ¿Cómo funcionan?</button></header>
              <div class="event-scope-note"><span>◇</span><div><strong>Estos entregables pertenecen a “{{ selected.title }}”</strong><p>Se reutilizan en todas sus fechas o cohortes. Una edición solo representa cuándo ocurre, sus cupos y sus participantes.</p></div></div>
              <div v-if="artifacts.length" class="event-artifact-grid">
                <article v-for="artifact in artifacts" :key="artifact.id" class="event-artifact">
                  <header><div><span>{{ artifact.type }} · versión {{ artifact.version }}</span><h4>{{ artifact.title }}</h4></div><b :class="artifactNeedsResolution(artifact) ? 'is-warning' : 'is-' + artifact.status">{{ artifactNeedsResolution(artifact) ? 'Estructura por actualizar' : artifact.status === 'applied' ? 'Aplicado' : artifact.status === 'superseded' ? 'Versión anterior' : artifact.status === 'rejected' ? 'Rechazado' : 'Borrador' }}</b></header>
                  <p>{{ payload(artifact).summary || 'Sin resumen disponible.' }}</p>
                  <div v-if="payload(artifact).risks?.length" class="event-artifact__review event-artifact__review--risk"><strong>Bloqueos técnicos</strong><ul><li v-for="risk in payload(artifact).risks" :key="risk">{{ risk }}</li></ul></div>
                  <div v-if="payload(artifact).required_inputs?.length" class="event-artifact__review"><strong>Información que AlexIA necesita</strong><ul><li v-for="item in payload(artifact).required_inputs" :key="item">{{ item }}</li></ul></div>
                  <div v-if="payload(artifact).recommendations?.length" class="event-artifact__review event-artifact__review--recommendation"><strong>Mejoras opcionales</strong><ul><li v-for="item in payload(artifact).recommendations.slice(0,8)" :key="item">{{ item }}</li></ul></div>
                  <div v-if="payload(artifact).quality_score != null" class="event-artifact__score"><span>Calidad estructural</span><strong>{{ payload(artifact).quality_score }}/100</strong></div>
                  <div v-if="payload(artifact).commercial_score != null" class="event-artifact__score"><span>Potencial comercial</span><strong>{{ payload(artifact).commercial_score }}/100</strong></div>
                  <details><summary>Ver contenido completo <span>⌄</span></summary><pre>{{ JSON.stringify(payload(artifact).payload, null, 2) }}</pre></details>
                  <footer v-if="artifact.status==='draft'"><button class="btn btn--ghost" @click="review(artifact,'rejected')">Descartar borrador</button><button v-if="artifactCanApply(artifact)" class="btn btn--primary" @click="review(artifact,'applied')">Aprobar para próximo release</button><button v-else class="btn btn--primary" @click="resolveArtifact(artifact)">Resolver con AlexIA</button></footer>
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
                    <article v-for="ed in selected.editions" :key="ed.id" :class="{'is-archived':ed.archived_at}">
                      <span>◷</span><div><strong>{{ ed.name }}</strong><p>{{ formatDate(ed.starts_at) }}</p><small>{{ ed.timezone }} · {{ ed.capacity ? ed.capacity + ' cupos' : 'Sin límite de cupos' }} · {{ ed.status }}</small></div>
                      <b>{{ ed.archived_at ? 'Archivada' : ed.registration_open == 1 ? 'Inscripciones abiertas' : 'Cerradas' }}</b>
                      <footer v-if="!ed.archived_at"><button class="event-text-action" @click="editEdition(ed)">Editar</button><button class="event-text-action" @click="duplicateEdition(ed)">Duplicar</button><button class="event-text-action is-danger" @click="archiveEdition(ed)">Archivar</button></footer>
                    </article>
                  </div>
                  <div v-else class="event-empty-state event-empty-state--compact"><span>◷</span><h4>Aún no has programado una edición</h4><p>Completa el formulario para definir cuándo ocurrirá y cuántas personas podrán registrarse.</p></div>
                  <button v-if="selected.editions?.length && !showEditionForm" class="event-add-edition" @click="showEditionForm=true"><span>＋</span><div><strong>Crear otra edición</strong><small>Úsalo solo para una nueva fecha, ciudad o cohorte</small></div></button>
                </div>
                <form v-if="showEditionForm" class="event-edition-form" @submit.prevent="saveEdition">
                  <div class="event-edition-form__title"><div><span>{{ editingEditionId ? 'Editar edición' : selected.editions?.length ? 'Otra edición' : 'Primera edición' }}</span><strong>Programa una fecha o cohorte</strong></div><button type="button" class="event-help-trigger" @click="openHelp('editions')">?</button></div>
                  <label>Nombre de la edición<input v-model="edition.name" class="input" placeholder="Ej. Cohorte Cartagena · Julio" /></label>
                  <div class="event-edition-form__two"><label>Inicio<input v-model="edition.starts_at" class="input" type="datetime-local" /></label><label>Finalización<input v-model="edition.ends_at" class="input" type="datetime-local" /></label></div>
                  <div class="event-edition-form__two"><label>Zona horaria<select v-model="edition.timezone" class="input"><option>America/Bogota</option><option>America/Mexico_City</option><option>America/New_York</option><option>Europe/Madrid</option></select></label><label>Cupos<input v-model.number="edition.capacity" class="input" type="number" min="0" /></label></div>
                  <label v-if="editingEditionId">Estado<select v-model="edition.status" class="input"><option value="scheduled">Programada</option><option value="open">Abierta</option><option value="closed">Cerrada</option><option value="cancelled">Cancelada</option></select></label>
                  <label class="event-switch"><input v-model="edition.registration_open" type="checkbox" /><span></span><div><strong>Abrir inscripciones</strong><small>Las personas podrán registrarse al publicar.</small></div></label>
                  <div class="event-edition-form__actions"><button v-if="selected.editions?.length" type="button" class="btn btn--ghost" @click="cancelEditionEdit">Cancelar</button><button class="btn btn--primary" :disabled="busy">{{ busy ? 'Guardando…' : editingEditionId ? 'Guardar cambios' : 'Guardar esta edición' }}</button></div>
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
                  <label>Edición o cohorte<select v-model="offer.edition_id" class="input" required><option value="" disabled>Selecciona una edición</option><option v-for="ed in selected.editions.filter(item=>!item.archived_at)" :key="ed.id" :value="ed.id">{{ ed.name }}</option></select></label>
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

            <section v-if="tab==='automation'" class="event-panel event-automation">
              <header class="event-panel__head">
                <div><span class="event-panel__kicker">Seguimiento y valor de vida</span><h3>Automatizaciones del customer journey</h3><p>Configura confirmación, recuperación de pago, recordatorios, postventa, upselling, renovación y referidos. Cada envío queda deduplicado, observable y asociado al Lead y su oportunidad.</p></div>
              </header>
              <div class="event-scope-note"><span>↻</span><div><strong>El cron procesa reglas y cola cada 15 minutos</strong><p>Correo y WhatsApp usan únicamente conectores activos. Los mensajes se omiten cuando el registro ya no cumple la condición, por ejemplo si el pago pendiente ya fue confirmado.</p></div></div>
              <div class="event-automation-grid">
                <article v-for="rule in automationRules" :key="rule.id" :class="{active:Number(rule.active)===1}">
                  <header><div><small>{{ rule.template_key }}</small><strong>{{ triggerLabel(rule.trigger_key) }}</strong></div><label class="event-switch"><input v-model.number="rule.active" type="checkbox" :true-value="1" :false-value="0" /><span></span></label></header>
                  <div class="event-offer-form__two">
                    <label>Canal<select v-model="rule.channel" class="input"><option value="email">Correo</option><option value="whatsapp">WhatsApp</option><option value="admin">Aviso interno</option></select></label>
                    <label>Espera en minutos<input v-model.number="rule.delay_minutes" class="input" type="number" min="0" max="525600" /></label>
                  </div>
                  <template v-if="rule.channel==='whatsapp'">
                    <div class="event-scope-note"><span>WA</span><div><strong>Usa una plantilla aprobada por Meta</strong><p>Las automatizaciones inician conversaciones fuera de la ventana de 24 horas; un mensaje libre sería rechazado por WhatsApp.</p></div></div>
                    <div class="event-offer-form__two">
                      <label>Nombre de plantilla<input v-model="rule.config.whatsapp_template" class="input" placeholder="confirmacion_evento" /></label>
                      <label>Idioma<input v-model="rule.config.whatsapp_language" class="input" placeholder="es_CO" /></label>
                    </div>
                    <label>Variables del cuerpo, en orden<input v-model="rule.config.whatsapp_parameter_keys" class="input" placeholder="lead_name,experience_title,edition_name,when" /><small>Disponibles: lead_name, experience_title, edition_name, when, target_url, target_label.</small></label>
                  </template>
                  <label v-if="['upsell_offer','renewal_offer','referral_request','event_followup'].includes(rule.trigger_key)">URL del siguiente paso<input v-model="rule.target_url" class="input" type="url" placeholder="https://tonnydager.com/…" /></label>
                  <label v-if="['upsell_offer','renewal_offer','referral_request','event_followup'].includes(rule.trigger_key)">Texto del CTA<input v-model="rule.target_label" class="input" placeholder="Continuar mi proceso" /></label>
                  <footer><span>{{ Number(rule.active)===1 ? 'Activa' : 'Inactiva' }}</span><button class="btn btn--ghost btn--sm" :disabled="busy" @click="saveAutomation(rule)">Guardar regla</button></footer>
                </article>
              </div>
            </section>

            <section v-if="tab==='participants'" class="event-panel">
              <header class="event-panel__head"><div><span class="event-panel__kicker">Comunidad y CRM</span><h3>Participantes registrados</h3><p>Las inscripciones también alimentan Leads y Pipeline automáticamente.</p></div><button class="event-help-trigger event-help-trigger--labeled" @click="openHelp('participants')"><span>?</span> ¿Cómo se registran?</button></header>
              <div v-if="enrollments.length" class="table-wrap"><table class="table event-participant-table"><thead><tr><th>Participante</th><th>Contacto</th><th>Edición</th><th>Estado</th><th>Registro</th></tr></thead><tbody><tr v-for="person in enrollments" :key="person.id"><td><strong>{{ person.name }}</strong><small>{{ person.company || 'Empresa sin registrar' }}</small></td><td><span>{{ person.email }}</span><small>{{ person.whatsapp || 'WhatsApp pendiente' }}</small></td><td>{{ person.edition_name }}</td><td><b>{{ person.status }}</b></td><td>{{ formatDate(person.created_at) }}</td></tr></tbody></table></div>
              <div v-else class="event-empty-state"><span>◎</span><h4>Los participantes aparecerán aquí</h4><p>Cuando publiques la landing y alguien complete el formulario, se creará su registro, Lead y oportunidad comercial.</p></div>
            </section>

            <section v-if="tab==='publish'" class="event-panel event-publication">
              <header class="event-panel__head">
                <div><span class="event-panel__kicker">Publicación progresiva</span><h3>{{ readiness.can_publish ? 'Puedes publicar esta versión' : 'Falta un requisito técnico' }}</h3><p>Publica cuando el borrador ya te sirva y sigue iterando después. Las mejoras recomendadas no bloquean el release.</p></div>
                <button class="event-help-trigger event-help-trigger--labeled" @click="openHelp('publish')"><span>?</span> ¿Qué comprueba?</button>
              </header>
              <div class="event-publication__summary" :class="{ready:readiness.can_publish}">
                <div class="event-publication__meter"><div class="event-progress-ring" :style="{ '--progress': readiness.progress + '%' }"><strong>{{ readiness.progress }}%</strong></div></div>
                <div><span>{{ readiness.can_publish ? 'PUBLICACIÓN DISPONIBLE' : 'REQUISITO PENDIENTE' }}</span><h4>{{ readiness.completed }} de {{ readiness.total }} requisitos técnicos listos</h4><p>{{ readiness.can_publish ? 'La página puede abrirse al público ahora; las mejoras opcionales pueden completarse después.' : 'Resuelve únicamente el elemento marcado como requisito técnico.' }}</p></div>
              </div>
              <div class="event-publication__checks">
                <article v-for="check in readiness.checks" :key="check.key" :class="{complete:check.complete,blocked:!check.complete && check.required,recommended:!check.complete && !check.required}">
                  <span>{{ check.complete ? '✓' : check.required ? '!' : '○' }}</span>
                  <div><div class="event-publication__check-title"><strong>{{ check.label }}</strong><b>{{ check.complete ? 'Completado' : check.required ? 'Requiere corrección' : 'Mejora opcional' }}</b><em v-if="check.commercial_score != null">{{ check.commercial_score }}/100 potencial comercial</em><em v-else-if="check.quality_score != null">{{ check.quality_score }}/100 calidad estructural</em></div><p>{{ check.detail }}</p><ul v-if="check.risks?.length"><li v-for="risk in check.risks" :key="risk">{{ risk }}</li></ul><div v-if="check.required_inputs?.length" class="event-publication__needed"><strong>AlexIA puede completar mejor esto si confirmas:</strong><span v-for="item in check.required_inputs" :key="item">{{ item }}</span></div><div v-if="check.recommendations?.length" class="event-publication__recommendations"><span v-for="item in check.recommendations.slice(0,4)" :key="item">{{ item }}</span></div></div>
                  <button v-if="!check.complete" class="btn btn--ghost btn--sm" @click="goToCheck(check)">{{ check.key === 'landing' && !check.artifact_id ? 'Crear con AlexIA' : check.action === 'artifacts' ? 'Revisar y aplicar' : ['landing','security','quality'].includes(check.key) ? 'Resolver con AlexIA' : check.stage ? 'Abrir esta revisión' : 'Completar ahora' }} →</button>
                </article>
              </div>
              <div class="event-publication__final">
                <div><strong>{{ selected.current_release ? readiness.has_changes ? 'Hay cambios del editor listos para publicar' : 'El release público está actualizado' : readiness.can_publish ? 'Primera publicación disponible' : 'Aún no hay una landing publicable' }}</strong><p>{{ selected.current_release ? 'Release v' + selected.current_release.version + ' · /eventos/' + publicSlug : readiness.can_publish ? 'El primer release hará visible la landing; las inscripciones se abrirán cuando configures una edición.' : 'Crea una landing con AlexIA o desde el editor.' }}</p></div>
                <div class="event-publication__release-action">
                  <input v-if="readiness.can_publish && readiness.has_changes" v-model="releaseNotes" class="input" maxlength="500" placeholder="Notas del release (opcional)" />
                  <button class="btn btn--primary" :disabled="busy || !readiness.can_publish || !readiness.has_changes" @click="publishExperience">{{ busy ? 'Publicando…' : readiness.publication_action === 'republish' ? 'Publicar cambios' : 'Publicar landing' }}</button>
                </div>
              </div>
              <div v-if="releases.length" class="event-release-history">
                <header><div><span class="event-panel__kicker">Historial inmutable</span><h4>Releases publicados</h4></div><small>Restaurar crea un release nuevo; nunca reescribe el historial.</small></header>
                <article v-for="release in releases" :key="release.id" :class="{current:selected.current_release?.id===release.id}">
                  <div><strong>Release v{{ release.version }}</strong><small>{{ formatDate(release.published_at) }} · {{ release.status }}<template v-if="release.rollback_of_release_id"> · rollback de #{{ release.rollback_of_release_id }}</template></small><p v-if="release.release_notes">{{ release.release_notes }}</p></div>
                  <b v-if="selected.current_release?.id===release.id">Público actual</b>
                  <button v-else class="btn btn--ghost btn--sm" :disabled="busy" @click="rollbackRelease(release)">Restaurar esta versión</button>
                </article>
              </div>
            </section>
          </template>
        </div>
      </div>
    </template>

    <Modal v-if="actionDialog==='duplicate'" title="Duplicar experiencia" @close="closeAction">
      <div class="event-help-modal">
        <p class="event-help-modal__lead">Se copiarán estructura, ediciones, ofertas, medios y últimos entregables como borradores independientes. No se copiarán participantes, pagos ni releases.</p>
        <label>Nombre de la copia<input id="event-duplicate-title" class="input" :value="selected.title + ' · Copia'" /></label>
      </div>
      <template #foot><button class="btn btn--ghost" @click="closeAction">Cancelar</button><button class="btn btn--primary" :disabled="busy" @click="duplicateExperience">{{ busy ? 'Duplicando…' : 'Crear copia' }}</button></template>
    </Modal>

    <Modal v-if="actionDialog==='regenerate'" title="Regenerar con AlexIA" @close="closeAction">
      <div class="event-help-modal">
        <p class="event-help-modal__lead">AlexIA creará versiones nuevas por etapas. El release público y su URL permanecerán intactos hasta que revises, apruebes y publiques un nuevo release.</p>
        <label>Alcance<select v-model="regeneration.scope" class="input"><option value="landing">Solo landing</option><option value="conversion">Oferta y conversión</option><option value="design_copy">Diseño, imágenes y copy</option><option value="complete">Arquitectura completa</option></select></label>
        <label>Instrucciones y restricciones<textarea v-model="regeneration.brief" class="input" rows="6" placeholder="Qué debe conservar, qué debe mejorar y qué hechos no puede inventar…"></textarea></label>
      </div>
      <template #foot><button class="btn btn--ghost" @click="closeAction">Cancelar</button><button class="btn btn--primary" :disabled="busy" @click="regenerateExperience">{{ busy ? 'Programando…' : 'Programar regeneración' }}</button></template>
    </Modal>

    <Modal v-if="actionDialog==='delete'" title="Eliminar experiencia con verificación" @close="closeAction">
      <div v-if="deletion.step==='impact'" class="event-help-modal">
        <p class="event-help-modal__lead">La experiencia se archivará y permanecerá recuperable durante 30 días. Después se purgará su contenido, pero pagos, órdenes, oportunidades, customer journey y auditoría se conservarán.</p>
        <div class="event-deletion-impact">
          <span><strong>{{ selected.lifecycle_impact?.editions || 0 }}</strong> ediciones</span>
          <span><strong>{{ selected.lifecycle_impact?.participants || 0 }}</strong> participantes</span>
          <span><strong>{{ selected.lifecycle_impact?.approved_payments || 0 }}</strong> pagos aprobados</span>
          <span><strong>{{ selected.lifecycle_impact?.opportunities || 0 }}</strong> oportunidades</span>
          <span><strong>{{ selected.lifecycle_impact?.orders || 0 }}</strong> órdenes</span>
          <span><strong>{{ selected.lifecycle_impact?.releases || 0 }}</strong> releases</span>
        </div>
      </div>
      <div v-else class="event-help-modal">
        <p class="event-help-modal__lead">Enviamos un código de seis dígitos a {{ deletion.email_hint }}. Vence en 10 minutos y permite máximo cinco intentos.</p>
        <label class="event-otp-field"><span>Código de verificación</span><input v-model="deletion.code" class="input event-otp-input" inputmode="numeric" maxlength="6" autocomplete="one-time-code" placeholder="000000" @input="deletion.code=deletion.code.replace(/\D/g,'').slice(0,6)" /></label>
        <small class="event-otp-help">Este código confirma tu identidad. No necesitas volver a escribir el nombre de la experiencia.</small>
      </div>
      <template #foot>
        <button class="btn btn--ghost" @click="closeAction">Cancelar</button>
        <button v-if="deletion.step==='impact'" class="btn btn--primary" :disabled="busy" @click="sendDeletionCode">{{ busy ? 'Enviando…' : 'Enviar código por correo' }}</button>
        <button v-else class="btn btn--primary" :disabled="busy || !/^\d{6}$/.test(deletion.code)" @click="confirmDeletion">{{ busy ? 'Verificando…' : 'Confirmar y enviar a papelera' }}</button>
      </template>
    </Modal>

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
