<?php

use App\Shared\DataApi\SnapshotStore;
use App\Shared\Jobs\JobRun;
use App\Shared\LogHistory\LogHistory;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/* Skenario backend sistem: rute admin dan retensi log (docs/skenario/sistem.md, SI-B07–SI-B09, SI-B11). */

function barisLog(string $modul, string $dibuat): void
{
    LogHistory::create([
        'request_id' => 'r-'.uniqid(), 'modul' => $modul, 'aksi' => "$modul.x", 'metode' => 'GET', 'path' => "api/v1/$modul",
        'param_hash' => str_repeat('0', 64), 'status_http' => 200, 'durasi_ms' => 5, 'dibuat_pada' => CarbonImmutable::parse($dibuat),
    ]);
}

it('SI-B07 bersihkan-log menghapus tepat yang lebih tua dari 180 hari', function () {
    CarbonImmutable::setTestNow('2026-11-02 04:00:00');
    barisLog('dataset', '2026-05-06 03:59:59'); // 180 hari + 1 detik
    barisLog('dataset', '2026-05-06 04:00:00'); // tepat 180 hari: tetap
    barisLog('dashboard', '2026-11-01 00:00:00');
    JobRun::create(['job' => 'portal:sinkron', 'pemicu' => 'cron', 'mulai' => '2026-05-01 00:00:00', 'status' => 'sukses']);
    JobRun::create(['job' => 'portal:sinkron', 'pemicu' => 'cron', 'mulai' => '2026-10-01 00:00:00', 'status' => 'sukses']);

    $this->artisan('portal:bersihkan-log')->assertSuccessful();

    expect(LogHistory::count())->toBe(2)
        ->and(LogHistory::orderBy('dibuat_pada')->first()->dibuat_pada->toDateTimeString())->toBe('2026-05-06 04:00:00')
        ->and(JobRun::where('job', 'portal:sinkron')->pluck('mulai')->map->toDateString()->all())->toBe(['2026-10-01']);
    $run = JobRun::where('job', 'portal:bersihkan-log')->sole();
    expect($run->status)->toBe('sukses')
        ->and($run->ringkasan)->toMatchArray(['log_history' => 1, 'job_runs' => 1]);
    CarbonImmutable::setTestNow();
});

it('SI-B08 log: filter modul dan tanggal (hari WIB), paging 50 terbaru dulu; job berhalaman', function () {
    foreach (range(1, 55) as $i) {
        barisLog('dataset', '2026-10-20 10:00:00');
    }
    barisLog('dashboard', '2026-10-20 10:00:00');
    barisLog('dataset', '2026-10-18 16:59:59'); // 18 Okt 23:59:59 WIB
    barisLog('dataset', '2026-10-18 17:00:00'); // 19 Okt 00:00 WIB
    $admin = tokenAkun('admin', 'admin');

    $hal1 = $this->getJson('/api/v1/sistem/log?modul=dataset&dari=2026-10-19&sampai=2026-10-20', $admin)->assertOk();
    expect($hal1->json('meta'))->toMatchArray(['page' => 1, 'size' => 50, 'total' => 56, 'has_more' => true, 'sumber' => null])
        ->and($hal1->json('data'))->toHaveCount(50)
        ->and($hal1->json('data.0.id'))->toBeGreaterThan($hal1->json('data.49.id'));
    $hal2 = $this->getJson('/api/v1/sistem/log?modul=dataset&dari=2026-10-19&sampai=2026-10-20&page=2', $admin)->assertOk();
    expect($hal2->json('meta.has_more'))->toBeFalse()
        ->and($hal2->json('data'))->toHaveCount(6)
        ->and(collect($hal2->json('data'))->pluck('modul')->unique()->all())->toBe(['dataset']);

    $this->getJson('/api/v1/sistem/log?sampai=2026-10-18', $admin)->assertOk()->assertJson(['meta' => ['total' => 1]]);
    $this->getJson('/api/v1/sistem/log?dari=2026-10-20&sampai=2026-10-19', $admin)->assertStatus(422)->assertJson(['errors' => ['code' => 'INVALID_PARAM']]);
    $this->getJson('/api/v1/sistem/log?dari=20-10-2026', $admin)->assertStatus(422);

    JobRun::create(['job' => 'portal:sinkron', 'pemicu' => 'manual', 'klien' => 'admin', 'mulai' => '2026-10-20 04:00:00', 'selesai' => '2026-10-20 04:01:00', 'status' => 'sukses', 'ringkasan' => ['ok' => 1]]);
    $this->getJson('/api/v1/sistem/job', $admin)->assertOk()->assertJson([
        'data' => [['job' => 'portal:sinkron', 'pemicu' => 'manual', 'klien' => 'admin', 'status' => 'sukses', 'ringkasan' => ['ok' => 1]]],
        'meta' => ['page' => 1, 'size' => 50, 'total' => 1, 'has_more' => false],
    ]);
});

it('SI-B09 rute admin menolak token read (403) dan tanpa token (401)', function (string $metode, string $uri) {
    $this->json($metode, $uri, [], tokenAkun('frontend', 'read'))->assertForbidden()->assertJson(['errors' => ['code' => 'FORBIDDEN']]);
    app('auth')->forgetGuards();
    $this->json($metode, $uri)->assertUnauthorized();
    expect(JobRun::count())->toBe(0);
})->with([
    ['GET', '/api/v1/sistem/log'],
    ['GET', '/api/v1/sistem/job'],
    ['POST', '/api/v1/sistem/job/sinkron'],
    ['POST', '/api/v1/sistem/cache/kosongkan'],
]);

it('SI-B11 kosongkan cache menghapus cache Data API, snapshot tetap', function () {
    // Store produksi (Oracle); tes lain memakai store array.
    config(['cache.default' => 'database']);
    Cache::put('dataapi:'.hash('sha256', 'x'), '{"data":1}', 60);
    Cache::put('dataapi:'.hash('sha256', 'y'), '{"data":2}', 60);
    Cache::put('lain', 'tetap', 60);
    app(SnapshotStore::class)->simpan('beranda.ringkasan', '{"data":1,"meta":{}}');

    $this->postJson('/api/v1/sistem/cache/kosongkan', [], tokenAkun('admin', 'admin'))
        ->assertOk()
        ->assertJson(['data' => ['dihapus' => 2]]);

    expect(Cache::get('lain'))->toBe('tetap')
        ->and(DB::table('snapshot')->count())->toBe(1);
});

it('SI-B12 rute admin tercatat di LOG_HISTORY modul sistem', function () {
    $this->getJson('/api/v1/sistem/job', tokenAkun('admin', 'admin'))->assertOk();

    expect(LogHistory::where('modul', 'sistem')->where('aksi', 'sistem.job')->sole()->klien)->toBe('admin');
});
