<?php
declare(strict_types=1);

// Fuente única para las campañas comerciales públicas.
// Las URLs de checkout se configuran por variables de entorno y nunca se
// exponen dentro del contenido público de la campaña.
$timezone = new DateTimeZone('America/Bogota');
$now = new DateTimeImmutable('now', $timezone);

$phaseFor = static function (array $phases) use ($now): array {
    foreach ($phases as $phase) {
        $starts = new DateTimeImmutable($phase['starts_at'], new DateTimeZone('America/Bogota'));
        $ends = new DateTimeImmutable($phase['ends_at'], new DateTimeZone('America/Bogota'));
        if ($now >= $starts && $now <= $ends) {
            return $phase;
        }
    }
    return $now < new DateTimeImmutable($phases[0]['starts_at'], new DateTimeZone('America/Bogota'))
        ? $phases[0]
        : $phases[array_key_last($phases)];
};

$presencialPhases = [
    [
        'key' => 'preventa',
        'label' => 'Preventa',
        'starts_at' => '2026-07-27 00:00:00',
        'ends_at' => '2026-07-31 23:59:59',
        'prices' => ['COP' => 250000],
        'next_prices' => ['COP' => 350000],
        'change_copy' => 'La preventa termina el 31 de julio o al agotarse los cupos publicados.',
    ],
    [
        'key' => 'oficial',
        'label' => 'Precio oficial',
        'starts_at' => '2026-08-01 00:00:00',
        'ends_at' => '2026-08-08 08:30:00',
        'prices' => ['COP' => 350000],
        'next_prices' => [],
        'change_copy' => 'Inscripciones sujetas a disponibilidad real de cupos.',
    ],
];
$virtualPhases = [
    [
        'key' => 'fundadores',
        'label' => 'Fundadores',
        'starts_at' => '2026-07-27 00:00:00',
        'ends_at' => '2026-07-31 23:59:59',
        'prices' => [
            'general' => ['COP' => 229000, 'USD' => 59],
            'premium' => ['COP' => 499000, 'USD' => 129],
        ],
        'next_prices' => [
            'general' => ['COP' => 299000, 'USD' => 79],
            'premium' => ['COP' => 599000, 'USD' => 159],
        ],
        'change_copy' => 'Precio Fundadores hasta el 31 de julio o los primeros 50 cupos.',
    ],
    [
        'key' => 'lanzamiento',
        'label' => 'Lanzamiento',
        'starts_at' => '2026-08-01 00:00:00',
        'ends_at' => '2026-08-10 23:59:59',
        'prices' => [
            'general' => ['COP' => 299000, 'USD' => 79],
            'premium' => ['COP' => 599000, 'USD' => 159],
        ],
        'next_prices' => [
            'general' => ['COP' => 369000, 'USD' => 97],
            'premium' => ['COP' => 749000, 'USD' => 197],
        ],
        'change_copy' => 'Precio de lanzamiento vigente hasta el 10 de agosto.',
    ],
    [
        'key' => 'ultima_llamada',
        'label' => 'Última llamada',
        'starts_at' => '2026-08-11 00:00:00',
        'ends_at' => '2026-08-18 19:00:00',
        'prices' => [
            'general' => ['COP' => 369000, 'USD' => 97],
            'premium' => ['COP' => 749000, 'USD' => 197],
        ],
        'next_prices' => ['general' => [], 'premium' => []],
        'change_copy' => 'Inscripciones abiertas hasta el inicio o hasta completar la capacidad.',
    ],
];

$presencialPhase = $phaseFor($presencialPhases);
$virtualPhase = $phaseFor($virtualPhases);

