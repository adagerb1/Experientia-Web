<?php
namespace Core\Services;

class EventMediaService
{
    public static function capabilities(): array
    {
        return [
            'image' => ['status' => 'planned', 'providers' => ['openai','manual'], 'requires_approval' => true],
            'video' => ['status' => 'planned', 'providers' => ['openai','veo','manual'], 'requires_approval' => true],
            'audio' => ['status' => 'planned', 'providers' => ['elevenlabs','manual'], 'requires_approval' => true],
        ];
    }

    public static function productionBrief(array $artifact, string $kind): array
    {
        if (!isset(self::capabilities()[$kind])) throw new \InvalidArgumentException('Tipo de medio no soportado.');
        return [
            'kind' => $kind,
            'provider' => null,
            'status' => 'draft',
            'requires_human_approval' => true,
            'source_artifact' => $artifact,
            'safety' => [
                'no_secrets_in_prompt' => true,
                'rights_confirmation_required' => true,
                'public_figure_consent_required' => true,
                'brand_review_required' => true,
            ],
        ];
    }
}
