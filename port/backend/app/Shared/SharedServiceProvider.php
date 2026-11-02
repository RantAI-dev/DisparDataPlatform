<?php

namespace App\Shared;

use App\Shared\Auth\BuatTokenCommand;
use App\Shared\Cache\OracleDatabaseStore;
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

        // Driver `database` (cache Laravel di Oracle, SPEC §4.6) memakai store yang kompatibel Oracle.
        // Dipasang saat cache manager pertama kali dibuat, bukan di boot(): RouteServiceProvider
        // (lebih dulu di-boot) sudah membuat RateLimiter beserta store cache-nya.
        $this->app->resolving('cache', fn ($cache) => $cache->extend('database', function ($app, array $config) {
            $koneksi = $app['db']->connection($config['connection'] ?? null);
            $store = new OracleDatabaseStore(
                $koneksi,
                $config['table'],
                $config['prefix'] ?? $app['config']['cache.prefix'],
                $config['lock_table'] ?? 'cache_locks',
                $config['lock_lottery'] ?? [2, 100],
                $config['lock_timeout'] ?? 86400,
            );

            return $app['cache']->repository($store->setLockConnection(
                $app['db']->connection($config['lock_connection'] ?? $config['connection'] ?? null)
            ));
        }));
    }

    public function boot(): void
    {
        Routing::daftarkan();

        if ($this->app->runningInConsole()) {
            $this->commands([BuatTokenCommand::class]);
        }
    }
}
