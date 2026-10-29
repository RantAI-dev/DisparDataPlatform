<?php

namespace App\Features\Dataset\Http\Controllers;

use App\Features\Dataset\Http\Requests\AgregatRequest;
use App\Features\Dataset\Http\Requests\BarisRequest;
use App\Features\Dataset\Http\Requests\EksporRequest;
use App\Features\Dataset\Http\Requests\HalamanRequest;
use App\Features\Dataset\Http\Requests\KatalogRequest;
use App\Features\Dataset\Http\Resources\DatasetResource;
use App\Features\Dataset\Http\Resources\EksporResource;
use App\Features\Dataset\Services\DatasetService;

final class DatasetController
{
    public function __construct(private readonly DatasetService $layanan) {}

    /**
     * Katalog dataset
     *
     * Dataset primer Satu Data Jakarta dan dataset sekunder Dinas, lengkap dengan lapisan lakehouse
     * (medallion), statistik katalog, dan jumlah per lapisan. Dibaca dari snapshot harian.
     */
    public function katalog(KatalogRequest $r): DatasetResource
    {
        return new DatasetResource($this->layanan->katalog($r->untukDataApi()));
    }

    /**
     * Detail dataset
     *
     * Metadata satu dataset: judul, deskripsi, sumber, frekuensi, satuan, periode data, lapisan
     * lakehouse, dan jumlah baris Bronze (`total_bronze`). `meta.total` = jumlah baris Silver.
     *
     * @param  string  $slug  Slug dataset, mis. `data-jumlah-wisatawan-mancanegara-berdasarkan-kebangsaan`.
     */
    public function detail(string $slug): DatasetResource
    {
        return new DatasetResource($this->layanan->dataset($slug));
    }

    /**
     * Kolom dataset
     *
     * Daftar kolom yang ditampilkan beserta keterangan dan tipe aslinya.
     *
     * @param  string  $slug  Slug dataset, mis. `data-jumlah-wisatawan-mancanegara-berdasarkan-kebangsaan`.
     */
    public function kolom(string $slug): DatasetResource
    {
        return new DatasetResource($this->layanan->kolom($slug));
    }

    /**
     * Pilihan filter
     *
     * Pilihan filter per kolom Silver: kategori (≤ 50 nilai beserta jumlahnya), rentang angka, atau
     * rentang tanggal. Dihitung atas seluruh dataset.
     *
     * @param  string  $slug  Slug dataset, mis. `data-jumlah-wisatawan-mancanegara-berdasarkan-kebangsaan`.
     */
    public function facet(string $slug): DatasetResource
    {
        return new DatasetResource($this->layanan->facet($slug));
    }

    /**
     * Baris data
     *
     * Baris dataset dari lapisan Silver, berhalaman. `q` mencari teks di semua kolom; `f[]` memfilter
     * (`kolom:in:nilai`, diulang untuk nilai lain, atau `kolom:range:min..max`); `sort` = `kolom:asc|desc`.
     * `meta.total` = jumlah baris yang cocok.
     *
     * @param  string  $slug  Slug dataset, mis. `data-jumlah-wisatawan-mancanegara-berdasarkan-kebangsaan`.
     */
    public function baris(BarisRequest $r, string $slug): DatasetResource
    {
        return new DatasetResource($this->layanan->baris($slug, $r->untukDataApi()));
    }

    /**
     * Agregat untuk grafik
     *
     * Ringkasan nilai `y` per kategori `x` (sum, avg, count, max, min) atas seluruh baris yang cocok
     * dengan pencarian dan filter; diurutkan menurun, maksimal 1.000 kelompok.
     *
     * @param  string  $slug  Slug dataset, mis. `data-jumlah-wisatawan-mancanegara-berdasarkan-kebangsaan`.
     */
    public function agregat(AgregatRequest $r, string $slug): DatasetResource
    {
        return new DatasetResource($this->layanan->agregat($slug, $r->untukDataApi()));
    }

    /**
     * Halaman pertama dataset
     *
     * Gabungan detail, kolom, dan baris halaman pertama dalam satu permintaan:
     * `data = {dataset, kolom, baris}`.
     *
     * @param  string  $slug  Slug dataset, mis. `data-jumlah-wisatawan-mancanegara-berdasarkan-kebangsaan`.
     */
    public function halaman(HalamanRequest $r, string $slug): DatasetResource
    {
        return new DatasetResource($this->layanan->halaman($slug, $r->untukDataApi()));
    }

    /**
     * Ekspor CSV / XLSX
     *
     * Mengunduh semua baris yang cocok dengan pencarian, filter, dan urutan. CSV memakai BOM dan CRLF;
     * XLSX berisi sheet `Data`. Nama berkas `{slug}.csv`, atau `{slug}-terfilter.csv` bila ada filter.
     * Jumlah baris ada di header `X-Row-Count`; lebih dari 100.000 baris → 413.
     *
     * @param  string  $slug  Slug dataset, mis. `data-jumlah-wisatawan-mancanegara-berdasarkan-kebangsaan`.
     */
    public function ekspor(EksporRequest $r, string $slug): EksporResource
    {
        return new EksporResource($this->layanan->ekspor($slug, $r->untukDataApi()));
    }
}
