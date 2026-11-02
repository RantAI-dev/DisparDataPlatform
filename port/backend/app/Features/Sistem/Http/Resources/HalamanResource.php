<?php

namespace App\Features\Sistem\Http\Resources;

use App\Features\Sistem\Data\Halaman;
use App\Shared\DataApi\JsonMentah;
use App\Shared\Http\ApiResponse;
use Illuminate\Contracts\Support\Responsable;
use Illuminate\Http\JsonResponse;

/** Daftar admin berhalaman: `data` = baris, `meta` = page, size, total, has_more (KONTRAK §3). */
final class HalamanResource implements Responsable
{
    public function __construct(private readonly Halaman $halaman) {}

    public function toResponse($request): JsonResponse
    {
        $meta = (object) [
            'page' => $this->halaman->page,
            'size' => Halaman::UKURAN,
            'total' => $this->halaman->total,
            'has_more' => $this->halaman->adaLagi(),
        ];

        return ApiResponse::sukses(JsonMentah::encode($this->halaman->item), $meta, sumber: null);
    }
}