return [
    'campaigns' => [
        'marketing-vender-plus-cartagena' => [
            'key' => 'mvp_pres_0808',
            'slug' => 'marketing-vender-plus-cartagena',
            'variant' => 'control',
            'status' => 'published',
            'mode' => 'presencial',
            'brand' => 'ExperientIA × Academia Conversa × Tonny Dager',
            'eyebrow' => 'Entrenamiento presencial de implementación',
            'name' => 'Marketing para Vender+',
            'headline' => 'Trae un producto. Sal con una campaña.',
            'lead' => 'Un día para convertir lo que vendes en una oferta clara, un mensaje que se entiende y una ruta comercial que puedas activar y medir.',
            'dates_label' => 'Sábado 8 de agosto de 2026',
            'schedule_label' => '8:30 a. m.–6:00 p. m.',
            'location_label' => 'Academia Conversa · Cartagena de Indias',
            'hero_cta' => ['key' => 'hero_primary', 'label' => 'Quiero construir mi campaña', 'offer_key' => 'presencial'],
            'secondary_cta' => ['key' => 'reserve', 'label' => 'Reservar con COP $150.000', 'offer_key' => 'reserva'],
            'phase' => $presencialPhase,
            'promise_title' => 'No vienes a tomar apuntes. Vienes a tomar decisiones.',
            'problem_title' => 'Publicar más no es vender más.',
            'problems' => [
                'Tienes un buen producto, pero tu oferta todavía suena parecida a todas.',
                'Publicas y pautas sin una ruta clara entre atención, conversación y venta.',
                'Los leads llegan a WhatsApp, pero el seguimiento depende de la memoria.',
                'Quieres usar IA, aunque todavía no has definido qué debe acelerar.',
            ],
            'outcomes' => [
                ['title' => 'Cliente que decide', 'text' => 'Una prioridad comercial concreta, no “todo el mundo”.'],
                ['title' => 'Oferta Vender+', 'text' => 'Resultado, mecanismo, prueba y siguiente paso conectados.'],
                ['title' => 'Mensaje y pieza base', 'text' => 'Un ángulo rector, copy y guion utilizables.'],
                ['title' => 'Ruta de conversión', 'text' => 'Canal, CTA, conversación, seguimiento y métricas.'],
                ['title' => 'Plan de 30 días', 'text' => 'Acciones priorizadas y una primera ejecución en 72 horas.'],
            ],
            'method' => [
                ['step' => '01', 'title' => 'Enfoca', 'text' => 'Define el problema, el cliente y la decisión que quieres provocar.'],
                ['step' => '02', 'title' => 'Construye', 'text' => 'Trabaja sobre tu producto dentro de Vender+ Studio.'],
                ['step' => '03', 'title' => 'Contrasta', 'text' => 'Tonny, la metodología y AlexIA detectan vacíos y generalidades.'],
                ['step' => '04', 'title' => 'Activa', 'text' => 'Consolida tu campaña y sal con la siguiente acción definida.'],
            ],
            'agenda' => [
                ['time' => 'Mañana', 'title' => 'Cliente, oferta y promesa', 'result' => 'Define a quién atraer, qué vender y por qué elegirte.'],
                ['time' => 'Tarde', 'title' => 'Mensaje, ruta y campaña', 'result' => 'Conecta contenido, CTA, WhatsApp, seguimiento y medición.'],
                ['time' => 'Cierre', 'title' => 'Blueprint + acción', 'result' => 'Ordena la campaña y define lo que ejecutarás en 72 horas.'],
            ],
            'includes' => [
                '8 horas de aprendizaje e implementación.',
                'Acceso individual a Vender+ Studio durante el evento y 14 días posteriores.',
                'Blueprint Vender+: cliente, oferta, mensaje, canal, ruta, campaña y métricas.',
                'Kit de campaña, plantillas, e-book, checklist, almuerzo y pausas.',
                'Certificado sujeto a los checkpoints publicados.',
            ],
            'fit' => [
                'Tienes un producto, servicio, programa o negocio real.',
                'Publicas o pautas, pero no tienes una campaña conectada.',
                'Quieres salir con decisiones aplicadas, no solo ideas.',
            ],
            'not_fit' => [
                'Buscas una fórmula que garantice ventas sin validar ni ejecutar.',
                'Esperas que la IA invente la estrategia y decida por ti.',
                'Solo quieres un tutorial de botones en una plataforma.',
            ],
            'authority' => [
                ['value' => '18+ años', 'label' => 'conectando estrategia, tecnología, marketing y datos'],
                ['value' => '200+ clientes', 'label' => 'acompañados en proyectos y procesos de transformación'],
                ['value' => '10 países', 'label' => 'con experiencia empresarial y de formación'],
            ],
            'faq' => [
                ['q' => '¿Necesito saber de marketing o pauta?', 'a' => 'No. Partimos de decisiones de negocio y avanzamos paso a paso sobre tu caso real.'],
                ['q' => '¿Debo llevar computador?', 'a' => 'Sí, es la herramienta recomendada para trabajar con Vender+ Studio y construir tus activos.'],
                ['q' => '¿Puedo reservar y pagar el saldo después?', 'a' => 'Sí. La reserva es de COP $150.000 y el saldo debe completarse a más tardar el 5 de agosto, sujeto a la política publicada.'],
                ['q' => '¿El entrenamiento garantiza ventas?', 'a' => 'No. Construirás una estrategia, activos y métricas; el resultado depende de tu mercado, ejecución, inversión y seguimiento.'],
                ['q' => '¿Qué incluye la jornada?', 'a' => 'Entrenamiento, acceso temporal a Vender+ Studio, recursos, almuerzo, pausas y certificado sujeto a checkpoints.'],
            ],
            'offers' => [
                'presencial' => [
                    'name' => $presencialPhase['label'],
                    'prices' => $presencialPhase['prices'],
                    'next_prices' => $presencialPhase['next_prices'],
                    'checkout_urls' => ['COP' => getenv('MVP_PRESENCIAL_CHECKOUT_URL') ?: ''],
                ],
                'reserva' => [
                    'name' => 'Reserva',
                    'prices' => ['COP' => 150000],
                    'next_prices' => [],
                    'checkout_urls' => ['COP' => getenv('MVP_PRESENCIAL_RESERVA_URL') ?: ''],
                ],
            ],
            'ctas' => [
                'hero_primary' => ['mode' => 'checkout', 'requires_contact' => true],
                'reserve' => ['mode' => 'checkout', 'requires_contact' => true],
                'whatsapp' => ['mode' => 'whatsapp', 'requires_contact' => true],
                'final' => ['mode' => 'checkout', 'requires_contact' => true],
            ],
        ],
        'marketing-vender-plus-virtual' => [
            'key' => 'mvp_virtual_0818',
            'slug' => 'marketing-vender-plus-virtual',
            'variant' => 'control',
            'status' => 'published',
            'mode' => 'virtual',
            'brand' => 'ExperientIA × Tonny Dager',
            'eyebrow' => 'Workshop virtual · implementación en vivo',
            'name' => 'Marketing para Vender+ Virtual',
            'headline' => 'Cuatro sesiones para dejar de improvisar y construir tu próxima campaña.',
            'lead' => 'Conecta cliente, oferta, mensaje, canal, conversación y métricas en un Blueprint aplicable a los próximos 30 días.',
            'dates_label' => '18, 20, 25 y 27 de agosto de 2026',
            'schedule_label' => '7:00–9:00 p. m. · hora Colombia',
            'location_label' => 'En vivo · acceso desde cualquier país',
            'hero_cta' => ['key' => 'hero_primary', 'label' => 'Ver planes y elegir mi acceso', 'offer_key' => 'general'],
            'secondary_cta' => ['key' => 'whatsapp', 'label' => 'Resolver una pregunta', 'offer_key' => 'general'],
            'phase' => [
                'key' => $virtualPhase['key'],
                'label' => $virtualPhase['label'],
                'starts_at' => $virtualPhase['starts_at'],
                'ends_at' => $virtualPhase['ends_at'],
                'change_copy' => $virtualPhase['change_copy'],
            ],
            'promise_title' => 'No terminarás con una libreta llena de apuntes.',
            'problem_title' => 'La pauta no arregla una estrategia que no existe.',
            'problems' => [
                'Publicas por cumplir, sin saber qué acción comercial debe provocar cada pieza.',
                'Tu producto tiene valor, pero el mercado no entiende por qué debería elegirte.',
                'Mandas los leads a WhatsApp sin guion, estado ni próxima acción.',
                'Mides alcance y clics, aunque no puedes explicar qué genera conversación o venta.',
            ],
            'outcomes' => [
                ['title' => 'Diagnóstico y cliente', 'text' => 'Fugas comerciales y una situación de decisión prioritaria.'],
                ['title' => 'Oferta y mensaje', 'text' => 'Oferta, pitch, mensaje rector y Matriz de Mensajes.'],
                ['title' => 'Canal y conversación', 'text' => 'Ruta de Conversión y guion de WhatsApp.'],
                ['title' => 'Campaña y métricas', 'text' => 'Brief, umbrales, Blueprint y plan de 30 días.'],
            ],
            'method' => [
                ['step' => '01', 'title' => 'Enfoca', 'text' => 'Recibes el marco mínimo y eliges la decisión que importa.'],
                ['step' => '02', 'title' => 'Construye', 'text' => 'Trabajas sobre tu negocio dentro de Vender+ Studio.'],
                ['step' => '03', 'title' => 'Contrasta', 'text' => 'Detectas contradicciones entre cliente, oferta, mensaje y CTA.'],
                ['step' => '04', 'title' => 'Prueba', 'text' => 'Validas mensajes, conversaciones o una ruta real.'],
                ['step' => '05', 'title' => 'Mejora', 'text' => 'Regresas con evidencia y ajustas la decisión siguiente.'],
                ['step' => '06', 'title' => 'Activa', 'text' => 'Consolidas el Blueprint y ejecutas una acción en 72 horas.'],
            ],
            'agenda' => [
                ['time' => '18 AGO.', 'title' => '¿A quién debemos atraer?', 'result' => 'Fugas + Cliente que Decide.'],
                ['time' => '20 AGO.', 'title' => '¿Por qué deberían elegirte?', 'result' => 'Oferta + pitch + mensajes.'],
                ['time' => '25 AGO.', 'title' => '¿Dónde decide tu cliente?', 'result' => 'Canal + ruta + guion.'],
                ['time' => '27 AGO.', 'title' => '¿Cómo probamos sin improvisar?', 'result' => 'Campaña + métricas + Blueprint.'],
            ],
            'includes' => [
                'Cuatro sesiones virtuales en vivo · 8 horas de trabajo aplicado.',
                'Acceso individual a Vender+ Studio con asistencia de AlexIA.',
                'Entregable y lista de acciones al finalizar cada sesión.',
                'Grabaciones temporales, plantillas y comunidad según el plan.',
                'Certificado sujeto a asistencia y checkpoints publicados.',
            ],
            'fit' => [
                'Tienes un producto, servicio, programa, negocio o idea concreta.',
                'Quieres explicar mejor tu valor y convertir atención en conversaciones.',
                'Puedes ejecutar tareas cortas entre sesiones.',
            ],
            'not_fit' => [
                'Buscas una fórmula que garantice ventas sin validar ni medir.',
                'Solo quieres un tutorial avanzado de pauta.',
                'Esperas que la IA tome las decisiones por ti.',
            ],
            'authority' => [
                ['value' => '18+ años', 'label' => 'de experiencia en negocios y tecnología'],
                ['value' => '200+ clientes', 'label' => 'acompañados en proyectos y procesos'],
                ['value' => '10 países', 'label' => 'con experiencia aplicada'],
            ],
            'faq' => [
                ['q' => '¿Necesito saber de marketing o pauta?', 'a' => 'No. Partimos de decisiones de negocio y avanzamos paso a paso.'],
                ['q' => '¿Necesito experiencia con inteligencia artificial?', 'a' => 'No. Vender+ Studio te guía y la experiencia mantiene una ruta funcional aunque una función de IA no esté disponible.'],
                ['q' => '¿Las sesiones son en vivo?', 'a' => 'Sí. Son el 18, 20, 25 y 27 de agosto, de 7:00 a 9:00 p. m. hora Colombia.'],
                ['q' => '¿Quedan grabadas?', 'a' => 'Sí. General tendrá acceso por 15 días y Premium por 60 días, contados desde la última sesión y sujetos a los términos publicados.'],
                ['q' => '¿Puedo hacerlo desde el celular?', 'a' => 'Sí, aunque recomendamos computador para trabajar con mayor comodidad en Vender+ Studio.'],
                ['q' => '¿El programa garantiza ventas?', 'a' => 'No. Te ayuda a construir, probar y medir una estrategia; los resultados dependen de tu mercado y ejecución.'],
            ],
            'offers' => [
                'general' => [
                    'name' => 'General',
                    'badge' => 'Ruta esencial',
                    'prices' => $virtualPhase['prices']['general'],
                    'next_prices' => $virtualPhase['next_prices']['general'],
                    'features' => ['4 sesiones en vivo', 'Vender+ Studio + AlexIA', 'Grabaciones 15 días', 'Kit esencial', 'Comunidad 7 días'],
                    'checkout_urls' => [
                        'COP' => getenv('MVP_VIRTUAL_GENERAL_COP_CHECKOUT_URL') ?: '',
                        'USD' => getenv('MVP_VIRTUAL_GENERAL_USD_CHECKOUT_URL') ?: '',
                    ],
                ],
                'premium' => [
                    'name' => 'Premium',
                    'badge' => 'Más acompañamiento',
                    'prices' => $virtualPhase['prices']['premium'],
                    'next_prices' => $virtualPhase['next_prices']['premium'],
                    'features' => ['4 sesiones en vivo', 'Vender+ Studio + AlexIA', 'Grabaciones 60 días', 'Biblioteca ampliada', 'Comunidad 30 días', 'Cupo máximo: 60 personas'],
                    'checkout_urls' => [
                        'COP' => getenv('MVP_VIRTUAL_PREMIUM_COP_CHECKOUT_URL') ?: '',
                        'USD' => getenv('MVP_VIRTUAL_PREMIUM_USD_CHECKOUT_URL') ?: '',
                    ],
                ],
            ],
            'ctas' => [
                'hero_primary' => ['mode' => 'internal', 'target' => '#planes', 'requires_contact' => false],
                'plan_general' => ['mode' => 'checkout', 'requires_contact' => true],
                'plan_premium' => ['mode' => 'checkout', 'requires_contact' => true],
                'whatsapp' => ['mode' => 'whatsapp', 'requires_contact' => true],
                'final' => ['mode' => 'internal', 'target' => '#planes', 'requires_contact' => false],
            ],
        ],
    ],
];
