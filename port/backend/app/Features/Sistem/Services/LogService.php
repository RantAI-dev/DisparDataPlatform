<?php

namespace App\Features\Sistem\Services;

use App\Features\Sistem\Data\Halaman;
use App\Shared\Jobs\JobRun;
use App\Shared\Jobs\JobRunRecorder;
use App\Shared\LogHistory\LogHistory;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;

/** Baca LOG_HISTORY dan JOB_RUNS untuk admin, dan job retensi `portal:bersihkan-log` (SPEC §4.5). */
final class LogService
{
    public const JOB_BERSIHKAN = 'portal:bersihkan-log';

    /** Tanggal filter `dari`/`sampai` dibaca sebagai hari WIB. */
    private const ZONA = 'Asia/Jakarta';

    public function __construct(private readonly JobRunRecorder $rekam) {}

    public function log(?string $modul, ?string $dari, ?string $sampai, int $page): Halaman
    {
        $q = LogHistory::query()
            ->when($modul !== null, fn (Builder $q) => $q->where('modul', $modul))
            ->when($dari !== null, fn (Builder $q) => $q->where('dibuat_pada', '>=', CarbonImmutable::parse($dari, self::ZONA)->startOfDay()->utc()))
            ->when($sampai !== null, fn (Builder $q) => $q->where('dibuat_pada', '<', CarbonImmutable::parse($sampai, self::ZONA)->addDay()->startOfDay()->utc()));

        return $this->halaman($q, $page, fn (LogHistory $l) => [
            'id' => (int) $l->id,
            'request_id' => $l->request_id,
            'modul' => $l->modul,
            'aksi' => $l->aksi,
            'metode' => $l->metode,
            'path' => $l->path,
            'param_hash' => $l->param_hash,
            'param_ringkas' => $l->param_ringkas,
            'klien' => $l->klien,
            'ip' => $l->ip,
            'user_agent' => $l->user_agent,
            'status_http' => (int) $l->status_http,
            'durasi_ms' => (int) $l->durasi_ms,
            'jumlah_baris' => $l->jumlah_baris === null ? null : (int) $l->jumlah_baris,
            'sumber' => $l->sumber,
            'dibuat_pada' => $l->dibuat_pada->toIso8601String(),
        ]);
    }

    public function job(int $page): Halaman
    {
        return $this->halaman(JobRun::query(), $page, fn (JobRun $j) => [
            'id' => (int) $j->id,
            'job' => $j->job,
            'pemicu' => $j->pemicu,
            'klien' => $j->klien,
            'mulai' => $j->mulai->toIso8601String(),
            'selesai' => $j->selesai?->toIso8601String(),
            'status' => $j->status,
            'ringkasan' => $j->ringkasan,
        ]);
    }

    /**
     * Hapus LOG_HISTORY dan JOB_RUNS yang lebih tua dari retensi (bawaan 180 hari), dicatat di JOB_RUNS.
     *
     * @return array{batas: string, log_history: int, job_runs: int}
     */
    public function bersihkan(): array
    {
        return $this->rekam->jalankan(self::JOB_BERSIHKAN, 'cron', null, function () {
            $batas = CarbonImmutable::now()->subDays((int) config('loghistory.retensi_hari'));

            return [
                'batas' => $batas->toIso8601String(),
                'log_history' => LogHistory::where('dibuat_pada', '<', $batas)->delete(),
                'job_runs' => JobRun::where('mulai', '<', $batas)->delete(),
            ];
        });
    }

    /** @param callable(mixed): array<string, mixed> $bentuk */
    private function halaman(Builder $q, int $page, callable $bentuk): Halaman
    {
        $total = (clone $q)->count();
        $item = $q->orderByDesc('id')->forPage($page, Halaman::UKURAN)->get()->map($bentuk)->values()->all();

        return new Halaman($item, $page, $total);
    }
}
