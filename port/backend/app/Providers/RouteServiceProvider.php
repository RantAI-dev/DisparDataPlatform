<?php

namespace App\Providers;

use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Foundation\Support\Providers\RouteServiceProvider as ServiceProvider;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Facades\Route;

class RouteServiceProvider extends ServiceProvider
{
    /**
     * The path to your application's "home" route.
     *
     * Typically, users are redirected here after authentication.
     *
     * @var string
     */
    public const HOME = '/home';

    /**
     * Define your route model bindings, pattern filters, and other route configuration.
     */
    public function boot(): void
    {
        // throttle:api per klien + IP (SPEC §4.4). Throttle berjalan sebelum auth:sanctum,
        // jadi klien dibaca langsung dari guard sanctum.
        RateLimiter::for('api', function (Request $request) {
            $klien = auth('sanctum')->user()?->name ?? 'anon';

            return Limit::perMinute((int) config('portal.batas_per_menit'))->by($klien.'|'.$request->ip());
        });

        // Rute /api/v1 milik tiap fitur, dimuat <Fitur>ServiceProvider lewat Route::portal().
        $this->routes(function () {

            Route::middleware('web')
                ->group(base_path('routes/web.php'));
        });
    }
}
