<?php

use App\Features\Sistem\Http\Controllers\KesehatanController;
use Illuminate\Support\Facades\Route;

// KONTRAK §2.7: rute sistem hanya ada di Laravel. Kesehatan publik (tanpa token).
Route::portal(function () {
    Route::apiGet('sistem/kesehatan', KesehatanController::class, modul: 'sistem', kelas: 'P', ability: null)
        ->name('sistem.kesehatan');
});
