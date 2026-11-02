<?php

use Illuminate\Foundation\Testing\RefreshDatabase;
use Tests\TestCase;

uses(TestCase::class, RefreshDatabase::class)->in('Feature');
uses(TestCase::class)->in('Arch');
uses(TestCase::class)->in('Integrasi');

/*
| Pembantu tes bersama.
*/

use App\Models\User;
use App\Shared\DataApi\DataApiClient;
use App\Shared\Http\ApiResponse;
use App\Shared\Tetap\BacaTetap;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;
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

/**
 * Kunci rekaman fixture untuk sebuah URL Data API, sama dengan tools/fixture-server/kunci.mjs:
 * parameter kosong dibuang, diurutkan stabil menurut nama, di-encode seperti encodeURIComponent.
 */
function kunciFixture(string $url): string
{
    $bagian = parse_url($url);
    $path = rtrim($bagian['path'] ?? '/', '/') ?: '/';
    $pasangan = [];
    foreach (array_filter(explode('&', $bagian['query'] ?? '')) as $p) {
        [$k, $v] = array_pad(explode('=', $p, 2), 2, '');
        $v = urldecode($v);
        if ($v !== '') {
            $pasangan[] = [urldecode($k), $v];
        }
    }
    usort($pasangan, fn ($a, $b) => strcmp($a[0], $b[0])); // usort PHP 8 stabil
    $enc = fn (string $s) => strtr(rawurlencode($s), ['%21' => '!', '%27' => "'", '%28' => '(', '%29' => ')', '%2A' => '*']);
    $query = implode('&', array_map(fn ($p) => $enc($p[0]).'='.$enc($p[1]), $pasangan));

    return $query ? "$path?$query" : $path;
}

/**
 * Palsukan Data API dengan rekaman fixtures/data-api (seperti pemutar fixture-server). URL yang
 * belum direkam dijawab 599. Mengembalikan daftar kunci yang dipanggil, untuk diperiksa tes.
 */
function dataApiDariFixture(): ArrayObject
{
    // Dimuat sekali per proses: men-decode ulang semua rekaman (±5 MB) di tiap tes menghabiskan memori.
    static $rekaman = null;
    if ($rekaman === null) {
        $rekaman = [];
        foreach (glob(dirname(__DIR__, 2).'/fixtures/data-api/*.json') ?: [] as $berkas) {
            $r = json_decode(file_get_contents($berkas), true);
            $rekaman[$r['kunci']] = $r;
        }
    }
    $dipanggil = new ArrayObject;
    Http::fake(function ($req) use ($rekaman, $dipanggil) {
        $kunci = kunciFixture($req->url());
        $dipanggil[] = $kunci;
        $r = $rekaman[$kunci] ?? ['status' => 599, 'headers' => [], 'body' => '{"error":{"code":"FIXTURE_TIDAK_ADA","message":"'.$kunci.'"}}'];

        return Http::response($r['body'], $r['status'], $r['headers']);
    });

    return $dipanggil;
}
