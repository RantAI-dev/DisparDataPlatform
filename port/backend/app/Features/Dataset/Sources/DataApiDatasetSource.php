<?php

namespace App\Features\Dataset\Sources;

use App\Features\Dataset\Contracts\DatasetSource;
use App\Shared\DataApi\DataApiClient;
use App\Shared\DataApi\DataApiResponse;
use App\Shared\DataApi\DataApiStream;
use Psr\Http\Message\ResponseInterface;

/** `f[]` dari Laravel dikirim ke Data API sebagai `f=` berulang oleh DataApiClient::url(). */
final class DataApiDatasetSource implements DatasetSource
{
    public function __construct(
        private readonly DataApiClient $dataApi,
        private readonly DataApiStream $aliran,
    ) {}

    public function katalog(array $query): DataApiResponse
    {
        return $this->dataApi->get('/v1/katalog', $query);
    }

    public function dataset(string $slug): DataApiResponse
    {
        return $this->dataApi->get(self::path($slug));
    }

    public function kolom(string $slug): DataApiResponse
    {
        return $this->dataApi->get(self::path($slug, 'kolom'));
    }

    public function facet(string $slug): DataApiResponse
    {
        return $this->dataApi->get(self::path($slug, 'facet'));
    }

    public function baris(string $slug, array $query): DataApiResponse
    {
        return $this->dataApi->get(self::path($slug, 'baris'), $query);
    }

    public function agregat(string $slug, array $query): DataApiResponse
    {
        return $this->dataApi->get(self::path($slug, 'agregat'), $query);
    }

    public function ekspor(string $slug, array $query): ResponseInterface
    {
        return $this->aliran->buka(self::path($slug, 'ekspor'), $query);
    }

    private static function path(string $slug, string $bagian = ''): string
    {
        return '/v1/dataset/'.rawurlencode($slug).($bagian ? '/'.$bagian : '');
    }
}
