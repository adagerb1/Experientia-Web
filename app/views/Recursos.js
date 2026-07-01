import { ref, computed, onMounted } from 'vue';
import PageCta from '../components/PageCta.js';
import { api } from '../../assets/js/api.js';
import { FALLBACK_RESOURCES } from '../data/resources.js';

const CATEGORIES = ['IA aplicada a negocios', 'Automatización', 'Growth', 'Estrategia', 'Marketing estratégico', 'CRM', 'Experiencia de cliente', 'Agentes inteligentes', 'Liderazgo', 'Transformación digital'];

export default {
  components: { PageCta },
  setup() {
    const items = ref(FALLBACK_RESOURCES);
    const fCat = ref('');
    onMounted(async () => {
      const res = await api.resources();
      if (res && res.success !== false && Array.isArray(res.data) && res.data.length) items.value = res.data;
    });
    const cats = computed(() => [...new Set(items.value.map((r) => r.category).filter(Boolean))]);
    const filtered = computed(() => fCat.value ? items.value.filter((r) => r.category === fCat.value) : items.value);
    const featured = computed(() => filtered.value.find((r) => r.featured) || filtered.value[0]);
    const rest = computed(() => filtered.value.filter((r) => r !== featured.value));
    return { items, fCat, cats, filtered, featured, rest, CATEGORIES };
  },
  template: `
  <div class="page">
    <section class="page__hero">
      <div class="container">
        <p class="kicker" v-reveal>Recursos</p>
        <h1 class="section__title" v-reveal>Ideas, estrategias e insights para crecer en la era de la IA.</h1>
        <p class="page__lead" v-reveal>Contenido para líderes, empresarios y equipos que quieren aplicar inteligencia artificial, automatización, marketing y datos con criterio de negocio.</p>
      </div>
    </section>

    <section class="section">
      <div class="container">
        <div class="chips-filter" v-reveal>
          <button class="chipf" :class="{ on: !fCat }" @click="fCat=''">Todos</button>
          <button class="chipf" :class="{ on: fCat===c }" v-for="c in cats" :key="c" @click="fCat=c">{{ c }}</button>
        </div>

        <router-link v-if="featured" :to="'/recursos/'+featured.slug" class="res-featured" v-reveal>
          <div class="res-featured__body">
            <span class="recurso__type">{{ featured.type }}<template v-if="featured.gated"> · Descargable</template></span>
            <h2>{{ featured.title }}</h2>
            <p>{{ featured.excerpt }}</p>
            <span class="res-featured__meta">{{ featured.author || 'Tonny Dager' }}<template v-if="featured.read_min"> · {{ featured.read_min }} min</template></span>
          </div>
          <span class="res-featured__go">Leer <span aria-hidden="true">→</span></span>
        </router-link>

        <div class="recursos__grid">
          <router-link class="card recurso" v-for="r in rest" :key="r.slug" :to="'/recursos/'+r.slug" v-reveal>
            <span class="recurso__type">{{ r.type }}<template v-if="r.gated"> · Descargable</template></span>
            <h3 class="recurso__title">{{ r.title }}</h3>
            <p class="card__text">{{ r.excerpt }}</p>
            <span class="recurso__link">{{ r.gated ? 'Descargar' : 'Leer artículo' }} →</span>
          </router-link>
        </div>
      </div>
    </section>

    <page-cta title="¿Quieres tu guía estratégica?" primary="Ver la guía descargable" primary-to="/recursos/guia-escalar-con-ia" secondary="Agenda una conversación" secondary-to="/agenda" />
  </div>`
};
