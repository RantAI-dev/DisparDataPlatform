<?php

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class)->in('Feature');
uses(TestCase::class)->in('Arch');

/*
| Pembantu tes bersama.
*/

use App\Models\User;
use App\Shared\DataApi\DataApiClient;
use App\Shared\Http\ApiResponse;
use App\Shared\Tetap\BacaTetap;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

/** Rute uji di /api/v1/uji/*: meneruskan ke Data API palsu lewat jalur Shared yang sesungguhnya. */
function daftarkanRuteUji(): void
{
    Route::portal(function () {
        Route::apiGet('uji/dataapi', fn (DataApiClient $c) => ApiResponse::dariDataApi(
            $c->get('/v1/uji', request()->query())
        ), modul: 'uji', kelas: 'P')->name('uji.dataapi');

        Route::apiGet('uji/tetap', function (DataApiClient $c, BacaTetap $tetap) {
            $hasil = $tetap->baca('uji:tetap', fn () => $c->get('/v1/uji'));

            return ApiResponse::dariDataApi($hasil['respons'], $hasil['sumber'], $hasil['stale']);
        }, modul: 'uji', kelas: 'T')->name('uji.tetap');

        Route::apiGet('uji/validasi', function (Request $r) {
            $r->validate(['page' => 'integer|min:1']);

            return ApiResponse::sukses('{}');
        }, modul: 'uji', kelas: 'P')->name('uji.validasi');

        Route::apiGet('uji/teruskan/{path}', fn (DataApiClient $c, string $path) => ApiResponse::dariDataApi(
            $c->get('/'.$path, request()->query())
        ), modul: 'uji', kelas: 'P')->where('path', '.*')->name('uji.teruskan');

        Route::apiGet('uji/admin', fn () => ApiResponse::sukses('{}'), modul: 'uji', kelas: 'P', ability: 'admin')
            ->name('uji.admin');
    });
    Route::getRoutes()->refreshNameLookups();
    Route::getRoutes()->refreshActionLookups();
}

/** Header Authorization untuk akun layanan dengan satu ability. */
function tokenAkun(string $akun = 'frontend', string $ability = 'read'): array
{
    $user = User::firstOrCreate(['name' => $akun]);

    return ['Authorization' => 'Bearer '.$user->createToken('uji', [$ability])->plainTextToken];
}
