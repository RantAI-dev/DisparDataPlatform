<?php

namespace App\Features\Sistem\Http\Controllers;

use App\Features\Sistem\Http\Resources\KesehatanResource;
use App\Features\Sistem\Services\KesehatanService;

final class KesehatanController
{
    public function __invoke(KesehatanService $layanan): KesehatanResource
    {
        return new KesehatanResource($layanan->periksa());
    }
}
