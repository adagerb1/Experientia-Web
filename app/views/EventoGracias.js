import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../../assets/js/api.js?v=20260726-2';
import { track } from '../../assets/js/tracking.js?v=20260726-2';
import { normalizeEventLanding } from '../data/eventLanding.js?v=20260726-2';

export default {
  setup() {
    const route = useRoute();
    const experience = ref(null);
    const loading = ref(true);
    const error = ref('');
    const payment = ref(null);
    const checkingPayment = ref(false);
    let paymentTimer = null;
    const landing = computed(() => normalizeEventLanding(experience.value || {}));
    const edition = computed(() => {
      const editions = experience.value?.editions || [];
      const editionId = route.query.edition || payment.value?.edition_id || '';
      return editions.find((item) => String(item.id) === String(editionId)) || editions[0] || null;
    });
    const hasPayment = computed(() => Boolean(route.query.ref));
    const paymentApproved = computed(() => payment.value?.status === 'approved' || payment.value?.enrollment_status === 'confirmed');
    const paymentFailed = computed(() => ['failed', 'declined', 'voided', 'error'].includes(payment.value?.status)
      || payment.value?.enrollment_status === 'payment_failed');
    const paymentPending = computed(() => hasPayment.value && !paymentApproved.value && !paymentFailed.value);

    async function checkPayment() {
      if (!route.query.ref || checkingPayment.value) return;
      checkingPayment.value = true;
      const result = await api.eventPayment(route.params.slug, String(route.query.ref));
      if (result.success && result.data) {
        payment.value = result.data;
        if (paymentApproved.value || paymentFailed.value) clearInterval(paymentTimer);
      }
      checkingPayment.value = false;
    }

    function formatDate(value, timezone = 'America/Bogota') {
      if (!value) return 'Revisa la confirmación que recibirás por correo.';
      try {
        return new Intl.DateTimeFormat('es-CO', {
          weekday: 'long',
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

    async function load() {
      loading.value = true;
      const result = await api.eventPublic(route.params.slug);
      if (result.success && result.data) {
        experience.value = result.data;
        document.title = route.query.ref
          ? `Estado del pago — ${result.data.title}`
          : `Registro confirmado — ${result.data.title}`;
        track('event_thank_you_viewed', {
          experience: route.params.slug,
          model: landing.value.model,
        });
        if (route.query.ref) {
          await checkPayment();
          if (paymentPending.value) paymentTimer = setInterval(checkPayment, 3500);
        }
      } else {
        error.value = result.message || result.error || 'No encontramos esta experiencia.';
      }
      loading.value = false;
    }

    onMounted(load);
    onUnmounted(() => clearInterval(paymentTimer));
    return {
      experience, landing, edition, loading, error, payment, hasPayment, paymentApproved,
      paymentFailed, paymentPending, checkingPayment, formatDate, checkPayment, year: new Date().getFullYear()
    };
  },
  template: `
  <div class="event-thanks" :class="landing.themeClass" :style="landing.themeStyle">
    <div v-if="loading" class="event-lp__loading"><span class="event-lp__loader"></span><p>Confirmando tu experiencia…</p></div>
    <section v-else-if="error" class="event-lp__unavailable"><img src="/assets/icons/mark.svg" alt="" width="54" height="54" /><h1>No pudimos cargar la confirmación</h1><p>{{ error }}</p><router-link class="event-lp__button event-lp__button--primary" to="/">Volver al inicio</router-link></section>
    <template v-else>
      <header class="event-thanks__header">
        <a href="/" class="event-lp__brand"><img src="/assets/icons/mark.svg" alt="" width="34" height="34" /><span><strong>{{ landing.brand.name }}</strong><small>{{ experience.title }}</small></span></a>
      </header>
      <main class="event-thanks__main">
        <div class="event-thanks__signal" :class="{'is-pending':paymentPending,'is-failed':paymentFailed}" aria-hidden="true"><span>{{ paymentPending ? '···' : paymentFailed ? '!' : '✓' }}</span><i></i><i></i></div>
        <p class="event-lp__eyebrow">{{ paymentPending ? 'Verificando con la pasarela' : paymentFailed ? 'Pago no confirmado' : landing.registration.success.eyebrow }}</p>
        <h1>{{ paymentPending ? 'Estamos confirmando tu pago' : paymentFailed ? 'Tu pago no pudo completarse' : landing.registration.success.headline }}</h1>
        <p class="event-thanks__lead">{{ paymentPending ? 'La pasarela todavía está procesando la transacción. Esta página se actualizará automáticamente; no cierres ni repitas el pago.' : paymentFailed ? 'No se realizó ningún cargo confirmado. Puedes volver a la experiencia y reintentar con el mismo u otro medio de pago.' : landing.registration.success.body }}</p>
        <div v-if="edition" class="event-thanks__date"><small>Próxima edición</small><strong>{{ formatDate(edition.starts_at, edition.timezone) }}</strong><span>{{ edition.timezone }}</span></div>
        <section v-if="!paymentPending && !paymentFailed" class="event-thanks__steps" aria-label="Siguientes pasos">
          <article v-for="(step,index) in landing.registration.success.steps" :key="step.title">
            <span>{{ step.number || String(index + 1).padStart(2,'0') }}</span><div><h2>{{ step.title }}</h2><p>{{ step.text }}</p></div>
          </article>
        </section>
        <div class="event-thanks__actions">
          <button v-if="paymentPending" class="event-lp__button event-lp__button--ghost" :disabled="checkingPayment" @click="checkPayment">{{ checkingPayment ? 'Consultando…' : 'Verificar ahora' }}</button>
          <a v-if="!paymentPending && !paymentFailed && landing.registration.success.whatsapp_url" class="event-lp__button event-lp__button--primary" :href="landing.registration.success.whatsapp_url" target="_blank" rel="noopener">{{ landing.registration.success.whatsapp_label }} ↗</a>
          <router-link class="event-lp__button" :class="paymentFailed ? 'event-lp__button--primary' : 'event-lp__button--ghost'" :to="'/eventos/' + $route.params.slug">{{ paymentFailed ? 'Volver a elegir mi acceso' : 'Volver a la experiencia' }}</router-link>
        </div>
        <p class="event-thanks__support">¿No recibes la confirmación? Revisa spam y promociones o escríbenos a <a href="mailto:hello@tonnydager.com">hello@tonnydager.com</a>.</p>
      </main>
      <footer class="event-thanks__footer">© {{ year }} Tonny Dager · ExperientIA S.A.S.</footer>
    </template>
  </div>`
};
