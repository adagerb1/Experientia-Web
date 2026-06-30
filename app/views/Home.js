import { onMounted, onUnmounted, ref } from 'vue';
import { RouterLink, useRouter } from 'vue-router';
import { METRICS, PROBLEMS, PILLARS, ROUTES_HOME, CASES, RESOURCES } from '../data/site.js';
import MicroDiagnostic from '../components/MicroDiagnostic.js';
import { store } from '../../assets/js/store.js';
import { track, EVENTS } from '../../assets/js/tracking.js';
import { countUp } from '../../assets/js/motion.js';

export default {
  components: { RouterLink, MicroDiagnostic },
  setup() {
    const router = useRouter();
    const photoError = ref(false);
    let onScroll;

    // Adaptive CTA: la etiqueta del sticky cambia según la sección visible.
    const SECTION_LABELS = {
      problema: 'Diagnosticar mi negocio',
      diagnostico: 'Encontrar mi ruta',
      rutas: 'Elegir mi ruta',
      casos: 'Quiero resultados similares',
      'cta-final': 'Agendar conversación estratégica'
    };

    onMounted(() => {
      track(EVENTS.VIEW_HOME);
      store.showSticky(false);

      // Accesibilidad: respeta prefers-reduced-motion en los videos de fondo.
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        document.querySelectorAll('.hero__video, .section-video').forEach((v) => {
          v.removeAttribute('autoplay'); try { v.pause(); } catch (e) {}
        });
      }

      const hero = document.getElementById('hero');
      let io;
      if ('IntersectionObserver' in window) {
        // Mostrar sticky al pasar el hero.
        io = new IntersectionObserver(([e]) => store.showSticky(!e.isIntersecting), { threshold: 0.1 });
        if (hero) io.observe(hero);
        // Cambiar etiqueta por sección.
        const labelIo = new IntersectionObserver((entries) => {
          entries.forEach((entry) => {
            if (entry.isIntersecting && SECTION_LABELS[entry.target.id]) {
              store.setSticky(SECTION_LABELS[entry.target.id]);
            }
          });
        }, { threshold: 0.4 });
        Object.keys(SECTION_LABELS).forEach((id) => {
          const el = document.getElementById(id);
          if (el) labelIo.observe(el);
        });
      }
      // Count-up de las métricas de autoridad (microinteracción).
      if ('IntersectionObserver' in window) {
        const mio = new IntersectionObserver((entries) => {
          entries.forEach((en) => {
            if (!en.isIntersecting) return;
            const el = en.target;
            const m = (el.textContent || '').match(/^(\D*)(\d[\d.,]*)(.*)$/);
            if (m) countUp(el, parseInt(m[2].replace(/[.,]/g, ''), 10), { prefix: m[1], suffix: m[3] });
            mio.unobserve(el);
          });
        }, { threshold: 0.6 });
        document.querySelectorAll('.metrics .metric__num').forEach((n) => mio.observe(n));
      }

      onUnmounted(() => { if (io) io.disconnect(); });
    });

    const heroCta = () => { track(EVENTS.CLICK_CTA_HERO); router.push('/contacto'); };
    const marqueeKeys = ['Autoridad', 'Claridad', 'Estrategia', 'IA aplicada', 'Automatización', 'Growth', 'Revenue', 'Experiencia'];

    return { METRICS, PROBLEMS, PILLARS, ROUTES_HOME, CASES, RESOURCES, heroCta, photoError, marqueeKeys };
  },
  template: `
  <div>
    <!-- HERO cinematográfico (video full-bleed) -->
    <section class="hero hero--cinematic" id="hero">
      <video class="hero__video" autoplay muted loop playsinline preload="auto" aria-hidden="true">
        <source src="/assets/video/hero.mp4" type="video/mp4" />
      </video>
      <div class="hero__scrim" aria-hidden="true"></div>
      <div class="container hero__inner hero__inner--cinematic">
        <div class="hero__content" v-reveal>
          <p class="eyebrow eyebrow--light">Tonny Dager · Founder &amp; CEO de ExperientIA</p>
          <h1 class="hero__title hero__title--light">IA, automatización y growth para empresas que quieren <span class="grad">escalar con claridad.</span></h1>
          <p class="hero__sub hero__sub--light">Convierto tecnología, datos y estrategia en sistemas reales de crecimiento, eficiencia y ventas. No se trata de usar más herramientas: se trata de construir un negocio más inteligente, medible y preparado para la era de la IA.</p>
          <div class="hero__actions">
            <a href="#" class="btn btn--primary btn--lg" @click.prevent="heroCta">Agenda tu sesión estratégica</a>
            <router-link to="/consultoria" class="btn btn--ghost btn--lg">Ver la consultoría</router-link>
          </div>
          <div class="hero__trust" aria-label="Prueba de autoridad">
            <span><strong>+200</strong> empresas</span>
            <span><strong>18+</strong> años</span>
            <span><strong>10</strong> países</span>
          </div>
        </div>
      </div>
      <div class="hero__scrollcue" aria-hidden="true"><span></span></div>
    </section>

    <!-- MARQUEE de autoridad -->
    <div class="marquee" aria-hidden="true">
      <div class="marquee__track">
        <span class="marquee__item" v-for="k in marqueeKeys" :key="'a-'+k">{{ k }}</span>
        <span class="marquee__item" v-for="k in marqueeKeys" :key="'b-'+k">{{ k }}</span>
      </div>
    </div>

    <!-- MÉTRICAS -->
    <section class="metrics" aria-label="Métricas de autoridad">
      <div class="container metrics__grid">
        <div class="metric" v-for="m in METRICS" :key="m.num" v-reveal>
          <span class="metric__num">{{ m.num }}</span>
          <span class="metric__label">{{ m.label }}</span>
        </div>
      </div>
    </section>

    <!-- PROBLEMA -->
    <section class="section section--soft" id="problema">
      <div class="container">
        <p class="kicker" v-reveal>Problema</p>
        <h2 class="section__title" v-reveal>Tu empresa no necesita más ruido.<br />Necesita un sistema.</h2>
        <p class="section__text" v-reveal>Muchas empresas están rodeadas de herramientas, campañas, datos y promesas de IA, pero siguen con procesos manuales, ventas inconsistentes, poca claridad y decisiones sin información confiable. La oportunidad no está en sumar más tecnología sin dirección, sino en construir un sistema que conecte estrategia, IA, automatización, marketing, datos y ejecución.</p>
        <div class="problem-cards">
          <article class="card" v-for="p in PROBLEMS" :key="p.title" v-reveal>
            <h3 class="card__title">{{ p.title }}</h3>
            <p class="card__text">{{ p.text }}</p>
          </article>
        </div>
      </div>
    </section>

    <!-- MICRODIAGNÓSTICO -->
    <section class="section" id="diagnostico">
      <div class="container">
        <micro-diagnostic />
      </div>
    </section>

    <!-- PILARES -->
    <section class="section" id="pilares">
      <div class="container">
        <p class="kicker" v-reveal>Pilares de impacto</p>
        <h2 class="section__title" v-reveal>Cómo genero impacto en tu negocio.</h2>
        <p class="section__text" v-reveal>Mi enfoque une estrategia, inteligencia artificial, automatización, marketing, datos y revenue para que la tecnología no se quede en discurso, sino que se convierta en crecimiento real.</p>
        <div class="bento">
          <article class="card bento__tile" :class="'bento__tile--'+(i+1)" v-for="(p, i) in PILLARS" :key="p.title" v-reveal>
            <span class="card__icon" aria-hidden="true">{{ p.icon }}</span>
            <h3 class="card__title">{{ p.title }}</h3>
            <p class="card__text">{{ p.text }}</p>
          </article>
        </div>
      </div>
    </section>

    <!-- TONNY + EXPERIENTIA -->
    <section class="section system" id="sistema">
      <div class="container system__inner">
        <div class="system__visual" v-reveal aria-hidden="true">
          <div class="system__nucleus">
            <span class="system__core"></span>
            <span class="system__ring"></span>
            <span class="system__ring system__ring--alt"></span>
          </div>
        </div>
        <div class="system__content" v-reveal>
          <p class="kicker kicker--light">Tonny + ExperientIA</p>
          <h2 class="section__title">La estrategia necesita ejecución.<br />La ejecución necesita claridad.</h2>
          <p class="section__text">Tonny Dager y ExperientIA funcionan como un mismo ecosistema: una visión estratégica conectada con capacidad real de implementación.</p>
          <div class="system__pair">
            <div class="card">
              <h3 class="card__title">Tonny Dager — Estrategia</h3>
              <p class="card__text">Creo claridad estratégica, ayudo a priorizar lo que realmente importa y acompaño a líderes y equipos a tomar mejores decisiones para crecer.</p>
            </div>
            <div class="card">
              <h3 class="card__title">ExperientIA — Ejecución</h3>
              <p class="card__text">Convertimos la visión en sistemas, soluciones, automatización, datos, agentes inteligentes y resultados medibles.</p>
            </div>
          </div>
          <p class="system__quote">Tonny crea la claridad estratégica. ExperientIA convierte la visión en sistemas, soluciones y resultados.</p>
          <router-link to="/experientia" class="btn btn--ghost">Conoce cómo trabajamos</router-link>
        </div>
      </div>
    </section>

    <!-- RUTAS -->
    <section class="section section--soft" id="rutas">
      <div class="container">
        <p class="kicker" v-reveal>Rutas de transformación</p>
        <h2 class="section__title" v-reveal>Elige tu ruta.</h2>
        <p class="section__text" v-reveal>No todas las empresas necesitan lo mismo. Algunas necesitan claridad, otras automatización, otras vender mejor, formar a su equipo o implementar soluciones con IA. Elige la ruta que más se parece a tu necesidad actual.</p>
        <div class="rutas__grid">
          <article class="card ruta" v-for="r in ROUTES_HOME" :key="r.num" v-reveal>
            <span class="ruta__num">{{ r.num }}</span>
            <h3 class="ruta__title">{{ r.title }}</h3>
            <p class="ruta__text">{{ r.text }}</p>
            <ul class="ruta__list"><li v-for="i in r.list" :key="i">{{ i }}</li></ul>
            <router-link :to="r.to" class="ruta__link">{{ r.cta }} →</router-link>
          </article>
        </div>
      </div>
    </section>

    <!-- CASOS -->
    <section class="section" id="casos">
      <div class="container">
        <p class="kicker" v-reveal>Casos reales</p>
        <h2 class="section__title" v-reveal>Casos reales. Impacto medible.</h2>
        <p class="section__text" v-reveal>La estrategia cobra valor cuando se convierte en resultados. Así la claridad, la automatización, los datos y la IA transforman procesos, ventas y decisiones.</p>
        <div class="casos__metrics" v-reveal>
          <div class="caso-metric"><span class="caso-metric__num">+47%</span><span class="caso-metric__label">Crecimiento promedio</span></div>
          <div class="caso-metric"><span class="caso-metric__num">+32%</span><span class="caso-metric__label">En ventas</span></div>
          <div class="caso-metric"><span class="caso-metric__num">−28%</span><span class="caso-metric__label">En costos operativos</span></div>
        </div>
        <div class="casos__grid">
          <article class="card caso" v-for="c in CASES" :key="c.sector" v-reveal>
            <span class="caso__sector">{{ c.sector }}</span>
            <p class="caso__row"><strong>Problema</strong>{{ c.problem }}</p>
            <p class="caso__row"><strong>Intervención</strong>{{ c.action }}</p>
            <p class="caso__row"><strong>Resultado</strong>{{ c.result }}</p>
          </article>
        </div>
        <div style="text-align:center;margin-top:32px" v-reveal>
          <router-link to="/casos" class="btn btn--ghost">Ver todos los casos</router-link>
        </div>
      </div>
    </section>

    <!-- RECURSOS -->
    <section class="section section--soft" id="recursos">
      <div class="container">
        <p class="kicker" v-reveal>Recursos</p>
        <h2 class="section__title" v-reveal>Ideas, estrategias e insights para crecer en la era de la IA.</h2>
        <div class="recursos__grid">
          <article class="card recurso" v-for="r in RESOURCES" :key="r.title" v-reveal>
            <span class="recurso__type">{{ r.type }}</span>
            <h3 class="recurso__title">{{ r.title }}</h3>
            <p class="card__text">{{ r.text }}</p>
            <router-link to="/recursos" class="recurso__link">Explorar →</router-link>
          </article>
        </div>
      </div>
    </section>

    <!-- CTA FINAL -->
    <section class="section cta-final" id="cta-final">
      <video class="section-video" autoplay muted loop playsinline preload="none" aria-hidden="true">
        <source src="/assets/video/hero-abstract.mp4" type="video/mp4" />
      </video>
      <div class="cta-final__bg" aria-hidden="true"><span class="orbit orbit--1"></span><span class="orbit__glow"></span></div>
      <div class="container cta-final__inner" v-reveal>
        <p class="kicker kicker--light">El siguiente paso es tuyo</p>
        <h2 class="cta-final__title">Convirtamos la claridad en un sistema de crecimiento real.</h2>
        <p class="cta-final__text">Agenda una conversación estratégica y revisemos cómo convertir IA, automatización, marketing y datos en una ruta clara de crecimiento para tu empresa.</p>
        <div class="cta-final__actions">
          <router-link to="/contacto" class="btn btn--primary btn--lg">Agenda una conversación estratégica</router-link>
          <router-link to="/diagnostico-ia-growth" class="btn btn--ghost btn--lg">Encontrar mi ruta</router-link>
        </div>
      </div>
    </section>
  </div>`
};
