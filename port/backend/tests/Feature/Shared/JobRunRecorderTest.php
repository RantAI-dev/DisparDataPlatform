<?php

use App\Shared\Jobs\JobRun;
use App\Shared\Jobs\JobRunRecorder;

it('mencatat job sukses beserta ringkasannya', function () {
    $hasil = app(JobRunRecorder::class)->jalankan('portal:sinkron', 'cron', null, fn () => ['kunci' => 3, 'gagal' => 0]);

    $run = JobRun::sole();
    expect($hasil)->toBe(['kunci' => 3, 'gagal' => 0])
        ->and($run->status)->toBe('sukses')
        ->and($run->pemicu)->toBe('cron')
        ->and($run->ringkasan)->toBe(['kunci' => 3, 'gagal' => 0])
        ->and($run->selesai)->not->toBeNull();
});

it('mencatat job gagal lalu melempar ulang errornya', function () {
    expect(fn () => app(JobRunRecorder::class)->jalankan('portal:sinkron', 'manual', 'admin', fn () => throw new RuntimeException('Data API mati')))
        ->toThrow(RuntimeException::class, 'Data API mati');

    $run = JobRun::sole();
    expect($run->status)->toBe('gagal')
        ->and($run->klien)->toBe('admin')
        ->and($run->ringkasan)->toBe(['error' => 'Data API mati']);
});
