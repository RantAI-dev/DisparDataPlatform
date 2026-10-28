<?php

namespace App\Features\Sistem\Sources;

use App\Features\Sistem\Contracts\SistemSource;
use App\Shared\DataApi\DataApiClient;
use App\Shared\DataApi\DataApiException;

final class DataApiSistemSource implements SistemSource
{
    public function __construct(private readonly DataApiClient $dataApi) {}

    public function dataApiSehat(): bool
    {
        try {
            $this->dataApi->get('/v1/health', timeout: (int) config('dataapi.timeout_kesehatan'), ulang: 0);

            return true;
        } catch (DataApiException) {
            return false;
        }
    }
}
