<?php

namespace App\Features\Beranda\Http\Resources;

use App\Shared\DataApi\DataApiResponse;
use App\Shared\Http\ApiResponse;
use Illuminate\Contracts\Support\Responsable;
use Illuminate\Http\JsonResponse;

final class BerandaResource implements Responsable
{
    /** @param array{respons: DataApiResponse, sumber: 'snapshot'|'data_api', stale: bool} $hasil */
    public function __construct(private readonly array $hasil) {}

    public function toResponse($request): JsonResponse
    {
        return ApiResponse::dariDataApi($this->hasil['respons'], $this->hasil['sumber'], $this->hasil['stale']);
    }
}
