import { computed } from 'vue';
import { useRoute } from 'vue-router';

// Páginas legales (contenido base, editable). Una vista para los 4 documentos.
const DOCS = {
  '/privacidad': {
    title: 'Política de privacidad',
    intro: 'En Tonny Dager · ExperientIA S.A.S. tratamos tus datos con confidencialidad y solo para los fines aquí descritos.',
    blocks: [
      ['Responsable', 'ExperientIA S.A.S. es responsable del tratamiento de los datos recolectados a través de este sitio.'],
      ['Datos que recolectamos', 'Nombre, empresa, cargo, email, WhatsApp, país y la información que proporciones en formularios y diagnósticos.'],
      ['Finalidad', 'Responder solicitudes, agendar sesiones, enviar tu diagnóstico y compartir contenido relevante. No vendemos tus datos a terceros.'],
      ['Tus derechos', 'Puedes solicitar acceso, corrección o eliminación de tus datos escribiendo a hola@tonnydager.com.']
    ]
  },
  '/terminos': {
    title: 'Términos y condiciones',
    intro: 'El uso de este sitio implica la aceptación de estos términos.',
    blocks: [
      ['Uso del sitio', 'El contenido es informativo y no constituye asesoría vinculante hasta formalizar un servicio.'],
      ['Servicios', 'Consultoría, mentorías, conferencias, entrenamientos y soluciones de ExperientIA se rigen por acuerdos específicos.'],
      ['Propiedad intelectual', 'Las marcas, textos y materiales son propiedad de Tonny Dager · ExperientIA S.A.S.'],
      ['Contacto', 'Para dudas sobre estos términos: hola@tonnydager.com.']
    ]
  },
  '/tratamiento-de-datos': {
    title: 'Tratamiento de datos',
    intro: 'Autorización para el tratamiento de datos personales conforme a la normativa aplicable.',
    blocks: [
      ['Autorización', 'Al enviar tus datos autorizas su tratamiento para los fines comerciales y de seguimiento descritos en la política de privacidad.'],
      ['Conservación', 'Conservamos tus datos mientras exista relación comercial o interés legítimo, y los eliminamos a tu solicitud.'],
      ['Seguridad', 'Aplicamos medidas razonables para proteger la información frente a accesos no autorizados.'],
      ['Revocatoria', 'Puedes revocar esta autorización en cualquier momento escribiendo a hola@tonnydager.com.']
    ]
  },
  '/cookies': {
    title: 'Política de cookies',
    intro: 'Usamos cookies y tecnologías similares para mejorar tu experiencia y medir el desempeño del sitio.',
    blocks: [
      ['Qué son', 'Pequeños archivos que permiten recordar preferencias y entender cómo se usa el sitio.'],
      ['Tipos', 'Cookies técnicas (necesarias) y de analítica (para medir tráfico y conversión).'],
      ['Control', 'Puedes gestionar o bloquear cookies desde la configuración de tu navegador.'],
      ['Más información', 'Escríbenos a hola@tonnydager.com para resolver dudas.']
    ]
  }
};

export default {
  setup() {
    const route = useRoute();
    const doc = computed(() => DOCS[route.path] || DOCS['/privacidad']);
    return { doc };
  },
  template: `
  <div class="page">
    <section class="page__hero">
      <div class="container" style="max-width:760px">
        <p class="kicker" v-reveal>Legal</p>
        <h1 class="section__title" v-reveal>{{ doc.title }}</h1>
        <p class="page__lead" v-reveal>{{ doc.intro }}</p>
      </div>
    </section>
    <section class="section" style="padding-top:0">
      <div class="container" style="max-width:760px">
        <article class="card" v-for="b in doc.blocks" :key="b[0]" v-reveal style="margin-bottom:14px">
          <h2 class="card__title">{{ b[0] }}</h2>
          <p class="card__text">{{ b[1] }}</p>
        </article>
        <p class="muted" style="color:var(--color-muted);font-size:.85rem;margin-top:18px">Última actualización: 2026. Este contenido es una base general; ajústalo con tu asesor legal.</p>
      </div>
    </section>
  </div>`
};
