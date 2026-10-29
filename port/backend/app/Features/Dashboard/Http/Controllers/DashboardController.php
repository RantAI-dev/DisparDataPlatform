<?php

namespace App\Features\Dashboard\Http\Controllers;

use App\Features\Dashboard\Http\Requests\DestinasiRequest;
use App\Features\Dashboard\Http\Requests\JenisRequest;
use App\Features\Dashboard\Http\Requests\KotaRequest;
use App\Features\Dashboard\Http\Requests\PdrbPeriodeRequest;
use App\Features\Dashboard\Http\Requests\PeriodeRequest;
use App\Features\Dashboard\Http\Requests\TahunPeriodeRequest;
use App\Features\Dashboard\Http\Requests\TahunRequest;
use App\Features\Dashboard\Http\Requests\TamuRequest;
use App\Features\Dashboard\Http\Resources\DashboardResource;
use App\Features\Dashboard\Services\DashboardService;

/** KONTRAK §2.2: satu metode per endpoint (docblock = isi /docs). */
final class DashboardController
{
    public function __construct(private readonly DashboardService $layanan) {}

    /**
     * Ringkasan dashboard
     *
     * Empat KPI beranda dashboard: wisman tahun terakhir lengkap vs target RPJMD dan PDRB ekonomi kreatif.
     */
    public function ringkasan(): DashboardResource
    {
        return new DashboardResource($this->layanan->baca('ringkasan', []));
    }

    /**
     * Wisman per tahun
     *
     * Capaian kunjungan wisman per tahun vs target RPJMD, pertumbuhan, dan tahun bawaan halaman.
     */
    public function wismanTahunan(): DashboardResource
    {
        return new DashboardResource($this->layanan->baca('wisman/tahunan', []));
    }

    /**
     * Wisman per bulan
     *
     * Kunjungan wisman per bulan seluruh periode, deret year-on-year, dan ringkasan bulan terpilih (`periode`).
     */
    public function wismanBulanan(PeriodeRequest $r): DashboardResource
    {
        return new DashboardResource($this->layanan->baca('wisman/bulanan', $r->untukDataApi()));
    }

    /**
     * Wisman per kebangsaan
     *
     * Negara terbesar (`top`) + Lainnya untuk satu tahun (`tahun`) atau satu bulan (`periode`).
     */
    public function wismanKebangsaan(TahunPeriodeRequest $r): DashboardResource
    {
        return new DashboardResource($this->layanan->baca('wisman/kebangsaan', $r->untukDataApi()));
    }

    /**
     * Wisman per pintu masuk
     *
     * Komposisi pintu masuk: bulanan BPS bila ada untuk `periode`, selain itu semesteran SDI.
     */
    public function wismanPintuMasuk(TahunPeriodeRequest $r): DashboardResource
    {
        return new DashboardResource($this->layanan->baca('wisman/pintu-masuk', $r->untukDataApi()));
    }

    /**
     * Rata-rata lama menginap
     *
     * Rata-rata lama menginap per bulan (rata-rata sederhana kelas bintang), wisman dan wisnus.
     */
    public function lamaMenginapRataRata(): DashboardResource
    {
        return new DashboardResource($this->layanan->baca('lama-menginap/rata-rata', []));
    }

    /**
     * Lama menginap per kelas hotel
     *
     * Tabel lama menginap per kelas hotel untuk satu bulan (`periode`) dan jenis tamu (`tamu`).
     */
    public function lamaMenginapPerKelas(TamuRequest $r): DashboardResource
    {
        return new DashboardResource($this->layanan->baca('lama-menginap/per-kelas', $r->untukDataApi()));
    }

    /**
     * Deret lama menginap per kelas
     *
     * Deret bulanan lama menginap per kelas hotel untuk satu jenis tamu.
     */
    public function lamaMenginapSeri(TamuRequest $r): DashboardResource
    {
        return new DashboardResource($this->layanan->baca('lama-menginap/seri', $r->untukDataApi()));
    }

    /**
     * Pilihan dashboard wisnus
     *
     * Daftar kota, tahun, dan tahun bawaan untuk filter dashboard wisatawan nusantara.
     */
    public function wisnusMeta(): DashboardResource
    {
        return new DashboardResource($this->layanan->baca('wisnus/meta', []));
    }

    /**
     * Wisnus per tahun
     *
     * Perjalanan wisnus per tahun dan KPI, untuk semua kota atau satu `kota`.
     */
    public function wisnusTahunan(KotaRequest $r): DashboardResource
    {
        return new DashboardResource($this->layanan->baca('wisnus/tahunan', $r->untukDataApi()));
    }

