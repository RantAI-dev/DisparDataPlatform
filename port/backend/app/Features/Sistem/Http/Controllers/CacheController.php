<?php

namespace App\Features\Sistem\Http\Controllers;

use App\Features\Sistem\Http\Resources\AksiResource;
use App\Features\Sistem\Services\CacheService;

final class CacheController
{
    public function __invoke(CacheService $layanan): AksiResource
    {
        return AksiResource::cache($layanan->kosongkan());
    }
}
