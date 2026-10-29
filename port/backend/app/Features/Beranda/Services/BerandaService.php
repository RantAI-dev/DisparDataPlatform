<?php

namespace App\Features\Beranda\Services;

use App\Features\Beranda\Contracts\BerandaSource;
use App\Shared\DataApi\DataApiResponse;
use App\Shared\Tetap\BacaTetap;

/** Beranda: satu endpoint kelas T (snapshot). */
final class BerandaService
{
    public function __construct(
        private readonly BerandaSource $sumber,
        private readonly BacaTetap $tetap,
    ) {}

    /** @return array{respons: DataApiResponse, sumber: 'snapshot'|'data_api', stale: bool} */
    public function ringkasan(): array
    {
        return $this->tetap->baca('beranda.ringkasan', fn () => $this->sumber->ringkasan());
    }
}
