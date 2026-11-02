<?php

namespace App\Features\Beranda;

use App\Features\Beranda\Contracts\BerandaSource;
use App\Features\Beranda\Sources\DataApiBerandaSource;
use Illuminate\Support\ServiceProvider;

final class BerandaServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(BerandaSource::class, DataApiBerandaSource::class);
    }

    public function boot(): void
    {
        $this->loadRoutesFrom(__DIR__.'/routes.php');
    }
}
