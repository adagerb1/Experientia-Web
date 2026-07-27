export const EXPERIENCE_MODELS = [
  {
    key: 'lead_event',
    legacy: [],
    icon: '↗',
    label: 'Evento gratuito de captación',
    short: 'Webinar, masterclass o demo que convierte tráfico en registros y registros en asistencia.',
    flow: ['Captar', 'Confirmar', 'Activar', 'Asistir', 'Convertir'],
    defaultPalette: 'editorial',
  },
  {
    key: 'paid_event',
    legacy: ['workshop', 'event'],
    icon: '✦',
    label: 'Taller o evento pago',
    short: 'Experiencia intensiva con oferta, planes, reserva o checkout y preparación previa.',
    flow: ['Persuadir', 'Elegir', 'Reservar', 'Preparar', 'Ejecutar', 'Continuar'],
    defaultPalette: 'midnight',
  },
  {
    key: 'cohort_program',
    legacy: ['course'],
    icon: '▤',
    label: 'Programa por cohortes',
    short: 'Programa de varias sesiones con hitos, acompañamiento, comunidad y progreso visible.',
    flow: ['Diagnosticar', 'Inscribir', 'Incorporar', 'Avanzar', 'Acompañar', 'Certificar'],
    defaultPalette: 'cobalt',
  },
  {
    key: 'summit',
    legacy: [],
    icon: '◉',
    label: 'Conferencia o summit',
    short: 'Agenda, speakers, venue o transmisión, tipos de entrada, aliados y networking.',
    flow: ['Descubrir', 'Explorar', 'Elegir entrada', 'Asistir', 'Conectar', 'Dar seguimiento'],
    defaultPalette: 'ember',
  },
  {
    key: 'membership',
    legacy: ['community'],
    icon: '◎',
    label: 'Comunidad o membresía',
    short: 'Acceso recurrente a contenido, interacción, acompañamiento y resultados sostenidos.',
    flow: ['Descubrir', 'Unirse', 'Incorporarse', 'Participar', 'Progresar', 'Renovar'],
    defaultPalette: 'forest',
  },
];

const ALLOWED_BLOCKS = new Set([
  'problem',
  'transformation',
  'deliverables',
  'agenda',
  'roadmap',
  'methodology',
  'support',
  'value_stack',
  'cadence',
  'community',
  'audience',
  'facilitator',
  'speakers',
  'venue',
  'proof',
  'offer',
  'faq',
  'closing',
]);

const PALETTES = new Set(['midnight', 'editorial', 'cobalt', 'ember', 'forest']);
const BRANDS = new Set(['tonny', 'experientia', 'cobrand']);
const REGISTRATION_MODES = new Set(['form', 'waitlist', 'application', 'checkout']);
const PAYMENT_MODES = new Set(['free', 'external', 'connector']);
const PAYMENT_PROVIDERS = new Set(['wompi', 'epayco', 'external']);
const URGENCY_MODES = new Set(['none', 'fixed', 'evergreen']);
const SOCIAL_PROOF_MODES = new Set(['aggregate', 'live_presence', 'recent_registrations']);
const PALETTE_COLORS = {
  midnight: ['#38bdf8', '#2dd4bf'],
  editorial: ['#df7c35', '#a45a2b'],
  cobalt: ['#4f8cff', '#66e0ff'],
  ember: ['#ff5a2f', '#ffb02e'],
  forest: ['#36c995', '#9fe870'],
};

