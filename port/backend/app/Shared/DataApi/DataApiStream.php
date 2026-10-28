<?php

namespace App\Shared\DataApi;

use Illuminate\Http\Client\ConnectionException;
use Psr\Http\Message\ResponseInterface;

/**
 * Klien ekspor (kelas aliran, SPEC §4.6): timeout panjang, tanpa retry, body tidak dibaca ke memori.
 * Pemakainya (fitur Dataset, plan 11) meneruskan body ke browser sebagai StreamedResponse.
 */
class DataApiStream
{
    public function __construct(private readonly DataApiClient $klien) {}

    /** @param array<string, scalar|array<scalar>|null> $query */
    public function buka(string $path, array $query = []): ResponseInterface
    {
        try {
            $res = $this->klien->http()
                ->timeout((int) config('dataapi.timeout_stream'))
                ->withOptions(['stream' => true])
                ->get($this->klien->url($path, $query));
        } catch (ConnectionException) {
            throw DataApiException::tidakTersedia();
        }
        if (! $res->successful()) {
            throw DataApiClient::exceptionDari($res);
        }

        return $res->toPsrResponse();
    }
}
