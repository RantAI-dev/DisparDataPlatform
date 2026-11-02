<?php

namespace App\Features\Sistem\Console;

use App\Features\Sistem\Services\SinkronService;
use Illuminate\Console\Command;

/** Perbarui SNAPSHOT semua endpoint kelas T dari Data API (SPEC §4.6). Dijadwalkan harian di Kernel. */
final class SinkronCommand extends Command
{
    protected $signature = 'portal:sinkron {--manual : dicatat sebagai pemicu manual (operator), bukan cron}';

    protected $description = 'Perbarui snapshot endpoint kelas T dari Data API';

    public function handle(SinkronService $sinkron): int
    {
        $lock = $sinkron->kunci();
        if ($lock === null) {
            $this->warn('Sinkron lain masih berjalan; dilewati.');

            return self::SUCCESS;
        }

        $manual = (bool) $this->option('manual');
        $hasil = $sinkron->jalankan($lock, $manual ? 'manual' : 'cron', $manual ? 'cli' : null);

        $this->info("ok {$hasil['ok']}, berubah {$hasil['berubah']}, gagal {$hasil['gagal']}");
        foreach ($hasil['rincian_gagal'] as $g) {
            $this->error("gagal {$g['rute']} ".json_encode($g['varian']).": {$g['error']}");
        }

        return $hasil['gagal'] > 0 ? self::FAILURE : self::SUCCESS;
    }
}
