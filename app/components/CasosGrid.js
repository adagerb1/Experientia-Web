import { ref } from 'vue';

// Rejilla de casos con tarjetas flip (frente: métrica; reverso: detalle + audio).
// Reutilizable en el Home y en la página /casos.
export default {
  props: {
    cases: { type: Array, default: () => [] }
  },
  setup() {
    const flipped = ref({});
    const playing = ref('');
    let audioEl = null;

    const flip = (id) => { flipped.value = { ...flipped.value, [id]: !flipped.value[id] }; };
    const tagList = (t) => (t || '').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 4);
    const key = (c, i) => (c.id != null ? c.id : 'c' + i);

    function toggleAudio(c) {
      if (!c.audio_url) return;
      const id = c.id != null ? c.id : c.audio_url;
      if (playing.value === id && audioEl) { audioEl.pause(); playing.value = ''; return; }
      if (audioEl) audioEl.pause();
      audioEl = new Audio(c.audio_url);
      audioEl.onended = () => { playing.value = ''; };
      audioEl.play().then(() => { playing.value = id; }).catch(() => { playing.value = ''; });
    }
    const isPlaying = (c) => playing.value === (c.id != null ? c.id : c.audio_url);

    return { flipped, flip, tagList, key, toggleAudio, isPlaying };
  },
  template: `
  <div class="casos__grid casos__grid--flip">
    <div class="flipcard" v-for="(c, i) in cases" :key="key(c, i)" :class="{ 'is-flipped': flipped[key(c, i)] }" v-reveal @click="flip(key(c, i))">
      <div class="flipcard__inner">
        <div class="flipcard__face flipcard__front" :style="c.image_url ? { backgroundImage: 'linear-gradient(180deg, rgba(11,29,58,.35), rgba(11,29,58,.88)), url(' + c.image_url + ')' } : null" :class="{ 'flipcard__front--img': c.image_url }">
          <span class="caso__sector">{{ c.sector }}</span>
          <div class="flipcard__front-body">
            <span v-if="c.metric_value" class="flipcard__metric">{{ c.metric_value }}</span>
            <span v-if="c.metric_label" class="flipcard__metric-label">{{ c.metric_label }}</span>
            <h3 class="flipcard__title">{{ c.title || c.summary || c.result }}</h3>
          </div>
          <span class="flipcard__hint">Ver detalle →</span>
        </div>
        <div class="flipcard__face flipcard__back">
          <span class="caso__sector">{{ c.sector }}</span>
          <p class="caso__row"><strong>Problema</strong>{{ c.problem }}</p>
          <p class="caso__row"><strong>Intervención</strong>{{ c.intervention || c.action }}</p>
          <p class="caso__row"><strong>Resultado</strong>{{ c.result }}</p>
          <div class="flipcard__foot">
            <div class="flipcard__tags"><span class="logo-chip" v-for="t in tagList(c.tags)" :key="t">{{ t }}</span></div>
            <button v-if="c.audio_url" type="button" class="flipcard__audio" @click.stop="toggleAudio(c)">
              {{ isPlaying(c) ? '❚❚ Pausar' : '▶ Escuchar' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  </div>`
};
