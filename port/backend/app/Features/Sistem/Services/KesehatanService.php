<?php

namespace App\Features\Sistem\Services;

use App\Features\Sistem\Contracts\SistemSource;
use App\Features\Sistem\Data\StatusKesehatan;
use Illuminate\Support\Facades\DB;
use Throwable;

/** Memeriksa rantai portal: Oracle (milik app) dan Data API (sumber data). */
final class KesehatanService
{
    public function __construct(private readonly SistemSource $sumber) {}

    public function periksa(): StatusKesehatan
    {
        return new StatusKesehatan($this->oracleSehat(), $this->sumber->dataApiSehat(), (string) config('portal.versi'));
    }

    private function oracleSehat(): bool
    {
        try {
            return DB::selectOne('select 1 as ok from dual')?->ok == 1;
        } catch (Throwable) {
            return false;
        }
    }
}
