// Vue Router en modo history (Documento técnico: routing History).
import { createRouter, createWebHistory } from 'vue-router';

import Home from '../../app/views/Home.js?v=20260726-2';
import SobreTonny from '../../app/views/SobreTonny.js';
import Diagnostico from '../../app/views/Diagnostico.js';
import DiagnosticoTablero from '../../app/views/DiagnosticoTablero.js?v=20260726-2';
import LinkBio from '../../app/views/LinkBio.js?v=20260726-2';
import Legal from '../../app/views/Legal.js';
import Consultoria from '../../app/views/Consultoria.js';
import Entrenamientos from '../../app/views/Entrenamientos.js';
import Mentorias from '../../app/views/Mentorias.js';
import Conferencias from '../../app/views/Conferencias.js';
import ExperientIA from '../../app/views/ExperientIA.js';
import AlexIA from '../../app/views/AlexIA.js';
import Casos from '../../app/views/Casos.js?v=20260726-2';
import Recursos from '../../app/views/Recursos.js?v=20260726-2';
import Recurso from '../../app/views/Recurso.js?v=20260726-2';
import Contacto from '../../app/views/Contacto.js?v=20260726-2';
import Agenda from '../../app/views/Agenda.js?v=20260726-2';
import Evento from '../../app/views/Evento.js?v=20260726-2';
import EventoGracias from '../../app/views/EventoGracias.js?v=20260726-2';
import NotFound from '../../app/views/NotFound.js';
import { HOME_FAQ } from '../../app/data/faq.js';

const routes = [
  { path: '/', component: Home, meta: { title: 'Tonny Dager — Arquitecto del Crecimiento Empresarial | IA, automatización y growth', desc: 'Tonny Dager convierte estrategia, datos e IA en un tablero claro de crecimiento. Haz el Diagnóstico Tablero de Crecimiento y descubre tu primera jugada.', faq: HOME_FAQ } },
  { path: '/sobre-tonny-dager', component: SobreTonny, meta: { title: 'Sobre Tonny Dager — Autoridad en IA, growth y estrategia', desc: 'Quién es Tonny Dager, su experiencia, su visión sobre IA y por qué creó ExperientIA.' } },
  { path: '/diagnostico-ia-growth', component: Diagnostico, meta: { title: 'Diagnóstico IA & Growth — Tonny Dager', desc: 'Sesión 1:1 para identificar oportunidades de crecimiento, automatización, IA, marketing, ventas y datos.' } },
  { path: '/diagnostico-tablero-crecimiento', component: DiagnosticoTablero, meta: { title: 'Diagnóstico Tablero de Crecimiento — Tonny Dager', desc: 'Descubre dónde se está trabando tu empresa en las 11 zonas del Tablero de Crecimiento y cuál debe ser tu primera jugada.', serviceName: 'Diagnóstico Tablero de Crecimiento' } },
  { path: '/tablero', component: LinkBio, meta: { title: 'Tonny Dager — Tablero de Crecimiento', desc: 'Haz el diagnóstico y descubre tu primera jugada de crecimiento.', bare: true } },
  { path: '/consultoria', component: Consultoria, meta: { title: 'Consultoría Estratégica 1:1 — Tonny Dager', desc: 'Sesión estratégica de alto nivel para convertir tu complejidad en una ruta clara de crecimiento.', serviceName: 'Consultoría Estratégica 1:1' } },
  { path: '/entrenamientos', component: Entrenamientos, meta: { title: 'Entrenamientos en IA, automatización y growth — Tonny Dager', desc: 'Programas aplicados para que tu equipo ejecute IA, automatización, marketing y growth con resultados.', serviceName: 'Entrenamientos en IA, automatización y growth' } },
  { path: '/mentorias', component: Mentorias, meta: { title: 'Mentorías Estratégicas — Tonny Dager', desc: 'Mentoría premium de acompañamiento para empresarios, founders y líderes que quieren crecer con claridad.', serviceName: 'Mentorías Estratégicas' } },
  { path: '/conferencias', component: Conferencias, meta: { title: 'Conferencias & Workshops — Tonny Dager', desc: 'Speaker estratégico en IA, automatización y growth para empresas, gremios, universidades y eventos.', serviceName: 'Conferencias y Workshops (Speaker)' } },
  { path: '/experientia', component: ExperientIA, meta: { title: 'ExperientIA — Implementación de IA, automatización y growth', desc: 'ExperientIA convierte la claridad estratégica en sistemas, tecnología, procesos y resultados.', serviceName: 'Soluciones ExperientIA (IA, automatización, datos y growth)' } },
  { path: '/alexia', component: AlexIA, meta: { title: 'AlexIA — Agentes inteligentes para atención, ventas y seguimiento', desc: 'AlexIA automatiza atención, agendamiento, seguimiento comercial y soporte con agentes conversacionales.', serviceName: 'AlexIA — Agentes inteligentes' } },
  { path: '/casos', component: Casos, meta: { title: 'Casos reales — Resultados medibles | Tonny Dager', desc: 'Casos reales de IA, automatización y growth con impacto medible en procesos, ventas y decisiones.' } },
  { path: '/recursos', component: Recursos, meta: { title: 'Recursos — Ideas e insights de IA y growth | Tonny Dager', desc: 'Artículos, guías y checklists para aplicar IA, automatización, marketing y datos con criterio de negocio.' } },
  { path: '/recursos/:slug', component: Recurso, meta: { title: 'Recurso — Tonny Dager', desc: 'Contenido estratégico sobre IA, automatización, growth y el Tablero de Crecimiento.' } },
  { path: '/contacto', component: Contacto, meta: { title: 'Contacto — Agenda una conversación estratégica', desc: 'Cuéntanos tu necesidad y canalizamos tu solicitud: diagnóstico, mentoría, conferencia, IA o AlexIA.' } },
  { path: '/eventos/:slug/gracias', component: EventoGracias, meta: { title: 'Registro confirmado — Tonny Dager', desc: 'Siguientes pasos para participar en la experiencia.', bare: true } },
  { path: '/eventos/:slug', component: Evento, meta: { title: 'Evento — Tonny Dager', desc: 'Experiencia, taller o evento de Tonny Dager.', bare: true } },
  { path: '/agenda', component: Agenda, meta: { title: 'Agenda tu sesión con Tonny Dager', desc: 'Reserva una sesión estratégica o un diagnóstico: elige el tipo de sesión, escoge un horario disponible y confirma.', serviceName: 'Agendamiento de sesiones estratégicas' } },
  { path: '/privacidad', component: Legal, meta: { title: 'Política de privacidad — Tonny Dager', desc: 'Cómo tratamos y protegemos tus datos en Tonny Dager · ExperientIA.' } },
  { path: '/terminos', component: Legal, meta: { title: 'Términos y condiciones — Tonny Dager', desc: 'Términos de uso del sitio y los servicios de Tonny Dager · ExperientIA.' } },
  { path: '/tratamiento-de-datos', component: Legal, meta: { title: 'Tratamiento de datos — Tonny Dager', desc: 'Autorización y manejo de datos personales conforme a la normativa aplicable.' } },
  { path: '/cookies', component: Legal, meta: { title: 'Política de cookies — Tonny Dager', desc: 'Uso de cookies y tecnologías similares en el sitio.' } },
  { path: '/:pathMatch(.*)*', component: NotFound, meta: { title: 'Página no encontrada — Tonny Dager', desc: '' } }
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior(to, from, saved) {
    if (saved) return saved;
    if (to.hash) return { el: to.hash, behavior: 'smooth' };
    return { top: 0 };
  }
});

