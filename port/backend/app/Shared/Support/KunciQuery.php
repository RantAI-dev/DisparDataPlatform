<?php

namespace App\Shared\Support;

use GuzzleHttp\Psr7\Query;

/**
 * Kunci snapshot/cache untuk satu endpoint + query. Parameter kosong dibuang dan kunci diurutkan,
 * jadi urutan parameter dari klien tidak membuat entri ganda. Kunci > 200 karakter (batas kolom
 * SNAPSHOT.KUNCI) diringkas dengan SHA-256. Job `portal:sinkron` (plan 16) memakai fungsi yang sama.
 */
final class KunciQuery
{
    /** @param array<string, scalar|array<scalar>|null> $query */
    public static function buat(string $endpoint, array $query = []): string
    {
        $query = array_filter($query, fn ($v) => $v !== null && $v !== '' && $v !== []);
        ksort($query);
        $kunci = $query ? $endpoint.'?'.Query::build($query) : $endpoint;

        return strlen($kunci) <= 200 ? $kunci : $endpoint.'#'.hash('sha256', $kunci);
    }
}
