// Vue Router en modo history (Documento técnico: routing History).
import { createRouter, createWebHistory } from 'vue-router';

import Home from '../../app/views/Home.js';
import SobreTonny from '../../app/views/SobreTonny.js';
import Diagnostico from '../../app/views/Diagnostico.js';
import Mentorias from '../../app/views/Mentorias.js';
import Conferencias from '../../app/views/Conferencias.js';
import ExperientIA from '../../app/views/ExperientIA.js';
import AlexIA from '../../app/views/AlexIA.js';
import Casos from '../../app/views/Casos.js';
import Recursos from '../../app/views/Recursos.js';
import Contacto from '../../app/views/Contacto.js';
import NotFound from '../../app/views/NotFound.js';

const routes = [
  { path: '/', component: Home, meta: { title: 'Tonny Dager — IA, automatización y growth para empresas', desc: 'Vender mejor, operar con menos fricción y escalar con claridad. Estrategia humana + ExperientIA.' } },
  { path: '/sobre-tonny-dager', component: SobreTonny, meta: { title: 'Sobre Tonny Dager — Autoridad en IA, growth y estrategia', desc: 'Quién es Tonny Dager, su experiencia, su visión sobre IA y por qué creó ExperientIA.' } },
  { path: '/diagnostico-ia-growth', component: Diagnostico, meta: { title: 'Diagnóstico IA & Growth — Tonny Dager', desc: 'Sesión 1:1 para identificar oportunidades de crecimiento, automatización, IA, marketing, ventas y datos.' } },
  { path: '/mentorias', component: Mentorias, meta: { title: 'Mentorías Estratégicas — Tonny Dager', desc: 'Mentoría premium de acompañamiento para empresarios, founders y líderes que quieren crecer con claridad.' } },
  { path: '/conferencias', component: Conferencias, meta: { title: 'Conferencias & Workshops — Tonny Dager', desc: 'Speaker estratégico en IA, automatización y growth para empresas, gremios, universidades y eventos.' } },
  { path: '/experientia', component: ExperientIA, meta: { title: 'ExperientIA — Implementación de IA, automatización y growth', desc: 'ExperientIA convierte la claridad estratégica en sistemas, tecnología, procesos y resultados.' } },
  { path: '/alexia', component: AlexIA, meta: { title: 'AlexIA — Agentes inteligentes para atención, ventas y seguimiento', desc: 'AlexIA automatiza atención, agendamiento, seguimiento comercial y soporte con agentes conversacionales.' } },
  { path: '/casos', component: Casos, meta: { title: 'Casos reales — Resultados medibles | Tonny Dager', desc: 'Casos reales de IA, automatización y growth con impacto medible en procesos, ventas y decisiones.' } },
  { path: '/recursos', component: Recursos, meta: { title: 'Recursos — Ideas e insights de IA y growth | Tonny Dager', desc: 'Artículos, guías y checklists para aplicar IA, automatización, marketing y datos con criterio de negocio.' } },
  { path: '/contacto', component: Contacto, meta: { title: 'Contacto — Agenda una conversación estratégica', desc: 'Cuéntanos tu necesidad y canalizamos tu solicitud: diagnóstico, mentoría, conferencia, IA o AlexIA.' } },
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

// SEO dinámico por ruta (title + meta description).
router.afterEach((to) => {
  if (to.meta?.title) document.title = to.meta.title;
  if (to.meta?.desc != null) {
    let m = document.querySelector('meta[name="description"]');
    if (!m) { m = document.createElement('meta'); m.name = 'description'; document.head.appendChild(m); }
    m.setAttribute('content', to.meta.desc);
  }
});
