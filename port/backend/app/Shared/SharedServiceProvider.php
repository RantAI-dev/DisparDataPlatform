<?php

namespace App\Shared;

use App\Shared\Auth\BuatTokenCommand;
use App\Shared\LogHistory\LogContext;
use App\Shared\Support\Routing;
use Illuminate\Support\ServiceProvider;

/** Bagian bersama portal: konteks request, makro rute, perintah artisan. */
final class SharedServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Satu konteks per request (dan per job).
        $this->app->scoped(LogContext::class);
    }

    public function boot(): void
    {
        Routing::daftarkan();

        if ($this->app->runningInConsole()) {
            $this->commands([BuatTokenCommand::class]);
        }
    }
}
