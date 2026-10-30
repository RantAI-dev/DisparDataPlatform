<?php

namespace App\Features\Sistem\Contracts;

interface SistemSource
{
    /** Apakah Data API menjawab /v1/health. */
    public function dataApiSehat(): bool;
}
