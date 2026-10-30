<?php

namespace App\Features\Gmti\Services;

use App\Features\Gmti\Contracts\GmtiSource;
use App\Shared\Cache\BacaCache;
use App\Shared\DataApi\DataApiResponse;
use App\Shared\Support\KunciQuery;
use App\Shared\Tetap\BacaTetap;

/** Fitur gmti/spasial/hotel-scraped (KONTRAK §2.5): T lewat snapshot, P lewat cache. */
final class GmtiService
{
    public function __construct(
        private readonly GmtiSource $sumber,
        private readonly BacaTetap $tetap,
        private readonly BacaCache $cache,
    ) {}

    /**
     * @param  'T'|'P'  $kelas
     * @param  array<string, scalar|null>  $query
     * @return array{respons: DataApiResponse, sumber: 'data_api'|'cache'|'snapshot', stale: bool}
     */
    public function baca(string $kelas, string $jalur, array $query = []): array
    {
        $kunci = KunciQuery::buat(str_replace('/', '.', $jalur), $query);
        $ambil = fn () => $this->sumber->ambil($jalur, $query);

        return $kelas === 'T' ? $this->tetap->baca($kunci, $ambil) : $this->cache->baca($kunci, $ambil);
    }
}
