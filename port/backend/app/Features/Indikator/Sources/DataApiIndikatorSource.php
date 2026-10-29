<?php

namespace App\Features\Indikator\Sources;

use App\Features\Indikator\Contracts\IndikatorSource;
use App\Shared\DataApi\DataApiClient;
use App\Shared\DataApi\DataApiResponse;

final class DataApiIndikatorSource implements IndikatorSource
{
    public function __construct(private readonly DataApiClient $dataApi) {}

    public function ambil(string $jalur, array $query): DataApiResponse
    {
        // Pemilihan dataset indikator (K-12) di Data API bisa belasan detik saat cache-nya dingin;
        // timeout bawaan 10 s × ulang akan menyerah lebih dulu. Hasilnya disimpan di snapshot.
        return $this->dataApi->get('/v1/'.$jalur, $query, timeout: (int) config('dataapi.timeout_lambat'), ulang: 0);
    }
}
