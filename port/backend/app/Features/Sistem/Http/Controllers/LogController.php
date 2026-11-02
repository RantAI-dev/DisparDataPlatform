<?php

namespace App\Features\Sistem\Http\Controllers;

use App\Features\Sistem\Http\Requests\DaftarLogRequest;
use App\Features\Sistem\Http\Resources\HalamanResource;
use App\Features\Sistem\Services\LogService;

final class LogController
{
    public function __invoke(DaftarLogRequest $r, LogService $layanan): HalamanResource
    {
        return new HalamanResource($layanan->log(
            $r->validated('modul'),
            $r->validated('dari'),
            $r->validated('sampai'),
            (int) ($r->validated('page') ?? 1),
        ));
    }
}
