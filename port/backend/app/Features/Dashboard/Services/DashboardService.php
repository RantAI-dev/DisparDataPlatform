<?php

namespace App\Features\Dashboard\Services;

use App\Features\Dashboard\Contracts\DashboardSource;
use App\Shared\Cache\BacaCache;
use App\Shared\DataApi\DataApiResponse;
use App\Shared\Support\KunciQuery;
use App\Shared\Tetap\BacaTetap;
use InvalidArgumentException;

/**
 * Fitur dashboard (KONTRAK §2.2). Semua endpoint diteruskan apa adanya; kelas baca per endpoint:
 * T lewat snapshot, P lewat cache.
 */
final class DashboardService
{
    public const KELAS = [
        'ringkasan' => 'T',
        'wisman/tahunan' => 'T',
        'wisman/bulanan' => 'T',
        'wisman/kebangsaan' => 'P',
        'wisman/pintu-masuk' => 'P',
        'lama-menginap/rata-rata' => 'T',
        'lama-menginap/per-kelas' => 'P',
        'lama-menginap/seri' => 'T',
        'wisnus/meta' => 'T',
        'wisnus/tahunan' => 'P',
        'wisnus/per-kota' => 'P',
        'wisnus/bulanan' => 'P',
        'wisnus/yoy' => 'P',
        'destinasi/meta' => 'T',
        'destinasi/ringkasan' => 'P',
        'destinasi/per-destinasi' => 'P',
        'destinasi/bulanan' => 'P',
        'tenaga-kerja/dki' => 'T',
        'tenaga-kerja/subsektor' => 'P',
        'tenaga-kerja/sertifikasi' => 'T',
        'pdrb-ekraf/makro' => 'T',
        'pdrb-ekraf/subsektor/sebaran' => 'P',
        'pdrb-ekraf/subsektor/pertumbuhan' => 'P',
    ];

    public function __construct(
        private readonly DashboardSource $sumber,
        private readonly BacaTetap $tetap,
        private readonly BacaCache $cache,
    ) {}

    /**
     * @param  array<string, scalar|null>  $query
     * @return array{respons: DataApiResponse, sumber: 'data_api'|'cache'|'snapshot', stale: bool}
     */
    public function baca(string $endpoint, array $query = []): array
    {
        $kelas = self::KELAS[$endpoint] ?? throw new InvalidArgumentException("Endpoint dashboard tak dikenal: $endpoint");
        $kunci = KunciQuery::buat('dashboard.'.str_replace('/', '.', $endpoint), $query);
        $ambil = fn () => $this->sumber->ambil($endpoint, $query);

        return $kelas === 'T' ? $this->tetap->baca($kunci, $ambil) : $this->cache->baca($kunci, $ambil);
    }
}
