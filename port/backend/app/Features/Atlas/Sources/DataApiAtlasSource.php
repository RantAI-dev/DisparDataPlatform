<?php

namespace App\Features\Atlas\Sources;

use App\Features\Atlas\Contracts\AtlasSource;
use App\Shared\DataApi\DataApiClient;
use App\Shared\DataApi\DataApiResponse;

final class DataApiAtlasSource implements AtlasSource
{
    public function __construct(private readonly DataApiClient $dataApi) {}

    public function ambil(string $jalur, array $query): DataApiResponse
    {
        // Merge + dedup restoran (≤ 2.577 baris) bisa lebih dari timeout bawaan saat cache Data API dingin.
        return $this->dataApi->get('/v1/atlas/'.$jalur, $query, timeout: (int) config('dataapi.timeout_lambat'), ulang: 0);
    }
}
