<?php

use App\Features\Atlas\Http\Controllers\AtlasController;
use Illuminate\Support\Facades\Route;

// KONTRAK §2.4: enam subhalaman statis (kelas T). Pertunjukan: varian per tahun.
Route::portal(function () {
    Route::apiGet('atlas/restoran-gci', [AtlasController::class, 'restoranGci'], modul: 'atlas', kelas: 'T')->name('atlas.restoran-gci');
    Route::apiGet('atlas/direktori-restoran', [AtlasController::class, 'direktoriRestoran'], modul: 'atlas', kelas: 'T')->name('atlas.direktori-restoran');
    Route::apiGet('atlas/golf', [AtlasController::class, 'golf'], modul: 'atlas', kelas: 'T')->name('atlas.golf');
    Route::apiGet('atlas/suvenir', [AtlasController::class, 'suvenir'], modul: 'atlas', kelas: 'T')->name('atlas.suvenir');
    Route::apiGet('atlas/hotel', [AtlasController::class, 'hotel'], modul: 'atlas', kelas: 'T')->name('atlas.hotel');
    Route::apiGet('atlas/pertunjukan', [AtlasController::class, 'pertunjukan'], modul: 'atlas', kelas: 'T', varian: [
        [], ['tahun' => '2025'], ['tahun' => '2026'],
    ])->name('atlas.pertunjukan');
});
