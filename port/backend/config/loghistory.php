<?php

// Log history per request (SPEC §4.5). Seluruh perilaku log ada di App\Shared\LogHistory.
return [
    'aktif' => (bool) env('LOG_HISTORY_AKTIF', true),
    'retensi_hari' => (int) env('LOG_HISTORY_RETENSI_HARI', 180),
    'param_maks' => 2000,

    // Kunci query yang tidak pernah ditulis ke PARAM_RINGKAS.
    'param_rahasia' => ['token', 'api_token', 'access_token', 'password'],
];
