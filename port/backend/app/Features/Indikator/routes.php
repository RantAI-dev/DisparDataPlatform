<?php

use App\Features\Indikator\Http\Controllers\IndikatorController;
use Illuminate\Support\Facades\Route;

// KONTRAK §2.3. Detail: varian = 28 kode indikator (sinkron plan 16).
Route::portal(function () {
    $fw = [['framework' => 'GCI'], ['framework' => 'GPCI']];
    Route::apiGet('indikator', [IndikatorController::class, 'daftar'], modul: 'indikator', kelas: 'T', varian: $fw)->name('indikator.daftar');
    Route::apiGet('indikator/{code}', [IndikatorController::class, 'detail'], modul: 'indikator', kelas: 'T', varian: [['code' => 'CE1'], ['code' => 'CE2'], ['code' => 'CE3'], ['code' => 'CE4'], ['code' => 'BA-MICE'], ['code' => 'CE5'], ['code' => 'CE6'], ['code' => 'HC-VISA'], ['code' => 'CI-IC'], ['code' => 'CI-CE'], ['code' => 'CI-CX'], ['code' => 'CI-AM'], ['code' => 'CI-TA'], ['code' => 'CI-WH'], ['code' => 'CI-NL'], ['code' => 'CI-TH'], ['code' => 'CI-MU'], ['code' => 'CI-ST'], ['code' => 'CI-HR'], ['code' => 'CI-LH'], ['code' => 'CI-SH'], ['code' => 'CI-DI'], ['code' => 'CI-FR'], ['code' => 'CI-FV'], ['code' => 'AC-DF'], ['code' => 'AC-AP'], ['code' => 'AC-AR'], ['code' => 'AC-TT']])
        ->where('code', '[A-Za-z0-9-]+')->name('indikator.detail');
    Route::apiGet('gci/resmi', [IndikatorController::class, 'gciResmi'], modul: 'indikator', kelas: 'T')->name('indikator.gci-resmi');
    Route::apiGet('dataset-tematik', [IndikatorController::class, 'datasetTematik'], modul: 'indikator', kelas: 'T', varian: $fw)->name('indikator.dataset-tematik');
    Route::apiGet('pariwisata/wisatawan-internasional', [IndikatorController::class, 'wisatawanInternasional'], modul: 'indikator', kelas: 'T')
        ->name('indikator.wisatawan-internasional');
    Route::apiGet('pariwisata/kuliner-michelin', [IndikatorController::class, 'kulinerMichelin'], modul: 'indikator', kelas: 'T')
        ->name('indikator.kuliner-michelin');
    Route::apiGet('pariwisata/seni-pertunjukan', [IndikatorController::class, 'seniPertunjukan'], modul: 'indikator', kelas: 'P')
        ->name('indikator.seni-pertunjukan');
});
