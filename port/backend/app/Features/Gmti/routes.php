<?php

use App\Features\Gmti\Http\Controllers\GmtiController;
use Illuminate\Support\Facades\Route;

// KONTRAK §2.5. Ringkasan, spasial, dan hotel-scraped kelas T; daftar tempat dan detail titik P.
Route::portal(function () {
    Route::apiGet('gmti/ringkasan', [GmtiController::class, 'ringkasan'], modul: 'gmti', kelas: 'T')->name('gmti.ringkasan');
    Route::apiGet('gmti/tempat', [GmtiController::class, 'tempat'], modul: 'gmti', kelas: 'P')->name('gmti.tempat');
    Route::apiGet('spasial', [GmtiController::class, 'spasial'], modul: 'spasial', kelas: 'T')->name('spasial.index');
    Route::apiGet('spasial/titik/{id}', [GmtiController::class, 'titik'], modul: 'spasial', kelas: 'P')
        ->where('id', '[A-Za-z0-9][A-Za-z0-9_.:-]*')->name('spasial.titik');
    Route::apiGet('hotel-scraped', [GmtiController::class, 'hotelScraped'], modul: 'hotel-scraped', kelas: 'T')->name('hotel-scraped');
});
