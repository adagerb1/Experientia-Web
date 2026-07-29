import { ref, reactive, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { api, apiErrorMessage } from '../../assets/js/api.js';
import { track } from '../../assets/js/tracking.js';
import { FALLBACK_CONSULTATIONS } from '../data/consultations.js';
import { COUNTRIES } from '../data/countries.js';
import { getLead, saveLead, prefill, getUtm, hasDiagnostico } from '../../assets/js/leadStore.js';
import Combobox from '../components/Combobox.js';
import PhoneField from '../components/PhoneField.js';

const MONTHS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const WEEKDAYS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const money = (n, c) => Number(n) > 0 ? new Intl.NumberFormat('es-CO', { style: 'currency', currency: c || 'COP', maximumFractionDigits: 0 }).format(n) : 'Sin costo';

export default {
  components: { Combobox, PhoneField },
  setup() {
    const route = useRoute();
    const stage = ref('type');        // type | slot | form | done
    const types = ref(FALLBACK_CONSULTATIONS);
    const selType = ref(null);
    const slots = ref([]);            // [{date,time,datetime}]
    const slotsLoading = ref(false);
    const backendSlots = ref(false);  // true si vinieron del backend
    const selSlot = ref(null);
    const prefer = reactive({ date: '', time: '09:00' });  // fallback sin backend
    const lead = reactive({ name: '', company: '', email: '', country: '', whatsapp: '', message: '',
      role: '', cargo: '', reto: '', objetivo: '' });
    const diagDone = ref(false); // ¿ya completó el diagnóstico Tablero? (prepara la sesión)
    const sending = ref(false);
    const result = ref(null);
    const error = ref('');
    const returned = ref(null); // reserva al volver de la pasarela (?ref=)

    onMounted(async () => {
      track('agenda_started', { path: route.path });
      prefill(lead); // prellena si ya dejó sus datos (diagnóstico, contacto, recurso)
      diagDone.value = hasDiagnostico();
      if (lead.role && !lead.cargo) lead.cargo = lead.role;

      // Retorno de la pasarela de pago: muestra el estado real de la reserva.
      const ref_ = route.query.ref;
      if (ref_) {
        const b = await api.booking(String(ref_));
        if (b && b.success !== false && b.data) {
          returned.value = b.data;
          result.value = {
            reference: b.data.reference, booking_id: b.data.id,
            requires_payment: ['pending_payment', 'payment_started', 'payment_pending'].includes(b.data.status)
          };
          stage.value = 'done';
          track('payment_return', { ref: b.data.reference, status: b.data.status });
          return;
        }
      }

      const res = await api.consultations();
      if (res && res.success !== false && Array.isArray(res.data) && res.data.length) types.value = res.data;
      const slug = route.query.tipo;
      if (slug) { const t = types.value.find((x) => x.slug === slug); if (t) chooseType(t); }
    });

    const retPaid = computed(() => returned.value && ['payment_confirmed', 'confirmed', 'completed'].includes(returned.value.status));

    async function chooseType(t) {
      selType.value = t; stage.value = 'slot'; selSlot.value = null;
      track('agenda_type_selected', { type: t.slug });
      await loadSlots(t);
    }
    async function loadSlots(t) {
      slotsLoading.value = true; slots.value = []; backendSlots.value = false;
      const res = await api.availability(t.id);
      if (res && res.success !== false && Array.isArray(res.data) && res.data.length) {
        slots.value = res.data; backendSlots.value = true;
      }
      slotsLoading.value = false;
      if (!prefer.date) { const d = new Date(); d.setDate(d.getDate() + 1); prefer.date = d.toISOString().slice(0, 10); }
    }

    const slotsByDate = computed(() => {
      const map = {};
      slots.value.forEach((s) => { (map[s.date] = map[s.date] || []).push(s); });
      return Object.entries(map).map(([date, list]) => ({ date, list }));
    });
    const dayLabel = (d) => { const dt = new Date(d + 'T00:00:00'); return `${WEEKDAYS[dt.getDay()]} ${dt.getDate()} ${MONTHS[dt.getMonth()]}`; };

    function pickSlot(s) { selSlot.value = s; track('agenda_slot_selected', { datetime: s.datetime }); goForm(); }
    function pickPreferred() {
      if (!prefer.date) { error.value = 'Elige una fecha.'; return; }
      selSlot.value = { date: prefer.date, time: prefer.time, datetime: `${prefer.date} ${prefer.time}:00`, preferred: true };
      goForm();
    }
    function goForm() { error.value = ''; stage.value = 'form'; }
    function back() { if (stage.value === 'form') stage.value = 'slot'; else if (stage.value === 'slot') { stage.value = 'type'; selType.value = null; } }

    const canSubmit = computed(() => lead.name.trim() && /.+@.+\..+/.test(lead.email) && selSlot.value);

    async function submit() {
      if (!canSubmit.value) { error.value = 'Completa tu nombre y un email válido.'; return; }
      sending.value = true; error.value = '';
      const payload = {
        consultation_type_id: selType.value.id, scheduled_at: selSlot.value.datetime,
        name: lead.name, email: lead.email, company: lead.company,
        country: lead.country, whatsapp: lead.whatsapp, message: lead.message,
        cargo: lead.cargo, reto: lead.reto, objetivo: lead.objetivo,
        diagnostico_completado: diagDone.value ? 1 : 0,
        utm: getUtm()
      };
      try {
        const res = await api.createBooking(payload);
        saveLead(lead);
        track('booking_submitted', {
          type: selType.value.slug,
          booking_id: res.data.booking_id
        });
        result.value = res.data || { status: 'confirmed' };
        stage.value = 'done';
      } catch (err) {
        error.value = apiErrorMessage(err, 'No pudimos crear la reserva. Intenta de nuevo.');
      } finally {
        sending.value = false;
      }
    }

    async function pay() {
      if (!result.value?.reference) return;
      error.value = '';
      const res = await api.startPayment({ booking_id: result.value.booking_id, reference: result.value.reference });
      const ck = res && res.data && res.data.checkout;
      if (!ck) { error.value = 'El pago aún no está disponible. Te contactaremos con el enlace de pago.'; return; }
      if (ck.configured === false) { error.value = 'La pasarela de pago aún no está configurada. Te enviaremos el enlace de pago por correo.'; return; }
      if (ck.gateway === 'wompi' && ck.checkout_url) { location.href = ck.checkout_url; return; }
      if (ck.gateway === 'epayco' && ck.config) { openEpayco(ck.config); return; }
      error.value = 'No pudimos iniciar el pago. Intenta de nuevo o escríbenos.';
    }

    // Carga el checkout on-page de ePayco y lo abre.
    function openEpayco(config) {
      const launch = () => {
        try {
          const handler = window.ePayco.checkout.configure({ key: config.key, test: String(config.test) === 'true' });
          handler.open(config);
        } catch (e) { error.value = 'No se pudo abrir el checkout de ePayco.'; }
      };
      if (window.ePayco) return launch();
      const s = document.createElement('script');
      s.src = 'https://checkout.epayco.co/checkout.js'; s.onload = launch;
      s.onerror = () => { error.value = 'No se pudo cargar el checkout de ePayco.'; };
      document.body.appendChild(s);
    }

    return { stage, types, selType, slots, slotsLoading, backendSlots, slotsByDate, selSlot, prefer, lead, sending, result, error,
      returned, retPaid, diagDone, COUNTRIES, money, dayLabel, chooseType, pickSlot, pickPreferred, back, submit, pay, canSubmit };
  },
  template: `
  <div class="page agenda">
    <section class="page__hero">
      <div class="container">
        <p class="kicker" v-reveal>Agenda</p>
        <h1 class="section__title" v-reveal>Reserva tu espacio para hablar con Tonny.</h1>
        <p class="page__lead" v-reveal>Elige el tipo de sesión, escoge un horario disponible y confirma. Recibirás la confirmación y el enlace de la reunión por correo.</p>
      </div>
    </section>

    <section class="section">
      <div class="container" style="max-width:820px">
        <ol class="stepper" aria-hidden="true">
          <li :class="{ on: stage!=='type', now: stage==='type' }">1 · Sesión</li>
          <li :class="{ on: stage==='form'||stage==='done', now: stage==='slot' }">2 · Horario</li>
          <li :class="{ on: stage==='done', now: stage==='form' }">3 · Datos</li>
        </ol>

        <!-- Paso 1: tipo -->
        <div v-if="stage==='type'" class="agenda__grid">
          <button class="agenda-card" v-for="t in types" :key="t.id" @click="chooseType(t)">
            <div class="agenda-card__top"><h3>{{ t.name }}</h3><span class="agenda-card__price">{{ money(t.price, t.currency) }}</span></div>
            <p class="agenda-card__desc">{{ t.short_description }}</p>
            <div class="agenda-card__meta"><span>{{ t.duration_min }} min</span><span>·</span><span>{{ t.modality || 'Virtual' }}</span><span class="agenda-card__go">Elegir →</span></div>
          </button>
        </div>

        <!-- Paso 2: horario -->
        <div v-else-if="stage==='slot'" class="agenda__panel">
          <button class="agenda__back" @click="back">← Cambiar sesión</button>
          <div class="agenda__sel"><strong>{{ selType.name }}</strong><span>{{ selType.duration_min }} min · {{ money(selType.price, selType.currency) }}</span></div>

          <div v-if="slotsLoading" class="agenda__loading">Buscando disponibilidad…</div>

          <template v-else-if="backendSlots">
            <p class="agenda__hint">Selecciona un horario disponible:</p>
            <div class="agenda__days">
              <div class="agenda__day" v-for="d in slotsByDate" :key="d.date">
                <h4>{{ dayLabel(d.date) }}</h4>
                <div class="agenda__times">
                  <button class="chip-time" v-for="s in d.list" :key="s.datetime" @click="pickSlot(s)">{{ s.time }}</button>
                </div>
              </div>
            </div>
          </template>

          <template v-else>
            <p class="agenda__hint">Indícanos tu preferencia de fecha y hora; confirmamos disponibilidad por correo.</p>
            <div class="agenda__prefer">
              <label class="field"><span>Fecha</span><input type="date" v-model="prefer.date" class="combo__input" /></label>
              <label class="field"><span>Hora</span>
                <select v-model="prefer.time" class="combo__input">
                  <option v-for="h in ['08:00','09:00','10:00','11:00','14:00','15:00','16:00','17:00']" :key="h" :value="h">{{ h }}</option>
                </select></label>
            </div>
            <button class="btn btn--primary" @click="pickPreferred">Continuar →</button>
          </template>
        </div>

        <!-- Paso 3: datos -->
        <div v-else-if="stage==='form'" class="agenda__panel">
          <button class="agenda__back" @click="back">← Cambiar horario</button>
          <div class="agenda__summary">
            <div><span>Sesión</span><strong>{{ selType.name }}</strong></div>
            <div><span>Cuándo</span><strong>{{ dayLabel(selSlot.date) }} · {{ selSlot.time }}</strong></div>
            <div><span>Valor</span><strong>{{ money(selType.price, selType.currency) }}</strong></div>
          </div>
          <form class="diag__card" @submit.prevent="submit" style="display:grid;gap:13px">
            <input v-model="lead.name" class="combo__input" type="text" placeholder="Nombre *" required />
            <input v-model="lead.company" class="combo__input" type="text" placeholder="Empresa" />
            <input v-model="lead.email" class="combo__input" type="email" placeholder="Email *" required />
            <combobox v-model="lead.country" :options="COUNTRIES" placeholder="País (escribe para buscar)" name="country" />
            <phone-field v-model="lead.whatsapp" />

            <p class="agenda__prep-title">Para preparar mejor tu sesión <span class="muted">(opcional)</span></p>
            <input v-model="lead.cargo" class="combo__input" type="text" placeholder="Tu cargo o rol" />
            <input v-model="lead.reto" class="combo__input" type="text" placeholder="Tu principal reto hoy" />
            <textarea v-model="lead.objetivo" class="combo__input" style="min-height:70px;padding-top:12px" placeholder="¿Qué quieres lograr en esta sesión?"></textarea>
            <p v-if="diagDone" class="agenda__prep-note">✓ Ya completaste el Diagnóstico Tablero — llegaremos a la sesión con tu radar listo.</p>

            <textarea v-model="lead.message" class="combo__input" style="min-height:90px;padding-top:12px" placeholder="Algo más que quieras contarnos"></textarea>
            <p v-if="error" class="error">{{ error }}</p>
            <button class="btn btn--primary" type="submit" :disabled="sending || !canSubmit">{{ sending ? 'Reservando…' : 'Confirmar reserva' }}</button>
          </form>
        </div>

        <!-- Paso 4: confirmación -->
        <div v-else class="diag__card diag__result agenda__done">
          <!-- Retorno de la pasarela de pago -->
          <template v-if="returned">
            <span class="diag__result-mark" aria-hidden="true">{{ retPaid ? '✓' : '◷' }}</span>
            <h2 class="diag__result-title">{{ retPaid ? '¡Pago confirmado!' : 'Estamos confirmando tu pago…' }}</h2>
            <p class="diag__result-text" v-if="retPaid">
              Tu sesión <strong>{{ returned.consultation && returned.consultation.name }}</strong> quedó confirmada
              para el <strong>{{ (returned.scheduled_at || '').slice(0, 16).replace('T', ' · ') }}</strong>.<br />
              Referencia <strong>{{ returned.reference }}</strong>. Te enviamos el enlace de la reunión por correo.
            </p>
            <p class="diag__result-text" v-else>
              Referencia <strong>{{ returned.reference }}</strong>. Si tu banco aún está procesando, la confirmación
              llega en minutos por correo. Si el pago no se completó, puedes reintentarlo.
            </p>
            <div class="agenda__done-actions">
              <button v-if="!retPaid" class="btn btn--primary" @click="pay">Reintentar pago</button>
              <router-link to="/" class="btn btn--ghost">Volver al inicio</router-link>
            </div>
          </template>

          <template v-else>
            <span class="diag__result-mark" aria-hidden="true">✓</span>
            <h2 class="diag__result-title">¡Reserva {{ result && result.reference ? 'confirmada' : 'recibida' }}, {{ lead.name || 'gracias' }}!</h2>
            <p class="diag__result-text" v-if="result && result.reference">
              {{ selType.name }} · {{ dayLabel(selSlot.date) }} a las {{ selSlot.time }}.<br />
              Referencia <strong>{{ result.reference }}</strong>. Te enviamos la confirmación y el enlace de la reunión por correo.
            </p>
            <p class="diag__result-text" v-else>
              Registramos tu solicitud para <strong>{{ selType.name }}</strong> ({{ dayLabel(selSlot.date) }} · {{ selSlot.time }}).
              Te confirmaremos la disponibilidad y el enlace por correo.
            </p>
            <div class="agenda__done-actions">
              <button v-if="result && result.requires_payment" class="btn btn--primary" @click="pay">Continuar con el pago</button>
              <router-link to="/" class="btn btn--ghost">Volver al inicio</router-link>
            </div>
          </template>
        </div>
      </div>
    </section>
  </div>`
};
