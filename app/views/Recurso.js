import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../../assets/js/api.js';
import { track } from '../../assets/js/tracking.js';
import { FALLBACK_RESOURCES } from '../data/resources.js';
import { COUNTRIES } from '../data/countries.js';
import Combobox from '../components/Combobox.js';
import PhoneField from '../components/PhoneField.js';

function slugifyHeading(s) {
  return (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

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

    const articleEl = ref(null);
    const toc = ref([]);            // [{id, text}]
    const activeId = ref('');
    const progress = ref(0);
    let observer = null;

    async function load(slug) {
      res.value = null; notFound.value = false; unlocked.value = false; downloadUrl.value = '';
      toc.value = []; activeId.value = ''; progress.value = 0;
      const r = await api.resource(slug);
      if (r && r.success !== false && r.data) res.value = r.data;
      else res.value = FALLBACK_RESOURCES.find((x) => x.slug === slug) || null;
      if (!res.value) { notFound.value = true; return; }
      document.title = (res.value.seo_title || res.value.title) + ' — Tonny Dager';
      track('resource_viewed', { slug, gated: !!res.value.gated });
      await nextTick();
      buildToc();
    }

    // Construye la guía de lectura a partir de los <h2> del artículo.
    function buildToc() {
      if (!articleEl.value) return;
      const hs = [...articleEl.value.querySelectorAll('h2')];
      toc.value = hs.map((h, i) => {
        const id = h.id || (slugifyHeading(h.textContent) + '-' + i);
        h.id = id;
        return { id, text: h.textContent };
      });
      if (observer) observer.disconnect();
      if (!hs.length) return;
      observer = new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting) activeId.value = e.target.id; });
      }, { rootMargin: '-20% 0px -70% 0px', threshold: 0 });
      hs.forEach((h) => observer.observe(h));
    }

    function onScroll() {
      const el = articleEl.value;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = rect.height - vh;
      const scrolled = Math.min(Math.max(-rect.top, 0), Math.max(total, 1));
      progress.value = total > 0 ? Math.round((scrolled / total) * 100) : (rect.top < vh ? 100 : 0);
    }
    function goTo(id) { const el = document.getElementById(id); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }

    onMounted(() => { load(route.params.slug); window.addEventListener('scroll', onScroll, { passive: true }); });
    onUnmounted(() => { window.removeEventListener('scroll', onScroll); if (observer) observer.disconnect(); });
    watch(() => route.params.slug, (s) => { if (s) load(s); });

    const isGated = computed(() => res.value && Number(res.value.gated) === 1);
    const canSubmit = computed(() => form.name.trim() && /.+@.+\..+/.test(form.email));

    async function unlock() {
      if (!canSubmit.value) { error.value = 'Completa tu nombre y un email válido.'; return; }
      sending.value = true; error.value = '';
      const r = await api.unlockResource(res.value.slug, { ...form });
      sending.value = false;
      track('resource_unlocked', { slug: res.value.slug });
      downloadUrl.value = (r && r.data && r.data.file_url) ? r.data.file_url : (res.value.file_url || '');
      unlocked.value = true;
      if (downloadUrl.value) {
        const a = document.createElement('a');
        a.href = downloadUrl.value; a.download = ''; a.target = '_blank'; a.rel = 'noopener';
        document.body.appendChild(a); a.click(); a.remove();
      }
    }

    return { res, notFound, isGated, unlocked, downloadUrl, form, sending, error, canSubmit, COUNTRIES,
      articleEl, toc, activeId, progress, unlock, goTo };
  },
  template: `
  <div class="page article-page">
    <div class="reading-bar" v-if="res && !isGated"><span :style="{ width: progress + '%' }"></span></div>

    <section class="page__hero">
      <div class="container" style="max-width:960px">
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
      <div class="container" style="max-width:960px">
        <div class="article__wrap" :class="{ 'article__wrap--toc': !isGated && toc.length }">
          <aside class="toc" v-if="!isGated && toc.length">
            <p class="toc__title">En este artículo</p>
            <nav>
              <a v-for="t in toc" :key="t.id" href="#" @click.prevent="goTo(t.id)" :class="{ 'is-active': activeId === t.id }">{{ t.text }}</a>
            </nav>
          </aside>

          <div class="article__main">
            <article v-if="!isGated" ref="articleEl" class="article__body" v-html="res.body"></article>

            <template v-else>
              <article class="article__body article__body--teaser" v-html="res.body"></article>
              <div v-if="!unlocked" class="gate">
                <h2 class="gate__title">{{ res.cta_label || 'Descarga el recurso' }}</h2>
                <p class="gate__text">Déjanos tus datos y la descarga inicia al instante.</p>
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
                <h2 class="diag__result-title">¡Listo! Tu descarga inició.</h2>
                <p class="diag__result-text">Si no comenzó automáticamente, usa el botón para descargar «{{ res.title }}».</p>
                <div class="agenda__done-actions">
                  <a v-if="downloadUrl" :href="downloadUrl" target="_blank" rel="noopener" class="btn btn--primary">Descargar «{{ res.title }}»</a>
                  <router-link to="/agenda" class="btn btn--ghost">Agenda una conversación</router-link>
                </div>
              </div>
            </template>

            <div class="article__cta" v-if="!isGated">
              <h3>¿Quieres aplicar esto en tu empresa?</h3>
              <p>Haz el Diagnóstico Tablero de Crecimiento o agenda una conversación estratégica.</p>
              <div class="agenda__done-actions">
                <router-link to="/diagnostico-tablero-crecimiento" class="btn btn--primary">Hacer el Diagnóstico</router-link>
                <router-link to="/agenda" class="btn btn--ghost">Agendar sesión</router-link>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>`
};