    /**
     * Wisnus per kota tujuan
     *
     * Perjalanan wisnus per kota tujuan untuk satu `tahun`.
     */
    public function wisnusPerKota(TahunRequest $r): DashboardResource
    {
        return new DashboardResource($this->layanan->baca('wisnus/per-kota', $r->untukDataApi()));
    }

    /**
     * Wisnus per bulan
     *
     * Deret bulanan perjalanan wisnus per kota, atau satu `kota`.
     */
    public function wisnusBulanan(KotaRequest $r): DashboardResource
    {
        return new DashboardResource($this->layanan->baca('wisnus/bulanan', $r->untukDataApi()));
    }

    /**
     * Wisnus year-on-year
     *
     * Perjalanan wisnus bulan yang sama lintas tahun, untuk semua kota atau satu `kota`.
     */
    public function wisnusYoy(KotaRequest $r): DashboardResource
    {
        return new DashboardResource($this->layanan->baca('wisnus/yoy', $r->untukDataApi()));
    }

    /**
     * Pilihan kunjungan destinasi
     *
     * Tahun dan daftar destinasi wisata untuk jenis pengunjung `jenis`.
     */
    public function destinasiMeta(JenisRequest $r): DashboardResource
    {
        return new DashboardResource($this->layanan->baca('destinasi/meta', $r->untukDataApi()));
    }

    /**
     * Ringkasan kunjungan destinasi
     *
     * KPI dan catatan data kunjungan ke destinasi wisata per `tahun` dan `destinasi`.
     */
    public function destinasiRingkasan(DestinasiRequest $r): DashboardResource
    {
        return new DashboardResource($this->layanan->baca('destinasi/ringkasan', $r->untukDataApi()));
    }

    /**
     * Kunjungan per destinasi
     *
     * Peringkat kunjungan per destinasi wisata untuk satu `tahun`.
     */
    public function destinasiPerDestinasi(DestinasiRequest $r): DashboardResource
    {
        return new DashboardResource($this->layanan->baca('destinasi/per-destinasi', $r->untukDataApi()));
    }

    /**
     * Kunjungan destinasi per bulan
     *
     * Deret bulanan kunjungan ke semua destinasi atau satu `destinasi`.
     */
    public function destinasiBulanan(DestinasiRequest $r): DashboardResource
    {
        return new DashboardResource($this->layanan->baca('destinasi/bulanan', $r->untukDataApi()));
    }

    /**
     * Tenaga kerja ekraf DKI
     *
     * Tenaga kerja ekonomi kreatif DKI Jakarta per tahun, porsi nasional, dan jenis kelamin.
     */
    public function tenagaKerjaDki(): DashboardResource
    {
        return new DashboardResource($this->layanan->baca('tenaga-kerja/dki', []));
    }

    /**
     * Tenaga kerja per subsektor
     *
     * Tenaga kerja ekonomi kreatif nasional per subsektor untuk satu `tahun`.
     */
    public function tenagaKerjaSubsektor(TahunRequest $r): DashboardResource
    {
        return new DashboardResource($this->layanan->baca('tenaga-kerja/subsektor', $r->untukDataApi()));
    }

    /**
     * Sertifikasi kompetensi
     *
     * Jumlah tenaga kerja tersertifikasi per tahun dan per bidang.
     */
    public function tenagaKerjaSertifikasi(): DashboardResource
    {
        return new DashboardResource($this->layanan->baca('tenaga-kerja/sertifikasi', []));
    }

    /**
     * PDRB ekraf makro
     *
     * PDRB ekonomi kreatif DKI: nilai, kontribusi vs target RPJMD, dan pertumbuhan per periode.
     */
    public function pdrbMakro(): DashboardResource
    {
        return new DashboardResource($this->layanan->baca('pdrb-ekraf/makro', []));
    }

    /**
     * Sebaran PDRB per subsektor
     *
     * Distribusi PDRB ekonomi kreatif per subsektor untuk satu `periode`.
     */
    public function pdrbSebaran(PdrbPeriodeRequest $r): DashboardResource
    {
        return new DashboardResource($this->layanan->baca('pdrb-ekraf/subsektor/sebaran', $r->untukDataApi()));
    }

    /**
     * Pertumbuhan PDRB per subsektor
     *
     * Pertumbuhan PDRB ekonomi kreatif per subsektor untuk satu `periode`.
     */
    public function pdrbPertumbuhan(PdrbPeriodeRequest $r): DashboardResource
    {
        return new DashboardResource($this->layanan->baca('pdrb-ekraf/subsektor/pertumbuhan', $r->untukDataApi()));
    }
}
