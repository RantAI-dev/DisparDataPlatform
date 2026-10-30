<?php

namespace App\Shared\Support;

use Closure;
use Illuminate\Routing\Route as RuteLaravel;
use Illuminate\Support\Facades\Route;

/**
 * Pembantu rute portal (SPEC §4.2). Hanya GET dan POST; tidak ada makro PATCH.
 *
 * Route::portal(fn () => …)                  grup /api/v1 + middleware `api`
 * Route::apiGet($uri, $aksi, modul, kelas)    rute ber-atribut `modul`, `kelas` (T/P/S), `varian`
 */
final class Routing
{
    public static function daftarkan(): void
    {
        Route::macro('portal', function (Closure $rute): void {
            Route::middleware('api')->prefix('api/v1')->group($rute);
        });

        foreach (['apiGet' => 'get', 'apiPost' => 'post'] as $makro => $metode) {
            Route::macro($makro, function (
                string $uri,
                array|string|Closure $aksi,
                string $modul,
                string $kelas,
                array $varian = [],
                ?string $ability = 'read',
            ) use ($metode): RuteLaravel {
                $rute = Route::{$metode}($uri, $aksi);
                $rute->setAction(array_merge($rute->getAction(), [
                    'modul' => $modul,
                    'kelas' => $kelas,
                    'varian' => $varian,
                ]));
                if ($ability !== null) {
                    $rute->middleware(['auth:sanctum', 'abilities:'.$ability]);
                }

                return $rute;
            });
        }
    }
}
