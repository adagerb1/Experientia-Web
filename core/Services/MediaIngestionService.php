<?php
declare(strict_types=1);

namespace Core\Services;

use Core\Helpers\Audit;

final class MediaIngestionService
{
    private const EXTENSIONS = [
        'audio/ogg' => 'ogg', 'audio/mpeg' => 'mp3', 'audio/mp4' => 'm4a', 'audio/wav' => 'wav',
        'audio/x-wav' => 'wav', 'audio/webm' => 'webm', 'image/jpeg' => 'jpg', 'image/png' => 'png',
        'image/webp' => 'webp', 'application/pdf' => 'pdf', 'text/plain' => 'txt', 'text/markdown' => 'md',
        'text/csv' => 'csv', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' => 'docx',
        'application/msword' => 'doc',
    ];

    public static function whatsapp(array $message, array $connectorConfig, array $binding): array
    {
        $type = (string) ($message['type'] ?? 'unknown');
        $node = is_array($message[$type] ?? null) ? $message[$type] : [];
        $mediaId = (string) ($node['id'] ?? '');
        $name = (string) ($node['filename'] ?? ($type . '-' . date('Ymd-His')));
        if ($mediaId === '') return self::rejected($type, 'El mensaje no incluyó un identificador de medio.');
        $download = WhatsAppService::downloadMedia($connectorConfig, $mediaId, (int) ($binding['max_file_bytes'] ?? 10485760));
        if (empty($download['ok'])) return self::rejected($type, (string) ($download['error'] ?? 'No fue posible descargar el archivo.'));
        return self::process($type, $name, (string) $download['mime_type'], (string) $download['bytes_data'], $mediaId, $binding);
    }

    public static function telegram(array $message, string $botToken, array $binding): array
    {
        $type = 'unknown'; $fileId = ''; $name = '';
        if (!empty($message['voice'])) { $type = 'audio'; $fileId = (string) $message['voice']['file_id']; $name = 'voice-' . ($message['voice']['file_unique_id'] ?? date('His')) . '.ogg'; }
        elseif (!empty($message['audio'])) { $type = 'audio'; $fileId = (string) $message['audio']['file_id']; $name = (string) ($message['audio']['file_name'] ?? 'audio'); }
        elseif (!empty($message['document'])) { $type = 'document'; $fileId = (string) $message['document']['file_id']; $name = (string) ($message['document']['file_name'] ?? 'documento'); }
        elseif (!empty($message['photo']) && is_array($message['photo'])) {
            $type = 'image'; $photo = $message['photo'][array_key_last($message['photo'])]; $fileId = (string) ($photo['file_id'] ?? ''); $name = 'imagen-' . ($photo['file_unique_id'] ?? date('His')) . '.jpg';
        }
        if ($fileId === '') return self::rejected($type, 'Telegram no incluyó un archivo compatible.');
        $download = TelegramService::downloadFile($botToken, $fileId, (int) ($binding['max_file_bytes'] ?? 10485760));
        if (empty($download['ok'])) return self::rejected($type, (string) ($download['error'] ?? 'No fue posible descargar el archivo.'));
        $mime = self::detectMime((string) $download['bytes_data'], $name, $type);
        return self::process($type, $name, $mime, (string) $download['bytes_data'], 'tg:' . $fileId, $binding);
    }