function cleanText(value, fallback = '') {
  if (typeof value !== 'string' && typeof value !== 'number') return fallback;
  return String(value)
    .replace(/<[^>]*>/g, ' ')
    .replace(/[*_`]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim() || fallback;
}

function cleanIdentifier(value) {
  if (typeof value !== 'string' && typeof value !== 'number') return '';
  const identifier = String(value).trim().toLowerCase();
  return /^[a-z][a-z0-9_-]{0,63}$/.test(identifier) ? identifier : '';
}

function legacyLead(value, fallback = '') {
  const source = cleanText(value);
  if (!source || source.length > 360 || (source.match(/[✅◆•]/g) || []).length > 3) {
    const replacement = cleanText(fallback);
    return replacement.length > 360 ? `${replacement.slice(0, 357).trim()}…` : replacement;
  }
  return source;
}

function safeUrl(value, fallback = '') {
  if (typeof value !== 'string' && typeof value !== 'number') return fallback;
  const url = String(value).trim();
  if (!url) return fallback;
  if (/[\u0000-\u001f\u007f<>"'`\\]/.test(url)) return fallback;
  if (/^tel:\+?[0-9 ()-]{7,24}$/i.test(url)) return url;
  if (/\s/.test(url)) return fallback;
  if (/^#[a-z][a-z0-9_-]*$/i.test(url)) return url;
  if (/^\/(?!\/)[a-z0-9/_?=&%#.+:@-]*$/i.test(url)) return url;
  if (/^mailto:[a-z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-z0-9.-]+$/i.test(url)) return url;
  if (url.startsWith('https://') && !/[()]/.test(url)) {
    try {
      const parsed = new URL(url);
      if (parsed.protocol === 'https:' && parsed.hostname && !parsed.username && !parsed.password) return parsed.href;
    } catch (_) {}
  }
  return fallback;
}

function safeColor(value, fallback) {
  const color = cleanText(value);
  return /^#[0-9a-f]{6}$/i.test(color) ? color : fallback;
}

function list(value, limit = 12) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => cleanText(item)).filter(Boolean).slice(0, limit);
}

function booleanValue(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

function cards(value, limit = 12) {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    if (typeof item === 'string') return { number: index + 1, title: cleanText(item), text: '' };
    if (!item || typeof item !== 'object') return null;
    return {
      number: cleanText(item.number, String(index + 1)),
      icon: cleanText(item.icon),
      tag: cleanText(item.tag || item.label),
      title: cleanText(item.title || item.name || item.result),
      text: cleanText(item.text || item.description || item.body || item.detail),
      meta: cleanText(item.meta || item.proof || item.output),
    };
  }).filter((item) => item && (item.title || item.text)).slice(0, limit);
}

function timeline(value, limit = 16) {
  if (!Array.isArray(value)) return [];
  return value.map((item, index) => {
    if (typeof item === 'string') return { number: index + 1, title: cleanText(item), text: '', points: [] };
    if (!item || typeof item !== 'object') return null;
    return {
      number: cleanText(item.number, String(index + 1).padStart(2, '0')),
      date: cleanText(item.date),
      time: cleanText(item.time),
      duration: cleanText(item.duration),
      eyebrow: cleanText(item.eyebrow || item.block),
      title: cleanText(item.title || item.name),
      text: cleanText(item.text || item.description || item.objective),
      deliverable: cleanText(item.deliverable || item.output || item.result),
      points: list(item.points || item.items, 8),
    };
  }).filter((item) => item && (item.title || item.text)).slice(0, limit);
}

function faq(value, limit = 14) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (!item || typeof item !== 'object') return null;
    return {
      q: cleanText(item.q || item.question || item.title),
      a: cleanText(item.a || item.answer || item.text),
    };
  }).filter((item) => item && item.q && item.a).slice(0, limit);
}

function people(value, limit = 12) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (!item || typeof item !== 'object') return null;
    return {
      name: cleanText(item.name),
      role: cleanText(item.role || item.title),
      bio: cleanText(item.bio || item.description),
      topic: cleanText(item.topic),
      image_url: safeUrl(item.image_url || item.image),
      credentials: list(item.credentials, 6),
    };
  }).filter((item) => item && item.name).slice(0, limit);
}

