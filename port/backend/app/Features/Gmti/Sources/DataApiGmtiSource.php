<?php

namespace App\Features\Gmti\Sources;

use App\Features\Gmti\Contracts\GmtiSource;
use App\Shared\DataApi\DataApiClient;
use App\Shared\DataApi\DataApiResponse;

final class DataApiGmtiSource implements GmtiSource
{
    public function __construct(private readonly DataApiClient $dataApi) {}

    public function ambil(string $jalur, array $query): DataApiResponse
    {
        // /v1/spasial menggabungkan ±5.000 titik + point-in-polygon kecamatan; lambat saat cache dingin.
        return $this->dataApi->get('/v1/'.$jalur, $query, timeout: (int) config('dataapi.timeout_lambat'), ulang: 0);
    }
}
