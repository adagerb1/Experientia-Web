import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../../assets/js/api.js';
import { track } from '../../assets/js/tracking.js';
import { normalizeEventLanding } from '../data/eventLanding.js?v=20260724-1';

export default {
  setup() {
    const route = useRoute();
    const experience = ref(null);
    const loading = ref(true);
    const error = ref('');
    const landing = computed(() => normalizeEventLanding(experience.value || {}));
    const edition = computed(() => {
      const editions = experience.value?.editions || [];
      return editions.find((item) => String(item.id) === String(route.query.edition || '')) || editions[0] || null;
    });

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
        document.title = `Registro confirmado — ${result.data.title}`;
        track('event_thank_you_viewed', {
          experience: route.params.slug,
          model: landing.value.model,
        });
      } else {
        error.value = result.message || result.error || 'No encontramos esta experiencia.';
      }
      loading.value = false;
    }

    onMounted(load);
    return { experience, landing, edition, loading, error, formatDate, year: new Date().getFullYear() };
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
        <div class="event-thanks__signal" aria-hidden="true"><span>✓</span><i></i><i></i></div>
        <p class="event-lp__eyebrow">{{ landing.registration.success.eyebrow }}</p>
        <h1>{{ landing.registration.success.headline }}</h1>
        <p class="event-thanks__lead">{{ landing.registration.success.body }}</p>
        <div v-if="edition" class="event-thanks__date"><small>Próxima edición</small><strong>{{ formatDate(edition.starts_at, edition.timezone) }}</strong><span>{{ edition.timezone }}</span></div>
        <section class="event-thanks__steps" aria-label="Siguientes pasos">
          <article v-for="(step,index) in landing.registration.success.steps" :key="step.title">
            <span>{{ step.number || String(index + 1).padStart(2,'0') }}</span><div><h2>{{ step.title }}</h2><p>{{ step.text }}</p></div>
          </article>
        </section>
        <div class="event-thanks__actions">
          <a v-if="landing.registration.success.whatsapp_url" class="event-lp__button event-lp__button--primary" :href="landing.registration.success.whatsapp_url" target="_blank" rel="noopener">{{ landing.registration.success.whatsapp_label }} ↗</a>
          <router-link class="event-lp__button event-lp__button--ghost" :to="'/eventos/' + $route.params.slug">Volver a la experiencia</router-link>
        </div>
        <p class="event-thanks__support">¿No recibes la confirmación? Revisa spam y promociones o escríbenos a <a href="mailto:hello@tonnydager.com">hello@tonnydager.com</a>.</p>
      </main>
      <footer class="event-thanks__footer">© {{ year }} Tonny Dager · ExperientIA S.A.S.</footer>
    </template>
  </div>`
};