function plans(value, fallbackOffers = [], limit = 4) {
  const hasStructuredPlans = Array.isArray(value) && value.length;
  const source = hasStructuredPlans ? value : fallbackOffers;
  if (!Array.isArray(source)) return [];
  const hasVerifiedOffers = Array.isArray(fallbackOffers) && fallbackOffers.length > 0;
  const normalized = source.map((item, sourceIndex) => {
    if (!item || typeof item !== 'object') return null;
    const plan = {
      id: Number(item.id) > 0 ? Number(item.id) : null,
      edition_id: Number(item.edition_id) > 0 ? Number(item.edition_id) : null,
      source_index: hasStructuredPlans ? sourceIndex : null,
      name: cleanText(item.name || item.title, 'Acceso'),
      badge: cleanText(item.badge),
      description: cleanText(item.description),
      price: cleanText(item.price),
      compare_at: cleanText(item.compare_at),
      currency: cleanText(item.currency),
      cadence: cleanText(item.cadence),
      featured: item.featured === true || item.featured === 1 || item.featured === '1',
      features: list(item.features || item.includes, 14),
      checkout_url: safeUrl(item.checkout_url || item.url),
      payment_mode: PAYMENT_MODES.has(item.payment_mode) ? item.payment_mode : '',
      payment_provider: PAYMENT_PROVIDERS.has(item.payment_provider) ? item.payment_provider : '',
      cta_label: cleanText(item.cta_label, 'Elegir este acceso'),
      edition_name: cleanText(item.edition_name),
    };
    if (hasStructuredPlans && hasVerifiedOffers) {
      const verified = fallbackOffers.find((offer) => (
        (plan.id && Number(offer.id) === plan.id)
        || cleanText(offer.name || offer.title).toLowerCase() === plan.name.toLowerCase()
      ));
      if (!verified) return null;
      plan.id = Number(verified.id) > 0 ? Number(verified.id) : plan.id;
      plan.edition_id = Number(verified.edition_id) > 0 ? Number(verified.edition_id) : plan.edition_id;
      plan.price = cleanText(verified.price, plan.price);
      plan.currency = cleanText(verified.currency, plan.currency);
      plan.checkout_url = safeUrl(verified.checkout_url || verified.url, plan.checkout_url);
      plan.payment_mode = PAYMENT_MODES.has(verified.payment_mode) ? verified.payment_mode : plan.payment_mode;
      plan.payment_provider = PAYMENT_PROVIDERS.has(verified.payment_provider) ? verified.payment_provider : plan.payment_provider;
      plan.edition_name = cleanText(verified.edition_name, plan.edition_name);
    }
    return plan;
  }).filter(Boolean).slice(0, limit);
  if (!hasStructuredPlans || !Array.isArray(fallbackOffers)) return normalized;
  for (const offer of fallbackOffers) {
    if (normalized.length >= limit) break;
    const offerId = Number(offer?.id) || null;
    const offerName = cleanText(offer?.name || offer?.title).toLowerCase();
    if (normalized.some((plan) => (offerId && plan.id === offerId) || (offerName && plan.name.toLowerCase() === offerName))) continue;
    const extra = plans([], [offer], 1)[0];
    if (extra) normalized.push(extra);
  }
  return normalized;
}

function testimonials(value, limit = 8) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => {
    if (!item || typeof item !== 'object') return null;
    return {
      quote: cleanText(item.quote || item.text),
      name: cleanText(item.name),
      role: cleanText(item.role),
      image_url: safeUrl(item.image_url || item.image),
      source_url: safeUrl(item.source_url),
    };
  }).filter((item) => item && item.quote && item.name).slice(0, limit);
}

