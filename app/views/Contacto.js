import { reactive, ref } from 'vue';
import { api } from '../../assets/js/api.js';
import { track } from '../../assets/js/tracking.js';

const INTENTIONS = ['Quiero una mentoría', 'Quiero un diagnóstico', 'Quiero contratar una conferencia', 'Quiero implementar IA', 'Quiero automatizar procesos', 'Quiero conocer AlexIA', 'Quiero hablar con ExperientIA', 'No sé por dónde empezar'];

export default {
  setup() {
    const form = reactive({ name: '', company: '', role: '', email: '', whatsapp: '', country: '', intent: INTENTIONS[0], message: '' });
    const sent = ref(false);
    const sending = ref(false);
    async function submit() {
      sending.value = true;
      await api.submitForm('contacto', { ...form });
      track('lead_created', { source: 'contacto', intent: form.intent });
      sending.value = false;
      sent.value = true;
    }
    return { form, sent, sending, submit, INTENTIONS };
  },
  template: `
  <div class="page">
    <section class="page__hero">
      <div class="container">
        <p class="kicker" v-reveal>Contacto</p>
        <h1 class="section__title" v-reveal>Agenda una conversación estratégica.</h1>
        <p class="page__lead" v-reveal>Cuéntanos tu necesidad y canalizamos tu solicitud hacia el siguiente paso correcto: diagnóstico, mentoría, conferencia, implementación de IA o AlexIA.</p>
      </div>
    </section>

    <section class="section">
      <div class="container" style="max-width:680px">
        <form v-if="!sent" class="diag__card" @submit.prevent="submit" style="display:grid;gap:14px">
          <label class="sr-only" for="c-name">Nombre</label>
          <input id="c-name" v-model="form.name" class="diag__opt" style="display:block" type="text" placeholder="Nombre *" required />
          <input v-model="form.company" class="diag__opt" style="display:block" type="text" placeholder="Empresa" />
          <input v-model="form.role" class="diag__opt" style="display:block" type="text" placeholder="Cargo" />
          <input v-model="form.email" class="diag__opt" style="display:block" type="email" placeholder="Email *" required />
          <input v-model="form.whatsapp" class="diag__opt" style="display:block" type="tel" placeholder="WhatsApp" />
          <input v-model="form.country" class="diag__opt" style="display:block" type="text" placeholder="País" />
          <label class="sr-only" for="c-intent">Intención</label>
          <select id="c-intent" v-model="form.intent" class="diag__opt" style="display:block">
            <option v-for="i in INTENTIONS" :key="i" :value="i">{{ i }}</option>
          </select>
          <textarea v-model="form.message" class="diag__opt" style="display:block;min-height:110px" placeholder="Mensaje"></textarea>
          <button class="btn btn--primary" type="submit" :disabled="sending">{{ sending ? 'Enviando…' : 'Enviar solicitud' }}</button>
          <p class="diag__text" style="font-size:0.82rem;margin:0">Tus datos se tratan con confidencialidad. Te responderemos por email o WhatsApp.</p>
        </form>

        <div v-else class="diag__card diag__result">
          <span class="diag__result-mark" aria-hidden="true">✓</span>
          <h2 class="diag__result-title">¡Gracias, {{ form.name || 'hola' }}!</h2>
          <p class="diag__result-text">Recibimos tu solicitud sobre “{{ form.intent }}”. En breve te contactaremos para dar el siguiente paso con claridad.</p>
        </div>
      </div>
    </section>
  </div>`
};
