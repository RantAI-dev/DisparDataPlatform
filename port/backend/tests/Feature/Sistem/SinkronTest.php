<?php

use App\Features\Sistem\Services\SinkronService;
use App\Shared\DataApi\SnapshotStore;
use App\Shared\Jobs\JobRun;
use Carbon\CarbonImmutable;
use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

/* Skenario backend sistem: job sinkron (docs/skenario/sistem.md, SI-B01–SI-B06, SI-B10). */

/** @return list<array{rute: string, uri: string, varian: array<string, string>}> */
function targetSinkron(): array
{
    return app(SinkronService::class)->target();
}

it('SI-B01 sinkron semua sukses: satu snapshot per rute T × varian, endpoint P tidak dipanggil', function () {
    $dipanggil = dataApiDariFixture();

    $this->artisan('portal:sinkron')->assertSuccessful();

    $target = targetSinkron();
    $run = JobRun::sole();
    expect($run->status)->toBe('sukses')
        ->and($run->pemicu)->toBe('cron')
        ->and($run->ringkasan)->toBe(['ok' => count($target), 'berubah' => count($target), 'gagal' => 0, 'rincian_gagal' => []])
        ->and(DB::table('snapshot')->count())->toBe(count($target));

    // Kunci diturunkan dari rute: 28 kode indikator, tier katalog, tahun pertunjukan.
    $detail = array_filter($target, fn ($t) => $t['rute'] === 'indikator.detail');
    expect($detail)->toHaveCount(28)
        ->and(collect($target)->pluck('rute')->unique()->sort()->values()->all())->toBe(collect(app('router')->getRoutes()->getRoutes())
        ->filter(fn ($r) => ($r->getAction()['kelas'] ?? null) === 'T')->map->getName()->sort()->values()->all());

    // Tidak ada panggilan kelas P (dataset per slug, daftar gmti, titik spasial, wisman berparameter).
    $p = array_filter((array) $dipanggil, fn ($k) => preg_match('#^/v1/(dataset/|gmti/tempat|spasial/titik|dashboard/wisman/(kebangsaan|pintu-masuk))#', $k));
    expect($p)->toBe([]);
});

it('SI-B02 sebagian gagal: snapshot lama tetap, status sebagian, kegagalan dirinci', function () {
    app(SnapshotStore::class)->simpan('gmti.ringkasan', '{"data":{"lama":true},"meta":{}}');
    $kunciLama = DB::table('snapshot')->where('kunci', 'gmti.ringkasan')->first();
    Http::fake(fn ($req) => str_contains($req->url(), '/v1/gmti/ringkasan') ? throw new ConnectionException('mati') : null);
    dataApiDariFixture();

    $this->artisan('portal:sinkron')->assertFailed();

    $run = JobRun::sole();
    expect($run->status)->toBe('sebagian')
        ->and($run->ringkasan['gagal'])->toBe(1)
        ->and($run->ringkasan['ok'])->toBe(count(targetSinkron()) - 1)
        ->and($run->ringkasan['rincian_gagal'][0]['rute'])->toBe('gmti.ringkasan')
        ->and(DB::table('snapshot')->where('kunci', 'gmti.ringkasan')->first())->toEqual($kunciLama);
});

it('SI-B03 hash sama → snapshot tidak ditulis ulang', function () {
    dataApiDariFixture();
    $this->artisan('portal:sinkron')->assertSuccessful();
    DB::table('snapshot')->update(['diambil_pada' => CarbonImmutable::parse('2026-01-01')]);

    $this->artisan('portal:sinkron')->assertSuccessful();

    $kedua = JobRun::orderByDesc('id')->first();
    expect($kedua->ringkasan['berubah'])->toBe(0)
        ->and($kedua->ringkasan['ok'])->toBe(count(targetSinkron()))
        ->and(DB::table('snapshot')->where('diambil_pada', '>', CarbonImmutable::parse('2026-01-02'))->count())->toBe(0);
});

it('SI-B04 tidak tumpang tindih: jadwal withoutOverlapping, kunci dipegang → cron dilewati, manual 409', function () {
    $acara = collect(app(Schedule::class)->events())->first(fn ($e) => str_contains($e->command, 'portal:sinkron'));
    expect($acara->withoutOverlapping)->toBeTrue()
        ->and($acara->expression)->toBe('0 11 * * *')
        ->and($acara->timezone)->toBe('Asia/Jakarta');

    $lock = Cache::lock(SinkronService::JOB, 60);
    expect($lock->get())->toBeTrue();
    Http::fake();

    $this->artisan('portal:sinkron')->expectsOutputToContain('dilewati')->assertSuccessful();
    $this->postJson('/api/v1/sistem/job/sinkron', [], tokenAkun('admin', 'admin'))
        ->assertStatus(409)
        ->assertJson(['success' => false, 'errors' => ['code' => 'JOB_BERJALAN']]);

    expect(JobRun::count())->toBe(0);
    Http::assertNothingSent();
    $lock->release();
});

it('SI-B05 snapshot lebih tua dari 36 jam → meta.stale', function () {
    dataApiDariFixture();
    $this->artisan('portal:sinkron')->assertSuccessful();
    DB::table('snapshot')->where('kunci', 'beranda.ringkasan')->update(['diambil_pada' => CarbonImmutable::now()->subHours(37)]);
    Http::fake(fn () => throw new ConnectionException('mati'));

    $this->getJson('/api/v1/beranda/ringkasan', tokenAkun())->assertOk()->assertJson(['meta' => ['sumber' => 'snapshot', 'stale' => true]]);
    $this->getJson('/api/v1/gmti/ringkasan', tokenAkun())->assertOk()->assertJson(['meta' => ['sumber' => 'snapshot', 'stale' => false]]);
});

it('SI-B06 snapshot hilang dan Data API mati → 503', function () {
    Http::fake(fn () => throw new ConnectionException('mati'));

    $this->getJson('/api/v1/beranda/ringkasan', tokenAkun())->assertStatus(503)->assertJson(['errors' => ['code' => 'UPSTREAM_UNAVAILABLE']]);
});

it('SI-B10 pemicu manual: 202 lalu sinkron berjalan setelah respons, PEMICU=manual', function () {
    dataApiDariFixture();

    $this->postJson('/api/v1/sistem/job/sinkron', [], tokenAkun('admin', 'admin'))
        ->assertStatus(202)
        ->assertJson(['success' => true, 'data' => ['job' => 'portal:sinkron', 'pemicu' => 'manual']]);

    $run = JobRun::sole();
    expect($run->pemicu)->toBe('manual')
        ->and($run->klien)->toBe('admin')
        ->and($run->status)->toBe('sukses')
        ->and(DB::table('snapshot')->count())->toBe(count(targetSinkron()))
        ->and(Cache::lock(SinkronService::JOB, 1)->get())->toBeTrue();
});
