<?php

namespace App\Features\Sistem\Http\Resources;

use App\Features\Sistem\Data\StatusKesehatan;
use App\Shared\DataApi\JsonMentah;
use App\Shared\Http\ApiResponse;
use Illuminate\Contracts\Support\Responsable;
use Illuminate\Http\JsonResponse;

/**
 * Bentuk keluar kesehatan. Status HTTP selalu 200; `status` = ok | terganggu, supaya rincian
 * komponen tetap terbaca oleh pemantau.
 */
final class KesehatanResource implements Responsable
{
    public function __construct(private readonly StatusKesehatan $status) {}

    public function toResponse($request): JsonResponse
    {
        return ApiResponse::sukses(JsonMentah::encode([
            'status' => $this->status->sehat() ? 'ok' : 'terganggu',
            'versi' => $this->status->versi,
            'komponen' => [
                'oracle' => $this->status->oracle ? 'ok' : 'gagal',
                'data_api' => $this->status->dataApi ? 'ok' : 'gagal',
            ],
        ]), sumber: null);
    }
}
