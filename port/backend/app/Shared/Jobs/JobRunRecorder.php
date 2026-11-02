<?php

namespace App\Shared\Jobs;

use Carbon\CarbonImmutable;
use Throwable;

/**
 * Membungkus satu eksekusi job: baris JOB_RUNS dibuat saat mulai (status `jalan`), lalu ditutup
 * dengan ringkasan dari job, atau `gagal` dengan pesan error (error tetap dilempar ulang).
 *
 * Status penutup bawaan `sukses`; job yang sebagian gagal mengembalikan kunci `status`
 * (`sebagian`/`gagal`) di ringkasannya. Kunci itu dipindah ke kolom STATUS, tidak ikut RINGKASAN.
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

        $status = in_array($ringkasan['status'] ?? null, ['sebagian', 'gagal'], true) ? $ringkasan['status'] : 'sukses';
        unset($ringkasan['status']);
        $run->update(['selesai' => CarbonImmutable::now(), 'status' => $status, 'ringkasan' => $ringkasan]);

        return $ringkasan;
    }
}
