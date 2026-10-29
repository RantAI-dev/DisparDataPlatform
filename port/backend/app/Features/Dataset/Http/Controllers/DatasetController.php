<?php

namespace App\Features\Dataset\Http\Controllers;

use App\Features\Dataset\Http\Requests\AgregatRequest;
use App\Features\Dataset\Http\Requests\BarisRequest;
use App\Features\Dataset\Http\Requests\EksporRequest;
use App\Features\Dataset\Http\Requests\HalamanRequest;
use App\Features\Dataset\Http\Requests\KatalogRequest;
use App\Features\Dataset\Http\Resources\DatasetResource;
use App\Features\Dataset\Http\Resources\EksporResource;
use App\Features\Dataset\Services\DatasetService;

final class DatasetController
{
    public function __construct(private readonly DatasetService $layanan) {}

    public function katalog(KatalogRequest $r): DatasetResource
    {
        return new DatasetResource($this->layanan->katalog($r->untukDataApi()));
    }

    public function detail(string $slug): DatasetResource
    {
        return new DatasetResource($this->layanan->dataset($slug));
    }

    public function kolom(string $slug): DatasetResource
    {
        return new DatasetResource($this->layanan->kolom($slug));
    }

    public function facet(string $slug): DatasetResource
    {
        return new DatasetResource($this->layanan->facet($slug));
    }

    public function baris(BarisRequest $r, string $slug): DatasetResource
    {
        return new DatasetResource($this->layanan->baris($slug, $r->untukDataApi()));
    }

    public function agregat(AgregatRequest $r, string $slug): DatasetResource
    {
        return new DatasetResource($this->layanan->agregat($slug, $r->untukDataApi()));
    }

    public function halaman(HalamanRequest $r, string $slug): DatasetResource
    {
        return new DatasetResource($this->layanan->halaman($slug, $r->untukDataApi()));
    }

    public function ekspor(EksporRequest $r, string $slug): EksporResource
    {
        return new EksporResource($this->layanan->ekspor($slug, $r->untukDataApi()));
    }
}
