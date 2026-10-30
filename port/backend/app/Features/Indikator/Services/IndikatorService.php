<?php

namespace App\Features\Indikator\Services;

use App\Features\Indikator\Contracts\IndikatorSource;
use App\Shared\Cache\BacaCache;
use App\Shared\DataApi\DataApiResponse;
use App\Shared\Support\KunciQuery;
use App\Shared\Tetap\BacaTetap;

/** Fitur indikator (KONTRAK §2.3): semua kelas T (snapshot), kecuali seni-pertunjukan per tahun (P). */
final class IndikatorService
{
    public function __construct(
        private readonly IndikatorSource $sumber,
        private readonly BacaTetap $tetap,
        private readonly BacaCache $cache,
    ) {}

    /**
     * @param  array<string, scalar|null>  $query
     * @return array{respons: DataApiResponse, sumber: 'data_api'|'cache'|'snapshot', stale: bool}
     */
    public function tetap(string $jalur, array $query = []): array
    {
        return $this->tetap->baca(KunciQuery::buat('indikator.'.$jalur, $query), fn () => $this->sumber->ambil($jalur, $query));
    }

    /**
     * @param  array<string, scalar|null>  $query
     * @return array{respons: DataApiResponse, sumber: 'data_api'|'cache'|'snapshot', stale: bool}
     */
    public function berparameter(string $jalur, array $query = []): array
    {
        return $this->cache->baca(KunciQuery::buat('indikator.'.$jalur, $query), fn () => $this->sumber->ambil($jalur, $query));
    }
}
