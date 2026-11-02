<?php

namespace App\Features\Sistem\Services;

use App\Shared\Cache\BacaCache;

/** Kosongkan cache endpoint kelas P (KONTRAK §2.7). Snapshot kelas T tidak dihapus. */
final class CacheService
{
    public function __construct(private readonly BacaCache $cache) {}

    public function kosongkan(): int
    {
        return $this->cache->kosongkan();
    }
}
