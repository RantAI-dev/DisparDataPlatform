---
name: menambah-halaman-dispar-v2
description: Use when adding or changing a page, route, or data view in the dispar-v2 app (platform-v2/) — a new dashboard, dataset view, map, chart page, or its supporting API route. Triggers include "tambah halaman", "bikin halaman", "menu baru", "add page", "new dashboard", "halaman baru di v2", "tambah route".
---

# Menambah halaman di dispar-v2

App yang LIVE ada di **`platform-v2/`**. Semua data dari ClickHouse.

## Langkah 0 — dua hal yang harus dipastikan dulu

**(a) Tabelnya benar-benar ada?** Jangan percaya nama tabel yang disebut di
permintaan. Cek:

```bash
curl -s "http://192.168.18.187:18123/?user=dispar&password=$CH_PASSWORD" \
  --data-binary "SHOW TABLES FROM serving"
```

Kalau martnya belum ada, itu pekerjaan lakehouse dulu (tambah SQL di
`lakehouse/clickhouse/sql/31-gold-more.sql`, daftarkan di `GOLD_SOURCES` pada
`lib/ch/store.ts`), bukan pekerjaan halaman. Katakan itu ke pengguna — jangan
menulis halaman untuk tabel yang tidak ada.

**(b) Belum ada yang mengerjakannya?** `components/indicators/` sudah memuat
banyak indikator siap pakai (mis. `CiMu.tsx` untuk museum). `ls components/
components/charts/ components/indicators/` sebelum membuat yang baru.

Lalu siapkan koneksi — tanpa ini `npm run dev` gagal konek, bukan "halaman kosong
yang normal":

```bash
cp .env.example .env.local     # isi CH_URL ke 192.168.18.187:18123 + sandi
npm run dev                    # port 3032
```

## Pilih bentuknya

| Kalau halaman… | Bentuk | Contoh |
|---|---|---|
| Data jarang berubah, tanpa interaksi | server component + ISR | `app/gci/page.tsx` |
| Butuh filter, peta, grafik interaktif | client component + route API | `app/scraped-hotels/page.tsx` |

### Server component + ISR

```tsx
// app/<nama>/page.tsx
import { getReadiness } from "@/lib/report";

export const revalidate = 86400;

export default async function Page() {
  const all = await getReadiness();               // SEMUA framework
  const rows = all.filter((r) => r.framework === "GCI");   // saring sendiri
  return <FrameworkView rows={rows} />;
}
```

### Client component + route API

```tsx
// app/api/<nama>/route.ts
import { NextResponse } from "next/server";
import { q } from "@/lib/ch/client";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(req: Request) {
  const limit = Math.min(Number(new URL(req.url).searchParams.get("limit") ?? 100), 500);
  try {
    const rows = await q<Row>(
      `SELECT nama, kota, toString(count()) AS jml FROM serving.mart_x
       GROUP BY nama, kota LIMIT {limit:UInt32}`, { limit });
    return NextResponse.json({ rows });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
```

Selalu batasi `limit`. Halamannya `"use client"` + `fetch("/api/<nama>")`.

## Ambil data dari mana

```ts
q<T>(sql, params?): Promise<T[]>      // @/lib/ch/client — SQL bebas, baris langsung
```

**ClickHouse mengembalikan `UInt64`/`count()` sebagai string.** Bungkus
`toString(...)` di SQL lalu `Number(...)` di TS — seluruh `store.ts` begitu.

Primitif di `@/lib/ch/store` (`catalog`, `sync`, `columns`, `rowsPage`, `tiers`,
`medallion`) **hanya melayani dataset yang terdaftar di katalog SDI** — semuanya
menerjemahkan *slug* lewat `tableFor(slug)` ke `lake.bronze_meta.*`, dan
mengembalikan `[]` untuk apa pun di luar katalog. **Untuk mart sendiri, pakai
`q()` langsung.** (`rowsPage(slug, offset, limit, search)` — posisional, `search`
wajib.)

Baca dari `silver.*` atau `serving.mart_*`. Jangan baca Bronze untuk tampilan,
dan jangan pernah fetch SDI langsung dari halaman.

## Pakai ulang komponen yang sudah ada

Jangan merakit ECharts atau `<table>` dari nol:

| Butuh | Pakai |
|---|---|
| Angka besar / KPI | `components/charts/KpiStat` |
| Peringkat, tren, donat, batang, treemap | `RankedList`, `LineTrend`, `Donut`, `BarBreakdown`, `GroupedBars`, `Treemap`, `ComboBarLine` |
| Peta titik | `components/charts/PointMapClient` |
| Tabel dataset (cari + halaman) | `components/SdiTable` |

`PointMap` menerima `{lat, lng, label, value}` — `value` **wajib** dan menentukan
radius penanda; isi `1` kalau tidak relevan.

**Komponen yang menyentuh `window` dimuat lewat wrapper `*Client.tsx`:**

```tsx
export const PointMapClient = dynamic(() => import("./PointMap").then(m => m.PointMap),
  { ssr: false, loading: () => <div>Memuat peta…</div> });
```

Itu alasannya `ssr: false` — `window is not defined` saat prerender, bukan soal
ukuran bundel.

Peta kustom (bukan `PointMap`) di repo ini memakai **Leaflet imperatif +
`leaflet.markercluster`** (lihat `components/MapView.tsx`), bukan react-leaflet.
Basemap selalu lewat `addBasemap(map)` dari `lib/basemap.ts` — Esri Light Gray,
dipilih khusus karena CARTO mulai mencap "API KEY REQUIRED" di tilenya.

## Kerangka & tema

```tsx
<main className="min-h-screen">
  <div className="mx-auto max-w-[1320px] px-6 py-8">…</div>
</main>
```

`max-w-[1320px] px-6` dipakai 34 tempat termasuk `Nav` — pakai angka lain dan
halamanmu tidak lurus dengan bilah nav. `<Nav />` dan `<AiDock />` sudah dirender
`app/layout.tsx`; jangan ditambah lagi.

Token warna ada di `app/globals.css`: `--ink: #1c1a17` (teks utama),
`--ink-muted-80: #33302b`, `--ink-muted-48: #6b6459`, aksen oranye `#ed6b23`,
garis `#ece6df`. Tailwind mengekspos `orange`/`gold`/`civic` —
**awas: `navy` masih dipetakan ke oranye**, sisa re-theme.

Tiga keadaan wajib ditangani, polanya di `app/scraped-hotels/page.tsx`:
sedang memuat → kosong (dengan petunjuk cara mengisi data) → error (banner
`border-red-200 bg-red-50`), plus tombol muat ulang yang `disabled` saat memuat.

## Daftarkan di navigasi

```tsx
// components/Nav.tsx
const ITEMS = [ …, { href: "/<nama>", label: "<Label>" } ];
```

Tanpa ini halaman tidak bisa dijangkau. **`ITEMS` sudah berisi 7 dan bilahnya
penuh** — kalau menambah yang ke-8, tanyakan dulu mana yang digeser atau apakah
halaman ini sebaiknya jadi sub-halaman (mis. di bawah `/atlas`).

## Sebelum bilang selesai

1. `npx tsc --noEmit` **lulus** — jalankan, jangan diasumsikan.
2. `npm run dev` (port **3032**), buka halamannya, pastikan **data sungguhan
   muncul**. Halaman kosong di dev = `.env.local` belum benar, bukan hal normal.
3. Uji keadaan kosong dan error, bukan hanya jalur bahagia.
4. Rute dinamis: `params` adalah Promise di Next 15 — `use(params)`.
