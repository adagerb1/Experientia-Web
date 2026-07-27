import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../../assets/js/api.js?v=20260726-2';
import { track } from '../../assets/js/tracking.js?v=20260726-2';
import { prefill, saveLead, getUtm } from '../../assets/js/leadStore.js';
import { normalizeEventLanding, safeEventUrl } from '../data/eventLanding.js?v=20260726-2';
import { COUNTRIES } from '../data/countries.js';
import Combobox from '../components/Combobox.js';
import PhoneField from '../components/PhoneField.js';

const CARD_BLOCKS = new Set(['problem', 'transformation', 'deliverables', 'methodology', 'support', 'value_stack', 'community']);
const TIMELINE_BLOCKS = new Set(['agenda', 'roadmap', 'cadence']);

function setMeta(selector, attribute, value) {
  if (!value) return;
  let node = document.head.querySelector(selector);
  if (!node) {
    node = document.createElement('meta');
    if (selector.includes('property=')) node.setAttribute('property', selector.match(/property="([^"]+)"/)?.[1] || '');
    else node.setAttribute('name', selector.match(/name="([^"]+)"/)?.[1] || '');
    document.head.appendChild(node);
  }
  node.setAttribute(attribute, value);
}

function setCanonical(value) {
  if (!value) return;
  let node = document.head.querySelector('link[rel="canonical"]');
  if (!node) {
    node = document.createElement('link');
    node.rel = 'canonical';
    document.head.appendChild(node);
  }
  node.href = value;
}

function injectEventSchema(experience, landing) {
  let script = document.getElementById('event-schema');
  if (script?.dataset?.eventSlug === String(experience.slug || '')) return;
  if (!script) {
    script = document.createElement('script');
    script.id = 'event-schema';
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  script.dataset.eventSlug = String(experience.slug || '');
  const edition = experience.editions?.[0];
  const facilitator = landing.blocks?.find((block) => block.type === 'facilitator' && block.person)?.person;
  const speakers = landing.blocks?.find((block) => block.type === 'speakers')?.people || [];
  const venue = landing.blocks?.find((block) => block.type === 'venue')?.location;
  const faq = landing.blocks?.find((block) => block.type === 'faq')?.questions || [];
  const canonical = `${location.origin}/eventos/${encodeURIComponent(experience.slug || '')}`;
  const organization = {
    '@type': 'Organization',
    '@id': `${location.origin}/#experientia`,
    name: 'ExperientIA S.A.S.',
    url: `${location.origin}/experientia`,
  };
  const person = facilitator?.name ? {
    '@type': 'Person',
    name: facilitator.name,
    jobTitle: facilitator.role || undefined,
    description: facilitator.bio || undefined,
    image: facilitator.image_url || undefined,
    ...(facilitator.name === 'Tonny Dager' ? {
      '@id': `${location.origin}/#tonny`,
      url: `${location.origin}/sobre-tonny-dager`,
    } : {}),
  } : null;
  const offers = landing.offers.map((plan) => ({
    '@type': 'Offer',
    name: plan.name,
    description: plan.description || undefined,
    price: Number.isFinite(Number(plan.price)) ? Number(plan.price) : undefined,
    priceCurrency: plan.currency || 'COP',
    url: plan.checkout_url || `${canonical}#event-register`,
    availability: 'https://schema.org/InStock',
    seller: { '@id': `${location.origin}/#experientia` },
  }));
  let entity;
  if (landing.model === 'cohort_program') {
    entity = {
      '@type': 'Course',
      '@id': `${canonical}#experience`,
      name: experience.title,
      description: landing.seo.description,
      url: canonical,
      image: landing.seo.image_url ? [landing.seo.image_url] : undefined,
      provider: { '@id': `${location.origin}/#experientia` },
      instructor: person || undefined,
      offers: offers.length ? offers : undefined,
      hasCourseInstance: edition ? [{
        '@type': 'CourseInstance',
        name: edition.name,
        courseMode: venue?.address ? 'onsite' : 'online',
        startDate: edition.starts_at ? String(edition.starts_at).replace(' ', 'T') : undefined,
        endDate: edition.ends_at ? String(edition.ends_at).replace(' ', 'T') : undefined,
        instructor: person || undefined,
      }] : undefined,
    };
  } else if (landing.model === 'membership') {
    entity = {
      '@type': 'Product',
      '@id': `${canonical}#experience`,
      name: experience.title,
      description: landing.seo.description,
      url: canonical,
      image: landing.seo.image_url ? [landing.seo.image_url] : undefined,
      category: 'Comunidad o membresía profesional',
      brand: { '@id': `${location.origin}/#experientia` },
      offers: offers.length ? offers : undefined,
    };
  } else {
    const performers = [
      ...(person ? [person] : []),
      ...speakers.filter((item) => item?.name).map((item) => ({
        '@type': 'Person',
        name: item.name,
        jobTitle: item.role || undefined,
        description: item.bio || undefined,
        image: item.image_url || undefined,
      })),
    ];
    entity = {
      '@type': landing.model === 'summit' ? 'BusinessEvent' : 'Event',
      '@id': `${canonical}#experience`,
      name: experience.title,
      description: landing.seo.description,
      url: canonical,
      image: landing.seo.image_url ? [landing.seo.image_url] : undefined,
      eventStatus: 'https://schema.org/EventScheduled',
      eventAttendanceMode: venue?.address
        ? 'https://schema.org/OfflineEventAttendanceMode'
        : 'https://schema.org/OnlineEventAttendanceMode',
      organizer: { '@id': `${location.origin}/#experientia` },
      startDate: edition?.starts_at ? String(edition.starts_at).replace(' ', 'T') : undefined,
      endDate: edition?.ends_at ? String(edition.ends_at).replace(' ', 'T') : undefined,
      performer: performers.length ? performers : undefined,
      location: venue?.address ? {
        '@type': 'Place',
        name: venue.name || venue.city,
        address: {
          '@type': 'PostalAddress',
          streetAddress: venue.address,
          addressLocality: venue.city || undefined,
          addressCountry: 'CO',
        },
      } : { '@type': 'VirtualLocation', url: canonical },
      offers: offers.length ? offers : undefined,
      isAccessibleForFree: !offers.some((item) => Number(item.price) > 0),
    };
  }
  const graph = [
    organization,
    {
      '@type': 'WebPage',
      '@id': `${canonical}#webpage`,
      url: canonical,
      name: landing.seo.title,
      description: landing.seo.description,
      inLanguage: 'es-CO',
      breadcrumb: { '@id': `${canonical}#breadcrumb` },
      mainEntity: { '@id': `${canonical}#experience` },
    },
    {
      '@type': 'BreadcrumbList',
      '@id': `${canonical}#breadcrumb`,
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Inicio', item: `${location.origin}/` },
        { '@type': 'ListItem', position: 2, name: landing.modelSpec.label, item: canonical },
      ],
    },
    entity,
  ];
  if (faq.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${canonical}#faq`,
      mainEntity: faq.map((item) => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    });
  }
  if (landing.conversion.vsl.enabled && landing.conversion.vsl.url) {
    graph.push({
      '@type': 'VideoObject',
      '@id': `${canonical}#vsl`,
      name: landing.conversion.vsl.headline,
      description: landing.conversion.vsl.body || landing.seo.description,
      thumbnailUrl: [landing.conversion.vsl.poster_url || landing.seo.image_url].filter(Boolean),
      ...(/\.(mp4|webm|m4v)(?:\?|$)/i.test(landing.conversion.vsl.url)
        ? { contentUrl: landing.conversion.vsl.url }
        : { embedUrl: landing.conversion.vsl.url }),
    });
  }
  script.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
}

