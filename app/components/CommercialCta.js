import { reactive, ref } from 'vue';
import { api, apiErrorMessage } from '../../assets/js/api.js';
import { getAttributionContext } from '../../assets/js/attribution.js';
import { saveLead } from '../../assets/js/leadStore.js';
import { track } from '../../assets/js/tracking.js';
import Combobox from './Combobox.js';
import PhoneField from './PhoneField.js';
import { COUNTRIES } from '../data/countries.js';

export default {
  components: { Combobox, PhoneField },
  props: {
    campaign: { type: Object, required: true },
    ctaKey: { type: String, required: true },
    offerKey: { type: String, required: true },
    currency: { type: String, default: 'COP' },
    label: { type: String, required: true },
    variant: { type: String, default: 'primary' },
    compact: { type: Boolean, default: false }
  },
  setup(props) {
    const busy = ref(false);
    const modalOpen = ref(false);
    const error = ref('');
    const success = ref(false);
    const clickId = ref('');
    const form = reactive({
      name: '', email: '', whatsapp: '', country: props.campaign.mode === 'presencial' ? 'Colombia' : '',
      company: '', consent: false
    });

    function requestBody(leadId = 0) {
      const attribution = getAttributionContext();
      return {
        campaign_key: props.campaign.key,
        offer_key: props.offerKey,
        cta_key: props.ctaKey,
        currency: props.currency,
        page_variant: props.campaign.variant || 'control',
        visitor_uid: attribution.visitor_uid,
        session_uid: attribution.session_uid,
        touch: attribution.last_touch,
        click_uid: clickId.value || undefined,
        lead_id: leadId || undefined
      };
    }

    function applyAction(data) {
      clickId.value = data.click_id || clickId.value;
      if (data.action === 'collect_contact') {
        modalOpen.value = true;
        return;
      }
      if (data.action === 'internal') {
        const target = document.querySelector(data.destination);
        if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        return;
      }
      if (data.action === 'redirect' && data.destination) {
        if (data.destination_type === 'checkout') {
          track('begin_checkout', {
            click_id: data.click_id,
            campaign_key: props.campaign.key,
            offer_key: props.offerKey,
            currency: props.currency,
            page_variant: props.campaign.variant || 'control'
          });
        } else if (data.destination_type === 'whatsapp') {
          track('click_whatsapp', {
            click_id: data.click_id,
            campaign_key: props.campaign.key,
            offer_key: props.offerKey,
            page_variant: props.campaign.variant || 'control'
          });
        }
        window.location.assign(data.destination);
        return;
      }
      if (data.action === 'captured') {
        success.value = true;
        modalOpen.value = true;
      }
    }

    async function activate(leadId = 0) {
      if (busy.value) return;
      busy.value = true;
      error.value = '';
      track('click_cta', {
        campaign_key: props.campaign.key,
        offer_key: props.offerKey,
        cta_key: props.ctaKey,
        currency: props.currency,
        page_variant: props.campaign.variant || 'control'
      });
      try {
        const response = await api.resolveCta(requestBody(leadId));
        applyAction(response.data);
      } catch (err) {
        error.value = apiErrorMessage(err, 'No pudimos preparar el siguiente paso. Conservamos tus datos para que puedas reintentar.');
        modalOpen.value = true;
      } finally {
        busy.value = false;
      }
    }

    async function submit() {
      if (!form.consent) {
        error.value = 'Debes autorizar el tratamiento de tus datos para continuar.';
        return;
      }
      busy.value = true;
      error.value = '';
      saveLead(form);
      const attribution = getAttributionContext();
      try {
        const leadResponse = await api.createLead({
          name: form.name,
          email: form.email,
          whatsapp: form.whatsapp,
          country: form.country,
          company: form.company,
          consent: true,
          source: 'commercial_landing',
          primary_need: `${props.campaign.name} · ${props.offerKey}`,
          message: `Interés desde ${props.campaign.slug}; CTA ${props.ctaKey}; moneda ${props.currency}.`,
          campaign_key: props.campaign.key,
          offer_key: props.offerKey,
          click_id: clickId.value,
          attribution
        });
        const leadId = leadResponse.data.id;
        track('lead_created', {
          lead_id: leadId,
          click_id: clickId.value,
          campaign_key: props.campaign.key,
          offer_key: props.offerKey,
          page_variant: props.campaign.variant || 'control'
        });
        const ctaResponse = await api.resolveCta(requestBody(leadId));
        applyAction(ctaResponse.data);
      } catch (err) {
        error.value = apiErrorMessage(err);
      } finally {
        busy.value = false;
      }
    }

    function close() {
      if (!busy.value) modalOpen.value = false;
    }

    return { busy, modalOpen, error, success, form, COUNTRIES, activate, submit, close };
  },
  template: `
    <button type="button"
      class="commercial-cta"
      :class="['commercial-cta--' + variant, { 'commercial-cta--compact': compact }]"
      :disabled="busy"
      @click="activate()">
      <span>{{ busy ? 'Preparando…' : label }}</span>
      <span aria-hidden="true">→</span>
    </button>

    <div v-if="modalOpen" class="commercial-modal" role="presentation" @click.self="close">
      <section class="commercial-modal__card" role="dialog" aria-modal="true" aria-labelledby="commercial-modal-title">
        <button class="commercial-modal__close" type="button" aria-label="Cerrar" @click="close">×</button>
        <template v-if="success">
          <span class="commercial-modal__check" aria-hidden="true">✓</span>
          <h2 id="commercial-modal-title">Tu interés quedó registrado.</h2>
          <p>El checkout o el canal de conversación todavía no está configurado. El equipo recibió tu solicitud y podrá continuar el proceso contigo.</p>
          <button class="commercial-cta commercial-cta--secondary" type="button" @click="close">Cerrar</button>
        </template>
        <form v-else @submit.prevent="submit">
          <p class="commercial-modal__eyebrow">Antes de continuar</p>
          <h2 id="commercial-modal-title">¿A dónde enviamos tu confirmación?</h2>
          <p class="commercial-modal__lead">Estos datos conectan tu interés con el CRM y evitan que pierdas el contexto al pasar al pago o a WhatsApp.</p>

          <label for="commercial-name">Nombre completo</label>
          <input id="commercial-name" v-model.trim="form.name" type="text" autocomplete="name" required />

          <label for="commercial-email">Correo</label>
          <input id="commercial-email" v-model.trim="form.email" type="email" autocomplete="email" required />

          <label>Número de WhatsApp</label>
          <phone-field v-model="form.whatsapp" />

          <label>País</label>
          <combobox v-model="form.country" :options="COUNTRIES" placeholder="Selecciona tu país" name="country" />

          <label for="commercial-company">Empresa o proyecto <span>(opcional)</span></label>
          <input id="commercial-company" v-model.trim="form.company" type="text" autocomplete="organization" />

          <label class="commercial-modal__consent">
            <input v-model="form.consent" type="checkbox" required />
            <span>Autorizo el tratamiento de mis datos para gestionar esta inscripción y su seguimiento comercial.</span>
          </label>

          <p v-if="error" class="commercial-modal__error" role="alert">{{ error }}</p>
          <button class="commercial-cta commercial-cta--primary commercial-modal__submit" type="submit" :disabled="busy || !form.whatsapp || !form.country">
            {{ busy ? 'Guardando…' : 'Continuar de forma segura' }}
            <span aria-hidden="true">→</span>
          </button>
          <p class="commercial-modal__microcopy">No confirmaremos una compra hasta recibir la validación del medio de pago.</p>
        </form>
      </section>
    </div>
  `
};
