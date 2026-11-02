<?php

use App\Features\Dataset\Http\Controllers\DatasetController;
use Illuminate\Support\Facades\Route;

// KONTRAK §2.1. Katalog kelas T (snapshot, varian = tier yang dipakai /katalog dan /sdi), lainnya P,
// ekspor S. `halaman` hanya ada di Laravel (gabungan detail + kolom + baris).
Route::portal(function () {
    Route::apiGet('katalog', [DatasetController::class, 'katalog'], modul: 'dataset', kelas: 'T', varian: [
        ['tier' => 'semua'], ['tier' => 'primer'],
    ])->name('dataset.katalog');

    Route::prefix('dataset/{slug}')->where(['slug' => '[a-z0-9][a-z0-9-]*'])->group(function () {
        Route::apiGet('', [DatasetController::class, 'detail'], modul: 'dataset', kelas: 'P')->name('dataset.detail');
        Route::apiGet('kolom', [DatasetController::class, 'kolom'], modul: 'dataset', kelas: 'P')->name('dataset.kolom');
        Route::apiGet('facet', [DatasetController::class, 'facet'], modul: 'dataset', kelas: 'P')->name('dataset.facet');
        Route::apiGet('baris', [DatasetController::class, 'baris'], modul: 'dataset', kelas: 'P')->name('dataset.baris');
        Route::apiGet('agregat', [DatasetController::class, 'agregat'], modul: 'dataset', kelas: 'P')->name('dataset.agregat');
        Route::apiGet('halaman', [DatasetController::class, 'halaman'], modul: 'dataset', kelas: 'P')->name('dataset.halaman');
        Route::apiGet('ekspor', [DatasetController::class, 'ekspor'], modul: 'dataset', kelas: 'S')->name('dataset.ekspor');
    });
});
