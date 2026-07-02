import { ref, reactive, computed, onMounted, onUnmounted, watch, nextTick } from 'vue';
import { useRoute } from 'vue-router';
import { api } from '../../assets/js/api.js';
import { track } from '../../assets/js/tracking.js';
import { FALLBACK_RESOURCES } from '../data/resources.js';
import { COUNTRIES } from '../data/countries.js';
import Combobox from '../components/Combobox.js';
import PhoneField from '../components/PhoneField.js';
import { saveLead, prefill } from '../../assets/js/leadStore.js';

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
    prefill(form);

    const articleEl = ref(null);
    const audioEl = ref(null);
    const toc = ref([]);            // [{id, text}]
    const activeId = ref('');
    const progress = ref(0);
    const blocks = ref([]);         // bloques de texto para sincronizar con el audio
    const bounds = ref([]);         // fracción de fin de cada bloque (ponderada por longitud)
    let activeBlock = -1;
    let observer = null;
    // Estado del reproductor premium.
    const playing = ref(false);
    const curTime = ref(0);
    const duration = ref(0);
    const seekPct = ref(0);

    async function load(slug) {
      res.value = null; notFound.value = false; unlocked.value = false; downloadUrl.value = '';
      toc.value = []; activeId.value = ''; progress.value = 0;
      const r = await api.resource(slug);
      if (r && r.success !== false && r.data) res.value = r.data;
      else res.value = FALLBACK_RESOURCES.find((x) => x.slug === slug) || null;
      if (!res.value) { notFound.value = true; return; }
      document.title = (res.value.seo_title || res.value.title) + ' — Tonny Dager';
      applySeo(res.value, slug);
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
      blocks.value = [...articleEl.value.querySelectorAll('p, h2, li')];
      // Sincronización ponderada: cada bloque ocupa un tramo proporcional a su
      // longitud de texto, más una entrada inicial por el título (que el TTS narra primero).
      const lead = (res.value?.title || '').length + 2;
      const lens = blocks.value.map((b) => Math.max(1, (b.textContent || '').trim().length));
      const total = lead + lens.reduce((a, b) => a + b, 0);
      let acc = lead;
      bounds.value = lens.map((l) => { acc += l; return acc / total; });
      if (observer) observer.disconnect();
      if (!hs.length) return;
      observer = new IntersectionObserver((entries) => {
        entries.forEach((e) => { if (e.isIntersecting) activeId.value = e.target.id; });
      }, { rootMargin: '-20% 0px -70% 0px', threshold: 0 });
      hs.forEach((h) => observer.observe(h));
    }

    // SEO/GEO: meta description, Open Graph y JSON-LD Article para buscadores y asistentes de IA.
    function applySeo(r, slug) {
      const base = 'https://tonnydager.com';
      const url = base + '/recursos/' + slug;
      const desc = (r.seo_desc || r.excerpt || '').slice(0, 300);
      const setMeta = (attr, key, val) => {
        let el = document.head.querySelector(`meta[${attr}="${key}"]`);
        if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
        el.setAttribute('content', val);
      };
      setMeta('name', 'description', desc);
      setMeta('property', 'og:title', (r.seo_title || r.title));
      setMeta('property', 'og:description', desc);
      setMeta('property', 'og:type', 'article');
      setMeta('property', 'og:url', url);
      if (r.cover_url) setMeta('property', 'og:image', r.cover_url.startsWith('http') ? r.cover_url : base + r.cover_url);
      let link = document.head.querySelector('link[rel="canonical"]');
      if (!link) { link = document.createElement('link'); link.setAttribute('rel', 'canonical'); document.head.appendChild(link); }
      link.setAttribute('href', url);
      let ld = document.getElementById('route-schema');
      if (!ld) { ld = document.createElement('script'); ld.type = 'application/ld+json'; ld.id = 'route-schema'; document.head.appendChild(ld); }
      ld.textContent = JSON.stringify({
        '@context': 'https://schema.org', '@type': 'Article', headline: r.title, description: desc,
        author: { '@type': 'Person', name: r.author || 'Tonny Dager' },
        publisher: { '@type': 'Organization', name: 'ExperientIA S.A.S.' },
        image: r.cover_url ? [r.cover_url.startsWith('http') ? r.cover_url : base + r.cover_url] : undefined,
        mainEntityOfPage: url, articleSection: r.category || undefined
      });
    }

    // Sincroniza el resaltado y el scroll con la reproducción del audio (ponderado).
    function onAudioTime(e) {
      const a = e.target;
      duration.value = a.duration || 0;
      curTime.value = a.currentTime || 0;
      seekPct.value = a.duration ? (a.currentTime / a.duration) * 100 : 0;
      if (!a.duration || !bounds.value.length) return;
      const p = a.currentTime / a.duration;
      let idx = bounds.value.findIndex((b) => p <= b);
      if (idx === -1) idx = bounds.value.length - 1;
      if (idx === activeBlock) return;
      if (activeBlock >= 0 && blocks.value[activeBlock]) blocks.value[activeBlock].classList.remove('reading-here');
      activeBlock = idx;
      const el = blocks.value[idx];
      if (el) { el.classList.add('reading-here'); if (!a.paused) el.scrollIntoView({ behavior: 'smooth', block: 'center' }); }
    }
    function togglePlay() {
      const a = audioEl.value; if (!a) return;
      if (a.paused) { a.play(); playing.value = true; } else { a.pause(); playing.value = false; }
    }
    function onLoaded(e) { duration.value = e.target.duration || 0; }
    function onEnded() { playing.value = false; }
    function seek(e) {
      const a = audioEl.value; if (!a || !a.duration) return;
      const rect = e.currentTarget.getBoundingClientRect();
      a.currentTime = ((e.clientX - rect.left) / rect.width) * a.duration;
    }
    const fmtTime = (s) => { s = Math.floor(s || 0); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); };

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
      saveLead(form);
      const r = await api.unlockResource(res.value.slug, { ...form });
      sending.value = false;
      track('resource_unlocked', { slug: res.value.slug });
      downloadUrl.value = (r && r.data && r.data.file_url) ? r.data.file_url : (res.value.file_url || '');
      unlocked.value = true;
      if (downloadUrl.value) {
        const a = document.createElement('a');
        a.href = downloadUrl.value; a.download = downloadUrl.value.split('/').pop() || ''; a.rel = 'noopener';
        document.body.appendChild(a); a.click(); a.remove();
      }
    }

    return { res, notFound, isGated, unlocked, downloadUrl, form, sending, error, canSubmit, COUNTRIES,
      articleEl, audioEl, toc, activeId, progress, unlock, goTo, onAudioTime,
      playing, curTime, duration, seekPct, togglePlay, onLoaded, onEnded, seek, fmtTime };
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
            <img v-if="res.cover_url" :src="res.cover_url" class="article__cover" :alt="res.title" loading="lazy" />
            <div v-if="res.audio_url" class="audioplayer">
              <button class="audioplayer__btn" @click="togglePlay" :aria-label="playing ? 'Pausar' : 'Reproducir'">
                <span v-if="!playing">▶</span><span v-else>❚❚</span>
              </button>
              <div class="audioplayer__body">
                <div class="audioplayer__top"><strong>Escucha este artículo</strong><span class="audioplayer__time">{{ fmtTime(curTime) }} / {{ fmtTime(duration) }}</span></div>
                <div class="audioplayer__track" @click="seek"><span class="audioplayer__fill" :style="{ width: seekPct + '%' }"></span></div>
              </div>
              <audio ref="audioEl" :src="res.audio_url" preload="metadata" @timeupdate="onAudioTime" @loadedmetadata="onLoaded" @play="playing=true" @pause="playing=false" @ended="onEnded"></audio>
            </div>
            <article v-if="!isGated" ref="articleEl" class="article__body" v-html="res.body"></article>

            <template v-else>
              <article ref="articleEl" class="article__body article__body--teaser" v-html="res.body"></article>
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
                <template v-if="downloadUrl">
                  <h2 class="diag__result-title">¡Listo! Aquí está tu recurso.</h2>
                  <p class="diag__result-text">Si la descarga no inició sola, usa el botón.</p>
                  <div class="agenda__done-actions">
                    <a :href="downloadUrl" target="_blank" rel="noopener" download class="btn btn--primary">⬇ Descargar «{{ res.title }}»</a>
                    <router-link to="/agenda" class="btn btn--ghost">Agenda una conversación</router-link>
                  </div>
                </template>
                <template v-else>
                  <h2 class="diag__result-title">¡Gracias! Recibimos tus datos.</h2>
                  <p class="diag__result-text">Te haremos llegar «{{ res.title }}» muy pronto.</p>
                  <div class="agenda__done-actions">
                    <router-link to="/agenda" class="btn btn--ghost">Agenda una conversación</router-link>
                  </div>
                </template>
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
