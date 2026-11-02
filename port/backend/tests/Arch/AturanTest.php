<?php

/*
| Aturan pemisahan backend (SPEC §4.3). Tiap aturan diuji dua arah:
| - fitur nyata (app/Features/*) mematuhinya;
| - fitur palsu App\Features\Contoh (tests/Fixtures/Arch, sengaja melanggar) DITOLAK.
|   Bila sebuah aturan rusak sehingga tidak menolak Contoh, tes mutasinya gagal.
*/

use App\Shared\DataApi\DataApiClient;
use Illuminate\Support\Facades\Route;
use Pest\Arch\Exceptions\ArchExpectationFailedException;
use PHPUnit\Framework\ExpectationFailedException;

const CONTOH = 'App\Features\Contoh';
const DB_DAN_ELOQUENT = ['Illuminate\Support\Facades\DB', 'Illuminate\Database\Eloquent\Model'];

/** @return list<string> nama fitur nyata, dari isi app/Features */
function fiturNyata(): array
{
    return array_values(array_map('basename', glob(app_path('Features/*'), GLOB_ONLYDIR)));
}

/** @return list<string> yang boleh dipakai controller fitur (SPEC §4.3 butir 3) */
function izinController(string $fitur): array
{
    $f = "App\\Features\\$fitur";

    return ["$f\\Http\\Requests", "$f\\Http\\Resources", "$f\\Services", 'Illuminate\Http\Request'];
}

/** @return list<class-string> kelas di <dir>/Http/Controllers */
function kelasController(string $dir, string $namespace): array
{
    return array_map(
        fn ($berkas) => $namespace.'\\Http\\Controllers\\'.basename($berkas, '.php'),
        glob($dir.'/Http/Controllers/*.php') ?: [],
    );
}

/** Pastikan sebuah ekspektasi arsitektur GAGAL (dipakai untuk fitur palsu). */
function harusDitolak(Closure $aturan): void
{
    $ditolak = false;
    try {
        // Ekspektasi arch Pest dievaluasi saat objeknya dilepas, yaitu ketika closure selesai.
        $aturan();
    } catch (ExpectationFailedException|ArchExpectationFailedException) {
        $ditolak = true;
    }
    expect($ditolak)->toBeTrue('aturan tidak menolak fitur palsu Contoh');
}

it('1. fitur tidak memakai fitur lain', function () {
    foreach (fiturNyata() as $fitur) {
        $lain = array_map(fn ($f) => "App\\Features\\$f", array_diff(fiturNyata(), [$fitur]));
        if ($lain) {
            expect("App\\Features\\$fitur")->not->toUse($lain);
        }
    }
    harusDitolak(fn () => expect(CONTOH)->not->toUse('App\Features\Sistem'));
});

it('2. Shared tidak memakai Features', function () {
    expect('App\Shared')->not->toUse('App\Features');
});

it('3. controller hanya memakai Request, Service, dan Resource', function () {
    // Per kelas, bukan per namespace: toOnlyUse milik plugin arch crash (bukan gagal) bila
    // targetnya namespace dan ada pelanggaran.
    foreach (fiturNyata() as $fitur) {
        foreach (kelasController(app_path("Features/$fitur"), "App\\Features\\$fitur") as $kelas) {
            expect($kelas)->toOnlyUse(izinController($fitur));
        }
    }
    foreach (kelasController(base_path('tests/Fixtures/Arch/Contoh'), CONTOH) as $kelas) {
        harusDitolak(fn () => expect($kelas)->toOnlyUse(izinController('Contoh')));
    }
});

it('4. hanya Sources yang memakai DataApiClient', function () {
    foreach (fiturNyata() as $fitur) {
        expect("App\\Features\\$fitur")->not->toUse(DataApiClient::class)->ignoring("App\\Features\\$fitur\\Sources");
        expect("App\\Features\\$fitur\\Services")->not->toUse("App\\Features\\$fitur\\Sources");
    }
    harusDitolak(fn () => expect(CONTOH)->not->toUse(DataApiClient::class)->ignoring(CONTOH.'\Sources'));
});

it('5. tidak ada DB/Eloquent di fitur selain Sistem', function () {
    foreach (array_diff(fiturNyata(), ['Sistem']) as $fitur) {
        expect("App\\Features\\$fitur")->not->toUse(DB_DAN_ELOQUENT);
    }
    harusDitolak(fn () => expect(CONTOH)->not->toUse(DB_DAN_ELOQUENT));
});

it('6. tidak ada rute PATCH', function () {
    $patch = collect(Route::getRoutes()->getRoutes())->filter(fn ($r) => in_array('PATCH', $r->methods(), true));

    expect($patch->map->uri()->values()->all())->toBe([]);
});

it('7. env() hanya di config/', function () {
    expect('env')->not->toBeUsedIn('App')->ignoring(CONTOH);
    harusDitolak(fn () => expect('env')->not->toBeUsedIn(CONTOH));
});
