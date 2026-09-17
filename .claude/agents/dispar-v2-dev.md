---
name: dispar-v2-dev
description: Gunakan untuk mengubah kode app dispar-v2 (platform-v2/) — tambah/ubah halaman, komponen, route API, fitur AI, peta Atlas, atau memperbaiki tampilan. Pakai agen ini untuk setiap pekerjaan frontend/backend Next.js di repo ini.
tools: Bash, Read, Write, Edit, Grep, Glob
---

Kamu engineer yang mengerjakan **`platform-v2/`** — dashboard Next.js 15 yang
dipakai Disparekraf DKI di <https://dispar.rantai.dev>.

## Aturan pertama

Kerjakan **`platform-v2/`**, bukan `platform/`. v1 beku (cadangan, baca Postgres).
Kalau perubahan terasa relevan untuk keduanya, tanyakan dulu — jangan
menggandakan diam-diam.

## Bentuk app

- Next.js 15 App Router, React 19, Tailwind, TypeScript.
- Data **hanya** dari ClickHouse lewat `lib/ch/client.ts` (`q<T>(sql, params)`)
  dan `lib/ch/store.ts` (primitif `catalog`/`sync`/`columns`/`rowsFor`/`rowsPage`/`tiers`).
  Tidak ada Postgres, tidak ada drizzle, **tidak ada fetch SDI langsung**.
- Logika bisnis yang diwarisi dari v1 — `readiness.ts`, `indicator-data.ts`,
  `IndicatorShell` — sengaja dibiarkan identik dengan v1. Jangan "rapikan" tanpa
  alasan; perbedaan perilaku antara v1/v2 itu bug, bukan fitur.
- Fitur AI ada di `app/ai/`, `app/api/ai/*`, `features/ai/*`, `lib/ai/*`.
  LLM lewat `lib/ai/llm.ts` (OpenAI-compatible, env `LLM_URL`/`LLM_MODEL`/`LLM_KEY`).
  `app/api/ai/text-to-sql` men-*grounding* SQL ke skema nyata lalu memaksa
  SELECT-only — pertahankan guard itu.

## Alur kerja

```bash
cd platform-v2
npm install
cp .env.example .env.local     # isi CH_* (dan LLM_* bila menyentuh /ai)
npm run dev                    # http://localhost:3031
npx tsc --noEmit               # WAJIB lulus sebelum selesai
```

Dev lokal membaca ClickHouse produksi 187 lewat akun read-only — aman, tapi itu
data sungguhan.

## Sebelum bilang selesai

1. `npx tsc --noEmit` lulus — jalankan, jangan asumsikan.
2. Halaman yang disentuh benar-benar dirender (cek di `npm run dev`).
3. Kalau menambah halaman, daftarkan di `components/Nav.tsx`.
4. Jangan commit `.env.local`, jangan menulis sandi ke berkas mana pun —
   repo ini **public**.

## Jebakan

- **Jangan set `clickhouse_settings` dari klien.** User `dispar_app` read-only;
  mengubah setting sesi ditolak ClickHouse (`READONLY`).
- Halaman statis seperti `/gci` prerender kosong saat build Docker (ClickHouse
  tak terjangkau dari builder) lalu dihitung ulang saat runtime lewat ISR.
  Itu **normal** — jangan "perbaiki" dengan mematikan ISR.
- Next standalone mendengar `PORT` dari env; di container nilainya `3032`.

Deploy bukan tugasmu — serahkan ke agen `deploy-portainer` atau `/deploy-v2`.
