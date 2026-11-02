<?php

// Pengaturan umum portal yang tidak milik satu modul.
return [
    'versi' => env('PORTAL_VERSI', 'dev'),

    // Alamat server Nuxt yang dipercaya meneruskan X-Forwarded-For (SPEC §4.4, IP asli).
    'proxy_tepercaya' => array_values(array_filter(array_map(
        'trim',
        explode(',', (string) env('PORTAL_PROXY_TEPERCAYA', '127.0.0.1'))
    ))),

    // throttle:api per klien + IP.
    'batas_per_menit' => (int) env('PORTAL_BATAS_PER_MENIT', 120),

    // Snapshot kelas T (SPEC §4.6): lebih tua dari ini → meta.stale = true.
    'snapshot_basi_jam' => (int) env('PORTAL_SNAPSHOT_BASI_JAM', 36),

    // Cache endpoint kelas P (SPEC §4.6: 5–60 menit).
    'cache_menit' => (int) env('PORTAL_CACHE_MENIT', 15),

    // Jam job portal:sinkron (WIB), dipakai plan 16.
    'jam_sinkron' => env('PORTAL_JAM_SINKRON', '11:00'),
];