function normalizeBlock(block, index, fallbackOffers) {
  if (!block || typeof block !== 'object' || !ALLOWED_BLOCKS.has(block.type)) return null;
  const type = block.type;
  const normalized = {
    id: `event-${type}-${index + 1}`,
    source_index: index,
    type,
    theme: ['light', 'dark', 'accent', 'soft'].includes(block.theme) ? block.theme : 'light',
    eyebrow: cleanText(block.eyebrow),
    headline: cleanText(block.headline || block.title),
    body: cleanText(block.body || block.description || block.intro),
    items: cards(block.items),
    timeline: timeline(block.sessions || block.steps || block.phases || block.items),
    for_whom: list(block.for_whom || block.for || block.yes, 12),
    not_for: list(block.not_for || block.no, 12),
    metrics: cards(block.metrics, 8),
    testimonials: testimonials(block.testimonials),
    people: people(block.people || block.speakers),
    plans: plans(block.plans, fallbackOffers),
    questions: faq(block.questions || block.items),
    guarantee: cleanText(block.guarantee),
    note: cleanText(block.note || block.disclaimer),
    primary_cta: {
      label: cleanText(block.primary_cta?.label || block.cta_label),
      target: safeUrl(block.primary_cta?.target || block.cta_target),
    },
    media: {
      type: ['image', 'video'].includes(block.media?.type) ? block.media.type : 'image',
      url: safeUrl(block.media?.url || block.image_url),
      alt: cleanText(block.media?.alt || block.image_alt),
    },
    person: null,
    location: null,
  };

  if (block.person && typeof block.person === 'object') {
    normalized.person = {
      name: cleanText(block.person.name, 'Tonny Dager'),
      role: cleanText(block.person.role),
      bio: cleanText(block.person.bio || block.person.description),
      image_url: safeUrl(block.person.image_url || block.person.image),
      credentials: list(block.person.credentials, 8),
    };
  }
  if (block.location && typeof block.location === 'object') {
    normalized.location = {
      name: cleanText(block.location.name),
      address: cleanText(block.location.address),
      city: cleanText(block.location.city),
      detail: cleanText(block.location.detail || block.location.description),
      map_url: safeUrl(block.location.map_url),
      image_url: safeUrl(block.location.image_url),
    };
  }
  return normalized;
}

function formatEditionDate(value, timezone = 'America/Bogota') {
  if (!value) return '';
  try {
    const parsed = new Date(String(value).replace(' ', 'T'));
    return new Intl.DateTimeFormat('es-CO', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      timeZone: timezone,
    }).format(parsed);
  } catch (_) {
    return cleanText(value);
  }
}

export function canonicalExperienceModel(value) {
  const key = cleanIdentifier(value);
  const direct = EXPERIENCE_MODELS.find((model) => model.key === key);
  if (direct) return direct.key;
  const legacy = EXPERIENCE_MODELS.find((model) => model.legacy.includes(key));
  return legacy?.key || 'paid_event';
}

export function experienceModel(value) {
  const key = canonicalExperienceModel(value);
  return EXPERIENCE_MODELS.find((model) => model.key === key) || EXPERIENCE_MODELS[1];
}

