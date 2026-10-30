<?php

use App\Features\Dashboard\Http\Controllers\DashboardController;
use Illuminate\Support\Facades\Route;

// KONTRAK §2.2. Kelas sama dengan DashboardService::KELAS; varian = parameter tetap untuk sinkron.
Route::portal(function () {
    Route::apiGet('dashboard/ringkasan', [DashboardController::class, 'ringkasan'], modul: 'dashboard', kelas: 'T')->name('dashboard.ringkasan');
    Route::apiGet('dashboard/wisman/tahunan', [DashboardController::class, 'wismanTahunan'], modul: 'dashboard', kelas: 'T')->name('dashboard.wisman.tahunan');
    Route::apiGet('dashboard/wisman/bulanan', [DashboardController::class, 'wismanBulanan'], modul: 'dashboard', kelas: 'T')->name('dashboard.wisman.bulanan');
    Route::apiGet('dashboard/wisman/kebangsaan', [DashboardController::class, 'wismanKebangsaan'], modul: 'dashboard', kelas: 'P')->name('dashboard.wisman.kebangsaan');
    Route::apiGet('dashboard/wisman/pintu-masuk', [DashboardController::class, 'wismanPintuMasuk'], modul: 'dashboard', kelas: 'P')->name('dashboard.wisman.pintu-masuk');
    Route::apiGet('dashboard/lama-menginap/rata-rata', [DashboardController::class, 'lamaMenginapRataRata'], modul: 'dashboard', kelas: 'T')->name('dashboard.lama-menginap.rata-rata');
    Route::apiGet('dashboard/lama-menginap/per-kelas', [DashboardController::class, 'lamaMenginapPerKelas'], modul: 'dashboard', kelas: 'P')->name('dashboard.lama-menginap.per-kelas');
    Route::apiGet('dashboard/lama-menginap/seri', [DashboardController::class, 'lamaMenginapSeri'], modul: 'dashboard', kelas: 'T', varian: [['tamu' => 'wisman'], ['tamu' => 'wisnus']])->name('dashboard.lama-menginap.seri');
    Route::apiGet('dashboard/wisnus/meta', [DashboardController::class, 'wisnusMeta'], modul: 'dashboard', kelas: 'T')->name('dashboard.wisnus.meta');
    Route::apiGet('dashboard/wisnus/tahunan', [DashboardController::class, 'wisnusTahunan'], modul: 'dashboard', kelas: 'P')->name('dashboard.wisnus.tahunan');
    Route::apiGet('dashboard/wisnus/per-kota', [DashboardController::class, 'wisnusPerKota'], modul: 'dashboard', kelas: 'P')->name('dashboard.wisnus.per-kota');
    Route::apiGet('dashboard/wisnus/bulanan', [DashboardController::class, 'wisnusBulanan'], modul: 'dashboard', kelas: 'P')->name('dashboard.wisnus.bulanan');
    Route::apiGet('dashboard/wisnus/yoy', [DashboardController::class, 'wisnusYoy'], modul: 'dashboard', kelas: 'P')->name('dashboard.wisnus.yoy');
    Route::apiGet('dashboard/destinasi/meta', [DashboardController::class, 'destinasiMeta'], modul: 'dashboard', kelas: 'T', varian: [['jenis' => 'wisnus'], ['jenis' => 'wisman']])->name('dashboard.destinasi.meta');
    Route::apiGet('dashboard/destinasi/ringkasan', [DashboardController::class, 'destinasiRingkasan'], modul: 'dashboard', kelas: 'P')->name('dashboard.destinasi.ringkasan');
    Route::apiGet('dashboard/destinasi/per-destinasi', [DashboardController::class, 'destinasiPerDestinasi'], modul: 'dashboard', kelas: 'P')->name('dashboard.destinasi.per-destinasi');
    Route::apiGet('dashboard/destinasi/bulanan', [DashboardController::class, 'destinasiBulanan'], modul: 'dashboard', kelas: 'P')->name('dashboard.destinasi.bulanan');
    Route::apiGet('dashboard/tenaga-kerja/dki', [DashboardController::class, 'tenagaKerjaDki'], modul: 'dashboard', kelas: 'T')->name('dashboard.tenaga-kerja.dki');
    Route::apiGet('dashboard/tenaga-kerja/subsektor', [DashboardController::class, 'tenagaKerjaSubsektor'], modul: 'dashboard', kelas: 'P')->name('dashboard.tenaga-kerja.subsektor');
    Route::apiGet('dashboard/tenaga-kerja/sertifikasi', [DashboardController::class, 'tenagaKerjaSertifikasi'], modul: 'dashboard', kelas: 'T')->name('dashboard.tenaga-kerja.sertifikasi');
    Route::apiGet('dashboard/pdrb-ekraf/makro', [DashboardController::class, 'pdrbMakro'], modul: 'dashboard', kelas: 'T')->name('dashboard.pdrb-ekraf.makro');
    Route::apiGet('dashboard/pdrb-ekraf/subsektor/sebaran', [DashboardController::class, 'pdrbSebaran'], modul: 'dashboard', kelas: 'P')->name('dashboard.pdrb-ekraf.subsektor.sebaran');
    Route::apiGet('dashboard/pdrb-ekraf/subsektor/pertumbuhan', [DashboardController::class, 'pdrbPertumbuhan'], modul: 'dashboard', kelas: 'P')->name('dashboard.pdrb-ekraf.subsektor.pertumbuhan');
});
