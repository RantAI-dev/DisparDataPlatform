<?php

namespace App\Features\Atlas\Services;

use App\Features\Atlas\Contracts\AtlasSource;
use App\Shared\DataApi\DataApiResponse;
use App\Shared\Support\KunciQuery;
use App\Shared\Tetap\BacaTetap;

/** Fitur atlas (KONTRAK §2.4): semua kelas T (snapshot); pertunjukan per tahun = varian. */
final class AtlasService
{
    public function __construct(
        private readonly AtlasSource $sumber,
        private readonly BacaTetap $tetap,
    ) {}

    /**
     * @param  array<string, scalar|null>  $query
     * @return array{respons: DataApiResponse, sumber: 'snapshot'|'data_api', stale: bool}
     */
    public function baca(string $jalur, array $query = []): array
    {
        return $this->tetap->baca(KunciQuery::buat('atlas.'.$jalur, $query), fn () => $this->sumber->ambil($jalur, $query));
    }
}
