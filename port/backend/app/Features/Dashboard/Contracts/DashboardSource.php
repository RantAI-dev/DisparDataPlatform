<?php

namespace App\Features\Dashboard\Contracts;

use App\Shared\DataApi\DataApiResponse;

/**
 * Sumber data dashboard. Satu metode generik (bukan satu per endpoint seperti pola fitur): 23
 * endpoint passthrough tanpa logika per endpoint (ADR 0001, plan 12).
 */
interface DashboardSource
{
    /** @param array<string, scalar|null> $query */
    public function ambil(string $endpoint, array $query): DataApiResponse;
}
