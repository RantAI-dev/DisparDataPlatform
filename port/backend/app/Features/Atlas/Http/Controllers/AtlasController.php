<?php

namespace App\Features\Atlas\Http\Controllers;

use App\Features\Atlas\Http\Requests\TahunRequest;
use App\Features\Atlas\Http\Resources\AtlasResource;
use App\Features\Atlas\Services\AtlasService;

/** KONTRAK §2.4: satu metode per endpoint (docblock = isi /docs). */
final class AtlasController
{
    public function __construct(private readonly AtlasService $layanan) {}

    /**
     * Restoran GCI
     *
     * Seluruh restoran & kafe se-Jakarta untuk Global City Index: gabungan kurasi, OSM, rating, alamat, harga, dan restoran hotel (dedup ≤ 60 m).
     */
    public function restoranGci(): AtlasResource
    {
        return new AtlasResource($this->layanan->baca('restoran-gci'));
    }

    /**
     * Direktori restoran
     *
     * Restoran & kafe pilihan Jakarta dengan sumber sitasi publik (kurasi + OSM, dedup, hanya DKI).
     */
    public function direktoriRestoran(): AtlasResource
    {
        return new AtlasResource($this->layanan->baca('direktori-restoran'));
    }

    /**
     * Lapangan golf
     *
     * Lapangan & driving range golf di Jakarta dan sekitarnya.
     */
    public function golf(): AtlasResource
    {
        return new AtlasResource($this->layanan->baca('golf'));
    }

    /**
     * Toko suvenir
     *
     * Toko suvenir, oleh-oleh & kerajinan dari TripAdvisor.
     */
    public function suvenir(): AtlasResource
    {
        return new AtlasResource($this->layanan->baca('suvenir'));
    }

    /**
     * Hotel & akomodasi
     *
     * Registri hotel berbintang, tingkat penghunian kamar (TPK), dan lama menginap.
     */
    public function hotel(): AtlasResource
    {
        return new AtlasResource($this->layanan->baca('hotel'));
    }

    /**
     * Pertunjukan budaya
     *
     * Konser, festival, tari, teater, seni rupa, dan film; semua tahun atau satu `tahun`.
     */
    public function pertunjukan(TahunRequest $r): AtlasResource
    {
        return new AtlasResource($this->layanan->baca('pertunjukan', $r->validated()));
    }
}
