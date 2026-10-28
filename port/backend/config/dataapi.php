<?php

// Klien Data API (SPEC §4.4, §4.6). Satu-satunya tempat env DATA_API_* dibaca.
return [
    'url' => rtrim((string) env('DATA_API_URL', 'http://localhost:8080'), '/'),
    'token' => env('DATA_API_TOKEN', ''),

    // Klien biasa: timeout per percobaan, dan jumlah ulang untuk 5xx/timeout saja.
    'timeout' => (int) env('DATA_API_TIMEOUT', 10),
    'retry' => (int) env('DATA_API_RETRY', 2),
    'retry_jeda_ms' => (int) env('DATA_API_RETRY_JEDA_MS', 200),

    // Cek kesehatan (rute publik): singkat dan tanpa retry, supaya tidak menahan worker.
    'timeout_kesehatan' => (int) env('DATA_API_TIMEOUT_KESEHATAN', 3),

    // Klien ekspor (aliran): tanpa retry.
    'timeout_stream' => (int) env('DATA_API_TIMEOUT_STREAM', 300),
];
