<?php

namespace App\Features\Indikator\Http\Controllers;

use App\Features\Indikator\Http\Requests\FrameworkRequest;
use App\Features\Indikator\Http\Requests\TahunRequest;
use App\Features\Indikator\Http\Resources\IndikatorResource;
use App\Features\Indikator\Services\IndikatorService;

/** KONTRAK §2.3: satu metode per endpoint (docblock = isi /docs). */
final class IndikatorController
{
    public function __construct(private readonly IndikatorService $layanan) {}

    /**
     * Daftar indikator
     *
     * Kesiapan data tiap indikator satu framework: status, dataset pengisi, nilai terbaru, dan
     * ringkasan jumlah per status.
     */
    public function daftar(FrameworkRequest $r): IndikatorResource
    {
        return new IndikatorResource($this->layanan->tetap('indikator', $r->untukDataApi()));
    }

    /**
     * Detail indikator
     *
     * Identitas, konteks indeks (benchmark), dataset sumber, KPI, dan blok grafik satu indikator;
     * indikator tanpa data memuat `teks_fallback`.
     *
     * @param  string  $code  Kode indikator, mis. `CI-MU`.
     */
    public function detail(string $code): IndikatorResource
    {
        return new IndikatorResource($this->layanan->tetap('indikator/'.strtoupper($code)));
    }

    /**
     * Peringkat resmi GCI
     *
     * Peringkat Kearney GCI Jakarta (keseluruhan dan Pengalaman Budaya) serta empat kartu indikator
     * pariwisata resmi.
     */
    public function gciResmi(): IndikatorResource
    {
        return new IndikatorResource($this->layanan->tetap('gci/resmi'));
    }

    /**
     * Dataset tematik
     *
     * Kartu dataset tematik per framework dengan jumlah baris yang dihitung dari tabel sumber.
     */
    public function datasetTematik(FrameworkRequest $r): IndikatorResource
    {
        return new IndikatorResource($this->layanan->tetap('dataset-tematik', $r->untukDataApi()));
    }

    /**
     * Wisatawan internasional
     *
     * Isi halaman pariwisata wisatawan internasional: shell, KPI, kartu grafik, dan data per tahun.
     */
    public function wisatawanInternasional(): IndikatorResource
    {
        return new IndikatorResource($this->layanan->tetap('pariwisata/wisatawan-internasional'));
    }

    /**
     * Kuliner (Michelin)
     *
     * Isi halaman pariwisata penawaran kuliner: Michelin, restoran per wilayah, dan tabel pendukung.
     */
    public function kulinerMichelin(): IndikatorResource
    {
        return new IndikatorResource($this->layanan->tetap('pariwisata/kuliner-michelin'));
    }

    /**
     * Seni visual & pertunjukan
     *
     * Isi halaman seni pertunjukan untuk semua tahun atau satu `tahun`: KPI, grafik, venue peta, dan
     * artis Top-10 yang tampil di Jakarta.
     */
    public function seniPertunjukan(TahunRequest $r): IndikatorResource
    {
        return new IndikatorResource($this->layanan->berparameter('pariwisata/seni-pertunjukan', $r->untukDataApi()));
    }
}
