<?php

namespace App\Features\Dashboard\Sources;

use App\Features\Dashboard\Contracts\DashboardSource;
use App\Shared\DataApi\DataApiClient;
use App\Shared\DataApi\DataApiResponse;

final class DataApiDashboardSource implements DashboardSource
{
    public function __construct(private readonly DataApiClient $dataApi) {}

    public function ambil(string $endpoint, array $query): DataApiResponse
    {
        return $this->dataApi->get('/v1/dashboard/'.$endpoint, $query);
    }
}
