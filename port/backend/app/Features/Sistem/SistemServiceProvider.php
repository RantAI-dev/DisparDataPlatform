<?php

namespace App\Features\Sistem;

use App\Features\Sistem\Contracts\SistemSource;
use App\Features\Sistem\Sources\DataApiSistemSource;
use Illuminate\Support\ServiceProvider;

final class SistemServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(SistemSource::class, DataApiSistemSource::class);
    }

    public function boot(): void
    {
        $this->loadRoutesFrom(__DIR__.'/routes.php');
    }
}
