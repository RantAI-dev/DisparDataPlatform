<?php

namespace App\Shared\Jobs;

use Carbon\CarbonImmutable;
use Throwable;

/**
 * Membungkus satu eksekusi job: baris JOB_RUNS dibuat saat mulai (status `jalan`), lalu ditutup
 * `sukses` dengan ringkasan dari job, atau `gagal` dengan pesan error (error tetap dilempar ulang).
 */
class JobRunRecorder
{
    /**
     * @param  'cron'|'manual'  $pemicu
     * @param  callable(): array<string, mixed>  $kerja  mengembalikan ringkasan
     * @return array<string, mixed>
     */
    public function jalankan(string $job, string $pemicu, ?string $klien, callable $kerja): array
    {
        $run = JobRun::create([
            'job' => $job,
            'pemicu' => $pemicu,
            'klien' => $klien,
            'mulai' => CarbonImmutable::now(),
            'status' => 'jalan',
        ]);

        try {
            $ringkasan = $kerja();
        } catch (Throwable $e) {
            $run->update(['selesai' => CarbonImmutable::now(), 'status' => 'gagal', 'ringkasan' => ['error' => $e->getMessage()]]);
            throw $e;
        }

        $run->update(['selesai' => CarbonImmutable::now(), 'status' => 'sukses', 'ringkasan' => $ringkasan]);

        return $ringkasan;
    }
}
