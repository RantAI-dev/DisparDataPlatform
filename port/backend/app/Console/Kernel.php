<?php

namespace App\Console;

use Illuminate\Console\Scheduling\Schedule;
use Illuminate\Foundation\Console\Kernel as ConsoleKernel;

class Kernel extends ConsoleKernel
{
    /**
     * Define the application's command schedule.
     */
    protected function schedule(Schedule $schedule): void
    {
        // SPEC §4.6 [K-7]: setelah refresh Dagster 02:00 UTC (09:00 WIB). Sinkron manual berbagi kunci
        // eksklusif yang sama (SinkronService), withoutOverlapping menjaga sisi jadwal.
        $schedule->command('portal:sinkron')
            ->dailyAt((string) config('portal.jam_sinkron'))
            ->timezone('Asia/Jakarta')
            ->withoutOverlapping();

        // SPEC §4.5 [K-6]: retensi LOG_HISTORY dan JOB_RUNS.
        $schedule->command('portal:bersihkan-log')
            ->weeklyOn(0, '01:00')
            ->timezone('Asia/Jakarta')
            ->withoutOverlapping();
    }

    /**
     * Register the commands for the application.
     */
    protected function commands(): void
    {
        $this->load(__DIR__.'/Commands');

        require base_path('routes/console.php');
    }
}
