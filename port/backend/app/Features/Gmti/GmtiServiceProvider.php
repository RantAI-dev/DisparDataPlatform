<?php

namespace App\Features\Gmti;

use App\Features\Gmti\Contracts\GmtiSource;
use App\Features\Gmti\Sources\DataApiGmtiSource;
use Illuminate\Support\ServiceProvider;

final class GmtiServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(GmtiSource::class, DataApiGmtiSource::class);
    }

    public function boot(): void
    {
        $this->loadRoutesFrom(__DIR__.'/routes.php');
    }
}