    private static function process(string $type, string $name, string $mime, string $bytes, string $providerId, array $binding): array
    {
        $mime = strtolower(trim(explode(';', $mime, 2)[0]));
        $nameExtension = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        if ($nameExtension === 'docx' && in_array($mime, ['application/zip', 'application/octet-stream'], true)) {
            $mime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        } elseif ($nameExtension === 'doc' && in_array($mime, ['application/x-cdf', 'application/cdfv2', 'application/octet-stream'], true)) {
            $mime = 'application/msword';
        }
        $policy = is_array($binding['accepted_media'] ?? null) ? $binding['accepted_media'] : [];
        if (empty($policy[$type])) return self::rejected($type, 'Este tipo de mensaje no está habilitado para este canal.');
        $max = max(1048576, min(26214400, (int) ($binding['max_file_bytes'] ?? 10485760)));
        if ($bytes === '' || strlen($bytes) > $max) return self::rejected($type, 'El archivo está vacío o supera el tamaño permitido.');
        if (!isset(self::EXTENSIONS[$mime])) return self::rejected($type, 'El formato real del archivo no está permitido.');
        $extension = self::EXTENSIONS[$mime];
        if ($type === 'document' && !in_array($extension, (array) ($policy['document_extensions'] ?? []), true)) {
            return self::rejected($type, 'La extensión .' . $extension . ' no está habilitada.');
        }
        if ($type === 'audio' && !in_array($mime, (array) ($policy['audio_mimes'] ?? []), true)) return self::rejected($type, 'Formato de audio no habilitado.');
        if ($type === 'image' && !in_array($mime, (array) ($policy['image_mimes'] ?? []), true)) return self::rejected($type, 'Formato de imagen no habilitado.');

        $root = dirname(__DIR__, 2) . '/storage/inbound/' . date('Y/m');
        if (!is_dir($root) && !@mkdir($root, 0750, true) && !is_dir($root)) return self::rejected($type, 'No fue posible preparar el almacenamiento seguro.');
        $stored = date('YmdHis') . '-' . bin2hex(random_bytes(8)) . '.' . $extension;
        $path = $root . '/' . $stored;
        if (@file_put_contents($path, $bytes, LOCK_EX) === false) return self::rejected($type, 'No fue posible guardar el archivo.');
        @chmod($path, 0640);
        $result = ['accepted' => true, 'type' => $type, 'provider_media_id' => $providerId,
            'original_name' => mb_substr(basename($name), 0, 255), 'mime_type' => $mime, 'bytes' => strlen($bytes),
            'storage_path' => self::relativePath($path), 'sha256' => hash('sha256', $bytes), 'processing_status' => 'stored',
            'transcript' => null, 'extracted_text' => null, 'error_message' => null];
        unset($bytes);
        try {
            if ($type === 'audio') {
                $conn = ConnectorService::active('ai');
                if (!$conn || ($conn['provider'] ?? '') !== 'openai') throw new \RuntimeException('Activa OpenAI para transcribir audios.');
                $result['transcript'] = AiService::transcribe($conn, $path, $mime, 'es');
                $result['processing_status'] = 'transcribed';
            } elseif ($type === 'document') {
                $result['extracted_text'] = self::extractText($path, $extension);
                $result['processing_status'] = $result['extracted_text'] ? 'extracted' : 'stored_for_review';
            } else {
                $result['processing_status'] = 'stored_for_review';
            }
        } catch (\Throwable $e) {
            $result['processing_status'] = 'stored_for_review';
            $result['error_message'] = mb_substr($e->getMessage(), 0, 500);
            Audit::error('agent.media', $e->getMessage());
        }
        return $result;
    }

    private static function extractText(string $path, string $extension): ?string
    {
        if (in_array($extension, ['txt', 'md', 'csv'], true)) return mb_substr(trim((string) @file_get_contents($path)), 0, 40000);
        if ($extension === 'docx' && class_exists(\ZipArchive::class)) {
            $zip = new \ZipArchive();
            if ($zip->open($path) === true) {
                $xml = $zip->getFromName('word/document.xml'); $zip->close();
                if (is_string($xml)) {
                    $xml = str_replace(['</w:p>', '</w:tr>'], ["\n", "\n"], $xml);
                    return mb_substr(trim(html_entity_decode(strip_tags($xml), ENT_QUOTES | ENT_XML1, 'UTF-8')), 0, 40000);
                }
            }
        }
        return null;
    }

    private static function detectMime(string $bytes, string $name, string $type): string
    {
        if (class_exists(\finfo::class)) {
            $finfo = new \finfo(FILEINFO_MIME_TYPE); $mime = (string) $finfo->buffer($bytes);
            if ($mime !== '' && $mime !== 'application/octet-stream') {
                $extension = strtolower(pathinfo($name, PATHINFO_EXTENSION));
                if ($extension === 'docx' && $mime === 'application/zip') return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                return $mime;
            }
        }
        $ext = strtolower(pathinfo($name, PATHINFO_EXTENSION));
        foreach (self::EXTENSIONS as $mime => $candidate) if ($candidate === $ext) return $mime;
        return $type === 'image' ? 'image/jpeg' : ($type === 'audio' ? 'audio/ogg' : 'application/octet-stream');
    }

    private static function relativePath(string $path): string
    {
        return ltrim(str_replace(dirname(__DIR__, 2), '', $path), '/');
    }

    private static function rejected(string $type, string $message): array
    {
        return ['accepted' => false, 'type' => $type, 'processing_status' => 'rejected', 'error_message' => $message];
    }
}
