# Skenario fitur dashboard (plan 12)

Satu tes per ID, nama tes diawali ID-nya. Pola: `docs/pola-fitur.md`. Sumber tampilan: v2 yang tayang
(`464fc15`): `app/dashboard/**`, `components/dashboard/*`.

## Backend — Pest Feature (`backend/tests/Feature/Dashboard`)

| ID | Skenario |
|---|---|
| DB-B01 | Ke-23 endpoint KONTRAK §2.2 diteruskan dengan `data` byte-identik (fixture rekaman) |
| DB-B02 | Kelas T (mis. `lama-menginap/seri`) dari snapshot, kelas P (mis. `wisman/kebangsaan`) dari cache; urutan parameter tidak membuat entri ganda |
| DB-B03 | Parameter di luar kontrak → 422 tanpa memanggil Data API (`tamu`/`jenis` wajib atau tak dikenal, tahun/periode salah bentuk, `top` > 50) |
| DB-B04 | Data API mati → 503 `UPSTREAM_UNAVAILABLE` |
| DB-B05 | LOG_HISTORY: modul `dashboard`, aksi = nama rute, sumber |
| DB-B06 | Tanpa token → 401 |
| DB-B07 | Parameter di luar kontrak endpoint (mis. `top` di pintu-masuk, `tahun` di destinasi/bulanan) tidak diteruskan ke Data API |

## Frontend — Vitest (`frontend/tests/nuxt/dashboard.spec.ts`)

| ID | Skenario |
|---|---|
| DB-F01 | `useDashboard`: kebangsaan selalu `top=8`; kota/destinasi kosong tidak dikirim |

## E2E — Playwright (`frontend/tests/e2e/dashboard.spec.ts`)

| ID | Skenario |
|---|---|
| DB-E01 | `/dashboard`: KPI ringkasan ("Rp 411 T", quirk Q3) dan kartu menu → PDRB ("Rp 410,6 T") |
| DB-E02 | Wisman: toggle tahun (kebangsaan + pintu masuk), pilih bulan (KPI bulan, pintu bulanan BPS), semester belum dirilis |
| DB-E03 | Wisnus: filter kota tujuan |
| DB-E04 | Tenaga kerja: pilih tahun subsektor |
| DB-E05 | PDRB: toggle sebaran dan pertumbuhan dengan periode berbeda |
| DB-E06 | Perbesar grafik: modal, Esc menutup |

## Paritas (`frontend/tests/parity/dashboard.spec.ts`)

| ID | Halaman |
|---|---|
| DB-P01 | `/dashboard` |
| DB-P02 | `/dashboard/wisman` |
| DB-P03 | `/dashboard/wisnus` |
| DB-P04 | `/dashboard/tenaga-kerja` |
| DB-P05 | `/dashboard/pdrb-ekraf` |

### Paritas interaksi dan ekspor (`frontend/tests/parity/{interaksi,ekspor}.spec.ts`)

| ID | Halaman | Langkah |
|---|---|---|
| IX-P02 | `/dashboard/wisman` | tahun 2024 lalu bulan Mei (DB-E02) |
| IX-P03 | `/dashboard/wisnus` | filter kota tujuan (DB-E03) |
| IX-P04 | `/dashboard/tenaga-kerja` | tahun subsektor 2022 (DB-E04) |
| IX-P05 | `/dashboard/pdrb-ekraf` | modal Perbesar grafik (DB-E06) |
| IX-P15 | `/dashboard/pdrb-ekraf` | sebaran subsektor 2022 (DB-E05) |
| IX-P16 | `/dashboard/wisman` | bulan 2025-03: pintu masuk semesteran (DB-E02) |
| IX-P34 | `/dashboard/wisman` | modal Perbesar grafik pertama (WismanStat) |
| IX-P35 | `/dashboard/wisman` | modal Perbesar "Per kelas hotel" (LosByClass; wisnus memakai komponen sama) |
| IX-P36 | `/dashboard/wisman` | modal Perbesar "per destinasi" (DestinasiStat; wisnus memakai komponen sama) |
| IX-P37 | `/dashboard/wisnus` | modal Perbesar grafik pertama (WisnusStat) |
| IX-P38 | `/dashboard/tenaga-kerja` | modal Perbesar grafik pertama |
