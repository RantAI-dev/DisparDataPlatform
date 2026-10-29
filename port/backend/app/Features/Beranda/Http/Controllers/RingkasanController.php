<?php

namespace App\Features\Beranda\Http\Controllers;

use App\Features\Beranda\Http\Resources\BerandaResource;
use App\Features\Beranda\Services\BerandaService;

final class RingkasanController
{
    public function __invoke(BerandaService $layanan): BerandaResource
    {
        return new BerandaResource($layanan->ringkasan());
    }
}
