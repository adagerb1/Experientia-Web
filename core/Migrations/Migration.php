<?php
declare(strict_types=1);

namespace Core\Migrations;

use PDO;

interface Migration
{
    public function version(): string;

    public function description(): string;

    public function up(PDO $pdo): void;
}
