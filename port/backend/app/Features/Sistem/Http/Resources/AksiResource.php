<?php

namespace App\Features\Sistem\Http\Resources;

use App\Shared\DataApi\JsonMentah;
use App\Shared\Http\ApiResponse;
use Illuminate\Contracts\Support\Responsable;
use Illuminate\Http\JsonResponse;

/** Hasil aksi admin (POST): pemicu sinkron dan kosongkan cache. */
final class AksiResource implements Responsable
{
    /** @param array<string, mixed> $data */
    private function __construct(private readonly ?array $data, private readonly int $status) {}

    /** 202: sinkron dimulai sebagai proses terpisah; 409: sinkron lain masih berjalan. */
    public static function sinkron(bool $dimulai): self
    {
        return new self($dimulai ? ['job' => 'portal:sinkron', 'pemicu' => 'manual'] : null, $dimulai ? 202 : 409);
    }

    public static function cache(int $dihapus): self
    {
        return new self(['dihapus' => $dihapus], 200);
    }

    public function toResponse($request): JsonResponse
    {
        if ($this->data === null) {
            return ApiResponse::gagal('JOB_BERJALAN', 'Sinkron lain masih berjalan. Coba lagi setelah selesai.', $this->status);
        }

        return ApiResponse::sukses(JsonMentah::encode($this->data), sumber: null, status: $this->status);
    }
}