function legacyBlocks(experience, model, fallbackOffers) {
  const outcomes = list(experience.outcomes, 8);
  const editions = Array.isArray(experience.editions) ? experience.editions : [];
  const blocks = [
    {
      type: 'problem',
      theme: 'light',
      eyebrow: 'El punto de partida',
      headline: 'No necesitas más información. Necesitas una ruta que puedas ejecutar.',
      body: cleanText(experience.audience),
      items: [],
    },
    {
      type: 'transformation',
      theme: 'soft',
      eyebrow: 'La transformación',
      headline: 'Lo que vas a ser capaz de construir',
      body: cleanText(experience.summary),
      items: (outcomes.length ? outcomes : [
        'Claridad sobre la decisión que debes tomar.',
        'Un sistema práctico para pasar de intención a ejecución.',
        'Un plan de acción aplicable desde el siguiente día.',
      ]).map((title) => ({ title })),
    },
  ];
  if (editions.length) {
    blocks.push({
      type: model.key === 'cohort_program' ? 'roadmap' : 'agenda',
      theme: 'dark',
      eyebrow: model.key === 'cohort_program' ? 'Próximas cohortes' : 'Fechas disponibles',
      headline: model.key === 'cohort_program' ? 'Elige la cohorte en la que quieres avanzar' : 'Elige cuándo vivir esta experiencia',
      sessions: editions.map((edition) => ({
        title: cleanText(edition.name, 'Próxima edición'),
        date: formatEditionDate(edition.starts_at, edition.timezone),
        deliverable: Number(edition.capacity) > 0 ? `${edition.capacity} cupos` : 'Cupos abiertos',
      })),
    });
  }
  blocks.push(
    {
      type: 'audience',
      theme: 'light',
      eyebrow: 'Decisión honesta',
      headline: 'Esta experiencia es para ti si buscas aplicar, no solo escuchar',
      body: cleanText(experience.audience),
      for_whom: ['Quieres convertir una necesidad real en decisiones concretas.', 'Estás dispuesto a trabajar sobre tu propio caso.', 'Valoras una metodología práctica y acompañada.'],
      not_for: ['Buscas fórmulas mágicas o resultados sin ejecución.', 'Solo quieres acumular teoría.', 'No tienes disponibilidad para aplicar lo construido.'],
    },
    {
      type: 'facilitator',
      theme: 'soft',
      eyebrow: 'Quién guía la experiencia',
      headline: 'Estrategia de negocio conectada con ejecución real',
      person: {
        name: 'Tonny Dager',
        role: 'Founder & CEO de ExperientIA S.A.S.',
        bio: 'Ingeniero de sistemas, consultor, mentor y speaker con experiencia en estrategia, inteligencia artificial, automatización, datos, marketing y crecimiento empresarial.',
        image_url: '',
        credentials: ['18+ años acompañando empresas', '200+ clientes', 'Experiencia en 10 países'],
      },
    },
  );
  if (fallbackOffers.length) {
    blocks.push({
      type: 'offer',
      theme: 'dark',
      eyebrow: 'Elige tu acceso',
      headline: 'Reserva la opción que mejor se ajusta a tu momento',
      plans: fallbackOffers,
    });
  }
  blocks.push(
    {
      type: 'faq',
      theme: 'light',
      eyebrow: 'Antes de decidir',
      headline: 'Respuestas claras a las preguntas más frecuentes',
      questions: [
        { q: '¿Necesito experiencia previa?', a: 'No. La experiencia parte de tu contexto y te guía para convertirlo en decisiones y acciones concretas.' },
        { q: '¿Qué debo llevar o preparar?', a: 'Recibirás las indicaciones operativas después de registrarte. Llega con un caso real sobre el cual quieras trabajar.' },
        { q: '¿Cómo recibiré la confirmación?', a: 'Después del registro recibirás la información de la experiencia por los canales que hayas autorizado.' },
        { q: '¿Puedo participar desde otro país?', a: 'Revisa la modalidad y la zona horaria de la edición antes de reservar tu lugar.' },
      ],
    },
    {
      type: 'closing',
      theme: 'accent',
      eyebrow: 'Tu siguiente decisión',
      headline: 'La claridad no llega acumulando ideas. Llega cuando construyes una ruta y empiezas a ejecutarla.',
      body: 'Reserva tu lugar y recibe las indicaciones para comenzar.',
      primary_cta: { label: 'Quiero vivir esta experiencia', target: '#event-register' },
    },
  );
  return blocks;
}

