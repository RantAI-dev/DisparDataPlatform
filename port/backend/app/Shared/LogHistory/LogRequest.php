<?php

namespace App\Shared\LogHistory;

use Carbon\CarbonImmutable;
use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Symfony\Component\HttpFoundation\Response;
use Throwable;

/**
 * Menulis LOG_HISTORY setelah respons terkirim (`terminate`), sehingga kegagalan log tidak
 * pernah menggagalkan request (SPEC §4.5).
 */
final class LogRequest
{
    public function __construct(private readonly LogContext $konteks) {}

    public function handle(Request $request, Closure $next): Response
    {
        // Disimpan di request, bukan properti: Laravel membuat instance baru untuk terminate().
        $request->attributes->set('log_mulai', microtime(true));

        return $next($request);
    }

    public function terminate(Request $request, Response $response): void
    {
        if (! config('loghistory.aktif')) {
            return;
        }

        try {
            LogHistory::create($this->baris($request, $response));
        } catch (Throwable $e) {
            Log::warning('log_history gagal ditulis', ['request_id' => $this->konteks->requestId(), 'error' => $e->getMessage()]);
        }
    }

    /** @return array<string, mixed> */
    private function baris(Request $request, Response $response): array
    {
        $rute = $request->route();
        $query = self::normalkan($request->query());
        $rahasia = array_flip(config('loghistory.param_rahasia'));
        $ringkas = json_encode(array_diff_key($query, $rahasia), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        return [
            'request_id' => $this->konteks->requestId(),
            'modul' => is_object($rute) ? $rute->getAction('modul') : null,
            'aksi' => is_object($rute) ? $rute->getName() : null,
            'metode' => $request->method(),
            'path' => self::potong('/'.ltrim($request->path(), '/'), 500),
            'param_hash' => hash('sha256', json_encode($query) ?: ''),
            'param_ringkas' => $query ? self::potong((string) $ringkas, (int) config('loghistory.param_maks')) : null,
            'klien' => $request->user()?->name,
            'ip' => $request->ip(),
            'user_agent' => self::potong((string) $request->userAgent(), 500) ?: null,
            'status_http' => $response->getStatusCode(),
            'durasi_ms' => (int) round((microtime(true) - (float) $request->attributes->get('log_mulai', microtime(true))) * 1000),
            'jumlah_baris' => $this->konteks->jumlahBaris,
            'sumber' => $this->konteks->sumber,
            'dibuat_pada' => CarbonImmutable::now(),
        ];
    }

    /**
     * Potong per BYTE, bukan per karakter: VARCHAR2 Oracle default memakai byte semantics, jadi
     * teks non-ASCII yang ≤ N karakter bisa > N byte (ORA-12899). mb_strcut tidak memotong
     * di tengah karakter UTF-8.
     */
    private static function potong(string $teks, int $byte): string
    {
        return mb_strcut($teks, 0, $byte, 'UTF-8');
    }

    /**
     * Urutkan kunci secara rekursif supaya query yang sama selalu menghasilkan hash yang sama.
     *
     * @param  array<mixed>  $q
     * @return array<mixed>
     */
    private static function normalkan(array $q): array
    {
        ksort($q);
        foreach ($q as $k => $v) {
            if (is_array($v)) {
                $q[$k] = self::normalkan($v);
            }
        }

        return $q;
    }
}
