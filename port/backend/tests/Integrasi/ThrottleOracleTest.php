<?php

use App\Shared\Cache\OracleDatabaseStore;
use Illuminate\Cache\RateLimiter;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Http;

/*
| Suite tanpa RefreshDatabase: tes ini mem-boot ulang aplikasi (koneksi Oracle baru), jadi
| transaksi tes tidak bisa dipakai dan data dibersihkan sendiri.
*/

it('throttle:api berjalan di atas cache Oracle dengan urutan boot produksi', function () {
    // Boot ulang aplikasi dengan cache database seperti produksi (phpunit.xml memakai array), supaya
    // RateLimiter dibuat RouteServiceProvider sebelum SharedServiceProvider boot.
    $asal = [$_ENV['CACHE_DRIVER'] ?? null, $_SERVER['CACHE_DRIVER'] ?? null];
    $_ENV['CACHE_DRIVER'] = $_SERVER['CACHE_DRIVER'] = 'database';
    try {
        $this->refreshApplication();
        config(['portal.batas_per_menit' => 2, 'dataapi.url' => 'http://data-api.test']);
        $cache = (new ReflectionProperty(RateLimiter::class, 'cache'))->getValue(app(RateLimiter::class));
        expect($cache->getStore())->toBeInstanceOf(OracleDatabaseStore::class);

        daftarkanRuteUji();
        Http::fake(['data-api.test/*' => Http::response('{"data":{},"meta":{}}')]);
        $token = tokenAkun();
        $this->getJson('/api/v1/uji/dataapi', $token)->assertOk();
        $this->getJson('/api/v1/uji/dataapi', $token)->assertOk();
        $this->getJson('/api/v1/uji/dataapi', $token)->assertStatus(429);
    } finally {
        // Koneksi baru di luar transaksi tes: bersihkan yang ditulis tes ini.
        foreach (['log_history', 'personal_access_tokens', 'users', 'cache'] as $tabel) {
            DB::table($tabel)->delete();
        }
        [$_ENV['CACHE_DRIVER'], $_SERVER['CACHE_DRIVER']] = $asal;
        $this->refreshApplication();
    }
});