export function normalizeEventLanding(experience = {}) {
  let artifact = {};
  try {
    artifact = typeof experience.landing?.content_json === 'string'
      ? JSON.parse(experience.landing.content_json)
      : (experience.landing?.content_json || {});
  } catch (_) {
    artifact = {};
  }
  const raw = artifact.payload && typeof artifact.payload === 'object' ? artifact.payload : {};
  const model = experienceModel(raw.experience_model || experience.format);
  const backendOffers = Array.isArray(experience.offers)
    ? experience.offers
    : (experience.offer ? [experience.offer] : []);
  const fallbackOffers = plans([], backendOffers);
  const rawBlocks = Array.isArray(raw.blocks) ? raw.blocks : [];
  const blocks = rawBlocks
    .map((block, index) => normalizeBlock(block, index, fallbackOffers))
    .filter(Boolean);
  const finalBlocks = blocks.length ? blocks : legacyBlocks(experience, model, fallbackOffers)
    .map((block, index) => normalizeBlock(block, index, fallbackOffers))
    .filter(Boolean);
  const firstEdition = Array.isArray(experience.editions) ? experience.editions[0] : null;
  const rawHero = raw.hero && typeof raw.hero === 'object' ? raw.hero : {};
  const rawTheme = raw.theme && typeof raw.theme === 'object' ? raw.theme : {};
  const palette = PALETTES.has(rawTheme.palette) ? rawTheme.palette : model.defaultPalette;
  const paletteColors = PALETTE_COLORS[palette] || PALETTE_COLORS.midnight;
  const brandScope = BRANDS.has(raw.brand?.scope) ? raw.brand.scope : 'cobrand';
  const defaultBrandName = brandScope === 'experientia' ? 'ExperientIA' : brandScope === 'tonny' ? 'Tonny Dager' : 'Tonny Dager × ExperientIA';
  const rawRegistration = raw.registration && typeof raw.registration === 'object' ? raw.registration : {};
  const rawConversion = raw.conversion && typeof raw.conversion === 'object' ? raw.conversion : {};
  const rawVsl = rawConversion.vsl && typeof rawConversion.vsl === 'object' ? rawConversion.vsl : {};
  const rawAudio = rawConversion.audio_invite && typeof rawConversion.audio_invite === 'object' ? rawConversion.audio_invite : {};
  const rawUrgency = rawConversion.urgency && typeof rawConversion.urgency === 'object' ? rawConversion.urgency : {};
  const rawScarcity = rawConversion.scarcity && typeof rawConversion.scarcity === 'object' ? rawConversion.scarcity : {};
  const rawSocialProof = rawConversion.social_proof && typeof rawConversion.social_proof === 'object' ? rawConversion.social_proof : {};
  const rawAssistantWhatsapp = rawConversion.assistant_whatsapp && typeof rawConversion.assistant_whatsapp === 'object' ? rawConversion.assistant_whatsapp : {};
  const blockOffers = finalBlocks.filter((block) => block.type === 'offer').flatMap((block) => block.plans);
  const allOffers = blockOffers.length ? blockOffers : fallbackOffers;
  const firstCheckout = safeUrl(rawRegistration.checkout_url)
    || allOffers.find((offer) => offer.checkout_url)?.checkout_url
    || '';
  const registrationMode = REGISTRATION_MODES.has(rawRegistration.mode)
    ? rawRegistration.mode
    : (firstCheckout ? 'checkout' : model.key === 'lead_event' ? 'form' : 'form');
  const paymentMode = PAYMENT_MODES.has(rawRegistration.payment_mode)
    ? rawRegistration.payment_mode
    : (registrationMode === 'checkout' && firstCheckout ? 'external' : registrationMode === 'checkout' ? 'connector' : 'free');
  const paymentProvider = PAYMENT_PROVIDERS.has(rawRegistration.payment_provider)
    ? rawRegistration.payment_provider
    : (paymentMode === 'external' ? 'external' : 'wompi');
  const defaultTarget = '#event-register';
  const requestedPrimaryTarget = safeUrl(rawHero.primary_cta?.target, defaultTarget);
  const primaryCtaTarget = registrationMode === 'checkout' ? '#event-register' : requestedPrimaryTarget;

  const navigation = finalBlocks
    .filter((block) => ['deliverables', 'agenda', 'roadmap', 'facilitator', 'speakers', 'offer', 'faq'].includes(block.type))
    .slice(0, 4)
    .map((block) => ({
      label: block.type === 'offer' ? 'Planes' : block.type === 'faq' ? 'Preguntas' : block.type === 'facilitator' ? 'Facilitador' : block.type === 'speakers' ? 'Speakers' : block.type === 'agenda' || block.type === 'roadmap' ? 'Programa' : 'Resultados',
      target: `#${block.id}`,
    }));

  const heroFacts = cards(rawHero.facts, 5);
  if (!heroFacts.length && firstEdition) {
    heroFacts.push(
      { title: 'Próxima edición', text: formatEditionDate(firstEdition.starts_at, firstEdition.timezone) || 'Fecha por confirmar' },
      { title: 'Zona horaria', text: cleanText(firstEdition.timezone, 'America/Bogota') },
    );
    if (Number(firstEdition.capacity) > 0) heroFacts.push({ title: 'Cupos', text: String(firstEdition.capacity) });
  }

  const success = rawRegistration.success && typeof rawRegistration.success === 'object' ? rawRegistration.success : {};
  const successSteps = cards(success.steps, 6);
  return {
    schemaVersion: cleanText(raw.schema_version, 'legacy'),
    model: model.key,
    modelSpec: model,
    themeClass: `event-theme--${palette}`,
    themeStyle: {
      '--event-accent': safeColor(rawTheme.accent, paletteColors[0]),
      '--event-accent-2': safeColor(rawTheme.accent_secondary, paletteColors[1]),
    },
    brand: {
      scope: brandScope,
      name: cleanText(raw.brand?.name, defaultBrandName),
      descriptor: cleanText(raw.brand?.descriptor, 'Estrategia que se convierte en experiencia'),
    },
    announcement: cleanText(raw.announcement),
    navigation,
    hero: {
      eyebrow: cleanText(rawHero.eyebrow, model.label),
      headline: cleanText(rawHero.headline || raw.headline, experience.title || 'Una experiencia diseñada para avanzar'),
      subheadline: legacyLead(rawHero.subheadline || raw.subheadline, experience.summary),
      supporting: cleanText(rawHero.supporting || rawHero.microcopy),
      facts: heroFacts,
      primary_cta: {
        label: cleanText(rawHero.primary_cta?.label || rawHero.cta || raw.cta, registrationMode === 'waitlist' ? 'Unirme a la lista' : registrationMode === 'application' ? 'Aplicar ahora' : registrationMode === 'checkout' ? 'Elegir mi acceso' : 'Reservar mi lugar'),
        target: primaryCtaTarget,
      },
      secondary_cta: {
        label: cleanText(rawHero.secondary_cta?.label),
        target: safeUrl(rawHero.secondary_cta?.target),
      },
      media: {
        type: ['image', 'video'].includes(rawHero.media?.type) ? rawHero.media.type : '',
        url: safeUrl(rawHero.media?.url || rawHero.image_url),
        alt: cleanText(rawHero.media?.alt || rawHero.image_alt, experience.title),
      },
      trust: list(rawHero.trust, 6),
    },
    conversion: {
      vsl: {
        enabled: booleanValue(rawVsl.enabled, false),
        headline: cleanText(rawVsl.headline, 'Mira cómo funciona esta experiencia antes de decidir'),
        body: cleanText(rawVsl.body),
        url: safeUrl(rawVsl.url),
        poster_url: safeUrl(rawVsl.poster_url),
        caption: cleanText(rawVsl.caption),
      },
      audio_invite: {
        enabled: booleanValue(rawAudio.enabled, false),
        label: cleanText(rawAudio.label, 'Escucha la invitación de Tonny'),
        url: safeUrl(rawAudio.url),
        transcript: cleanText(rawAudio.transcript),
      },
      urgency: {
        mode: URGENCY_MODES.has(rawUrgency.mode) ? rawUrgency.mode : 'none',
        ends_at: cleanText(rawUrgency.ends_at),
        evergreen_minutes: Math.max(5, Math.min(1440, Number(rawUrgency.evergreen_minutes) || 15)),
        label: cleanText(rawUrgency.label, 'Esta condición termina en'),
        expiry_action: ['message', 'hide_cta'].includes(rawUrgency.expiry_action) ? rawUrgency.expiry_action : 'message',
        expired_message: cleanText(rawUrgency.expired_message, 'Esta condición ya terminó. Revisa la disponibilidad actual.'),
      },
      scarcity: {
        show_remaining_seats: booleanValue(rawScarcity.show_remaining_seats, true),
        show_when_remaining_lte: Math.max(1, Math.min(10000, Number(rawScarcity.show_when_remaining_lte) || 30)),
        low_stock_threshold: Math.max(1, Math.min(1000, Number(rawScarcity.low_stock_threshold) || 10)),
      },
      social_proof: {
        enabled: booleanValue(rawSocialProof.enabled, false),
        mode: SOCIAL_PROOF_MODES.has(rawSocialProof.mode) ? rawSocialProof.mode : 'aggregate',
        display_threshold: Math.max(1, Math.min(10000, Number(rawSocialProof.display_threshold) || 5)),
        label: cleanText(rawSocialProof.label),
      },
      assistant_whatsapp: {
        enabled: booleanValue(rawAssistantWhatsapp.enabled, false),
        label: cleanText(rawAssistantWhatsapp.label, 'Hablar con AlexIA'),
        message: cleanText(
          rawAssistantWhatsapp.message,
          `Hola AlexIA, quiero información sobre ${cleanText(experience.title, 'esta experiencia')}.`
        ),
      },
      sticky_cta: booleanValue(rawConversion.sticky_cta, true),
    },
    blocks: finalBlocks,
    offers: allOffers,
    registration: {
      mode: registrationMode,
      title: cleanText(rawRegistration.title, registrationMode === 'waitlist' ? 'Sé de los primeros en enterarte' : registrationMode === 'application' ? 'Cuéntanos por qué quieres participar' : 'Reserva tu lugar'),
      description: cleanText(rawRegistration.description, 'Completa tus datos y recibe la confirmación con los siguientes pasos.'),
      button_label: cleanText(rawRegistration.button_label, registrationMode === 'waitlist' ? 'Unirme a la lista de espera' : registrationMode === 'application' ? 'Enviar mi aplicación' : 'Confirmar mi inscripción'),
      consent_label: cleanText(rawRegistration.consent_label, 'Autorizo el tratamiento de mis datos para gestionar mi inscripción y recibir información de esta experiencia.'),
      ask_country: true,
      country_required: true,
      ask_company: booleanValue(rawRegistration.ask_company, model.key !== 'lead_event'),
      ask_whatsapp: true,
      whatsapp_required: booleanValue(rawRegistration.whatsapp_required, true),
      application_question: cleanText(rawRegistration.application_question, '¿Qué resultado quieres lograr y por qué esta experiencia es importante para ti?'),
      checkout_url: safeUrl(rawRegistration.checkout_url, firstCheckout),
      payment_mode: paymentMode,
      payment_provider: paymentProvider,
      success: {
        eyebrow: cleanText(success.eyebrow, 'Registro confirmado'),
        headline: cleanText(success.headline, 'Tu lugar quedó reservado'),
        body: cleanText(success.body, 'Ahora completa los siguientes pasos para llegar preparado y aprovechar la experiencia.'),
        steps: successSteps.length ? successSteps : [
          { number: '01', title: 'Revisa tu correo', text: 'Te enviaremos la confirmación y la información operativa.' },
          { number: '02', title: 'Guarda la fecha', text: 'Verifica la zona horaria y reserva el espacio en tu agenda.' },
          { number: '03', title: 'Prepárate para participar', text: 'Ten listo un caso real sobre el que quieras trabajar.' },
        ],
        whatsapp_url: safeUrl(success.whatsapp_url),
        whatsapp_label: cleanText(success.whatsapp_label, 'Continuar por WhatsApp'),
      },
    },
    seo: {
      title: cleanText(raw.seo?.title, `${experience.title || 'Experiencia'} — Tonny Dager`),
      description: cleanText(raw.seo?.description, experience.summary),
      image_url: safeUrl(raw.seo?.image_url || rawHero.media?.url),
    },
  };
}

export function safeEventUrl(value, fallback = '') {
  return safeUrl(value, fallback);
}
