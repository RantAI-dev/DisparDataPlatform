# Platform Data Dispar — app v2 (lakehouse)

Dashboard data terkonsolidasi Dinas Pariwisata & Ekonomi Kreatif DKI Jakarta.
**Inilah app yang LIVE** di <https://dispar.rantai.dev>.

v2 adalah duplikat persis app v1 (`../platform/`) — halaman dan tema identik.
Yang ditukar **hanya lapisan data**: Postgres/drizzle → **ClickHouse** lewat
`lib/ch/store.ts`. Logika bisnis (`readiness.ts`, `indicator-data.ts`,
`IndicatorShell`) sengaja dibiarkan sama. Kerjakan v2; v1 beku sebagai cadangan.

## Halaman

| Rute | Isi |
|---|---|
| `/` | beranda platform |
| `/sdi` | katalog data (primer SDI + sekunder Atlas), filter + search |
| `/sdi/[slug]` | isi tabel per dataset, dibaca dari Silver (sudah bertipe) |
| `/gci`, `/gpci` | indikator daya saing kota (ISR, `revalidate=86400`) |
| `/atlas` | peta POI terpadu |
| `/scraped-hotels` | POC ketersediaan hotel Jakarta (lihat `../scripts/scrapers/booking-jakarta`) |
| `/ai` | tanya-jawab data: text-to-SQL grounded ke skema nyata + Q&A katalog |
| `/docs` | referensi REST API |

## Dari mana datanya

```
SDI + berkas → Dagster (harian 02:00) → Bronze (Iceberg @ RustFS)
             → Silver (view bertipe) → Gold (serving.mart_*) → app ini
```

App **tidak pernah** fetch SDI langsung — semua penarikan lewat pipeline. Dataset
yang belum ada di lake menghasilkan 404, bukan fetch langsung.

## Jekate — asisten AI (`/ai`)

Agen data read-only, porting copilot RantAI-Lakehouse (`console/rust/crates/lakehouse-api/src/routes/ai/`).

- **Mode Ask** — jawab pertanyaan dengan angka dari query; grafik bila membantu.
- **Mode BI** — susun mini-dashboard: KPI + beberapa grafik + insight.
- **Peta data** (`lib/ai/data-map.ts`) — semua view `silver.*` dan `serving.mart_*`: judul katalog,
  jumlah baris, kolom, rentang nilai, contoh nilai teks. Dibangun saat server start (±40 dtk),
  di-cache 30 menit.
- **Alat** (`lib/ai/agent.ts`): `search_data`, `describe_table`, `run_sql`, `make_chart`.
  SQL dijaga `lib/ai/sql-guard.ts` (SELECT saja, hanya silver/serving, tanpa table function,
  dibungkus LIMIT) — di atas profil `app_readonly` ClickHouse.
- **Verifikasi angka** — angka di jawaban yang tidak muncul di hasil query memicu satu putaran
  perbaikan; yang tersisa ditandai di UI.
- **Endpoint** `POST /api/ai/chat` `{mode, messages}` → stream NDJSON. LLM: `LLM_URL`/`LLM_MODEL`/`LLM_KEY`
  (OpenAI-compatible, default OpenCode Go + deepseek-v4.1-flash).

## Pengembangan lokal

```bash
npm install
cp .env.example .env.local   # isi CH_* ke server 187
npm run dev                  # http://localhost:3032
npx tsc --noEmit             # wajib lulus sebelum commit
```

Dev lokal membaca ClickHouse produksi lewat akun read-only — aman, tapi itu data
sungguhan.

## Deploy

Self-host di Portainer, **bukan Vercel**. Lihat `DEPLOY.md`, atau jalankan
`/deploy-v2` dari Claude Code.
