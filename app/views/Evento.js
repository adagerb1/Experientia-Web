import { ref, reactive, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { api } from '../../assets/js/api.js';
import { track } from '../../assets/js/tracking.js';
import { prefill, saveLead, getUtm } from '../../assets/js/leadStore.js';
import { normalizeEventLanding, safeEventUrl } from '../data/eventLanding.js?v=20260724-1';

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

function injectEventSchema(experience, landing) {
  let script = document.getElementById('event-schema');
  if (!script) {
    script = document.createElement('script');
    script.id = 'event-schema';
    script.type = 'application/ld+json';
    document.head.appendChild(script);
  }
  const edition = experience.editions?.[0];
  const offer = landing.offers?.[0];
  const facilitator = landing.blocks?.find((block) => block.type === 'facilitator' && block.person)?.person;
  const schema = {
    '@context': 'https://schema.org',
    '@type': 'Event',
    name: experience.title,
    description: landing.seo.description,
    url: location.href.split('#')[0],
    eventStatus: 'https://schema.org/EventScheduled',
    organizer: { '@type': 'Organization', name: landing.brand.name, url: 'https://tonnydager.com' },
  };
  if (facilitator?.name) {
    schema.performer = { '@type': 'Person', name: facilitator.name };
    if (facilitator.name === 'Tonny Dager') schema.performer.url = 'https://tonnydager.com/sobre-tonny-dager';
  }
  if (edition?.starts_at) schema.startDate = String(edition.starts_at).replace(' ', 'T');
  if (edition?.ends_at) schema.endDate = String(edition.ends_at).replace(' ', 'T');
  if (landing.seo.image_url) schema.image = [landing.seo.image_url];
  if (offer?.price) {
    schema.offers = {
      '@type': 'Offer',
      price: String(offer.price),
      priceCurrency: offer.currency || 'COP',
      url: offer.checkout_url || location.href.split('#')[0] + '#event-register',
      availability: 'https://schema.org/InStock',
    };
  }
  script.textContent = JSON.stringify(schema);
}

export default {
  setup() {
    const route = useRoute();
    const router = useRouter();
    const experience = ref(null);
    const loading = ref(true);
    const sending = ref(false);
    const error = ref('');
    const formStarted = ref(false);
    const form = reactive({ edition_id: '', name: '', email: '', whatsapp: '', company: '', message: '', consent: false, website: '' });

    const landing = computed(() => normalizeEventLanding(experience.value || {}));
    const selectedEdition = computed(() => experience.value?.editions?.find((edition) => String(edition.id) === String(form.edition_id)));
    const seats = computed(() => {
      if (landing.value.registration.mode !== 'form') return null;
      const edition = selectedEdition.value;
      if (!edition || !Number(edition.capacity)) return null;
      return Math.max(0, Number(edition.capacity) - Number(edition.enrolled || 0));
    });
    const registrationVisible = computed(() => landing.value.registration.mode !== 'checkout');
    const isApplication = computed(() => landing.value.registration.mode === 'application');
    const hasEditions = computed(() => Boolean(experience.value?.editions?.length));
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

    function isCardBlock(type) { return CARD_BLOCKS.has(type); }
    function isTimelineBlock(type) { return TIMELINE_BLOCKS.has(type); }
    function ctaTarget(block = null) {
      const target = safeEventUrl(block?.primary_cta?.target, primaryTarget.value);
      if (landing.value.registration.mode === 'checkout' && target.startsWith('#')) {
        return landing.value.registration.checkout_url || primaryTarget.value;
      }
      return target;
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

    async function load() {
      loading.value = true;
      error.value = '';
      const result = await api.eventPublic(route.params.slug);
      if (result.success && result.data) {
        experience.value = result.data;
        if (result.data.editions?.length) form.edition_id = result.data.editions[0].id;
        prefill(form);
        document.title = landing.value.seo.title;
        setMeta('meta[name="description"]', 'content', landing.value.seo.description);
        setMeta('meta[property="og:title"]', 'content', landing.value.seo.title);
        setMeta('meta[property="og:description"]', 'content', landing.value.seo.description);
        if (landing.value.seo.image_url) setMeta('meta[property="og:image"]', 'content', landing.value.seo.image_url);
        injectEventSchema(result.data, landing.value);
        track('event_landing_viewed', {
          experience: route.params.slug,
          model: landing.value.model,
          schema: landing.value.schemaVersion,
        });
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

    onMounted(load);
    return {
      experience,
      landing,
      loading,
      sending,
      error,
      form,
      selectedEdition,
      seats,
      registrationVisible,
      isApplication,
      hasEditions,
      heroCards,
      primaryTarget,
      formatDate,
      formatPrice,
      isCardBlock,
      isTimelineBlock,
      ctaTarget,
      trackCta,
      startForm,
      register,
    };
  },
  template: `
  <div class="event-lp" :class="[landing.themeClass, 'event-model--' + landing.model]" :style="landing.themeStyle">
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
      <div v-if="landing.announcement" class="event-lp__announcement">{{ landing.announcement }}</div>
      <header class="event-lp__nav">
        <a href="#event-top" class="event-lp__brand" aria-label="Volver al inicio de la experiencia">
          <img src="/assets/icons/mark.svg" alt="" width="34" height="34" />
          <span><strong>{{ landing.brand.name }}</strong><small>{{ landing.brand.descriptor }}</small></span>
        </a>
        <nav v-if="landing.navigation.length" aria-label="Contenido de la experiencia">
          <a v-for="item in landing.navigation" :key="item.target" :href="item.target">{{ item.label }}</a>
        </nav>
        <a class="event-lp__nav-cta" :href="primaryTarget" @click="trackCta('navigation', primaryTarget)">{{ landing.hero.primary_cta.label }}</a>
      </header>

      <section id="event-top" class="event-lp__hero">
        <div class="event-lp__orb event-lp__orb--one" aria-hidden="true"></div>
        <div class="event-lp__orb event-lp__orb--two" aria-hidden="true"></div>
        <div class="event-lp__container event-lp__hero-grid">
          <div class="event-lp__hero-copy">
            <div class="event-lp__hero-kicker"><span></span>{{ landing.hero.eyebrow }}</div>
            <h1>{{ landing.hero.headline }}</h1>
            <p class="event-lp__hero-lead">{{ landing.hero.subheadline }}</p>
            <p v-if="landing.hero.supporting" class="event-lp__hero-support">{{ landing.hero.supporting }}</p>
            <div v-if="landing.hero.facts.length" class="event-lp__facts">
              <div v-for="fact in landing.hero.facts" :key="fact.title + fact.text">
                <small>{{ fact.title }}</small><strong>{{ fact.text }}</strong>
              </div>
            </div>
            <div class="event-lp__hero-actions">
              <a class="event-lp__button event-lp__button--primary" :href="primaryTarget" @click="trackCta('hero', primaryTarget)">
                {{ landing.hero.primary_cta.label }} <span>↗</span>
              </a>
              <a v-if="landing.hero.secondary_cta.label && landing.hero.secondary_cta.target" class="event-lp__button event-lp__button--ghost" :href="landing.hero.secondary_cta.target" @click="trackCta('hero_secondary', landing.hero.secondary_cta.target)">
                {{ landing.hero.secondary_cta.label }}
              </a>
            </div>
            <div v-if="landing.hero.trust.length" class="event-lp__hero-trust">
              <span v-for="item in landing.hero.trust" :key="item">✓ {{ item }}</span>
            </div>
          </div>

          <aside v-if="landing.model === 'lead_event' && registrationVisible" id="event-register" class="event-lp__capture">
            <div class="event-lp__capture-head"><span>Acceso</span><h2>{{ landing.registration.title }}</h2><p>{{ landing.registration.description }}</p></div>
            <form @submit.prevent="register" @focusin="startForm">
              <label v-if="experience.editions?.length > 1">Edición
                <select v-model="form.edition_id" required><option v-for="edition in experience.editions" :key="edition.id" :value="edition.id">{{ edition.name }} · {{ formatDate(edition.starts_at, edition.timezone) }}</option></select>
              </label>
              <label>Nombre completo<input v-model="form.name" required autocomplete="name" placeholder="¿Cómo te llamas?" /></label>
              <label>Correo electrónico<input v-model="form.email" type="email" required autocomplete="email" placeholder="tu@correo.com" /></label>
              <label v-if="landing.registration.ask_whatsapp">WhatsApp<input v-model="form.whatsapp" autocomplete="tel" placeholder="+57 300 000 0000" /></label>
              <label v-if="landing.registration.ask_company">Empresa<input v-model="form.company" autocomplete="organization" placeholder="Tu empresa" /></label>
              <label class="event-lp__consent"><input v-model="form.consent" type="checkbox" required /><span>{{ landing.registration.consent_label }} <a href="/tratamiento-de-datos" target="_blank" rel="noopener">Ver política</a>.</span></label>
              <input v-model="form.website" class="event-lp__hp" tabindex="-1" autocomplete="off" aria-hidden="true" />
              <p v-if="seats !== null" class="event-lp__seats">{{ seats > 0 ? seats + ' lugares disponibles en esta edición' : 'Lista de espera disponible' }}</p>
              <p v-if="error" class="event-lp__form-error">{{ error }}</p>
              <p v-if="!hasEditions" class="event-lp__form-error">Las inscripciones de esta edición todavía no están abiertas.</p>
              <button class="event-lp__button event-lp__button--primary event-lp__button--block" :disabled="sending || !hasEditions">{{ sending ? 'Confirmando…' : landing.registration.button_label }}</button>
              <small class="event-lp__privacy">Datos protegidos · Se usan únicamente para gestionar esta experiencia.</small>
            </form>
          </aside>

          <aside v-else class="event-lp__hero-stage">
            <div v-if="landing.hero.media.url" class="event-lp__hero-media">
              <video v-if="landing.hero.media.type === 'video'" :src="landing.hero.media.url" muted autoplay loop playsinline></video>
              <img v-else :src="landing.hero.media.url" :alt="landing.hero.media.alt" />
            </div>
            <div v-else class="event-lp__signal">
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

      <section v-if="landing.hero.trust.length" class="event-lp__trustbar">
        <div class="event-lp__container"><small>Diseñada para avanzar</small><span v-for="item in landing.hero.trust" :key="'bar-' + item">{{ item }}</span></div>
      </section>

      <template v-for="block in landing.blocks" :key="block.id">
        <section v-if="isCardBlock(block.type) && (block.items.length || block.headline || block.body)" :id="block.id" class="event-lp__section event-lp__cards-section" :class="'event-lp__section--' + block.theme">
          <div class="event-lp__container">
            <header class="event-lp__section-head">
              <div><p class="event-lp__eyebrow">{{ block.eyebrow }}</p><h2>{{ block.headline }}</h2></div>
              <p v-if="block.body">{{ block.body }}</p>
            </header>
            <div v-if="block.items.length" class="event-lp__card-grid" :class="'event-lp__card-grid--' + Math.min(block.items.length, 4)">
              <article v-for="(item,index) in block.items" :key="item.title + index">
                <span class="event-lp__card-number">{{ item.icon || item.number || String(index + 1).padStart(2,'0') }}</span>
                <small v-if="item.tag">{{ item.tag }}</small>
                <h3>{{ item.title }}</h3><p v-if="item.text">{{ item.text }}</p><b v-if="item.meta">{{ item.meta }}</b>
              </article>
            </div>
          </div>
        </section>

        <section v-else-if="isTimelineBlock(block.type) && block.timeline.length" :id="block.id" class="event-lp__section event-lp__timeline-section" :class="'event-lp__section--' + block.theme">
          <div class="event-lp__container">
            <header class="event-lp__section-head">
              <div><p class="event-lp__eyebrow">{{ block.eyebrow }}</p><h2>{{ block.headline }}</h2></div>
              <p v-if="block.body">{{ block.body }}</p>
            </header>
            <div class="event-lp__timeline">
              <article v-for="(item,index) in block.timeline" :key="item.title + index">
                <div class="event-lp__timeline-marker"><span>{{ item.number || String(index + 1).padStart(2,'0') }}</span></div>
                <div class="event-lp__timeline-copy">
                  <div class="event-lp__timeline-meta"><span v-if="item.date">{{ item.date }}</span><span v-if="item.time">{{ item.time }}</span><span v-if="item.duration">{{ item.duration }}</span></div>
                  <small v-if="item.eyebrow">{{ item.eyebrow }}</small><h3>{{ item.title }}</h3><p v-if="item.text">{{ item.text }}</p>
                  <ul v-if="item.points.length"><li v-for="point in item.points" :key="point">{{ point }}</li></ul>
                  <div v-if="item.deliverable" class="event-lp__deliverable"><span>Resultado</span>{{ item.deliverable }}</div>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section v-else-if="block.type === 'audience' && (block.for_whom.length || block.not_for.length)" :id="block.id" class="event-lp__section event-lp__audience" :class="'event-lp__section--' + block.theme">
          <div class="event-lp__container">
            <header class="event-lp__section-head"><div><p class="event-lp__eyebrow">{{ block.eyebrow }}</p><h2>{{ block.headline }}</h2></div><p v-if="block.body">{{ block.body }}</p></header>
            <div class="event-lp__audience-grid">
              <article class="event-lp__audience-yes"><span>Para quién sí</span><ul><li v-for="item in block.for_whom" :key="item"><b>✓</b>{{ item }}</li></ul></article>
              <article class="event-lp__audience-no"><span>Para quién no</span><ul><li v-for="item in block.not_for" :key="item"><b>×</b>{{ item }}</li></ul></article>
            </div>
          </div>
        </section>

        <section v-else-if="block.type === 'facilitator' && block.person" :id="block.id" class="event-lp__section event-lp__facilitator" :class="'event-lp__section--' + block.theme">
          <div class="event-lp__container event-lp__facilitator-grid">
            <div class="event-lp__facilitator-photo"><div class="event-lp__photo-glow"></div><img v-if="block.person.image_url" :src="block.person.image_url" :alt="block.person.name" loading="lazy" /><span v-else>{{ block.person.name.split(' ').map(part=>part[0]).slice(0,2).join('') }}</span></div>
            <div><p class="event-lp__eyebrow">{{ block.eyebrow }}</p><h2>{{ block.headline }}</h2><span class="event-lp__person-name">{{ block.person.name }}</span><strong class="event-lp__person-role">{{ block.person.role }}</strong><p>{{ block.person.bio }}</p><ul><li v-for="credential in block.person.credentials" :key="credential">{{ credential }}</li></ul></div>
          </div>
        </section>

        <section v-else-if="block.type === 'speakers' && block.people.length" :id="block.id" class="event-lp__section" :class="'event-lp__section--' + block.theme">
          <div class="event-lp__container">
            <header class="event-lp__section-head"><div><p class="event-lp__eyebrow">{{ block.eyebrow }}</p><h2>{{ block.headline }}</h2></div><p v-if="block.body">{{ block.body }}</p></header>
            <div class="event-lp__people">
              <article v-for="person in block.people" :key="person.name">
                <div class="event-lp__people-photo"><img v-if="person.image_url" :src="person.image_url" :alt="person.name" loading="lazy" /><span v-else>{{ person.name.split(' ').map(part=>part[0]).slice(0,2).join('') }}</span></div>
                <h3>{{ person.name }}</h3><strong>{{ person.role }}</strong><p v-if="person.topic">{{ person.topic }}</p>
              </article>
            </div>
          </div>
        </section>

        <section v-else-if="block.type === 'venue' && block.location" :id="block.id" class="event-lp__section event-lp__venue" :class="'event-lp__section--' + block.theme">
          <div class="event-lp__container event-lp__venue-grid">
            <div><p class="event-lp__eyebrow">{{ block.eyebrow }}</p><h2>{{ block.headline }}</h2><p>{{ block.body }}</p><strong>{{ block.location.name }}</strong><span>{{ block.location.address }}<template v-if="block.location.city"> · {{ block.location.city }}</template></span><p>{{ block.location.detail }}</p><a v-if="block.location.map_url" :href="block.location.map_url" target="_blank" rel="noopener">Ver ubicación ↗</a></div>
            <div class="event-lp__venue-visual" :style="block.location.image_url ? { backgroundImage: 'url(' + block.location.image_url + ')' } : {}"><span v-if="!block.location.image_url">Ubicación<br/>de la experiencia</span></div>
          </div>
        </section>

        <section v-else-if="block.type === 'proof' && (block.metrics.length || block.testimonials.length)" :id="block.id" class="event-lp__section event-lp__proof" :class="'event-lp__section--' + block.theme">
          <div class="event-lp__container">
            <header class="event-lp__section-head"><div><p class="event-lp__eyebrow">{{ block.eyebrow }}</p><h2>{{ block.headline }}</h2></div><p v-if="block.body">{{ block.body }}</p></header>
            <div v-if="block.metrics.length" class="event-lp__metrics"><article v-for="metric in block.metrics" :key="metric.title"><strong>{{ metric.title }}</strong><span>{{ metric.text }}</span></article></div>
            <div v-if="block.testimonials.length" class="event-lp__testimonials"><blockquote v-for="item in block.testimonials" :key="item.quote"><p>“{{ item.quote }}”</p><footer><strong>{{ item.name }}</strong><span>{{ item.role }}</span></footer></blockquote></div>
          </div>
        </section>

        <section v-else-if="block.type === 'offer' && block.plans.length" :id="block.id" class="event-lp__section event-lp__offer" :class="'event-lp__section--' + block.theme">
          <div class="event-lp__container">
            <header class="event-lp__section-head event-lp__section-head--center"><div><p class="event-lp__eyebrow">{{ block.eyebrow }}</p><h2>{{ block.headline }}</h2></div><p v-if="block.body">{{ block.body }}</p></header>
            <div class="event-lp__plans" :class="{'event-lp__plans--single':block.plans.length===1}">
              <article v-for="plan in block.plans" :key="plan.name" :class="{featured:plan.featured}">
                <span v-if="plan.badge" class="event-lp__plan-badge">{{ plan.badge }}</span>
                <small>{{ plan.edition_name }}</small><h3>{{ plan.name }}</h3><p>{{ plan.description }}</p>
                <div class="event-lp__price"><del v-if="plan.compare_at">{{ plan.compare_at }}</del><strong>{{ formatPrice(plan) }}</strong><span>{{ plan.cadence }}</span></div>
                <ul><li v-for="feature in plan.features" :key="feature"><b>✓</b>{{ feature }}</li></ul>
                <a class="event-lp__button" :class="plan.featured ? 'event-lp__button--primary' : 'event-lp__button--ghost'" :href="plan.checkout_url || landing.registration.checkout_url || '#event-register'" @click="trackCta('plan_' + plan.name, plan.checkout_url || landing.registration.checkout_url || '#event-register')">{{ plan.cta_label }} <span>↗</span></a>
              </article>
            </div>
            <p v-if="block.guarantee" class="event-lp__guarantee">◈ {{ block.guarantee }}</p><p v-if="block.note" class="event-lp__offer-note">{{ block.note }}</p>
          </div>
        </section>

        <section v-else-if="block.type === 'faq' && block.questions.length" :id="block.id" class="event-lp__section event-lp__faq" :class="'event-lp__section--' + block.theme">
          <div class="event-lp__container event-lp__faq-grid">
            <header><p class="event-lp__eyebrow">{{ block.eyebrow }}</p><h2>{{ block.headline }}</h2><p>{{ block.body }}</p></header>
            <div><details v-for="(item,index) in block.questions" :key="item.q"><summary><span>{{ String(index + 1).padStart(2,'0') }}</span>{{ item.q }}<b>＋</b></summary><p>{{ item.a }}</p></details></div>
          </div>
        </section>

        <section v-else-if="block.type === 'closing'" :id="block.id" class="event-lp__closing">
          <div class="event-lp__container"><p class="event-lp__eyebrow">{{ block.eyebrow }}</p><h2>{{ block.headline }}</h2><p>{{ block.body }}</p><a class="event-lp__button event-lp__button--primary" :href="ctaTarget(block)" @click="trackCta('closing', ctaTarget(block))">{{ block.primary_cta.label || landing.hero.primary_cta.label }} <span>↗</span></a></div>
        </section>
      </template>

      <section v-if="registrationVisible && landing.model !== 'lead_event'" id="event-register" class="event-lp__section event-lp__register">
        <div class="event-lp__container event-lp__register-grid">
          <div class="event-lp__register-copy"><p class="event-lp__eyebrow">Tu siguiente paso</p><h2>{{ landing.registration.title }}</h2><p>{{ landing.registration.description }}</p>
            <div v-if="selectedEdition" class="event-lp__selected-edition"><small>Edición seleccionada</small><strong>{{ selectedEdition.name }}</strong><span>{{ formatDate(selectedEdition.starts_at, selectedEdition.timezone) }}</span><b v-if="seats !== null">{{ seats }} cupos disponibles</b></div>
          </div>
          <form class="event-lp__form" @submit.prevent="register" @focusin="startForm">
            <label v-if="experience.editions?.length">Edición
              <select v-model="form.edition_id" required><option v-for="edition in experience.editions" :key="edition.id" :value="edition.id">{{ edition.name }} · {{ formatDate(edition.starts_at, edition.timezone) }}</option></select>
            </label>
            <div class="event-lp__form-two" :class="{'event-lp__form-two--single':!landing.registration.ask_company}"><label>Nombre completo<input v-model="form.name" required autocomplete="name" /></label><label v-if="landing.registration.ask_company">Empresa<input v-model="form.company" autocomplete="organization" /></label></div>
            <div class="event-lp__form-two" :class="{'event-lp__form-two--single':!landing.registration.ask_whatsapp}"><label>Correo electrónico<input v-model="form.email" type="email" required autocomplete="email" /></label><label v-if="landing.registration.ask_whatsapp">WhatsApp<input v-model="form.whatsapp" autocomplete="tel" /></label></div>
            <label v-if="isApplication">{{ landing.registration.application_question }}<textarea v-model="form.message" rows="4" required placeholder="Cuéntanos brevemente tu contexto, objetivo y disponibilidad."></textarea></label>
            <label class="event-lp__consent"><input v-model="form.consent" type="checkbox" required /><span>{{ landing.registration.consent_label }} <a href="/tratamiento-de-datos" target="_blank" rel="noopener">Ver política</a>.</span></label>
            <input v-model="form.website" class="event-lp__hp" tabindex="-1" autocomplete="off" aria-hidden="true" />
            <p v-if="error" class="event-lp__form-error">{{ error }}</p>
            <p v-if="!hasEditions" class="event-lp__form-error">Las inscripciones de esta edición todavía no están abiertas.</p>
            <button class="event-lp__button event-lp__button--primary event-lp__button--block" :disabled="sending || !hasEditions">{{ sending ? 'Confirmando…' : landing.registration.button_label }}</button>
            <small class="event-lp__privacy">Registro protegido · No compartimos tus datos con terceros.</small>
          </form>
        </div>
      </section>

      <footer class="event-lp__footer">
        <div><a href="/" class="event-lp__brand"><img src="/assets/icons/mark.svg" alt="" width="30" height="30" /><span><strong>{{ landing.brand.name }}</strong><small>Una experiencia de alto impacto</small></span></a><p>Diseñada por Tonny Dager y ExperientIA S.A.S.</p></div>
        <nav><a href="/privacidad">Privacidad</a><a href="/tratamiento-de-datos">Datos personales</a><a href="/terminos">Términos</a><a href="mailto:hello@tonnydager.com">Soporte</a></nav>
      </footer>

      <a class="event-lp__mobile-cta" :href="primaryTarget" @click="trackCta('mobile_sticky', primaryTarget)"><span>{{ landing.hero.primary_cta.label }}</span><b>↗</b></a>
    </template>
  </div>`
};
