<?php

use App\Features\Sistem\Http\Controllers\CacheController;
use App\Features\Sistem\Http\Controllers\JobController;
use App\Features\Sistem\Http\Controllers\KesehatanController;
use App\Features\Sistem\Http\Controllers\LogController;
use App\Shared\Auth\Ability;
use Illuminate\Support\Facades\Route;

// KONTRAK §2.7: rute sistem hanya ada di Laravel. Kesehatan publik (tanpa token); sisanya ability admin.
Route::portal(function () {
    Route::apiGet('sistem/kesehatan', KesehatanController::class, modul: 'sistem', kelas: 'P', ability: null)
        ->name('sistem.kesehatan');
    Route::apiGet('sistem/log', LogController::class, modul: 'sistem', kelas: 'P', ability: Ability::ADMIN)
        ->name('sistem.log');
    Route::apiGet('sistem/job', [JobController::class, 'daftar'], modul: 'sistem', kelas: 'P', ability: Ability::ADMIN)
        ->name('sistem.job');
    Route::apiPost('sistem/job/sinkron', [JobController::class, 'sinkron'], modul: 'sistem', kelas: 'P', ability: Ability::ADMIN)
        ->name('sistem.job.sinkron');
    Route::apiPost('sistem/cache/kosongkan', CacheController::class, modul: 'sistem', kelas: 'P', ability: Ability::ADMIN)
        ->name('sistem.cache.kosongkan');
});
