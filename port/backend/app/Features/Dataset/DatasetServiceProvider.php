<?php

namespace App\Features\Dataset;

use App\Features\Dataset\Contracts\DatasetSource;
use App\Features\Dataset\Sources\DataApiDatasetSource;
use Illuminate\Support\ServiceProvider;

final class DatasetServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(DatasetSource::class, DataApiDatasetSource::class);
    }

    public function boot(): void
    {
        $this->loadRoutesFrom(__DIR__.'/routes.php');
    }
}