export default {
  components: { Combobox, PhoneField },
  setup() {
    const route = useRoute();
    const router = useRouter();
    const experience = ref(null);
    const loading = ref(true);
    const sending = ref(false);
    const error = ref('');
    const formStarted = ref(false);
    const activity = ref({ viewers: 0, registered_total: 0, registered_today: 0, recent_activity: [], remaining_seats: null, capacity: null });
    const activityIndex = ref(0);
    const countdown = ref(0);
    const countdownExpired = ref(false);
    const editorMode = computed(() => route.query.editor === '1' && Boolean(route.query.experience_id));
    const editorReadOnly = computed(() => editorMode.value && route.query.preview === 'published');
    const form = reactive({
      edition_id: '',
      offer_id: '',
      name: '',
      email: '',
      country: '',
      whatsapp: '',
      company: '',
      message: '',
      consent: false,
      public_activity_consent: false,
      presence_session_id: '',
      website: '',
    });
    let activityTimer = null;
    let activityRotationTimer = null;
    let countdownTimer = null;

    const landing = computed(() => normalizeEventLanding(experience.value || {}));
    const selectedEdition = computed(() => experience.value?.editions?.find((edition) => String(edition.id) === String(form.edition_id)));
    const seats = computed(() => {
      if (!['form', 'checkout'].includes(landing.value.registration.mode)) return null;
      if (activity.value.remaining_seats !== null && activity.value.remaining_seats !== undefined) {
        return Number(activity.value.remaining_seats);
      }
      const edition = selectedEdition.value;
      if (!edition || !Number(edition.capacity)) return null;
      return Math.max(0, Number(edition.capacity) - Number(edition.enrolled || 0));
    });
    const registrationVisible = computed(() => true);
    const isApplication = computed(() => landing.value.registration.mode === 'application');
    const isCheckout = computed(() => landing.value.registration.mode === 'checkout');
    const hasEditions = computed(() => Boolean(experience.value?.editions?.length));
    const editionOffers = computed(() => (experience.value?.offers || []).filter((offer) => String(offer.edition_id) === String(form.edition_id)));
    const selectedOffer = computed(() => editionOffers.value.find((offer) => String(offer.id) === String(form.offer_id)) || editionOffers.value[0] || null);
    const showSeats = computed(() => {
      const scarcity = landing.value.conversion.scarcity;
      return scarcity.show_remaining_seats && seats.value !== null && seats.value <= scarcity.show_when_remaining_lte;
    });
    const socialProofText = computed(() => {
      const proof = landing.value.conversion.social_proof;
      if (!proof.enabled) return '';
      const value = proof.mode === 'live_presence'
        ? Number(activity.value.viewers || 0)
        : proof.mode === 'recent_registrations'
          ? Number(activity.value.registered_today || 0)
          : Number(activity.value.registered_total || 0);
      if (value < proof.display_threshold) return '';
      if (proof.label) return proof.label.replace('{count}', String(value));
      if (proof.mode === 'live_presence') return `${value} personas están viendo esta experiencia ahora`;
      if (proof.mode === 'recent_registrations') return `${value} personas se registraron hoy`;
      return `${value} personas ya dieron el siguiente paso`;
    });
    const recentActivityNotice = computed(() => {
      const proof = landing.value.conversion.social_proof;
      const items = Array.isArray(activity.value.recent_activity) ? activity.value.recent_activity : [];
      if (
        editorMode.value
        || !proof.enabled
        || proof.mode !== 'recent_registrations'
        || Number(activity.value.registered_today || 0) < proof.display_threshold
        || !items.length
      ) return null;
      const item = items[activityIndex.value % items.length];
      return {
        ...item,
        message: `${item.first_name}${item.country ? ` · ${item.country}` : ''} ${item.type === 'purchase' ? 'adquirió su acceso' : 'se registró en la experiencia'}`,
      };
    });
    const countdownParts = computed(() => {
      const total = Math.max(0, countdown.value);
      return {
        days: Math.floor(total / 86400),
        hours: Math.floor((total % 86400) / 3600),
        minutes: Math.floor((total % 3600) / 60),
        seconds: total % 60,
      };
    });
    const ctaHidden = computed(() => countdownExpired.value && landing.value.conversion.urgency.expiry_action === 'hide_cta');
    const heroCards = computed(() => {
      const block = landing.value.blocks.find((item) => ['transformation', 'deliverables', 'value_stack'].includes(item.type) && item.items.length);
      return block?.items.slice(0, 3) || [];
    });
    const primaryTarget = computed(() => {
      const target = landing.value.hero.primary_cta.target;
      if (target) return target;
      if (landing.value.registration.mode === 'checkout' && landing.value.registration.checkout_url) return landing.value.registration.checkout_url;
      return '#event-register';
    });

    function presenceSession() {
      const key = 'td_event_presence_' + String(route.params.slug || 'event');
      try {
        let id = localStorage.getItem(key) || '';
        if (!/^[a-zA-Z0-9_-]{16,120}$/.test(id)) {
          const bytes = new Uint8Array(18);
          crypto.getRandomValues(bytes);
          id = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('');
          localStorage.setItem(key, id);
        }
        return id;
      } catch (_) {
        return 'fallback_' + Math.random().toString(36).slice(2) + Date.now().toString(36);
      }
    }

    async function heartbeat() {
      if (editorMode.value || !experience.value) return;
      const result = await api.eventActivity(route.params.slug, {
        session_id: form.presence_session_id,
        edition_id: form.edition_id || null,
      });
      if (result.success && result.data) {
        activity.value = result.data;
        if (result.data.evergreen_ends_at) startCountdown(result.data.evergreen_ends_at);
      }
    }

    function startCountdown(targetValue = '') {
      clearInterval(countdownTimer);
      const urgency = landing.value.conversion.urgency;
      if (urgency.mode === 'none') {
        countdown.value = 0;
        countdownExpired.value = false;
        return;
      }
      const target = targetValue || urgency.ends_at;
      const end = Date.parse(String(target || '').replace(' ', 'T'));
      if (!Number.isFinite(end)) return;
      const tick = () => {
        countdown.value = Math.max(0, Math.ceil((end - Date.now()) / 1000));
        countdownExpired.value = countdown.value <= 0;
      };
      tick();
      countdownTimer = setInterval(tick, 1000);
    }

    function pickEdit(path, value, kind = 'text', label = 'Elemento') {
      if (!editorMode.value || editorReadOnly.value) return;
      window.parent.postMessage({
        type: 'event-editor-select',
        path,
        value,
        kind,
        label,
      }, location.origin);
    }

    function formatDate(value, timezone = 'America/Bogota') {
      if (!value) return 'Fecha por confirmar';
      try {
        return new Intl.DateTimeFormat('es-CO', {
          weekday: 'short',
          day: 'numeric',
          month: 'long',
          year: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          timeZone: timezone,
        }).format(new Date(String(value).replace(' ', 'T')));
      } catch (_) {
        return value;
      }
    }

    function formatPrice(plan) {
      if (plan.price === '' || plan.price == null) return 'Consulta disponibilidad';
      const amount = Number(plan.price);
      if (!Number.isFinite(amount)) return `${plan.price}${plan.currency ? ` ${plan.currency}` : ''}`;
      try {
        return new Intl.NumberFormat('es-CO', {
          style: 'currency',
          currency: plan.currency || 'COP',
          maximumFractionDigits: amount % 1 ? 2 : 0,
        }).format(amount);
      } catch (_) {
        return `${plan.price} ${plan.currency || ''}`.trim();
      }
    }

    function hostedVideo(url) {
      return /\.(mp4|webm|ogg)(\?.*)?$/i.test(String(url || ''));
    }

    function videoEmbedUrl(url) {
      const value = String(url || '');
      try {
        const parsed = new URL(value, location.origin);
        if (parsed.hostname.includes('youtube.com')) {
          const id = parsed.searchParams.get('v') || parsed.pathname.split('/').filter(Boolean).pop();
          return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : '';
        }
        if (parsed.hostname === 'youtu.be') {
          const id = parsed.pathname.split('/').filter(Boolean)[0];
          return id ? `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}` : '';
        }
        if (parsed.hostname.includes('vimeo.com')) {
          const id = parsed.pathname.split('/').filter(Boolean).find((part) => /^\d+$/.test(part));
          return id ? `https://player.vimeo.com/video/${id}` : '';
        }
      } catch (_) {}
      return '';
    }

    function isCardBlock(type) { return CARD_BLOCKS.has(type); }
    function isTimelineBlock(type) { return TIMELINE_BLOCKS.has(type); }
    function ctaTarget(block = null) {
      const target = safeEventUrl(block?.primary_cta?.target, primaryTarget.value);
      if (landing.value.registration.mode === 'checkout') return '#event-register';
      return target;
    }
    async function selectPlan(plan) {
      if (plan.edition_id) form.edition_id = plan.edition_id;
      await nextTick();
      if (plan.id) form.offer_id = plan.id;
      trackCta('plan_' + plan.name, '#event-register');
    }
    function trackCta(position, target = primaryTarget.value) {
      track('event_cta_clicked', {
        experience: route.params.slug,
        model: landing.value.model,
        position,
        target_type: String(target || '').startsWith('#') ? 'internal' : 'external',
      });
    }
    function startForm() {
      if (formStarted.value) return;
      formStarted.value = true;
      track('event_registration_started', { experience: route.params.slug, model: landing.value.model });
    }
    function openEpayco(config) {
      const launch = () => {
        try {
          const handler = window.ePayco.checkout.configure({
            key: config.key,
            test: String(config.test) === 'true',
          });
          handler.open(config);
          sending.value = false;
        } catch (_) {
          sending.value = false;
          error.value = 'No pudimos abrir ePayco. Intenta de nuevo o elige otro medio de pago.';
        }
      };
      if (window.ePayco) {
        launch();
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://checkout.epayco.co/checkout.js';
      script.onload = launch;
      script.onerror = () => {
        sending.value = false;
        error.value = 'No pudimos cargar ePayco. Revisa tu conexión e inténtalo de nuevo.';
      };
      document.body.appendChild(script);
    }

    async function load() {
      loading.value = true;
      error.value = '';
      let result;
      if (editorMode.value) {
        const token = localStorage.getItem('ngx_token') || '';
        try {
          const response = await fetch(`/api/admin/eventos/${encodeURIComponent(route.query.experience_id)}`, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
          });
          result = await response.json();
          if (result.success && result.data && editorReadOnly.value) {
            const release = result.data.current_release?.manifest || {};
            result.data = {
              ...result.data,
              ...(release.experience || {}),
              landing: result.data.published_landing,
              editions: Array.isArray(release.editions) ? release.editions : result.data.editions,
              offers: Array.isArray(release.offers) ? release.offers : result.data.offers,
            };
          }
        } catch (e) {
          result = { success: false, error: e.message };
        }
      } else {
        result = await api.eventPublic(route.params.slug);
      }
      if (result.success && result.data) {
        experience.value = result.data;
        if (result.data.editions?.length) form.edition_id = result.data.editions[0].id;
        prefill(form);
        form.presence_session_id = presenceSession();
        const offers = result.data.offers || [];
        const firstOffer = offers.find((offer) => String(offer.edition_id) === String(form.edition_id));
        if (firstOffer) form.offer_id = firstOffer.id;
        document.title = landing.value.seo.title;
        const canonical = `${location.origin}/eventos/${encodeURIComponent(result.data.slug || route.params.slug)}`;
        setCanonical(canonical);
        setMeta('meta[name="description"]', 'content', landing.value.seo.description);
        setMeta('meta[property="og:title"]', 'content', landing.value.seo.title);
        setMeta('meta[property="og:description"]', 'content', landing.value.seo.description);
        setMeta('meta[property="og:url"]', 'content', canonical);
        setMeta('meta[name="twitter:title"]', 'content', landing.value.seo.title);
        setMeta('meta[name="twitter:description"]', 'content', landing.value.seo.description);
        if (landing.value.seo.image_url) setMeta('meta[property="og:image"]', 'content', landing.value.seo.image_url);
        if (landing.value.seo.image_url) setMeta('meta[name="twitter:image"]', 'content', landing.value.seo.image_url);
        if (!editorMode.value) {
          injectEventSchema(result.data, landing.value);
          track('event_landing_viewed', {
            experience: route.params.slug,
            model: landing.value.model,
            schema: landing.value.schemaVersion,
          });
          await heartbeat();
          activityTimer = setInterval(heartbeat, 30000);
          if (landing.value.conversion.urgency.mode === 'fixed') startCountdown();
        } else {
          window.parent.postMessage({ type: 'event-editor-ready' }, location.origin);
        }
      } else {
        error.value = result.message || result.error || 'Esta experiencia no está disponible.';
      }
      loading.value = false;
    }

    async function register() {
      if (!hasEditions.value) {
        error.value = 'Las inscripciones todavía no están abiertas.';
        return;
      }
      if (!form.country) {
        error.value = 'Selecciona tu país para completar el registro.';
        return;
      }
      if (landing.value.registration.whatsapp_required && !form.whatsapp) {
        error.value = 'Incluye tu número de WhatsApp con indicativo de país.';
        return;
      }
      if (isCheckout.value && editionOffers.value.length && !form.offer_id) {
        error.value = 'Selecciona el acceso que quieres adquirir.';
        return;
      }
      sending.value = true;
      error.value = '';
      const result = await api.registerEvent(route.params.slug, { ...form, attribution: getUtm() });
      if (result.success) {
        saveLead(form);
        track('event_registration_completed', {
          experience: route.params.slug,
          model: landing.value.model,
          edition_id: form.edition_id,
        });
        const checkoutUrl = result.data?.checkout?.checkout_url;
        if (checkoutUrl) {
          track('event_checkout_started', {
            experience: route.params.slug,
            edition_id: form.edition_id,
            gateway: result.data.checkout.gateway,
          });
          window.location.assign(checkoutUrl);
          return;
        }
        if (result.data?.checkout?.gateway === 'epayco' && result.data.checkout.config) {
          track('event_checkout_started', {
            experience: route.params.slug,
            edition_id: form.edition_id,
            gateway: 'epayco',
          });
          openEpayco(result.data.checkout.config);
          return;
        }
        await router.push({
          path: result.data?.thank_you_url || `/eventos/${encodeURIComponent(route.params.slug)}/gracias`,
          query: { edition: String(form.edition_id) },
        });
      } else {
        error.value = result.message || result.error || 'No pudimos completar el registro. Revisa los datos e inténtalo de nuevo.';
        track('event_registration_failed', { experience: route.params.slug, message: error.value });
      }
      sending.value = false;
    }

    watch(() => form.edition_id, () => {
      const firstOffer = editionOffers.value[0];
      form.offer_id = firstOffer ? firstOffer.id : '';
      heartbeat();
    });
    onMounted(() => {
      load();
      activityRotationTimer = setInterval(() => { activityIndex.value += 1; }, 7000);
    });
    onUnmounted(() => {
      clearInterval(activityTimer);
      clearInterval(activityRotationTimer);
      clearInterval(countdownTimer);
    });
    return {
      experience,
      landing,
      loading,
      sending,
      error,
      form,
      selectedEdition,
      seats,
      showSeats,
      socialProofText,
      recentActivityNotice,
      activity,
      countdownParts,
      countdownExpired,
      ctaHidden,
      editorMode,
      editorReadOnly,
      registrationVisible,
      isApplication,
      isCheckout,
      hasEditions,
      editionOffers,
      selectedOffer,
      heroCards,
      primaryTarget,
      formatDate,
      formatPrice,
      hostedVideo,
      videoEmbedUrl,
      isCardBlock,
      isTimelineBlock,
      ctaTarget,
      selectPlan,
      trackCta,
      startForm,
      openEpayco,
      pickEdit,
      register,
      COUNTRIES,
    };
  },
  template: `
  <div class="event-lp" :class="[landing.themeClass, 'event-model--' + landing.model, {'event-lp--editor':editorMode}]" :style="landing.themeStyle">
    <div v-if="loading" class="event-lp__loading" aria-live="polite">
      <span class="event-lp__loader"></span><p>Preparando la experiencia…</p>
    </div>

    <section v-else-if="error && !experience" class="event-lp__unavailable">
      <img src="/assets/icons/mark.svg" alt="" width="54" height="54" />
      <p class="event-lp__eyebrow">Tonny Dager × ExperientIA</p>
      <h1>Esta experiencia no está disponible</h1>
      <p>{{ error }}</p>
      <router-link class="event-lp__button event-lp__button--primary" to="/">Volver al inicio</router-link>
    </section>

    <template v-else>
      <div v-if="editorMode" class="event-lp__editor-banner"><span>{{ editorReadOnly ? 'Release público' : 'Modo edición' }}</span><strong>{{ editorReadOnly ? 'Vista exacta de producción · solo lectura.' : 'Haz clic sobre un texto, imagen, video o audio para editarlo.' }}</strong></div>
      <div v-if="landing.announcement" class="event-lp__announcement" @click.stop="pickEdit('announcement',landing.announcement,'text','Anuncio superior')">{{ landing.announcement }}</div>
      <header class="event-lp__nav">
        <a href="#event-top" class="event-lp__brand" aria-label="Volver al inicio de la experiencia">
          <img src="/assets/icons/mark.svg" alt="" width="34" height="34" />
          <span><strong @click.stop="editorMode && ($event.preventDefault(),pickEdit('brand.name',landing.brand.name,'text','Nombre de marca'))">{{ landing.brand.name }}</strong><small @click.stop="editorMode && ($event.preventDefault(),pickEdit('brand.descriptor',landing.brand.descriptor,'text','Descriptor de marca'))">{{ landing.brand.descriptor }}</small></span>
        </a>
        <nav v-if="landing.navigation.length" aria-label="Contenido de la experiencia">
          <a v-for="item in landing.navigation" :key="item.target" :href="item.target">{{ item.label }}</a>
        </nav>
        <a class="event-lp__nav-cta" :href="primaryTarget" @click="editorMode && $event.preventDefault(); editorMode ? pickEdit('hero.primary_cta.label',landing.hero.primary_cta.label,'text','Texto del CTA principal') : trackCta('navigation', primaryTarget)">{{ landing.hero.primary_cta.label }}</a>
      </header>

      <section id="event-top" class="event-lp__hero">
        <div class="event-lp__orb event-lp__orb--one" aria-hidden="true"></div>
        <div class="event-lp__orb event-lp__orb--two" aria-hidden="true"></div>
        <div class="event-lp__container event-lp__hero-grid">
          <div class="event-lp__hero-copy">
            <div class="event-lp__hero-kicker" @click.stop="pickEdit('hero.eyebrow',landing.hero.eyebrow,'text','Antetítulo del hero')"><span></span>{{ landing.hero.eyebrow }}</div>
            <h1 @click.stop="pickEdit('hero.headline',landing.hero.headline,'text','Titular principal')">{{ landing.hero.headline }}</h1>
            <p class="event-lp__hero-lead" @click.stop="pickEdit('hero.subheadline',landing.hero.subheadline,'textarea','Subtítulo comercial')">{{ landing.hero.subheadline }}</p>
            <p v-if="landing.hero.supporting" class="event-lp__hero-support" @click.stop="pickEdit('hero.supporting',landing.hero.supporting,'textarea','Texto de apoyo')">{{ landing.hero.supporting }}</p>
            <div v-if="landing.hero.facts.length" class="event-lp__facts">
              <div v-for="(fact,index) in landing.hero.facts" :key="fact.title + fact.text">
                <small @click.stop="pickEdit('hero.facts.'+index+'.title',fact.title,'text','Etiqueta del dato')">{{ fact.title }}</small><strong @click.stop="pickEdit('hero.facts.'+index+'.text',fact.text,'text','Valor del dato')">{{ fact.text }}</strong>
              </div>
            </div>
            <div class="event-lp__hero-actions">
              <a v-if="!ctaHidden" class="event-lp__button event-lp__button--primary" :href="primaryTarget" @click="editorMode && $event.preventDefault(); editorMode ? pickEdit('hero.primary_cta.label',landing.hero.primary_cta.label,'text','Texto del CTA principal') : trackCta('hero', primaryTarget)">
                {{ landing.hero.primary_cta.label }} <span>↗</span>
              </a>
              <a v-if="landing.hero.secondary_cta.label && landing.hero.secondary_cta.target" class="event-lp__button event-lp__button--ghost" :href="landing.hero.secondary_cta.target" @click="trackCta('hero_secondary', landing.hero.secondary_cta.target)">
                {{ landing.hero.secondary_cta.label }}
              </a>
            </div>
            <div v-if="landing.hero.trust.length" class="event-lp__hero-trust">
              <span v-for="(item,index) in landing.hero.trust" :key="item" @click.stop="pickEdit('hero.trust.'+index,item,'text','Señal de confianza')">✓ {{ item }}</span>
            </div>
          </div>

          <aside v-if="landing.model === 'lead_event' && registrationVisible" id="event-register" class="event-lp__capture">
            <div class="event-lp__capture-head"><span>Acceso</span><h2 @click.stop="pickEdit('registration.title',landing.registration.title,'text','Título del formulario')">{{ landing.registration.title }}</h2><p @click.stop="pickEdit('registration.description',landing.registration.description,'textarea','Descripción del formulario')">{{ landing.registration.description }}</p></div>
            <form @submit.prevent="register" @focusin="startForm">
              <label v-if="experience.editions?.length > 1">Edición
                <select v-model="form.edition_id" required><option v-for="edition in experience.editions" :key="edition.id" :value="edition.id">{{ edition.name }} · {{ formatDate(edition.starts_at, edition.timezone) }}</option></select>
              </label>
              <label>Nombre completo<input v-model="form.name" required autocomplete="name" placeholder="¿Cómo te llamas?" /></label>
              <label>Correo electrónico<input v-model="form.email" type="email" required autocomplete="email" placeholder="tu@correo.com" /></label>
              <label>País<combobox v-model="form.country" :options="COUNTRIES" placeholder="Busca y selecciona tu país" name="country" /></label>
              <label v-if="landing.registration.ask_whatsapp">WhatsApp<phone-field v-model="form.whatsapp" /></label>
              <label v-if="landing.registration.ask_company">Empresa<input v-model="form.company" autocomplete="organization" placeholder="Tu empresa" /></label>
              <label class="event-lp__consent"><input v-model="form.consent" type="checkbox" required /><span>{{ landing.registration.consent_label }} <a href="/tratamiento-de-datos" target="_blank" rel="noopener">Ver política</a>.</span></label>
              <label v-if="landing.conversion.social_proof.enabled && landing.conversion.social_proof.mode === 'recent_registrations'" class="event-lp__consent event-lp__consent--optional"><input v-model="form.public_activity_consent" type="checkbox" /><span>Autorizo mostrar mi primer nombre y país como actividad reciente real. Es opcional.</span></label>
              <input v-model="form.website" class="event-lp__hp" tabindex="-1" autocomplete="off" aria-hidden="true" />
              <p v-if="showSeats" class="event-lp__seats">{{ seats > 0 ? seats + ' lugares disponibles en esta edición' : 'Lista de espera disponible' }}</p>
              <p v-if="error" class="event-lp__form-error">{{ error }}</p>
              <p v-if="!hasEditions" class="event-lp__form-error">Las inscripciones de esta edición todavía no están abiertas.</p>
              <button class="event-lp__button event-lp__button--primary event-lp__button--block" :disabled="sending || !hasEditions || ctaHidden" @click="editorMode && ($event.preventDefault(),pickEdit('registration.button_label',landing.registration.button_label,'text','Texto del botón'))">{{ sending ? 'Confirmando…' : landing.registration.button_label }}</button>
              <small class="event-lp__privacy">Datos protegidos · Se usan únicamente para gestionar esta experiencia.</small>
            </form>
          </aside>

          <aside v-else class="event-lp__hero-stage">
            <div v-if="landing.hero.media.url" class="event-lp__hero-media" @click.stop="pickEdit('hero.media.url',landing.hero.media.url,landing.hero.media.type || 'image','Imagen o video del hero')">
              <video v-if="landing.hero.media.type === 'video'" :src="landing.hero.media.url" muted autoplay loop playsinline></video>
              <img v-else :src="landing.hero.media.url" :alt="landing.hero.media.alt" />
            </div>
            <div v-else class="event-lp__signal" @click.stop="pickEdit('hero.media.url','', 'image','Imagen principal del hero')">
              <span class="event-lp__signal-label">{{ landing.modelSpec.label }}</span>
              <strong>{{ experience.title }}</strong>
              <div class="event-lp__signal-line"></div>
              <ol>
                <li v-for="(step,index) in landing.modelSpec.flow" :key="step"><span>{{ String(index + 1).padStart(2,'0') }}</span>{{ step }}</li>
              </ol>
            </div>
            <div v-if="heroCards.length" class="event-lp__hero-cards">
              <article v-for="item in heroCards" :key="item.title"><span>✓</span><div><strong>{{ item.title }}</strong><small v-if="item.text">{{ item.text }}</small></div></article>
            </div>
          </aside>
        </div>
        <div class="event-lp__scroll-note"><span></span>Descubre la experiencia</div>
      </section>

      <section v-if="landing.conversion.urgency.mode !== 'none' || socialProofText || showSeats" class="event-lp__momentum" aria-live="polite">
        <div class="event-lp__container event-lp__momentum-grid">
          <div v-if="landing.conversion.urgency.mode !== 'none' && !countdownExpired" class="event-lp__countdown">
            <span>{{ landing.conversion.urgency.label }}</span>
            <div>
              <b v-if="countdownParts.days"><strong>{{ String(countdownParts.days).padStart(2,'0') }}</strong><small>días</small></b>
              <b><strong>{{ String(countdownParts.hours).padStart(2,'0') }}</strong><small>horas</small></b>
              <b><strong>{{ String(countdownParts.minutes).padStart(2,'0') }}</strong><small>min</small></b>
              <b><strong>{{ String(countdownParts.seconds).padStart(2,'0') }}</strong><small>seg</small></b>
            </div>
          </div>
          <p v-else-if="countdownExpired" class="event-lp__expired">{{ landing.conversion.urgency.expired_message }}</p>
          <div class="event-lp__live-signals">
            <span v-if="socialProofText"><i></i>{{ socialProofText }}</span>
            <span v-if="showSeats" :class="{'is-low':seats <= landing.conversion.scarcity.low_stock_threshold}">{{ seats }} {{ seats === 1 ? 'cupo disponible' : 'cupos disponibles' }}</span>
          </div>
        </div>
      </section>

      <section v-if="landing.hero.trust.length" class="event-lp__trustbar">
        <div class="event-lp__container"><small>Diseñada para avanzar</small><span v-for="(item,index) in landing.hero.trust" :key="'bar-' + item" @click.stop="pickEdit('hero.trust.'+index,item,'text','Señal de confianza')">{{ item }}</span></div>
      </section>

      <section v-if="landing.conversion.vsl.enabled || editorMode" class="event-lp__section event-lp__vsl event-lp__section--dark">
        <div class="event-lp__container event-lp__vsl-grid">
          <header>
            <p class="event-lp__eyebrow">Video de venta</p>
            <h2 @click.stop="pickEdit('conversion.vsl.headline',landing.conversion.vsl.headline,'text','Titular de la VSL')">{{ landing.conversion.vsl.headline }}</h2>
            <p v-if="landing.conversion.vsl.body" @click.stop="pickEdit('conversion.vsl.body',landing.conversion.vsl.body,'textarea','Texto de la VSL')">{{ landing.conversion.vsl.body }}</p>
          </header>
          <div class="event-lp__vsl-frame" @click.stop="editorMode && pickEdit('conversion.vsl.url',landing.conversion.vsl.url,'video','Video Sales Letter')">
            <video v-if="hostedVideo(landing.conversion.vsl.url)" :src="landing.conversion.vsl.url" :poster="landing.conversion.vsl.poster_url" controls playsinline preload="metadata"></video>
            <iframe v-else-if="videoEmbedUrl(landing.conversion.vsl.url)" :src="videoEmbedUrl(landing.conversion.vsl.url)" title="Video de la experiencia" loading="lazy" allow="accelerometer; autoplay; encrypted-media; picture-in-picture" allowfullscreen></iframe>
            <a v-else-if="landing.conversion.vsl.url" :href="landing.conversion.vsl.url" target="_blank" rel="noopener">Ver video de la experiencia ↗</a>
            <button v-else-if="editorMode" type="button" class="event-lp__media-placeholder" @click.stop="pickEdit('conversion.vsl.url','','video','Video Sales Letter')">＋ Añadir VSL</button>
          </div>
          <small v-if="landing.conversion.vsl.caption">{{ landing.conversion.vsl.caption }}</small>
        </div>
      </section>

      <section v-if="landing.conversion.audio_invite.enabled || editorMode" class="event-lp__audio-invite">
        <div class="event-lp__container">
          <div><span>Una invitación personal</span><strong @click.stop="pickEdit('conversion.audio_invite.label',landing.conversion.audio_invite.label,'text','Título del audio')">{{ landing.conversion.audio_invite.label }}</strong></div>
          <audio v-if="landing.conversion.audio_invite.url" :src="landing.conversion.audio_invite.url" controls preload="metadata" @click.stop="editorMode && pickEdit('conversion.audio_invite.url',landing.conversion.audio_invite.url,'audio','Invitación de audio')"></audio>
          <button v-else-if="editorMode" type="button" class="event-lp__media-placeholder" @click.stop="pickEdit('conversion.audio_invite.url','','audio','Invitación de audio')">＋ Añadir audio</button>
        </div>
      </section>

      <template v-for="block in landing.blocks" :key="block.id">
        <section v-if="isCardBlock(block.type) && (block.items.length || block.headline || block.body)" :id="block.id" class="event-lp__section event-lp__cards-section" :class="'event-lp__section--' + block.theme">
          <div class="event-lp__container">
            <header class="event-lp__section-head">
              <div><p class="event-lp__eyebrow" @click.stop="pickEdit('blocks.'+block.source_index+'.eyebrow',block.eyebrow,'text','Antetítulo de sección')">{{ block.eyebrow }}</p><h2 @click.stop="pickEdit('blocks.'+block.source_index+'.headline',block.headline,'text','Titular de sección')">{{ block.headline }}</h2></div>
              <p v-if="block.body" @click.stop="pickEdit('blocks.'+block.source_index+'.body',block.body,'textarea','Texto de sección')">{{ block.body }}</p>
            </header>
            <div v-if="block.items.length" class="event-lp__card-grid" :class="'event-lp__card-grid--' + Math.min(block.items.length, 4)">
              <article v-for="(item,index) in block.items" :key="item.title + index">
                <span class="event-lp__card-number">{{ item.icon || item.number || String(index + 1).padStart(2,'0') }}</span>
                <small v-if="item.tag" @click.stop="pickEdit('blocks.'+block.source_index+'.items.'+index+'.tag',item.tag,'text','Etiqueta de tarjeta')">{{ item.tag }}</small>
                <h3 @click.stop="pickEdit('blocks.'+block.source_index+'.items.'+index+'.title',item.title,'text','Título de tarjeta')">{{ item.title }}</h3><p v-if="item.text" @click.stop="pickEdit('blocks.'+block.source_index+'.items.'+index+'.text',item.text,'textarea','Texto de tarjeta')">{{ item.text }}</p><b v-if="item.meta" @click.stop="pickEdit('blocks.'+block.source_index+'.items.'+index+'.meta',item.meta,'text','Dato de apoyo')">{{ item.meta }}</b>
              </article>
            </div>
          </div>
        </section>

        <section v-else-if="isTimelineBlock(block.type) && block.timeline.length" :id="block.id" class="event-lp__section event-lp__timeline-section" :class="'event-lp__section--' + block.theme">
          <div class="event-lp__container">
            <header class="event-lp__section-head">
              <div><p class="event-lp__eyebrow" @click.stop="pickEdit('blocks.'+block.source_index+'.eyebrow',block.eyebrow,'text','Antetítulo de sección')">{{ block.eyebrow }}</p><h2 @click.stop="pickEdit('blocks.'+block.source_index+'.headline',block.headline,'text','Titular de sección')">{{ block.headline }}</h2></div>
              <p v-if="block.body" @click.stop="pickEdit('blocks.'+block.source_index+'.body',block.body,'textarea','Texto de sección')">{{ block.body }}</p>
            </header>
            <div class="event-lp__timeline">
              <article v-for="(item,index) in block.timeline" :key="item.title + index">
                <div class="event-lp__timeline-marker"><span>{{ item.number || String(index + 1).padStart(2,'0') }}</span></div>
                <div class="event-lp__timeline-copy">
                  <div class="event-lp__timeline-meta"><span v-if="item.date" @click.stop="pickEdit('blocks.'+block.source_index+'.sessions.'+index+'.date',item.date,'text','Fecha del momento')">{{ item.date }}</span><span v-if="item.time" @click.stop="pickEdit('blocks.'+block.source_index+'.sessions.'+index+'.time',item.time,'text','Hora del momento')">{{ item.time }}</span><span v-if="item.duration" @click.stop="pickEdit('blocks.'+block.source_index+'.sessions.'+index+'.duration',item.duration,'text','Duración del momento')">{{ item.duration }}</span></div>
                  <small v-if="item.eyebrow">{{ item.eyebrow }}</small><h3 @click.stop="pickEdit('blocks.'+block.source_index+'.sessions.'+index+'.title',item.title,'text','Título del momento')">{{ item.title }}</h3><p v-if="item.text" @click.stop="pickEdit('blocks.'+block.source_index+'.sessions.'+index+'.description',item.text,'textarea','Descripción del momento')">{{ item.text }}</p>
                  <ul v-if="item.points.length"><li v-for="(point,pointIndex) in item.points" :key="point" @click.stop="pickEdit('blocks.'+block.source_index+'.sessions.'+index+'.points.'+pointIndex,point,'text','Punto del programa')">{{ point }}</li></ul>
                  <div v-if="item.deliverable" class="event-lp__deliverable" @click.stop="pickEdit('blocks.'+block.source_index+'.sessions.'+index+'.deliverable',item.deliverable,'textarea','Resultado del momento')"><span>Resultado</span>{{ item.deliverable }}</div>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section v-else-if="block.type === 'audience' && (block.for_whom.length || block.not_for.length)" :id="block.id" class="event-lp__section event-lp__audience" :class="'event-lp__section--' + block.theme">
          <div class="event-lp__container">
            <header class="event-lp__section-head"><div><p class="event-lp__eyebrow" @click.stop="pickEdit('blocks.'+block.source_index+'.eyebrow',block.eyebrow,'text','Antetítulo de sección')">{{ block.eyebrow }}</p><h2 @click.stop="pickEdit('blocks.'+block.source_index+'.headline',block.headline,'text','Titular de sección')">{{ block.headline }}</h2></div><p v-if="block.body" @click.stop="pickEdit('blocks.'+block.source_index+'.body',block.body,'textarea','Texto de sección')">{{ block.body }}</p></header>
            <div class="event-lp__audience-grid">
              <article class="event-lp__audience-yes"><span>Para quién sí</span><ul><li v-for="(item,index) in block.for_whom" :key="item" @click.stop="pickEdit('blocks.'+block.source_index+'.for_whom.'+index,item,'text','Criterio de audiencia')"><b>✓</b>{{ item }}</li></ul></article>
              <article class="event-lp__audience-no"><span>Para quién no</span><ul><li v-for="(item,index) in block.not_for" :key="item" @click.stop="pickEdit('blocks.'+block.source_index+'.not_for.'+index,item,'text','Criterio de exclusión')"><b>×</b>{{ item }}</li></ul></article>
            </div>
          </div>
        </section>

        <section v-else-if="block.type === 'facilitator' && block.person" :id="block.id" class="event-lp__section event-lp__facilitator" :class="'event-lp__section--' + block.theme">
          <div class="event-lp__container event-lp__facilitator-grid">
            <div class="event-lp__facilitator-photo" @click.stop="pickEdit('blocks.'+block.source_index+'.person.image_url',block.person.image_url,'image','Foto del facilitador')"><div class="event-lp__photo-glow"></div><img v-if="block.person.image_url" :src="block.person.image_url" :alt="block.person.name" loading="lazy" /><span v-else>{{ block.person.name.split(' ').map(part=>part[0]).slice(0,2).join('') }}</span></div>
            <div><p class="event-lp__eyebrow" @click.stop="pickEdit('blocks.'+block.source_index+'.eyebrow',block.eyebrow,'text','Antetítulo de sección')">{{ block.eyebrow }}</p><h2 @click.stop="pickEdit('blocks.'+block.source_index+'.headline',block.headline,'text','Titular de sección')">{{ block.headline }}</h2><span class="event-lp__person-name" @click.stop="pickEdit('blocks.'+block.source_index+'.person.name',block.person.name,'text','Nombre del facilitador')">{{ block.person.name }}</span><strong class="event-lp__person-role" @click.stop="pickEdit('blocks.'+block.source_index+'.person.role',block.person.role,'text','Rol del facilitador')">{{ block.person.role }}</strong><p @click.stop="pickEdit('blocks.'+block.source_index+'.person.bio',block.person.bio,'textarea','Biografía del facilitador')">{{ block.person.bio }}</p><ul><li v-for="(credential,index) in block.person.credentials" :key="credential" @click.stop="pickEdit('blocks.'+block.source_index+'.person.credentials.'+index,credential,'text','Credencial del facilitador')">{{ credential }}</li></ul></div>
          </div>
        </section>

        <section v-else-if="block.type === 'speakers' && block.people.length" :id="block.id" class="event-lp__section" :class="'event-lp__section--' + block.theme">
          <div class="event-lp__container">
            <header class="event-lp__section-head"><div><p class="event-lp__eyebrow" @click.stop="pickEdit('blocks.'+block.source_index+'.eyebrow',block.eyebrow,'text','Antetítulo de sección')">{{ block.eyebrow }}</p><h2 @click.stop="pickEdit('blocks.'+block.source_index+'.headline',block.headline,'text','Titular de sección')">{{ block.headline }}</h2></div><p v-if="block.body" @click.stop="pickEdit('blocks.'+block.source_index+'.body',block.body,'textarea','Texto de sección')">{{ block.body }}</p></header>
            <div class="event-lp__people">
              <article v-for="(person,personIndex) in block.people" :key="person.name">
                <div class="event-lp__people-photo" @click.stop="pickEdit('blocks.'+block.source_index+'.people.'+personIndex+'.image_url',person.image_url,'image','Foto del speaker')"><img v-if="person.image_url" :src="person.image_url" :alt="person.name" loading="lazy" /><span v-else>{{ person.name.split(' ').map(part=>part[0]).slice(0,2).join('') }}</span></div>
                <h3 @click.stop="pickEdit('blocks.'+block.source_index+'.people.'+personIndex+'.name',person.name,'text','Nombre del speaker')">{{ person.name }}</h3><strong @click.stop="pickEdit('blocks.'+block.source_index+'.people.'+personIndex+'.role',person.role,'text','Rol del speaker')">{{ person.role }}</strong><p v-if="person.topic" @click.stop="pickEdit('blocks.'+block.source_index+'.people.'+personIndex+'.topic',person.topic,'text','Tema del speaker')">{{ person.topic }}</p>
              </article>
            </div>
          </div>
        </section>

        <section v-else-if="block.type === 'venue' && block.location" :id="block.id" class="event-lp__section event-lp__venue" :class="'event-lp__section--' + block.theme">
          <div class="event-lp__container event-lp__venue-grid">
            <div><p class="event-lp__eyebrow" @click.stop="pickEdit('blocks.'+block.source_index+'.eyebrow',block.eyebrow,'text','Antetítulo de sección')">{{ block.eyebrow }}</p><h2 @click.stop="pickEdit('blocks.'+block.source_index+'.headline',block.headline,'text','Titular de sección')">{{ block.headline }}</h2><p @click.stop="pickEdit('blocks.'+block.source_index+'.body',block.body,'textarea','Texto de ubicación')">{{ block.body }}</p><strong @click.stop="pickEdit('blocks.'+block.source_index+'.location.name',block.location.name,'text','Nombre del lugar')">{{ block.location.name }}</strong><span><b @click.stop="pickEdit('blocks.'+block.source_index+'.location.address',block.location.address,'text','Dirección')">{{ block.location.address }}</b><template v-if="block.location.city"> · <b @click.stop="pickEdit('blocks.'+block.source_index+'.location.city',block.location.city,'text','Ciudad')">{{ block.location.city }}</b></template></span><p @click.stop="pickEdit('blocks.'+block.source_index+'.location.detail',block.location.detail,'textarea','Detalle del lugar')">{{ block.location.detail }}</p><a v-if="block.location.map_url" :href="block.location.map_url" target="_blank" rel="noopener">Ver ubicación ↗</a></div>
            <div class="event-lp__venue-visual" :style="block.location.image_url ? { backgroundImage: 'url(' + block.location.image_url + ')' } : {}" @click.stop="pickEdit('blocks.'+block.source_index+'.location.image_url',block.location.image_url,'image','Imagen del lugar')"><span v-if="!block.location.image_url">Ubicación<br/>de la experiencia</span></div>
          </div>
        </section>

        <section v-else-if="block.type === 'proof' && (block.metrics.length || block.testimonials.length)" :id="block.id" class="event-lp__section event-lp__proof" :class="'event-lp__section--' + block.theme">
          <div class="event-lp__container">
            <header class="event-lp__section-head"><div><p class="event-lp__eyebrow" @click.stop="pickEdit('blocks.'+block.source_index+'.eyebrow',block.eyebrow,'text','Antetítulo de sección')">{{ block.eyebrow }}</p><h2 @click.stop="pickEdit('blocks.'+block.source_index+'.headline',block.headline,'text','Titular de sección')">{{ block.headline }}</h2></div><p v-if="block.body" @click.stop="pickEdit('blocks.'+block.source_index+'.body',block.body,'textarea','Texto de prueba')">{{ block.body }}</p></header>
            <div v-if="block.metrics.length" class="event-lp__metrics"><article v-for="(metric,index) in block.metrics" :key="metric.title"><strong @click.stop="pickEdit('blocks.'+block.source_index+'.metrics.'+index+'.title',metric.title,'text','Valor de la métrica')">{{ metric.title }}</strong><span @click.stop="pickEdit('blocks.'+block.source_index+'.metrics.'+index+'.text',metric.text,'text','Descripción de la métrica')">{{ metric.text }}</span></article></div>
            <div v-if="block.testimonials.length" class="event-lp__testimonials"><blockquote v-for="(item,index) in block.testimonials" :key="item.quote"><p @click.stop="pickEdit('blocks.'+block.source_index+'.testimonials.'+index+'.quote',item.quote,'textarea','Testimonio')">“{{ item.quote }}”</p><footer><strong @click.stop="pickEdit('blocks.'+block.source_index+'.testimonials.'+index+'.name',item.name,'text','Nombre del testimonio')">{{ item.name }}</strong><span @click.stop="pickEdit('blocks.'+block.source_index+'.testimonials.'+index+'.role',item.role,'text','Rol del testimonio')">{{ item.role }}</span></footer></blockquote></div>
          </div>
        </section>

        <section v-else-if="block.type === 'offer' && block.plans.length" :id="block.id" class="event-lp__section event-lp__offer" :class="'event-lp__section--' + block.theme">
          <div class="event-lp__container">
            <header class="event-lp__section-head event-lp__section-head--center"><div><p class="event-lp__eyebrow" @click.stop="pickEdit('blocks.'+block.source_index+'.eyebrow',block.eyebrow,'text','Antetítulo de oferta')">{{ block.eyebrow }}</p><h2 @click.stop="pickEdit('blocks.'+block.source_index+'.headline',block.headline,'text','Titular de oferta')">{{ block.headline }}</h2></div><p v-if="block.body" @click.stop="pickEdit('blocks.'+block.source_index+'.body',block.body,'textarea','Texto de oferta')">{{ block.body }}</p></header>
            <div class="event-lp__plans" :class="{'event-lp__plans--single':block.plans.length===1}">
              <article v-for="plan in block.plans" :key="plan.id || plan.name" :class="{featured:plan.featured}">
                <span v-if="plan.badge" class="event-lp__plan-badge" @click.stop="plan.source_index !== null && pickEdit('blocks.'+block.source_index+'.plans.'+plan.source_index+'.badge',plan.badge,'text','Etiqueta del plan')">{{ plan.badge }}</span>
                <small>{{ plan.edition_name }}</small><h3>{{ plan.name }}</h3><p @click.stop="plan.source_index !== null && pickEdit('blocks.'+block.source_index+'.plans.'+plan.source_index+'.description',plan.description,'textarea','Descripción del plan')">{{ plan.description }}</p>
                <div class="event-lp__price"><del v-if="plan.compare_at">{{ plan.compare_at }}</del><strong>{{ formatPrice(plan) }}</strong><span>{{ plan.cadence }}</span></div>
                <ul><li v-for="(feature,index) in plan.features" :key="feature" @click.stop="plan.source_index !== null && pickEdit('blocks.'+block.source_index+'.plans.'+plan.source_index+'.features.'+index,feature,'text','Beneficio del plan')"><b>✓</b>{{ feature }}</li></ul>
                <a v-if="!ctaHidden" class="event-lp__button" :class="plan.featured ? 'event-lp__button--primary' : 'event-lp__button--ghost'" href="#event-register" @click="editorMode && $event.preventDefault(); editorMode && plan.source_index !== null ? pickEdit('blocks.'+block.source_index+'.plans.'+plan.source_index+'.cta_label',plan.cta_label,'text','CTA del plan') : selectPlan(plan)">{{ plan.cta_label }} <span>↗</span></a>
              </article>
            </div>
            <p v-if="block.guarantee" class="event-lp__guarantee" @click.stop="pickEdit('blocks.'+block.source_index+'.guarantee',block.guarantee,'textarea','Garantía')">◈ {{ block.guarantee }}</p><p v-if="block.note" class="event-lp__offer-note" @click.stop="pickEdit('blocks.'+block.source_index+'.note',block.note,'textarea','Nota de la oferta')">{{ block.note }}</p>
          </div>
        </section>

        <section v-else-if="block.type === 'faq' && block.questions.length" :id="block.id" class="event-lp__section event-lp__faq" :class="'event-lp__section--' + block.theme">
          <div class="event-lp__container event-lp__faq-grid">
            <header><p class="event-lp__eyebrow" @click.stop="pickEdit('blocks.'+block.source_index+'.eyebrow',block.eyebrow,'text','Antetítulo de FAQ')">{{ block.eyebrow }}</p><h2 @click.stop="pickEdit('blocks.'+block.source_index+'.headline',block.headline,'text','Titular de FAQ')">{{ block.headline }}</h2><p @click.stop="pickEdit('blocks.'+block.source_index+'.body',block.body,'textarea','Introducción de FAQ')">{{ block.body }}</p></header>
            <div><details v-for="(item,index) in block.questions" :key="item.q"><summary @click.stop="editorMode && pickEdit('blocks.'+block.source_index+'.questions.'+index+'.q',item.q,'text','Pregunta frecuente')"><span>{{ String(index + 1).padStart(2,'0') }}</span>{{ item.q }}<b>＋</b></summary><p @click.stop="pickEdit('blocks.'+block.source_index+'.questions.'+index+'.a',item.a,'textarea','Respuesta frecuente')">{{ item.a }}</p></details></div>
          </div>
        </section>

        <section v-else-if="block.type === 'closing'" :id="block.id" class="event-lp__closing">
          <div class="event-lp__container"><p class="event-lp__eyebrow" @click.stop="pickEdit('blocks.'+block.source_index+'.eyebrow',block.eyebrow,'text','Antetítulo de cierre')">{{ block.eyebrow }}</p><h2 @click.stop="pickEdit('blocks.'+block.source_index+'.headline',block.headline,'text','Titular de cierre')">{{ block.headline }}</h2><p @click.stop="pickEdit('blocks.'+block.source_index+'.body',block.body,'textarea','Texto de cierre')">{{ block.body }}</p><a v-if="!ctaHidden" class="event-lp__button event-lp__button--primary" :href="ctaTarget(block)" @click="editorMode && $event.preventDefault(); editorMode ? pickEdit('blocks.'+block.source_index+'.primary_cta.label',block.primary_cta.label || landing.hero.primary_cta.label,'text','Texto del CTA de cierre') : trackCta('closing', ctaTarget(block))">{{ block.primary_cta.label || landing.hero.primary_cta.label }} <span>↗</span></a></div>
        </section>
      </template>

      <section v-if="registrationVisible && landing.model !== 'lead_event'" id="event-register" class="event-lp__section event-lp__register">
        <div class="event-lp__container event-lp__register-grid">
          <div class="event-lp__register-copy"><p class="event-lp__eyebrow">Tu siguiente paso</p><h2 @click.stop="pickEdit('registration.title',landing.registration.title,'text','Título del formulario')">{{ landing.registration.title }}</h2><p @click.stop="pickEdit('registration.description',landing.registration.description,'textarea','Descripción del formulario')">{{ landing.registration.description }}</p>
            <div v-if="selectedEdition" class="event-lp__selected-edition"><small>Edición seleccionada</small><strong>{{ selectedEdition.name }}</strong><span>{{ formatDate(selectedEdition.starts_at, selectedEdition.timezone) }}</span><b v-if="showSeats">{{ seats }} cupos disponibles</b></div>
          </div>
          <form class="event-lp__form" @submit.prevent="register" @focusin="startForm">
            <label v-if="experience.editions?.length">Edición
              <select v-model="form.edition_id" required><option v-for="edition in experience.editions" :key="edition.id" :value="edition.id">{{ edition.name }} · {{ formatDate(edition.starts_at, edition.timezone) }}</option></select>
            </label>
            <div class="event-lp__form-two" :class="{'event-lp__form-two--single':!landing.registration.ask_company}"><label>Nombre completo<input v-model="form.name" required autocomplete="name" /></label><label v-if="landing.registration.ask_company">Empresa<input v-model="form.company" autocomplete="organization" /></label></div>
            <div class="event-lp__form-two"><label>Correo electrónico<input v-model="form.email" type="email" required autocomplete="email" /></label><label>País<combobox v-model="form.country" :options="COUNTRIES" placeholder="Busca tu país" name="country" /></label></div>
            <label v-if="landing.registration.ask_whatsapp">WhatsApp<phone-field v-model="form.whatsapp" /></label>
            <label v-if="isCheckout && editionOffers.length">Tipo de acceso
              <select v-model="form.offer_id" required>
                <option v-for="offer in editionOffers" :key="offer.id" :value="offer.id">{{ offer.name }} · {{ formatPrice(offer) }}</option>
              </select>
            </label>
            <div v-if="isCheckout && selectedOffer" class="event-lp__checkout-summary"><span>Pago seguro mediante {{ selectedOffer.payment_provider === 'epayco' ? 'ePayco' : selectedOffer.payment_provider === 'external' ? 'checkout externo' : 'Wompi' }}</span><strong>{{ formatPrice(selectedOffer) }}</strong></div>
            <label v-if="isApplication">{{ landing.registration.application_question }}<textarea v-model="form.message" rows="4" required placeholder="Cuéntanos brevemente tu contexto, objetivo y disponibilidad."></textarea></label>
            <label class="event-lp__consent"><input v-model="form.consent" type="checkbox" required /><span>{{ landing.registration.consent_label }} <a href="/tratamiento-de-datos" target="_blank" rel="noopener">Ver política</a>.</span></label>
            <label v-if="landing.conversion.social_proof.enabled && landing.conversion.social_proof.mode === 'recent_registrations'" class="event-lp__consent event-lp__consent--optional"><input v-model="form.public_activity_consent" type="checkbox" /><span>Autorizo mostrar mi primer nombre y país como actividad reciente real. Es opcional.</span></label>
            <input v-model="form.website" class="event-lp__hp" tabindex="-1" autocomplete="off" aria-hidden="true" />
            <p v-if="error" class="event-lp__form-error">{{ error }}</p>
            <p v-if="!hasEditions" class="event-lp__form-error">Las inscripciones de esta edición todavía no están abiertas.</p>
            <button class="event-lp__button event-lp__button--primary event-lp__button--block" :disabled="sending || !hasEditions || ctaHidden" @click="editorMode && ($event.preventDefault(),pickEdit('registration.button_label',landing.registration.button_label,'text','Texto del botón'))">{{ sending ? (isCheckout ? 'Preparando pago seguro…' : 'Confirmando…') : landing.registration.button_label }}</button>
            <small class="event-lp__privacy">Registro protegido · No compartimos tus datos con terceros.</small>
          </form>
        </div>
      </section>

      <aside v-if="recentActivityNotice" :key="recentActivityNotice.occurred_at + recentActivityNotice.first_name" class="event-lp__activity-toast" aria-live="polite">
        <span><i></i>Actividad verificada</span>
        <strong>{{ recentActivityNotice.message }}</strong>
      </aside>

      <footer class="event-lp__footer">
        <div><a href="/" class="event-lp__brand"><img src="/assets/icons/mark.svg" alt="" width="30" height="30" /><span><strong>{{ landing.brand.name }}</strong><small>Una experiencia de alto impacto</small></span></a><p>Diseñada por Tonny Dager y ExperientIA S.A.S.</p></div>
        <nav><a href="/privacidad">Privacidad</a><a href="/tratamiento-de-datos">Datos personales</a><a href="/terminos">Términos</a><a href="mailto:hello@tonnydager.com">Soporte</a></nav>
      </footer>

      <a v-if="landing.conversion.sticky_cta && !ctaHidden && !editorMode" class="event-lp__mobile-cta" :href="primaryTarget" @click="trackCta('mobile_sticky', primaryTarget)"><span>{{ landing.hero.primary_cta.label }}</span><b>↗</b></a>
    </template>
  </div>`
};
