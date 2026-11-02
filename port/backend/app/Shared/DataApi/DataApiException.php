<?php

namespace App\Shared\DataApi;

use RuntimeException;

/** Error dari Data API (atau kegagalan menghubunginya), dengan kode dan status HTTP yang diteruskan. */
final class DataApiException extends RuntimeException
{
    private const PESAN = [
        'NOT_FOUND' => 'Data tidak ditemukan.',
        'INVALID_PARAM' => 'Parameter tidak valid.',
        'INVALID_FILTER' => 'Filter tidak valid.',
        'TOO_LARGE' => 'Data terlalu besar untuk diekspor.',
        'UPSTREAM_UNAVAILABLE' => 'Sumber data sedang tidak tersedia.',
    ];

    public function __construct(
        public readonly string $kode,
        public readonly int $status,
        ?string $pesan = null,
        public readonly mixed $detail = null,
    ) {
        parent::__construct($pesan ?? self::PESAN[$kode] ?? 'Terjadi kesalahan pada sumber data.');
    }

    public static function tidakTersedia(): self
    {
        return new self('UPSTREAM_UNAVAILABLE', 503);
    }
}
