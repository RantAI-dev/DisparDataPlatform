<?php

namespace App\Features\Beranda\Sources;

use App\Features\Beranda\Contracts\BerandaSource;
use App\Shared\DataApi\DataApiClient;
use App\Shared\DataApi\DataApiResponse;

final class DataApiBerandaSource implements BerandaSource
{
    public function __construct(private readonly DataApiClient $dataApi) {}

    public function ringkasan(): DataApiResponse
    {
        return $this->dataApi->get('/v1/beranda/ringkasan');
    }
}
