<?php

namespace App\Features\Sistem\Http\Controllers;

use App\Features\Sistem\Http\Requests\JobRequest;
use App\Features\Sistem\Http\Resources\AksiResource;
use App\Features\Sistem\Http\Resources\HalamanResource;
use App\Features\Sistem\Services\LogService;
use App\Features\Sistem\Services\SinkronService;
use Illuminate\Http\Request;

final class JobController
{
    public function daftar(JobRequest $r, LogService $layanan): HalamanResource
    {
        return new HalamanResource($layanan->job((int) ($r->validated('page') ?? 1)));
    }

    public function sinkron(Request $r, SinkronService $layanan): AksiResource
    {
        return AksiResource::sinkron($layanan->mulaiDiLatar((string) $r->user()?->name));
    }
}
