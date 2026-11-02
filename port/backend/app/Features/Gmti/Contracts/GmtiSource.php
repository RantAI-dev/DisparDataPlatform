<?php

namespace App\Features\Gmti\Contracts;

use App\Shared\DataApi\DataApiResponse;

/** Sumber data gmti, spasial, dan hotel-scraped (KONTRAK §2.5). */
interface GmtiSource
{
    /** @param array<string, scalar|null> $query */
    public function ambil(string $jalur, array $query): DataApiResponse;
}
