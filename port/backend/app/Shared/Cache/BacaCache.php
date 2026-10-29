<?php

namespace App\Shared\Cache;

use App\Shared\DataApi\DataApiResponse;
use Illuminate\Support\Facades\Cache;

/**
 * Baca endpoint kelas P (berparameter) lewat cache Laravel (SPEC §4.6): store `database` di Oracle,
 * TTL `portal.cache_menit`. Yang disimpan body Data API mentah; error tidak pernah di-cache, dan
 * Data API gagal → DataApiException diteruskan (503).
 */
class BacaCache
{
    /**
     * @param  callable(): DataApiResponse  $ambil
     * @return array{respons: DataApiResponse, sumber: 'cache'|'data_api', stale: false}
     */
    public function baca(string $kunci, callable $ambil): array
    {
        // Kunci di-hash: kolom KEY tabel cache 255 byte, sedangkan q/f bebas panjangnya.
        $kunciCache = 'dataapi:'.hash('sha256', $kunci);
        $ada = Cache::get($kunciCache);
        if (is_string($ada)) {
            return ['respons' => DataApiResponse::dariBody($ada), 'sumber' => 'cache', 'stale' => false];
        }

        $respons = $ambil();
        Cache::put($kunciCache, $respons->body(), now()->addMinutes((int) config('portal.cache_menit')));

        return ['respons' => $respons, 'sumber' => 'data_api', 'stale' => false];
    }
}
