<?php

namespace App\Shared\DataApi;

use Carbon\CarbonImmutable;
use Illuminate\Database\QueryException;
use Illuminate\Support\Facades\DB;

/** Tabel SNAPSHOT: body Data API mentah untuk endpoint kelas T (SPEC §4.6). */
class SnapshotStore
{
    /** @return array{isi: string, diambil_pada: CarbonImmutable}|null */
    public function ambil(string $kunci): ?array
    {
        $baris = DB::table('snapshot')->where('kunci', $kunci)->first(['isi', 'diambil_pada']);

        return $baris ? ['isi' => (string) $baris->isi, 'diambil_pada' => CarbonImmutable::parse($baris->diambil_pada)] : null;
    }

    /**
     * Tulis ISI hanya bila HASH berbeda. Bila sama, cukup DIAMBIL_PADA yang diperbarui: data
     * terkonfirmasi segar, jadi tidak boleh tertandai basi (`stale`).
     *
     * @return bool true = isi berubah dan ditulis
     */
    public function simpanBilaBerubah(string $kunci, string $isi): bool
    {
        if (DB::table('snapshot')->where('kunci', $kunci)->value('hash') === hash('sha256', $isi)) {
            DB::table('snapshot')->where('kunci', $kunci)->update(['diambil_pada' => CarbonImmutable::now()]);

            return false;
        }
        $this->simpan($kunci, $isi);

        return true;
    }

    public function simpan(string $kunci, string $isi): void
    {
        $nilai = ['isi' => $isi, 'diambil_pada' => CarbonImmutable::now(), 'hash' => hash('sha256', $isi)];

        try {
            DB::table('snapshot')->updateOrInsert(['kunci' => $kunci], $nilai);
        } catch (QueryException $e) {
            // updateOrInsert = cek lalu insert. Dua request pertama yang bersamaan bisa sama-sama
            // insert; yang kalah (ORA-00001) cukup menimpa baris pemenang.
            if (! str_contains($e->getMessage(), 'ORA-00001')) {
                throw $e;
            }
            DB::table('snapshot')->where('kunci', $kunci)->update($nilai);
        }
    }
}
