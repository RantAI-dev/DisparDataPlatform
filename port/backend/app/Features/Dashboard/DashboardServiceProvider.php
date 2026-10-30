<?php

namespace App\Features\Dashboard;

use App\Features\Dashboard\Contracts\DashboardSource;
use App\Features\Dashboard\Sources\DataApiDashboardSource;
use Illuminate\Support\ServiceProvider;

final class DashboardServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        $this->app->bind(DashboardSource::class, DataApiDashboardSource::class);
    }

    public function boot(): void
    {
        $this->loadRoutesFrom(__DIR__.'/routes.php');
    }
}
