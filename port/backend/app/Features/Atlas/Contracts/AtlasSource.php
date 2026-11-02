<?php

namespace App\Features\Atlas\Contracts;

use App\Shared\DataApi\DataApiResponse;

/** Sumber data atlas (KONTRAK §2.4); enam endpoint passthrough. */
interface AtlasSource
{
    /** @param array<string, scalar|null> $query */
    public function ambil(string $jalur, array $query): DataApiResponse;
}
