import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { api } from '../../assets/js/api.js';
import { track } from '../../assets/js/tracking.js';
import CommercialCta from '../components/CommercialCta.js';

function money(value, currency) {
  if (value === undefined || value === null) return '';
  return new Intl.NumberFormat(currency === 'COP' ? 'es-CO' : 'en-US', {
    style: 'currency',
    currency,
    maximumFractionDigits: currency === 'COP' ? 0 : 0
  }).format(value);
}

export default {
  components: { CommercialCta },
  props: { slug: { type: String, required: true } },
  setup(props) {
    const campaign = ref(null);
    const loading = ref(true);
    const error = ref('');
    const currency = ref('COP');
    const stickyVisible = ref(false);
    let observer = null;

    const offers = computed(() => campaign.value?.offers || {});
    const primaryOfferKey = computed(() => campaign.value?.hero_cta?.offer_key || Object.keys(offers.value)[0] || '');
    const primaryPrice = computed(() => offers.value[primaryOfferKey.value]?.prices?.[currency.value]);
    const priceLabel = computed(() => money(primaryPrice.value, currency.value));
    const virtual = computed(() => campaign.value?.mode === 'virtual');

    function offerPrice(offer) {
      return money(offer?.prices?.[currency.value], currency.value);
    }
    function selectCurrency(value) {
      currency.value = value;
      track('select_currency', {
        campaign_key: campaign.value.key,
        currency: value,
        page_variant: campaign.value.variant
      });
    }
    function nextPrice(offer) {
      return money(offer?.next_prices?.[currency.value], currency.value);
    }
    function ctaKeyForOffer(key) {
      if (key === 'premium') return 'plan_premium';
      if (key === 'general') return 'plan_general';
      if (key === 'reserva') return 'reserve';
      return 'hero_primary';
    }
    function onScroll() {
      stickyVisible.value = window.scrollY > Math.min(620, window.innerHeight * 0.7)
        && window.scrollY + window.innerHeight < document.documentElement.scrollHeight - 380;
    }
    function injectSchema() {
      const current = campaign.value;
      if (!current) return;
      let node = document.getElementById('commercial-schema');
      if (!node) {
        node = document.createElement('script');
        node.id = 'commercial-schema';
        node.type = 'application/ld+json';
        document.head.appendChild(node);
      }
      node.textContent = JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Event',
        name: current.name,
        description: current.lead,
        eventAttendanceMode: current.mode === 'virtual'
          ? 'https://schema.org/OnlineEventAttendanceMode'
          : 'https://schema.org/OfflineEventAttendanceMode',
        organizer: { '@type': 'Organization', name: 'ExperientIA S.A.S.' },
        performer: { '@type': 'Person', name: 'Tonny Dager' },
        url: window.location.href
      });
    }
    function retry() { window.location.reload(); }
    function observeSections() {
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting || entry.target.dataset.tracked === '1') return;
          entry.target.dataset.tracked = '1';
          track(entry.target.dataset.track, {
            campaign_key: campaign.value.key,
            page_variant: campaign.value.variant
          });
        });
      }, { threshold: 0.35 });
      document.querySelectorAll('[data-track]').forEach((node) => observer.observe(node));
    }

    onMounted(async () => {
      try {
        const response = await api.campaign(props.slug);
        if (!response?.data?.campaign) throw new Error('Campaña sin contenido');
        campaign.value = response.data.campaign;
        document.body.classList.add('commercial-page-active');
        injectSchema();
        track('view_landing', {
          campaign_key: campaign.value.key,
          page_variant: campaign.value.variant,
          currency: currency.value
        });
        setTimeout(observeSections, 0);
      } catch (_) {
        error.value = 'No pudimos cargar la información de esta campaña. Reintenta para consultar fechas, precios y disponibilidad vigentes.';
      } finally {
        loading.value = false;
      }
      window.addEventListener('scroll', onScroll, { passive: true });
      onScroll();
    });
    onBeforeUnmount(() => {
      window.removeEventListener('scroll', onScroll);
      observer?.disconnect();
      document.body.classList.remove('commercial-page-active');
      document.getElementById('commercial-schema')?.remove();
    });

    return {
      campaign, loading, error, currency, stickyVisible, offers, primaryOfferKey,
      priceLabel, virtual, offerPrice, nextPrice, ctaKeyForOffer, money, retry, selectCurrency
    };
  },
  template: `
  <div class="commercial-shell">
    <div v-if="loading" class="commercial-state" role="status">
      <span class="commercial-state__pulse"></span>
      <p>Preparando la experiencia…</p>
    </div>

    <div v-else-if="error" class="commercial-state commercial-state--error">
      <h1>No queremos mostrarte información desactualizada.</h1>
      <p>{{ error }}</p>
      <button class="commercial-cta commercial-cta--primary" type="button" @click="retry">Reintentar</button>
    </div>

    <template v-else>
      <header class="commercial-nav">
        <a href="#inicio" class="commercial-brand" aria-label="Ir al inicio">
          <span class="commercial-brand__mark" aria-hidden="true">+</span>
          <span>Marketing para Vender+</span>
        </a>
        <nav aria-label="Navegación de la campaña">
          <a href="#resultado">Resultado</a>
          <a href="#agenda">Agenda</a>
          <a href="#planes">Inversión</a>
          <a href="#faq">Preguntas</a>
        </nav>
      </header>

      <main id="inicio">
        <section class="commercial-hero">
          <div class="commercial-container commercial-hero__grid">
            <div class="commercial-hero__copy">
              <p class="commercial-eyebrow">{{ campaign.eyebrow }}</p>
              <h1>{{ campaign.headline }}</h1>
              <p class="commercial-hero__lead">{{ campaign.lead }}</p>

              <div class="commercial-hero__facts" aria-label="Información principal">
                <span>{{ campaign.dates_label }}</span>
                <span>{{ campaign.schedule_label }}</span>
                <span>{{ campaign.location_label }}</span>
              </div>

              <div class="commercial-hero__actions">
                <commercial-cta :campaign="campaign" :cta-key="campaign.hero_cta.key"
                  :offer-key="campaign.hero_cta.offer_key" :currency="currency"
                  :label="campaign.hero_cta.label" />
                <commercial-cta :campaign="campaign" :cta-key="campaign.secondary_cta.key"
                  :offer-key="campaign.secondary_cta.offer_key" :currency="currency"
                  :label="campaign.secondary_cta.label" variant="secondary" />
              </div>
              <p class="commercial-hero__microcopy">
                <strong>{{ campaign.phase.label }}:</strong> {{ priceLabel }} · {{ campaign.phase.change_copy }}
              </p>
            </div>

            <div class="commercial-hero__visual" aria-label="Ruta de construcción de la campaña">
              <div class="commercial-blueprint">
                <span class="commercial-blueprint__label">Blueprint Vender+</span>
                <div class="commercial-blueprint__node commercial-blueprint__node--active"><span>01</span>Cliente</div>
                <div class="commercial-blueprint__line"></div>
                <div class="commercial-blueprint__node"><span>02</span>Oferta</div>
                <div class="commercial-blueprint__line"></div>
                <div class="commercial-blueprint__node"><span>03</span>Mensaje</div>
                <div class="commercial-blueprint__line"></div>
                <div class="commercial-blueprint__node"><span>04</span>Conversión</div>
                <div class="commercial-blueprint__result">Campaña activable en 30 días</div>
              </div>
            </div>
          </div>
        </section>

        <section class="commercial-authority" aria-label="Experiencia verificable">
          <div class="commercial-container commercial-authority__grid">
            <div v-for="item in campaign.authority" :key="item.value">
              <strong>{{ item.value }}</strong>
              <span>{{ item.label }}</span>
            </div>
          </div>
        </section>

        <section class="commercial-section commercial-section--ink">
          <div class="commercial-container commercial-problem">
            <div>
              <p class="commercial-eyebrow">La verdad incómoda</p>
              <h2>{{ campaign.problem_title }}</h2>
              <p>Antes de invertir más tiempo o dinero, necesitas conectar decisiones que hoy viven separadas.</p>
            </div>
            <ul>
              <li v-for="problem in campaign.problems" :key="problem">{{ problem }}</li>
            </ul>
          </div>
        </section>

        <section id="resultado" class="commercial-section" data-track="view_blueprint">
          <div class="commercial-container">
            <p class="commercial-eyebrow">Resultado tangible</p>
            <h2>{{ campaign.promise_title }}</h2>
            <p class="commercial-section__lead">Construirás un Blueprint que conecta lo que vendes, a quién quieres atraer, qué comunicar, dónde convertir y qué medir.</p>
            <div class="commercial-outcomes">
              <article v-for="(outcome, index) in campaign.outcomes" :key="outcome.title">
                <span>0{{ index + 1 }}</span>
                <h3>{{ outcome.title }}</h3>
                <p>{{ outcome.text }}</p>
              </article>
            </div>
            <div class="commercial-center">
              <commercial-cta :campaign="campaign" cta-key="hero_primary"
                :offer-key="primaryOfferKey" :currency="currency" label="Quiero construir mi Blueprint" />
            </div>
          </div>
        </section>

        <section class="commercial-section commercial-section--soft">
          <div class="commercial-container">
            <p class="commercial-eyebrow">Método Vender+</p>
            <h2>Aprendes una idea, la aplicas y vuelves con evidencia.</h2>
            <div class="commercial-method">
              <article v-for="item in campaign.method" :key="item.step">
                <span>{{ item.step }}</span>
                <h3>{{ item.title }}</h3>
                <p>{{ item.text }}</p>
              </article>
            </div>
          </div>
        </section>

        <section id="agenda" class="commercial-section" data-track="view_agenda">
          <div class="commercial-container">
            <p class="commercial-eyebrow">Ruta de trabajo</p>
            <h2>{{ virtual ? 'Cuatro días. Cuatro decisiones. Un sistema conectado.' : 'Un día intensivo. Una campaña conectada.' }}</h2>
            <div class="commercial-agenda">
              <article v-for="item in campaign.agenda" :key="item.time">
                <time>{{ item.time }}</time>
                <div><h3>{{ item.title }}</h3><p>{{ item.result }}</p></div>
              </article>
            </div>
          </div>
        </section>

        <section class="commercial-section commercial-section--ink">
          <div class="commercial-container commercial-includes">
            <div>
              <p class="commercial-eyebrow">La experiencia continúa</p>
              <h2>Tu acceso no termina cuando Tonny apaga la cámara.</h2>
              <p>Vender+ Studio conserva tus decisiones y te ayuda a construir sin volver a empezar desde cero.</p>
            </div>
            <ul>
              <li v-for="item in campaign.includes" :key="item">{{ item }}</li>
            </ul>
          </div>
        </section>

        <section class="commercial-section">
          <div class="commercial-container">
            <div class="commercial-fit">
              <article>
                <p class="commercial-eyebrow">Sí es para ti si…</p>
                <ul><li v-for="item in campaign.fit" :key="item">{{ item }}</li></ul>
              </article>
              <article class="commercial-fit__not">
                <p class="commercial-eyebrow">No es para ti si…</p>
                <ul><li v-for="item in campaign.not_fit" :key="item">{{ item }}</li></ul>
              </article>
            </div>
          </div>
        </section>

        <section id="planes" class="commercial-section commercial-section--plans" data-track="view_pricing">
          <div class="commercial-container">
            <p class="commercial-eyebrow">Inversión</p>
            <h2>{{ virtual ? 'Elige cuánto acompañamiento necesitas.' : 'Reserva tu lugar con información clara.' }}</h2>

            <div v-if="virtual" class="commercial-currency" role="group" aria-label="Moneda">
              <button type="button" :class="{ 'is-active': currency === 'COP' }" @click="selectCurrency('COP')">COP</button>
              <button type="button" :class="{ 'is-active': currency === 'USD' }" @click="selectCurrency('USD')">USD</button>
            </div>

            <div class="commercial-plans" :class="{ 'commercial-plans--single': !virtual }">
              <article v-for="(offer, key) in offers" :key="key"
                :class="{ 'commercial-plan--featured': key === 'premium' || (!virtual && key === 'presencial'), 'commercial-plan--reserve': key === 'reserva' }"
                class="commercial-plan">
                <p class="commercial-plan__badge">{{ offer.badge || offer.name }}</p>
                <h3>{{ offer.name }}</h3>
                <p class="commercial-plan__price">{{ offerPrice(offer) }}</p>
                <p v-if="nextPrice(offer)" class="commercial-plan__next">Próximo precio: {{ nextPrice(offer) }}</p>
                <ul v-if="offer.features">
                  <li v-for="feature in offer.features" :key="feature">{{ feature }}</li>
                </ul>
                <p v-else-if="key === 'reserva'" class="commercial-plan__description">Separa tu cupo hoy y completa el saldo a más tardar el 5 de agosto.</p>
                <p v-else class="commercial-plan__description">Acceso completo a la jornada presencial y a los recursos publicados.</p>
                <commercial-cta :campaign="campaign" :cta-key="ctaKeyForOffer(key)"
                  :offer-key="key" :currency="currency"
                  :label="key === 'premium' ? 'Quiero Premium' : key === 'general' ? 'Elegir General' : key === 'reserva' ? 'Reservar mi cupo' : 'Quiero construir mi campaña'"
                  :variant="key === 'reserva' ? 'secondary' : 'primary'" />
                <small>Pago seguro cuando la pasarela esté configurada · Confirmación verificable</small>
              </article>
            </div>
            <p class="commercial-risk">Marketing para Vender+ ofrece formación, herramientas y acompañamiento. No promete resultados económicos automáticos. Antes de pagar verás el valor, la moneda y las condiciones vigentes.</p>
          </div>
        </section>

        <section id="faq" class="commercial-section">
          <div class="commercial-container commercial-faq-wrap">
            <div>
              <p class="commercial-eyebrow">Preguntas frecuentes</p>
              <h2>Compra por claridad, no por presión.</h2>
            </div>
            <div class="commercial-faq">
              <details v-for="item in campaign.faq" :key="item.q">
                <summary>{{ item.q }}</summary>
                <p>{{ item.a }}</p>
              </details>
            </div>
          </div>
        </section>

        <section class="commercial-close">
          <div class="commercial-container">
            <p class="commercial-eyebrow">Tu siguiente decisión</p>
            <h2>Tu próxima campaña no debería comenzar en una plataforma.</h2>
            <p>Debería comenzar con una oferta clara, un mensaje que se entiende y una ruta que puedas medir.</p>
            <commercial-cta :campaign="campaign" cta-key="final"
              :offer-key="primaryOfferKey" :currency="currency"
              :label="virtual ? 'Ver planes y elegir mi acceso' : 'Quiero construir mi campaña'" />
          </div>
        </section>
      </main>

      <footer class="commercial-footer">
        <div class="commercial-container">
          <span>{{ campaign.brand }}</span>
          <nav aria-label="Información legal">
            <router-link to="/privacidad">Privacidad</router-link>
            <router-link to="/terminos">Términos</router-link>
            <router-link to="/tratamiento-de-datos">Tratamiento de datos</router-link>
          </nav>
        </div>
      </footer>

      <div class="commercial-sticky" :class="{ 'is-visible': stickyVisible }">
        <div><small>{{ campaign.phase.label }}</small><strong>{{ priceLabel }}</strong></div>
        <commercial-cta :campaign="campaign" :cta-key="campaign.hero_cta.key"
          :offer-key="campaign.hero_cta.offer_key" :currency="currency"
          :label="virtual ? 'Elegir acceso' : 'Reservar'" compact />
      </div>
    </template>
  </div>
  `
};
