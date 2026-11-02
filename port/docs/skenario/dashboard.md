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
