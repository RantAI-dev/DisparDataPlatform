<?php

namespace App\Shared\LogHistory;

use Illuminate\Support\Str;

/**
 * Keadaan satu request yang dibutuhkan log history dan klien Data API.
 * Didaftarkan scoped: satu instance per request (dan per job).
 */
final class LogContext
{
    private ?string $requestId = null;

    /** data_api | cache | snapshot */
    public ?string $sumber = null;

    public ?int $jumlahBaris = null;

    public function requestId(): string
    {
        return $this->requestId ??= (string) Str::uuid();
    }

    public function setRequestId(string $id): void
    {
        $this->requestId = $id;
    }
}
