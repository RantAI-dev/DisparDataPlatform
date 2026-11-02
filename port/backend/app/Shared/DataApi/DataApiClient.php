<?php

namespace App\Shared\DataApi;

use App\Shared\LogHistory\LogContext;
use GuzzleHttp\Psr7\Query;
use Illuminate\Http\Client\ConnectionException;
use Illuminate\Http\Client\PendingRequest;
use Illuminate\Http\Client\Response;
use Illuminate\Support\Facades\Http;
use JsonException;

/**
 * Klien Data API untuk endpoint biasa (SPEC §4.4). Hanya `Sources/*` fitur yang boleh memakainya.
 *
 * - `data` dikembalikan sebagai string JSON mentah.
 * - Timeout per percobaan dari config; ulang hanya untuk 5xx dan timeout/koneksi.
 * - Parameter berulang (`f[]` di Laravel) dikirim sebagai `f=` berulang.
 * - `X-Request-Id` request portal diteruskan.
 */
class DataApiClient
{
    public function __construct(private readonly LogContext $konteks) {}

    /**
     * @param  array<string, scalar|array<scalar>|null>  $query
     * @param  int|null  $timeout  detik per percobaan; bawaan config dataapi.timeout
     * @param  int|null  $ulang  jumlah ulang untuk 5xx/timeout; bawaan config dataapi.retry
     */
    public function get(string $path, array $query = [], ?int $timeout = null, ?int $ulang = null): DataApiResponse
    {
        $url = $this->url($path, $query);
        $ulang = max(0, $ulang ?? (int) config('dataapi.retry'));
        $timeout ??= (int) config('dataapi.timeout');

        for ($percobaan = 0; ; $percobaan++) {
            try {
                $res = $this->http()->timeout($timeout)->get($url);
            } catch (ConnectionException) {
                if ($percobaan < $ulang) {
                    $this->jeda();

                    continue;
                }
                throw DataApiException::tidakTersedia();
            }
            if ($res->serverError() && $percobaan < $ulang) {
                $this->jeda();

                continue;
            }
            break;
        }

        if (! $res->successful()) {
            throw self::exceptionDari($res);
        }

        try {
            return DataApiResponse::dariBody($res->body());
        } catch (JsonException) {
            throw new DataApiException('UPSTREAM_UNAVAILABLE', 502, 'Sumber data mengirim respons yang tidak valid.');
        }
    }

    /** @param array<string, scalar|array<scalar>|null> $query */
    public function url(string $path, array $query = []): string
    {
        $url = config('dataapi.url').'/'.ltrim($path, '/');
        $query = array_filter($query, fn ($v) => $v !== null && $v !== '' && $v !== []);

        // Query::build menulis array sebagai kunci berulang (f=a&f=b), bukan f[0]=a.
        return $query ? $url.'?'.Query::build($query) : $url;
    }

    public function http(): PendingRequest
    {
        return Http::withToken((string) config('dataapi.token'))
            ->withHeaders(['X-Request-Id' => $this->konteks->requestId()])
            ->acceptJson();
    }

    public static function exceptionDari(Response $res): DataApiException
    {
        // 401/403 dari Data API berarti token LAYANAN portal salah (konfigurasi server), bukan
        // token klien. Jangan diteruskan sebagai 401/403: Nuxt akan mengira tokennya yang salah.
        if (in_array($res->status(), [401, 403], true)) {
            return new DataApiException('UPSTREAM_AUTH', 502, 'Portal tidak diizinkan mengakses sumber data. Periksa token Data API di server.');
        }

        try {
            $err = JsonMentah::decode($res->body())->error ?? null;
        } catch (JsonException) {
            $err = null;
        }
        $kode = is_object($err) && isset($err->code) ? (string) $err->code
            : ($res->status() === 404 ? 'NOT_FOUND' : 'UPSTREAM_UNAVAILABLE');

        return new DataApiException($kode, $res->status(), null, is_object($err) ? ($err->detail ?? null) : null);
    }

    private function jeda(): void
    {
        usleep(max(0, (int) config('dataapi.retry_jeda_ms')) * 1000);
    }
}
