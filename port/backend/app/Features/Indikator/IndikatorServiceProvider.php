<?php

namespace App\Features\Indikator;

use App\Features\Indikator\Contracts\IndikatorSource;
use App\Features\Indikator\Sources\DataApiIndikatorSource;
use Illuminate\Support\ServiceProvider;

final class IndikatorServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(IndikatorSource::class, DataApiIndikatorSource::class);
    }

    public function boot(): void
    {
        $this->loadRoutesFrom(__DIR__.'/routes.php');
    }
}
