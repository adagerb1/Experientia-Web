<?php
namespace Core\Controllers;

use Core\Http\Request;
use Core\Http\Response;
use Core\Db;

class ResourceController
{
    // GET /recursos
    public function index(Request $req): void
    {
        Response::ok(Db::select("SELECT * FROM resources WHERE published = 1 ORDER BY id DESC"));
    }

    // GET /casos
    public function cases(Request $req): void
    {
        Response::ok(Db::select("SELECT * FROM case_studies WHERE published = 1 ORDER BY id DESC"));
    }
}
