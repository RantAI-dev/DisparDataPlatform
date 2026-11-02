<?php

namespace App\Features\Gmti\Http\Controllers;

use App\Features\Gmti\Http\Requests\LimitRequest;
use App\Features\Gmti\Http\Requests\TempatRequest;
use App\Features\Gmti\Http\Resources\GmtiResource;
use App\Features\Gmti\Services\GmtiService;

/** KONTRAK §2.5: satu metode per endpoint (docblock = isi /docs). */
final class GmtiController
{
    public function __construct(private readonly GmtiService $layanan) {}

    /**
     * Ringkasan GMTI
     *
     * Jakarta Ramah Muslim: angka per pilar, kepadatan per kecamatan, tipologi, capaian, dan penghargaan.
     */
    public function ringkasan(): GmtiResource
    {
        return new GmtiResource($this->layanan->baca('T', 'gmti/ringkasan'));
    }

    /**
     * Daftar tempat GMTI
     *
     * Tempat ramah Muslim berhalaman (200 per halaman) dengan filter pilar, kota, jenis, dan cari.
     */
    public function tempat(TempatRequest $r): GmtiResource
    {
        return new GmtiResource($this->layanan->baca('P', 'gmti/tempat', $r->validated()));
    }

    /**
     * Peta Spatial
     *
     * Titik ringkas berkoordinat (atlas, venue seni, GMTI, dataset Silver) beserta kepadatan per kecamatan.
     */
    public function spasial(): GmtiResource
    {
        return new GmtiResource($this->layanan->baca('T', 'spasial'));
    }

    /**
     * Detail titik Spatial
     *
     * Detail satu titik untuk popup peta (mis. sertifikat halal).
     */
    public function titik(string $id): GmtiResource
    {
        return new GmtiResource($this->layanan->baca('P', 'spasial/titik/'.$id));
    }

    /**
     * Hotel hasil scraping
     *
     * Harga kamar hotel hasil scraping Booking.com (snapshot Bronze).
     */
    public function hotelScraped(LimitRequest $r): GmtiResource
    {
        return new GmtiResource($this->layanan->baca('T', 'hotel-scraped', $r->validated()));
    }
}
