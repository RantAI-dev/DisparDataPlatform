<?php

namespace App\Features\Beranda\Http\Controllers;

use App\Features\Beranda\Http\Resources\BerandaResource;
use App\Features\Beranda\Services\BerandaService;

final class RingkasanController
{
    /**
     * Ringkasan beranda
     *
     * Angka beranda: jumlah dataset primer dan sekunder, jumlah baris pendataan lapangan, jumlah
     * indikator GCI dan GPCI, dan jumlah indeks global yang dipantau.
     */
    public function __invoke(BerandaService $layanan): BerandaResource
    {
        return new BerandaResource($layanan->ringkasan());
    }
}
