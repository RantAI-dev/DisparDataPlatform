<?php

namespace App\Shared\Tetap;

/**
 * Penanda job `portal:sinkron` (SPEC §4.6). Selama `jalankan()`, BacaTetap tidak membaca snapshot:
 * ia selalu memanggil Data API lalu menyimpan snapshot hanya bila HASH berubah, dan mencatat kunci
 * yang disentuhnya di sini.
 */
final class ModeSinkron
{
    private bool $aktif = false;

    /** @var array<string, bool> kunci snapshot → berubah */
    private array $kunci = [];

    /**
     * @param  callable(): mixed  $kerja
     * @return array<string, bool> kunci snapshot yang disentuh selama `$kerja` → berubah
     */
    public function jalankan(callable $kerja): array
    {
        $this->aktif = true;
        $this->kunci = [];
        try {
            $kerja();

            return $this->kunci;
        } finally {
            $this->aktif = false;
            $this->kunci = [];
        }
    }

    public function aktif(): bool
    {
        return $this->aktif;
    }

    public function catat(string $kunci, bool $berubah): void
    {
        $this->kunci[$kunci] = $berubah;
    }
}
