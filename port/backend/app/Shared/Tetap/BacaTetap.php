<?php

namespace App\Shared\Tetap;

use App\Shared\DataApi\DataApiResponse;
use App\Shared\DataApi\SnapshotStore;
use Carbon\CarbonImmutable;

/**
 * Baca endpoint kelas T (tetap) lewat SNAPSHOT (SPEC §4.6):
 *
 * - snapshot ada  → kirim snapshot (`sumber = snapshot`, `stale` bila lebih tua dari batas);
 * - snapshot kosong → panggil Data API, simpan, lalu kirim (`sumber = data_api`);
 * - snapshot kosong dan Data API gagal → DataApiException diteruskan (503).
 *
 * Snapshot diperbarui job `portal:sinkron` (plan 16), bukan oleh request.
 */
class BacaTetap
{
    public function __construct(private readonly SnapshotStore $snapshot) {}

    /**
     * @param  callable(): DataApiResponse  $ambil
     * @return array{respons: DataApiResponse, sumber: 'snapshot'|'data_api', stale: bool}
     */
    public function baca(string $kunci, callable $ambil): array
    {
        $ada = $this->snapshot->ambil($kunci);
        if ($ada !== null) {
            $basi = $ada['diambil_pada']->lt(CarbonImmutable::now()->subHours((int) config('portal.snapshot_basi_jam')));

            return ['respons' => DataApiResponse::dariBody($ada['isi']), 'sumber' => 'snapshot', 'stale' => $basi];
        }

        $respons = $ambil();
        $this->snapshot->simpan($kunci, $respons->body());

        return ['respons' => $respons, 'sumber' => 'data_api', 'stale' => false];
    }
}
