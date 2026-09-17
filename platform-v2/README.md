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

## Pengembangan lokal

```bash
npm install
cp .env.example .env.local   # isi CH_* ke server 187
npm run dev                  # http://localhost:3031
npx tsc --noEmit             # wajib lulus sebelum commit
```

Dev lokal membaca ClickHouse produksi lewat akun read-only — aman, tapi itu data
sungguhan.

## Deploy

Self-host di Portainer, **bukan Vercel**. Lihat `DEPLOY.md`, atau jalankan
`/deploy-v2` dari Claude Code.
