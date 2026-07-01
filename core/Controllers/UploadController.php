<?php
namespace Core\Controllers;

use Core\Http\Request;
use Core\Http\Response;
use Core\Helpers\Audit;
use Core\Services\ImageService;

class UploadController
{
    private const ALLOWED = ['image/jpeg' => 'jpg', 'image/png' => 'png', 'image/webp' => 'webp', 'image/gif' => 'gif'];
    private const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

    // POST /admin/upload (multipart, campo "file") — guarda una imagen y devuelve su URL.
    public function store(Request $req): void
    {
        if (empty($_FILES['file']) || ($_FILES['file']['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
            Response::error('No se recibió el archivo', 422);
        }
        $file = $_FILES['file'];
        if ($file['size'] > self::MAX_BYTES) Response::error('La imagen supera el máximo de 5 MB', 422);

        $mime = function_exists('mime_content_type') ? mime_content_type($file['tmp_name']) : ($file['type'] ?? '');
        if (!isset(self::ALLOWED[$mime])) Response::error('Formato no permitido (usa JPG, PNG, WEBP o GIF)', 422);

        // Optimiza para web (reescala y recomprime). Si no hay GD, guarda tal cual.
        $opt = ImageService::optimizeUpload($file['tmp_name'], 1600);
        if (!empty($opt['url'])) {
            Audit::log('upload.image', 'file', 0, ['url' => $opt['url'], 'bytes' => $opt['bytes']]);
            Response::created($opt, 'Imagen subida');
        }

        $dir = dirname(__DIR__, 2) . '/assets/uploads';
        if (!is_dir($dir)) @mkdir($dir, 0755, true);
        $ext = self::ALLOWED[$mime];
        $name = date('Ymd') . '-' . bin2hex(random_bytes(6)) . '.' . $ext;
        $dest = $dir . '/' . $name;
        if (!move_uploaded_file($file['tmp_name'], $dest)) Response::error('No se pudo guardar la imagen', 500);
        $size = @getimagesize($dest) ?: [0, 0];
        Audit::log('upload.image', 'file', 0, ['name' => $name]);
        Response::created(['url' => '/assets/uploads/' . $name, 'width' => $size[0], 'height' => $size[1]], 'Imagen subida');
    }
}