// SEO + GEO/AEO dinámico por ruta: title, description, Open Graph, canonical y JSON-LD.
const BASE_URL = 'https://tonnydager.com';

function setMeta(attr, key, content) {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (!el) { el = document.createElement('meta'); el.setAttribute(attr, key); document.head.appendChild(el); }
  el.setAttribute('content', content);
}
function setCanonical(href) {
  let el = document.head.querySelector('link[rel="canonical"]');
  if (!el) { el = document.createElement('link'); el.setAttribute('rel', 'canonical'); document.head.appendChild(el); }
  el.setAttribute('href', href);
}
function injectSchema(obj) {
  let el = document.getElementById('route-schema');
  if (!obj) { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('script'); el.type = 'application/ld+json'; el.id = 'route-schema'; document.head.appendChild(el); }
  el.textContent = JSON.stringify(obj);
}
function faqSchema(list) {
  return { '@context': 'https://schema.org', '@type': 'FAQPage',
    mainEntity: list.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })) };
}
function serviceSchema(name, desc, path) {
  return { '@context': 'https://schema.org', '@type': 'Service', name, description: desc, serviceType: name,
    provider: { '@type': 'Person', name: 'Tonny Dager', worksFor: { '@type': 'Organization', name: 'ExperientIA S.A.S.' } },
    areaServed: 'Global', url: BASE_URL + path };
}

router.afterEach((to) => {
  if (!to.path.startsWith('/eventos/')) document.getElementById('event-schema')?.remove();
  const url = BASE_URL + to.path;
  const desc = to.meta?.desc ?? '';
  if (to.meta?.title) document.title = to.meta.title;
  if (to.meta?.desc != null) setMeta('name', 'description', desc);
  setMeta('property', 'og:title', to.meta?.title || 'Tonny Dager');
  setMeta('property', 'og:description', desc);
  setMeta('property', 'og:url', url);
  setCanonical(url);

  let schema = null;
  if (to.meta?.faq) schema = faqSchema(to.meta.faq);
  else if (to.meta?.serviceName) schema = serviceSchema(to.meta.serviceName, desc, to.path);
  injectSchema(schema);
});
