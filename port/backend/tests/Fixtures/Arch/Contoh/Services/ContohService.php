<?php

namespace App\Features\Contoh\Services;

use App\Features\Sistem\Services\KesehatanService;
use App\Shared\DataApi\DataApiClient;
use Illuminate\Support\Facades\DB;

/**
 * FITUR PALSU untuk tes mutasi arsitektur (tests/Arch). Sengaja melanggar aturan SPEC §4.3:
 * memakai fitur lain (1), DataApiClient di luar Sources (4), DB di fitur (5), env() (7).
 * Hanya dimuat lewat autoload-dev; tidak pernah ada di app/.
 */
final class ContohService
{
    public function __construct(
        private readonly KesehatanService $lain,
        private readonly DataApiClient $dataApi,
    ) {}

    public function jalan(): mixed
    {
        return [DB::table('users')->count(), env('APP_NAME')];
    }
}
