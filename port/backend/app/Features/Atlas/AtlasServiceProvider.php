<?php

namespace App\Features\Atlas;

use App\Features\Atlas\Contracts\AtlasSource;
use App\Features\Atlas\Sources\DataApiAtlasSource;
use Illuminate\Support\ServiceProvider;

final class AtlasServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(AtlasSource::class, DataApiAtlasSource::class);
    }

    public function boot(): void
    {
        $this->loadRoutesFrom(__DIR__.'/routes.php');
    }
}
