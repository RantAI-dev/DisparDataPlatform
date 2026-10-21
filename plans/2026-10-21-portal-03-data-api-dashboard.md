# Plan 03 — Data API: dashboard (needs 02)

Repo: ini. Branch `feat/data-api-dashboard`.
Commit: `feat(data-api): endpoint dashboard wisman wisnus tenaga kerja pdrb`.

## Hasil akhir

`data_api/features/dashboard/` mengimplementasikan semua endpoint KONTRAK §2.2. Angkanya identik
dengan yang dirender `/dashboard/*` di Next.js `6b858eb`.

## Sumber logika yang diporting (inventaris B)

| Logika | Lokasi asal |
|---|---|
| SQL | `lib/dashboard/data.ts`, B §1.1–1.7. Salin SQL apa adanya, termasuk `avg(rata_rata)` |
| Agregasi klien wisman | `WismanStat.tsx`, B §3.2: total tahunan, `n_bulan`, parsial, YoY, top-8 + "Lainnya", pemilihan semester/BPS untuk pintu masuk |
| Agregasi klien wisnus | `WisnusStat.tsx`, B §4.2. Pertahankan Q15 (per-kota dan "tujuan teratas" mengabaikan filter kota) dan Q16 (YoY hanya bila himpunan kota sama) |
| Tenaga kerja | `tenaga-kerja/page.tsx` + `TkSubsektor`, B §5.1. Q11: urutan bidang mengikuti urutan kemunculan; tetapkan deterministik dengan meniru urutan yang tayang hari itu dan tulis urutannya di tes |
| PDRB | `PdrbEkrafStat.tsx`, B §6.1, dari `bronze_file.pdrb_ekraf_*` dan `target_kontribusi_ekraf_rpjmd` |

## Aturan

- **Quirk ditiru** (SPEC K-10): Q2, Q3 (dua pembulatan berbeda; kirim nilai mentah, format di
  frontend), Q7, Q8, Q10, Q12, Q15, Q16, Q18, Q20, Q21.
  - Q21: error ClickHouse menghasilkan `data` kosong + `meta.peringatan`, **bukan** 5xx. Ini
    menjaga perilaku "Tidak ada data." Catat pilihan ini di `x-catatan` OpenAPI.
- `TARGET_WISMAN`: bandingkan `bronze_file.target_wisman` dengan konstanta di
  `lib/dashboard/data.ts:11-18` **dan** `WismanDashboard.tsx:33-40`. Bila salah satu berbeda:
  STOP.
- Q4 "Fesyen" abu-abu: frontend yang mewarnai, dan alias `fesyen` **tidak** ditambah (tiru).
- Endpoint kelas T dihitung dengan satu query per endpoint bila memungkinkan, lalu diolah di
  `service.py`. Lama respons diukur di tes panggung.

## Test

- **Unit:** setiap fungsi agregasi di `service.py` diuji dengan fixture kecil buatan. Wajib ada
  kasus:
  - bulan bolong (Q8);
  - tahun parsial;
  - "Lainnya" dari sumber digabung ke "Lainnya";
  - kota tidak lengkap di salah satu bulan (Q16);
  - `jenis_tamu` tak dikenal (Q18);
  - semester belum dirilis → item kosong.
- **Mutation check:** coder mematahkan aturan Q16 dan menunjukkan tes gagal.
- **Contract:** semua endpoint divalidasi terhadap `openapi.yaml`.
- **Panggung:** setiap endpoint dibandingkan dengan golden live plan 01 pada saat yang sama, dan
  harus sama persis. Tempel ringkasan (endpoint, jumlah item, sama/beda) di PR.

## Gate lokal

```bash
cd lakehouse/data-api && uv run --extra dev ruff check . && uv run --extra dev pytest -q
uv run --extra dev pytest -q -m panggung -k dashboard
```

## Kriteria selesai

1. Semua endpoint KONTRAK §2.2 ada dan lulus kontrak.
2. Panggung: 100% sama dengan golden live.
3. Waktu respons p95 setiap endpoint ≤ 2 detik tanpa cache (diukur di panggung dan ditulis di
   PR).

## STOP

- `TARGET_WISMAN` berbeda antar sumber.
- Golden live berbeda dan sebabnya bukan perubahan data di antara dua panggilan.

## Bukan cakupan

Mengubah sumber ke `konform` (batch 3). Frontend.
