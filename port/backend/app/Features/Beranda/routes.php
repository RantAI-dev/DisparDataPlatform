<?php

use App\Features\Beranda\Http\Controllers\RingkasanController;
use Illuminate\Support\Facades\Route;

// KONTRAK §2.6.
Route::portal(function () {
    Route::apiGet('beranda/ringkasan', RingkasanController::class, modul: 'beranda', kelas: 'T')->name('beranda.ringkasan');
});
