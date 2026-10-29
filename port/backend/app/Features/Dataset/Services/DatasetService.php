<?php

namespace App\Features\Dataset\Services;

use App\Features\Dataset\Contracts\DatasetSource;
use App\Shared\Cache\BacaCache;
use App\Shared\DataApi\DataApiResponse;
use App\Shared\Support\KunciQuery;
use App\Shared\Tetap\BacaTetap;
use Psr\Http\Message\ResponseInterface;

/**
 * Fitur dataset (KONTRAK §2.1). Katalog kelas T (snapshot), detail/kolom/facet/baris/agregat
 * kelas P (cache), ekspor kelas S (aliran, tanpa cache).
 *
 * @phpstan-type Hasil array{respons: DataApiResponse, sumber: 'data_api'|'cache'|'snapshot', stale: bool}
 */
final class DatasetService
{
    public function __construct(
        private readonly DatasetSource $sumber,
        private readonly BacaTetap $tetap,
        private readonly BacaCache $cache,
    ) {}

    /** @return Hasil */
    public function katalog(array $query): array
    {
        return $this->tetap->baca(KunciQuery::buat('dataset.katalog', $query), fn () => $this->sumber->katalog($query));
    }

    /** @return Hasil */
    public function dataset(string $slug): array
    {
        return $this->cache->baca(KunciQuery::buat("dataset.$slug"), fn () => $this->sumber->dataset($slug));
    }

    /** @return Hasil */
    public function kolom(string $slug): array
    {
        return $this->cache->baca(KunciQuery::buat("dataset.$slug.kolom"), fn () => $this->sumber->kolom($slug));
    }

    /** @return Hasil */
    public function facet(string $slug): array
    {
        return $this->cache->baca(KunciQuery::buat("dataset.$slug.facet"), fn () => $this->sumber->facet($slug));
    }

    /** @return Hasil */
    public function baris(string $slug, array $query): array
    {
        return $this->cache->baca(KunciQuery::buat("dataset.$slug.baris", $query), fn () => $this->sumber->baris($slug, $query));
    }

    /** @return Hasil */
    public function agregat(string $slug, array $query): array
    {
        return $this->cache->baca(KunciQuery::buat("dataset.$slug.agregat", $query), fn () => $this->sumber->agregat($slug, $query));
    }

    /**
     * Gabungan untuk halaman detail (KONTRAK §2.1 catatan 2): `data = {dataset, kolom, baris}`
     * dari tiga panggilan, `meta` = meta baris (page/size/total/has_more). Detail dipanggil lebih
     * dulu supaya slug tak dikenal langsung 404.
     *
     * @return Hasil
     */
    public function halaman(string $slug, array $query): array
    {
        $bagian = [
            'dataset' => $this->dataset($slug),
            'kolom' => $this->kolom($slug),
            'baris' => $this->baris($slug, $query),
        ];

        $data = '{'.implode(',', array_map(
            fn ($nama, $h) => '"'.$nama.'":'.$h['respons']->data,
            array_keys($bagian),
            $bagian,
        )).'}';
        $meta = clone $bagian['baris']['respons']->meta;
        $meta->source = array_values(array_unique(array_merge(...array_map(
            fn ($h) => (array) ($h['respons']->meta->source ?? []),
            array_values($bagian),
        ))));
        $semuaCache = array_reduce($bagian, fn ($ok, $h) => $ok && $h['sumber'] === 'cache', true);

        return ['respons' => new DataApiResponse($data, $meta), 'sumber' => $semuaCache ? 'cache' : 'data_api', 'stale' => false];
    }

    public function ekspor(string $slug, array $query): ResponseInterface
    {
        return $this->sumber->ekspor($slug, $query);
    }
}
