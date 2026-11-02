<?php

namespace App\Shared\Tetap;

use App\Shared\DataApi\DataApiException;
use App\Shared\DataApi\DataApiResponse;
use App\Shared\DataApi\SnapshotStore;
use Carbon\CarbonImmutable;
use Illuminate\Support\Facades\Cache;
use RuntimeException;

/**
 * Baca endpoint kelas T (tetap) lewat SNAPSHOT (SPEC §4.6):
 *
 * - snapshot segar → kirim snapshot (`sumber = snapshot`);
 * - snapshot basi (lebih tua dari `portal.snapshot_basi_jam`) → satu request mencoba Data API dan
 *   memperbarui snapshot; request lain, dan semua request selama `portal.segarkan_jeda_menit` setelah
 *   percobaan gagal (5xx atau peringatan), langsung mendapat snapshot lama dengan `stale = true`.
 *   Ini menyegarkan kunci di luar daftar sinkron (parameter bebas, mis. `periode`) tanpa membuat
 *   setiap request menunggu timeout saat Data API mati;
 * - snapshot kosong → panggil Data API, simpan, lalu kirim (`sumber = data_api`); bila Data API gagal,
 *   DataApiException diteruskan (503).
 *
 * Jawaban berperingatan (Q21: query sumber gagal, data dikosongkan) diteruskan tetapi tidak disimpan.
 *
 * Selama job `portal:sinkron` (ModeSinkron aktif) Data API selalu dipanggil dan snapshot ditulis hanya
 * bila HASH berubah; jawaban berperingatan dihitung gagal sehingga snapshot lama tetap.
 */
class BacaTetap
{
    public function __construct(
        private readonly SnapshotStore $snapshot,
        private readonly ModeSinkron $sinkron,
    ) {}

    /**
     * @param  callable(): DataApiResponse  $ambil
     * @return array{respons: DataApiResponse, sumber: 'snapshot'|'data_api', stale: bool}
     */
    public function baca(string $kunci, callable $ambil): array
    {
        if ($this->sinkron->aktif()) {
            $respons = $ambil();
            if ($respons->adaPeringatan()) {
                throw new RuntimeException('Data API memberi peringatan (data dikosongkan): '.json_encode($respons->meta->peringatan, JSON_UNESCAPED_UNICODE));
            }
            $this->sinkron->catat($kunci, $this->snapshot->simpanBilaBerubah($kunci, $respons->body()));

            return ['respons' => $respons, 'sumber' => 'data_api', 'stale' => false];
        }

        $ada = $this->snapshot->ambil($kunci);
        if ($ada !== null && ! $this->basi($ada['diambil_pada'])) {
            return ['respons' => DataApiResponse::dariBody($ada['isi']), 'sumber' => 'snapshot', 'stale' => false];
        }

        // Snapshot basi: hanya satu request per jeda yang mencoba menyegarkan.
        $jeda = 'tetap:segarkan:'.hash('sha256', $kunci);
        if ($ada !== null && ! Cache::add($jeda, 1, now()->addMinutes((int) config('portal.segarkan_jeda_menit')))) {
            return $this->basiLama($ada['isi']);
        }

        try {
            $respons = $ambil();
        } catch (DataApiException $e) {
            // Hanya Data API tak tersedia (5xx) yang ditutup snapshot lama; 4xx tetap diteruskan.
            if ($ada === null || $e->status < 500) {
                throw $e;
            }

            return $this->basiLama($ada['isi']);
        }

        if ($respons->adaPeringatan()) {
            return $ada !== null ? $this->basiLama($ada['isi']) : ['respons' => $respons, 'sumber' => 'data_api', 'stale' => false];
        }
        Cache::forget($jeda);
        $this->snapshot->simpanBilaBerubah($kunci, $respons->body());

        return ['respons' => $respons, 'sumber' => 'data_api', 'stale' => false];
    }

    /** @return array{respons: DataApiResponse, sumber: 'snapshot', stale: true} */
    private function basiLama(string $isi): array
    {
        return ['respons' => DataApiResponse::dariBody($isi), 'sumber' => 'snapshot', 'stale' => true];
    }

    private function basi(CarbonImmutable $diambil): bool
    {
        return $diambil->lt(CarbonImmutable::now()->subHours((int) config('portal.snapshot_basi_jam')));
    }
}
