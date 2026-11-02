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
use Illuminate\Support\Facades\Process;

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

it('SI-B03 hash sama → isi tidak ditulis ulang, DIAMBIL_PADA diperbarui (tidak basi)', function () {
    dataApiDariFixture();
    $this->artisan('portal:sinkron')->assertSuccessful();
    DB::table('snapshot')->update(['diambil_pada' => CarbonImmutable::parse('2026-01-01')]);
    $hashLama = DB::table('snapshot')->orderBy('kunci')->pluck('hash')->all();

    $this->artisan('portal:sinkron')->assertSuccessful();

    $kedua = JobRun::orderByDesc('id')->first();
    expect($kedua->ringkasan['berubah'])->toBe(0)
        ->and($kedua->ringkasan['ok'])->toBe(count(targetSinkron()))
        ->and(DB::table('snapshot')->orderBy('kunci')->pluck('hash')->all())->toBe($hashLama)
        ->and(DB::table('snapshot')->where('diambil_pada', '<', CarbonImmutable::parse('2026-01-02'))->count())->toBe(0);
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

it('SI-B10 pemicu manual: 202, proses CLI terpisah mewarisi kunci, PEMICU=manual dengan klien pemicu', function () {
    Process::fake();
    $admin = tokenAkun('admin', 'admin');

    $this->postJson('/api/v1/sistem/job/sinkron', [], $admin)
        ->assertStatus(202)
        ->assertJson(['success' => true, 'data' => ['job' => 'portal:sinkron', 'pemicu' => 'manual']]);
    // Kunci tetap dipegang (diwariskan ke proses CLI): pemicu kedua langsung 409.
    $this->postJson('/api/v1/sistem/job/sinkron', [], $admin)->assertStatus(409);

    // Bukan di worker php-fpm (request_terminate_timeout): dilepas lewat `nohup … &`.
    $pemilik = null;
    Process::assertRan(function ($p) use (&$pemilik) {
        $arg = collect($p->command)->first(fn ($a) => str_starts_with($a, '--pemilik='));
        $pemilik = $arg ? substr($arg, 10) : null;

        return in_array('portal:sinkron', $p->command, true) && in_array('--manual', $p->command, true)
            && in_array('--klien=admin', $p->command, true) && str_contains($p->command[2], 'nohup') && $pemilik;
    });
    Process::assertRanTimes(fn ($p) => in_array('portal:sinkron', $p->command, true), 1);

    // Proses yang dilepas itu: memakai kunci warisan, lalu melepasnya.
    dataApiDariFixture();
    $this->artisan("portal:sinkron --manual --klien=admin --pemilik=$pemilik")->assertSuccessful();
    $run = JobRun::sole();
    expect($run->pemicu)->toBe('manual')
        ->and($run->klien)->toBe('admin')
        ->and($run->status)->toBe('sukses')
        ->and(Cache::lock(SinkronService::JOB, 1)->get())->toBeTrue();
});

it('SI-B16 proses sinkron gagal dimulai → 500 dan kunci dilepas', function () {
    Process::fake(fn () => Process::result(errorOutput: 'sh: tidak ada', exitCode: 127));

    $this->postJson('/api/v1/sistem/job/sinkron', [], tokenAkun('admin', 'admin'))->assertStatus(500);

    expect(Cache::lock(SinkronService::JOB, 1)->get())->toBeTrue();
});

it('SI-B13 snapshot basi dan Data API hidup → disegarkan saat dibaca (kunci di luar varian sinkron)', function () {
    dataApiDariFixture();
    $kunci = 'dashboard.wisman.bulanan';
    // Kunci berparameter bebas (bukan target sinkron), isi lama dan basi.
    $this->getJson('/api/v1/dashboard/wisman/bulanan', tokenAkun())->assertOk();
    DB::table('snapshot')->where('kunci', $kunci)->update(['isi' => '{"data":{"lama":true},"meta":{}}', 'hash' => 'lama', 'diambil_pada' => CarbonImmutable::now()->subHours(37)]);

    $r = $this->getJson('/api/v1/dashboard/wisman/bulanan', tokenAkun())->assertOk();

    expect($r->json('meta.sumber'))->toBe('data_api')
        ->and($r->json('meta.stale'))->toBeFalse()
        ->and($r->json('data.lama'))->toBeNull()
        ->and(DB::table('snapshot')->where('kunci', $kunci)->value('hash'))->not->toBe('lama')
        ->and(CarbonImmutable::parse(DB::table('snapshot')->where('kunci', $kunci)->value('diambil_pada'))->gt(CarbonImmutable::now()->subMinute()))->toBeTrue();
});

it('SI-B17 snapshot basi dan Data API mati → satu percobaan, lalu snapshot lama tanpa menunggu selama jeda', function () {
    app(SnapshotStore::class)->simpan('beranda.ringkasan', '{"data":{"lama":true},"meta":{}}');
    DB::table('snapshot')->update(['diambil_pada' => CarbonImmutable::now()->subHours(37)]);
    $panggil = 0;
    Http::fake(function () use (&$panggil) {
        $panggil++;
        throw new ConnectionException('mati');
    });

    foreach (range(1, 3) as $_) {
        $this->getJson('/api/v1/beranda/ringkasan', tokenAkun())->assertOk()
            ->assertJson(['data' => ['lama' => true], 'meta' => ['sumber' => 'snapshot', 'stale' => true]]);
    }

    // Satu request mencoba (dengan retry DataApiClient); dua berikutnya tidak memanggil Data API.
    expect($panggil)->toBe(1 + (int) config('dataapi.retry'));
});

it('SI-B14 jawaban berperingatan (Q21) tidak menimpa snapshot: sinkron gagal per kunci, baca memakai snapshot lama', function () {
    app(SnapshotStore::class)->simpan('beranda.ringkasan', '{"data":{"bagus":true},"meta":{}}');
    $berperingatan = Http::response('{"data":{},"meta":{"peringatan":["query gagal"]}}');
    Http::fake(fn ($req) => str_contains($req->url(), '/v1/beranda/ringkasan') ? $berperingatan : null);
    dataApiDariFixture();

    $this->artisan('portal:sinkron')->assertFailed();

    $run = JobRun::sole();
    expect($run->ringkasan['rincian_gagal'][0]['rute'])->toBe('beranda.ringkasan')
        ->and($run->ringkasan['rincian_gagal'][0]['error'])->toContain('peringatan')
        ->and(DB::table('snapshot')->where('kunci', 'beranda.ringkasan')->value('isi'))->toBe('{"data":{"bagus":true},"meta":{}}');

    // Basi + jawaban berperingatan → snapshot lama dikirim, ditandai stale.
    DB::table('snapshot')->where('kunci', 'beranda.ringkasan')->update(['diambil_pada' => CarbonImmutable::now()->subHours(37)]);
    $this->getJson('/api/v1/beranda/ringkasan', tokenAkun())->assertOk()
        ->assertJson(['data' => ['bagus' => true], 'meta' => ['sumber' => 'snapshot', 'stale' => true]]);
});

it('SI-B15 jawaban berperingatan tanpa snapshot diteruskan tetapi tidak disimpan (T) dan tidak di-cache (P)', function () {
    Http::fake(fn () => Http::response('{"data":{},"meta":{"peringatan":["query gagal"]}}'));

    $this->getJson('/api/v1/beranda/ringkasan', tokenAkun())->assertOk()->assertJson(['meta' => ['peringatan' => ['query gagal']]]);
    $this->getJson('/api/v1/dashboard/wisman/kebangsaan?tahun=2025', tokenAkun())->assertOk();
    $this->getJson('/api/v1/dashboard/wisman/kebangsaan?tahun=2025', tokenAkun())->assertOk()->assertJson(['meta' => ['sumber' => 'data_api']]);

    expect(DB::table('snapshot')->count())->toBe(0);
    Http::assertSentCount(3);
});
