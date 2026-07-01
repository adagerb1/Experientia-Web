import { ref, reactive, computed, onMounted, watch } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../../assets/js/api.js';
import { track } from '../../assets/js/tracking.js';
import { FALLBACK_RESOURCES } from '../data/resources.js';
import { COUNTRIES } from '../data/countries.js';
import Combobox from '../components/Combobox.js';
import PhoneField from '../components/PhoneField.js';

export default {
  components: { Combobox, PhoneField },
  setup() {
    const route = useRoute();
    const res = ref(null);
    const notFound = ref(false);
    const unlocked = ref(false);
    const downloadUrl = ref('');
    const sending = ref(false);
    const error = ref('');
    const form = reactive({ name: '', email: '', company: '', country: '', whatsapp: '' });

    async function load(slug) {
      res.value = null; notFound.value = false; unlocked.value = false; downloadUrl.value = '';
      const r = await api.resource(slug);
      if (r && r.success !== false && r.data) res.value = r.data;
      else res.value = FALLBACK_RESOURCES.find((x) => x.slug === slug) || null;
      if (!res.value) { notFound.value = true; return; }
      document.title = (res.value.seo_title || res.value.title) + ' — Tonny Dager';
      track('resource_viewed', { slug, gated: !!res.value.gated });
    }
    onMounted(() => load(route.params.slug));
    watch(() => route.params.slug, (s) => { if (s) load(s); });

    const isGated = computed(() => res.value && Number(res.value.gated) === 1);
    const canSubmit = computed(() => form.name.trim() && /.+@.+\..+/.test(form.email));

    async function unlock() {
      if (!canSubmit.value) { error.value = 'Completa tu nombre y un email válido.'; return; }
      sending.value = true; error.value = '';
      const r = await api.unlockResource(res.value.slug, { ...form });
      sending.value = false;
      track('resource_unlocked', { slug: res.value.slug });
      if (r && r.data && r.data.file_url) downloadUrl.value = r.data.file_url;
      else downloadUrl.value = res.value.file_url || ''; // fallback offline
      unlocked.value = true;
    }

    return { res, notFound, isGated, unlocked, downloadUrl, form, sending, error, canSubmit, COUNTRIES, unlock };
  },
  template: `
  <div class="page article-page">
    <section class="page__hero">
      <div class="container" style="max-width:820px">
        <template v-if="res">
          <router-link to="/recursos" class="article__back" v-reveal>← Recursos</router-link>
          <span class="recurso__type" v-reveal>{{ res.type }}<template v-if="res.category"> · {{ res.category }}</template></span>
          <h1 class="section__title" v-reveal>{{ res.title }}</h1>
          <p class="page__lead" v-reveal>{{ res.excerpt }}</p>
          <p class="article__meta" v-reveal>{{ res.author || 'Tonny Dager' }}<template v-if="res.read_min"> · {{ res.read_min }} min de lectura</template></p>
        </template>
        <template v-else-if="notFound">
          <h1 class="section__title">Recurso no encontrado</h1>
          <router-link to="/recursos" class="btn btn--primary" style="margin-top:16px">Ver todos los recursos</router-link>
        </template>
        <div v-else class="agenda__loading">Cargando…</div>
      </div>
    </section>

    <section class="section" v-if="res">
      <div class="container article__layout" style="max-width:820px">
        <!-- Artículo abierto -->
        <article v-if="!isGated" class="article__body" v-html="res.body"></article>

        <!-- Recurso gated -->
        <template v-else>
          <article class="article__body article__body--teaser" v-html="res.body"></article>

          <div v-if="!unlocked" class="gate">
            <h2 class="gate__title">{{ res.cta_label || 'Descarga el recurso' }}</h2>
            <p class="gate__text">Déjanos tus datos y recibe la descarga al instante y una copia en tu correo.</p>
            <form class="diag__card" @submit.prevent="unlock" style="display:grid;gap:12px">
              <input v-model="form.name" class="combo__input" type="text" placeholder="Nombre *" required />
              <input v-model="form.email" class="combo__input" type="email" placeholder="Email *" required />
              <input v-model="form.company" class="combo__input" type="text" placeholder="Empresa" />
              <combobox v-model="form.country" :options="COUNTRIES" placeholder="País (escribe para buscar)" name="country" />
              <phone-field v-model="form.whatsapp" />
              <p v-if="error" class="error">{{ error }}</p>
              <button class="btn btn--primary" type="submit" :disabled="sending || !canSubmit">{{ sending ? 'Preparando…' : (res.cta_label || 'Descargar ahora') }}</button>
              <p class="diag__text" style="font-size:.8rem;margin:0">Tus datos se tratan con confidencialidad. Sin spam.</p>
            </form>
          </div>

          <div v-else class="diag__card diag__result">
            <span class="diag__result-mark" aria-hidden="true">✓</span>
            <h2 class="diag__result-title">¡Listo! Tu recurso está disponible.</h2>
            <p class="diag__result-text">También te enviamos una copia a tu correo.</p>
            <div class="agenda__done-actions">
              <a v-if="downloadUrl" :href="downloadUrl" target="_blank" rel="noopener" class="btn btn--primary">Descargar «{{ res.title }}»</a>
              <router-link to="/agenda" class="btn btn--ghost">Agenda una conversación</router-link>
            </div>
          </div>
        </template>
      </div>
    </section>
  </div>`
};
