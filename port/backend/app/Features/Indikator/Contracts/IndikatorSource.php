<?php

namespace App\Features\Indikator\Contracts;

use App\Shared\DataApi\DataApiResponse;

/** Sumber data indikator (KONTRAK §2.3). Generik seperti dashboard: semua endpoint passthrough. */
interface IndikatorSource
{
    /** @param array<string, scalar|null> $query */
    public function ambil(string $jalur, array $query): DataApiResponse;
}
