<?php

namespace App\Features\Dataset\Contracts;

use App\Shared\DataApi\DataApiResponse;
use Psr\Http\Message\ResponseInterface;

/** Sumber data fitur dataset (KONTRAK §2.1). `$query` sudah divalidasi Request. */
interface DatasetSource
{
    /** @param array<string, scalar|null> $query */
    public function katalog(array $query): DataApiResponse;

    public function dataset(string $slug): DataApiResponse;

    public function kolom(string $slug): DataApiResponse;

    public function facet(string $slug): DataApiResponse;

    /** @param array<string, scalar|array<scalar>|null> $query */
    public function baris(string $slug, array $query): DataApiResponse;

    /** @param array<string, scalar|array<scalar>|null> $query */
    public function agregat(string $slug, array $query): DataApiResponse;

    /**
     * Ekspor sebagai aliran: body tidak dibaca ke memori.
     *
     * @param  array<string, scalar|array<scalar>|null>  $query
     */
    public function ekspor(string $slug, array $query): ResponseInterface;
}
