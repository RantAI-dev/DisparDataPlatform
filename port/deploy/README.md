# deploy/

Kosong sampai plan 19. Isinya nanti (SPEC §9): Dockerfile `backend` (php-fpm + nginx + Oracle
Instant Client), Dockerfile `frontend` (Node 20, `.output`), `compose.yaml` contoh, dan
`.env.example` berisi placeholder saja. Cara deploy di server Kominfo belum diketahui, jadi paket
dibuat netral (container atau bare metal).

Catatan untuk plan 19: `PORTAL_PROXY_TEPERCAYA` harus memuat alamat server Nuxt dan semua reverse
proxy/LB di depannya, supaya LOG_HISTORY mencatat IP pengunjung, bukan IP LB (ADR 0001).

Untuk pengembangan lokal pakai `../compose.dev.yaml`, bukan isi folder ini.
