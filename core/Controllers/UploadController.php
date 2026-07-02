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

    private const DOC_EXT = ['pdf' => 'application/pdf', 'xlsx' => '', 'xls' => '', 'docx' => '', 'doc' => '', 'pptx' => '', 'csv' => '', 'zip' => ''];
    private const MAX_DOC = 25 * 1024 * 1024; // 25 MB

    // POST /admin/upload-doc (multipart, campo "file") — guarda un documento (PDF/Excel/Word...).
    public function doc(Request $req): void
    {
        self::guardPostSize();
        if (empty($_FILES['file'])) Response::error('No se recibió el archivo. Verifica que sea menor a ' . self::maxMb() . ' MB.', 422);
        $err = $_FILES['file']['error'] ?? UPLOAD_ERR_NO_FILE;
        if ($err !== UPLOAD_ERR_OK) Response::error(self::uploadErr($err), 422);
        $file = $_FILES['file'];
        if ($file['size'] > self::MAX_DOC) Response::error('El archivo supera el máximo de 25 MB', 422);
        $ext = strtolower(pathinfo($file['name'], PATHINFO_EXTENSION));
        if (!array_key_exists($ext, self::DOC_EXT)) Response::error('Formato no permitido (PDF, Excel, Word, PPT, CSV o ZIP)', 422);

        $dir = dirname(__DIR__, 2) . '/assets/docs';
        if (!is_dir($dir)) @mkdir($dir, 0755, true);
        $base = preg_replace('/[^a-z0-9\-]+/', '-', strtolower(pathinfo($file['name'], PATHINFO_FILENAME)));
        $name = trim($base, '-') . '-' . bin2hex(random_bytes(4)) . '.' . $ext;
        $dest = $dir . '/' . $name;
        if (!move_uploaded_file($file['tmp_name'], $dest)) Response::error('No se pudo guardar el archivo', 500);
        Audit::log('upload.doc', 'file', 0, ['name' => $name]);
        Response::created(['url' => '/assets/docs/' . $name, 'name' => $file['name'], 'bytes' => (int) $file['size']], 'Documento subido');
    }

    // Si el cuerpo POST superó post_max_size, PHP vacía $_FILES y $_POST: lo detectamos.
    private static function guardPostSize(): void
    {
        $len = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
        $max = self::bytes(ini_get('post_max_size'));
        if ($max > 0 && $len > $max && empty($_FILES) && empty($_POST)) {
            Response::error('El archivo supera el límite del servidor (' . self::maxMb() . ' MB). '
                . 'Aumenta post_max_size/upload_max_filesize en el hosting o sube un archivo más liviano.', 413);
        }
    }

    private static function maxMb(): int
    {
        $u = self::bytes(ini_get('upload_max_filesize'));
        $p = self::bytes(ini_get('post_max_size'));
        $min = min($u ?: PHP_INT_MAX, $p ?: PHP_INT_MAX);
        return $min === PHP_INT_MAX ? 8 : (int) floor($min / 1048576);
    }

    private static function bytes($val): int
    {
        $val = trim((string) $val); if ($val === '') return 0;
        $unit = strtolower($val[strlen($val) - 1]);
        $num = (int) $val;
        return match ($unit) { 'g' => $num * 1073741824, 'm' => $num * 1048576, 'k' => $num * 1024, default => (int) $val };
    }

    private static function uploadErr(int $code): string
    {
        return match ($code) {
            UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE => 'El archivo supera el límite permitido (' . self::maxMb() . ' MB).',
            UPLOAD_ERR_PARTIAL => 'La subida se interrumpió. Intenta de nuevo.',
            UPLOAD_ERR_NO_FILE => 'No se seleccionó ningún archivo.',
            UPLOAD_ERR_NO_TMP_DIR, UPLOAD_ERR_CANT_WRITE => 'El servidor no pudo guardar el archivo (permisos/temporal).',
            default => 'No se pudo recibir el archivo.',
        };
    }
}
