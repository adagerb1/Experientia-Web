<?php
namespace Core\Controllers;

use Core\Http\Request;
use Core\Http\Response;
use Core\Db;
use Core\Helpers\Audit;

// Link en Bio editable: configuración guardada como JSON en settings (clave link_bio).
class BioController
{
    private const KEY = 'link_bio';

    // Valores por defecto (si aún no se ha personalizado desde el panel).
    private static function defaults(): array
    {
        return [
            'name' => 'Tonny Dager',
            'role' => 'Arquitecto del Crecimiento Empresarial',
            'avatar_url' => '/assets/img/tonny-portrait.png',
            'tags' => 'Estrategia · Datos · IA · Automatización · Ventas',
            'message' => 'Tu empresa puede vender y aun así estar trabada. Haz el diagnóstico y descubre tu primera jugada de crecimiento.',
            'show_pitch' => true,
            'pitch_title' => 'El Tablero en 4 líneas',
            'pitch_items' => [
                ['title' => 'Dirección', 'text' => 'define el rumbo'],
                ['title' => 'Defensa', 'text' => 'protege la estabilidad'],
                ['title' => 'Mediocampo', 'text' => 'conecta datos y procesos'],
                ['title' => 'Ataque', 'text' => 'convierte mercado en crecimiento'],
            ],
            'buttons' => [
                ['label' => 'Hacer Diagnóstico Tablero de Crecimiento', 'url' => '/diagnostico-tablero-crecimiento', 'external' => false, 'style' => 'primary', 'event' => 'bio_diagnostic_clicked'],
                ['label' => 'Agendar lectura estratégica', 'url' => '/agenda', 'external' => false, 'style' => 'normal', 'event' => 'bio_agenda_clicked'],
                ['label' => 'Conocer ExperientIA', 'url' => '/experientia', 'external' => false, 'style' => 'normal', 'event' => 'bio_experientia_clicked'],
                ['label' => 'Ver contenido destacado', 'url' => 'https://www.linkedin.com', 'external' => true, 'style' => 'ghost', 'event' => 'bio_content_clicked'],
            ],
            'footer' => '© 2026 Tonny Dager · ExperientIA',
        ];
    }

    private static function stored(): array
    {
        $raw = Db::scalar("SELECT `value` FROM settings WHERE `key` = :k", [':k' => self::KEY]);
        $data = $raw ? json_decode((string) $raw, true) : null;
        return is_array($data) ? $data : [];
    }

    // GET /bio — configuración pública (merge de defaults + personalización).
    public function index(Request $req): void
    {
        Response::ok(array_merge(self::defaults(), self::stored()));
    }

    // GET /admin/bio
    public function adminIndex(Request $req): void
    {
        Response::ok(array_merge(self::defaults(), self::stored()));
    }

    // PUT /admin/bio — guarda la configuración (sanitizada).
    public function save(Request $req): void
    {
        $b = $req->body;
        $clean = [
            'name' => self::str($b['name'] ?? '', 120),
            'role' => self::str($b['role'] ?? '', 160),
            'avatar_url' => self::str($b['avatar_url'] ?? '', 255),
            'tags' => self::str($b['tags'] ?? '', 255),
            'message' => self::str($b['message'] ?? '', 400),
            'show_pitch' => !empty($b['show_pitch']),
            'pitch_title' => self::str($b['pitch_title'] ?? '', 120),
            'pitch_items' => [],
            'buttons' => [],
            'footer' => self::str($b['footer'] ?? '', 160),
        ];

        foreach ((array) ($b['pitch_items'] ?? []) as $it) {
            $title = self::str($it['title'] ?? '', 60);
            if ($title === '') continue;
            $clean['pitch_items'][] = ['title' => $title, 'text' => self::str($it['text'] ?? '', 120)];
            if (count($clean['pitch_items']) >= 8) break;
        }
        foreach ((array) ($b['buttons'] ?? []) as $bt) {
            $label = self::str($bt['label'] ?? '', 120);
            $url = self::str($bt['url'] ?? '', 400);
            if ($label === '' || $url === '') continue;
            $style = in_array(($bt['style'] ?? 'normal'), ['primary', 'normal', 'ghost'], true) ? $bt['style'] : 'normal';
            $clean['buttons'][] = [
                'label' => $label, 'url' => $url,
                'external' => !empty($bt['external']),
                'style' => $style,
                'event' => self::str($bt['event'] ?? 'bio_link_clicked', 60) ?: 'bio_link_clicked',
            ];
            if (count($clean['buttons']) >= 12) break;
        }

        $json = json_encode($clean, JSON_UNESCAPED_UNICODE);
        Db::exec(
            "INSERT INTO settings (`key`,`value`) VALUES (:k,:v) ON DUPLICATE KEY UPDATE `value` = :v2",
            [':k' => self::KEY, ':v' => $json, ':v2' => $json]
        );
        Audit::log('bio.updated', 'settings', null, ['buttons' => count($clean['buttons'])], (int) ($req->params['__auth_uid'] ?? 0));
        Response::ok($clean, 'Link en Bio guardado');
    }

    private static function str($v, int $max): string
    {
        return mb_substr(trim((string) (is_scalar($v) ? $v : '')), 0, $max);
    }
}
