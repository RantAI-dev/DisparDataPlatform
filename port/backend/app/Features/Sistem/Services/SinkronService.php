<?php

namespace App\Features\Sistem\Services;

use App\Shared\Jobs\JobRunRecorder;
use App\Shared\Tetap\ModeSinkron;
use Illuminate\Contracts\Cache\Lock;
use Illuminate\Contracts\Container\Container;
use Illuminate\Http\Request;
use Illuminate\Routing\Router;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Process;
use RuntimeException;
use Symfony\Component\Process\PhpExecutableFinder;
use Throwable;

/**
 * Job `portal:sinkron` (SPEC §4.6): memanggil ulang setiap endpoint kelas T dan memperbarui SNAPSHOT
 * bila isinya berubah.
 *
 * Daftar kunci diturunkan dari rute, bukan ditulis ulang di sini: setiap rute GET ber-`kelas` T ×
 * atribut `varian`-nya (tanpa varian = satu panggilan tanpa parameter). Tiap target dijalankan lewat
 * controller rute itu sendiri (tanpa middleware HTTP) dengan ModeSinkron aktif, sehingga kunci
 * snapshot dan cara memanggil Data API sama persis dengan request biasa. Rute kelas P tidak pernah
 * dipanggil. Kegagalan satu target dicatat dan snapshot lamanya tetap.
 */
final class SinkronService
{
    public const JOB = 'portal:sinkron';

    /** Batas umur kunci eksklusif; sinkron normal selesai jauh sebelum ini. */
    private const LOCK_DETIK = 3600;

    public function __construct(
        private readonly Router $router,
        private readonly Container $app,
        private readonly ModeSinkron $mode,
        private readonly JobRunRecorder $rekam,
    ) {}

    /**
     * Kunci eksklusif sinkron (cron dan manual berbagi kunci ini); null = sinkron lain berjalan.
     * `$pemilik`: kunci yang sudah diambil pemicu manual lalu diwariskan ke proses CLI.
     */
    public function kunci(?string $pemilik = null): ?Lock
    {
        if ($pemilik !== null) {
            return Cache::restoreLock(self::JOB, $pemilik);
        }
        $lock = Cache::lock(self::JOB, self::LOCK_DETIK);

        return $lock->get() ? $lock : null;
    }

    /** @return list<array{rute: string, uri: string, varian: array<string, string>}> */
    public function target(): array
    {
        $hasil = [];
        foreach ($this->router->getRoutes()->getRoutes() as $rute) {
            $aksi = $rute->getAction();
            if (($aksi['kelas'] ?? null) !== 'T' || ! in_array('GET', $rute->methods(), true)) {
                continue;
            }
            foreach (($aksi['varian'] ?? []) ?: [[]] as $varian) {
                $hasil[] = ['rute' => (string) $rute->getName(), 'uri' => $rute->uri(), 'varian' => $varian];
            }
        }

        return $hasil;
    }

    /**
     * Jalankan sinkron dan catat di JOB_RUNS. Kunci dilepas di akhir.
     *
     * @param  'cron'|'manual'  $pemicu
     * @return array{ok: int, berubah: int, gagal: int, rincian_gagal: list<array<string, mixed>>}
     */
    public function jalankan(Lock $lock, string $pemicu, ?string $klien): array
    {
        try {
            return $this->rekam->jalankan(self::JOB, $pemicu, $klien, function () {
                $ok = $berubah = 0;
                $gagal = [];
                foreach ($this->target() as $t) {
                    try {
                        $kunci = $this->mode->jalankan(fn () => $this->panggil($t['uri'], $t['varian']));
                        if ($kunci === []) {
                            throw new RuntimeException('rute kelas T tidak membaca snapshot (BacaTetap)');
                        }
                        $ok++;
                        $berubah += count(array_filter($kunci));
                    } catch (Throwable $e) {
                        $gagal[] = ['rute' => $t['rute'], 'varian' => (object) $t['varian'], 'error' => mb_strcut($e->getMessage(), 0, 500)];
                    }
                }

                return [
                    'status' => $gagal === [] ? 'sukses' : ($ok === 0 ? 'gagal' : 'sebagian'),
                    'ok' => $ok,
                    'berubah' => $berubah,
                    'gagal' => count($gagal),
                    'rincian_gagal' => $gagal,
                ];
            });
        } finally {
            $lock->release();
        }
    }

    /**
     * Pemicu manual (POST sistem/job/sinkron): sinkron dijalankan sebagai proses CLI terlepas
     * (`portal:sinkron --manual`), bukan di worker php-fpm yang bisa dibunuh
     * `request_terminate_timeout`. Kunci diambil di sini dan diwariskan ke proses itu (`--pemilik`),
     * jadi pemicu kedua langsung 409. false = sinkron lain sedang berjalan.
     */
    public function mulaiDiLatar(string $klien): bool
    {
        $lock = $this->kunci();
        if ($lock === null) {
            return false;
        }

        $php = (new PhpExecutableFinder)->find(false) ?: 'php';
        // `nohup … &`: shell langsung kembali, proses sinkron lepas dari request ini. Keluarannya
        // (termasuk error sebelum JOB_RUNS sempat ditulis) disimpan di storage/logs untuk operator.
        $log = storage_path('logs/sinkron-manual.log');
        $hasil = Process::path(base_path())->env(['LOG_SINKRON' => $log])->run([
            'sh', '-c', 'nohup "$@" >>"$LOG_SINKRON" 2>&1 &', 'sh',
            $php, 'artisan', 'portal:sinkron', '--manual', '--klien='.$klien, '--pemilik='.$lock->owner(),
        ]);
        if ($hasil->failed()) {
            $lock->release();
            throw new RuntimeException('Proses portal:sinkron gagal dimulai: '.$hasil->errorOutput());
        }

        return true;
    }

    /** @param array<string, string> $varian parameter jalur (`{code}`) atau query */
    private function panggil(string $uri, array $varian): void
    {
        $query = [];
        foreach ($varian as $nama => $nilai) {
            if (str_contains($uri, '{'.$nama.'}')) {
                $uri = str_replace('{'.$nama.'}', rawurlencode($nilai), $uri);
            } else {
                $query[$nama] = $nilai;
            }
        }

        $request = Request::create('/'.$uri, 'GET', $query);
        $rute = $this->router->getRoutes()->match($request);
        $request->setRouteResolver(fn () => $rute);

        // FormRequest dibuat dari `request` di container; kembalikan request asli sesudahnya.
        $asli = $this->app->make('request');
        $this->app->instance('request', $request);
        try {
            $rute->run();
        } finally {
            $this->app->instance('request', $asli);
        }
    }
}
