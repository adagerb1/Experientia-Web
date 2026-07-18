import { ref, reactive, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../../assets/js/api.js';

export default {
  setup() {
    const route = useRoute();
    const experience = ref(null);
    const loading = ref(true);
    const sending = ref(false);
    const error = ref('');
    const done = ref(false);
    const form = reactive({ edition_id: '', name: '', email: '', whatsapp: '', company: '', consent: false, website: '' });

    const content = computed(() => {
      if (!experience.value?.landing?.content_json) return {};
      try { return JSON.parse(experience.value.landing.content_json).payload || {}; } catch (_) { return {}; }
    });
    const selectedEdition = computed(() => experience.value?.editions?.find((e) => String(e.id) === String(form.edition_id)));
    const seats = computed(() => {
      const ed = selectedEdition.value;
      if (!ed || !Number(ed.capacity)) return null;
      return Math.max(0, Number(ed.capacity) - Number(ed.enrolled || 0));
    });

    async function load() {
      loading.value = true;
      const result = await api.eventPublic(route.params.slug);
      if (result.success && result.data) {
        experience.value = result.data;
        if (result.data.editions?.length) form.edition_id = result.data.editions[0].id;
        document.title = result.data.title + ' — Tonny Dager';
      } else error.value = result.message || 'Esta experiencia no está disponible.';
      loading.value = false;
    }
    async function register() {
      sending.value = true; error.value = '';
      const result = await api.registerEvent(route.params.slug, { ...form });
      if (result.success) done.value = true;
      else error.value = result.message || 'No pudimos completar el registro.';
      sending.value = false;
    }
    onMounted(load);
    return { experience, content, loading, sending, error, done, form, selectedEdition, seats, register };
  },
  template: `
  <main id="main" class="event-landing">
    <section v-if="loading" class="section"><div class="container"><p>Cargando experiencia…</p></div></section>
    <section v-else-if="error && !experience" class="section"><div class="container"><h1>Experiencia no disponible</h1><p>{{ error }}</p><router-link class="btn btn--primary" to="/">Volver al inicio</router-link></div></section>
    <template v-else>
      <section class="event-hero">
        <div class="container event-hero__grid">
          <div>
            <p class="eyebrow">{{ experience.format }}</p>
            <h1>{{ content.headline || experience.title }}</h1>
            <p class="event-hero__lead">{{ content.subheadline || experience.summary }}</p>
            <a href="#registro" class="btn btn--primary">{{ content.cta || 'Reservar mi cupo' }}</a>
          </div>
          <aside class="event-hero__card">
            <span>Una experiencia de</span><strong>Tonny Dager + AlexIA</strong>
            <p>{{ experience.audience }}</p>
          </aside>
        </div>
      </section>

      <section class="section"><div class="container event-outcomes">
        <div><p class="eyebrow">Transformación</p><h2>{{ content.promise || 'Lo que vas a construir' }}</h2></div>
        <ul><li v-for="outcome in experience.outcomes" :key="outcome">{{ outcome }}</li><li v-if="!experience.outcomes?.length">Una ruta práctica, estratégica y aplicable desde el primer día.</li></ul>
      </div></section>

      <section id="registro" class="section event-register"><div class="container event-register__grid">
        <div><p class="eyebrow">Inscripción</p><h2>Reserva tu lugar</h2><p>Al registrarte, el equipo podrá acompañarte antes, durante y después de la experiencia.</p></div>
        <div class="card">
          <div v-if="done" class="event-register__done"><span>✓</span><h3>Tu inscripción quedó confirmada</h3><p>Te contactaremos por los datos que nos compartiste.</p></div>
          <form v-else @submit.prevent="register">
            <label>Edición<select v-model="form.edition_id" class="input" required><option v-for="ed in experience.editions" :key="ed.id" :value="ed.id">{{ ed.name }} · {{ ed.starts_at || 'Fecha por confirmar' }}</option></select></label>
            <p v-if="seats !== null" class="event-register__seats">Quedan {{ seats }} cupos</p>
            <label>Nombre<input v-model="form.name" class="input" required autocomplete="name" /></label>
            <label>Correo<input v-model="form.email" class="input" type="email" required autocomplete="email" /></label>
            <label>WhatsApp<input v-model="form.whatsapp" class="input" autocomplete="tel" /></label>
            <label>Empresa<input v-model="form.company" class="input" autocomplete="organization" /></label>
            <label class="event-register__consent"><input v-model="form.consent" type="checkbox" required /> Acepto el tratamiento de datos para gestionar mi inscripción.</label>
            <input v-model="form.website" class="event-register__hp" tabindex="-1" autocomplete="off" aria-hidden="true" />
            <p v-if="error" class="alert alert--danger">{{ error }}</p>
            <button class="btn btn--primary btn--block" :disabled="sending">{{ sending ? 'Confirmando…' : 'Confirmar inscripción' }}</button>
          </form>
        </div>
      </div></section>
    </template>
  </main>`
};
