<?php

namespace App\Features\Sistem\Console;

use App\Features\Sistem\Services\LogService;
use Illuminate\Console\Command;

/** Retensi LOG_HISTORY dan JOB_RUNS (SPEC §4.5, K-6). Dijadwalkan mingguan di Kernel. */
final class BersihkanLogCommand extends Command
{
    protected $signature = 'portal:bersihkan-log';

    protected $description = 'Hapus log history dan riwayat job yang lebih tua dari masa retensi';

    public function handle(LogService $log): int
    {
        $hasil = $log->bersihkan();
        $this->info("log_history {$hasil['log_history']}, job_runs {$hasil['job_runs']} dihapus (sebelum {$hasil['batas']})");

        return self::SUCCESS;
    }
}
