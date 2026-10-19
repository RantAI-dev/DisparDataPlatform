# Spec: Filter dan sort di halaman detail dataset

Status: **disetujui** (19 Okt 2026)

## Objective

Pembaca Dinas membuka satu dataset di Katalog Data atau daftar SDI lalu ingin
mempersempit dan mengurutkan barisnya, misalnya "museum di Jakarta Selatan",
"hotel dengan kamar terbanyak", atau "acara MICE bulan Juni", tanpa harus
mengunduh ke Excel dulu.

Halaman yang disentuh hanya satu: `/sdi/[slug]`
(`platform-v2/app/sdi/[slug]/page.tsx`). Halaman ini dipakai bersama oleh
dataset primer SDI dan dataset sekunder Katalog Data, jadi satu perubahan
berlaku untuk keduanya.

Keputusan yang sudah diambil (19 Okt):

| Topik | Keputusan |
|---|---|
| Bentuk filter | Per kolom, otomatis menurut tipe kolom. Kolom teks berkategori: pilih satu atau lebih nilai. Kolom angka: rentang min–maks. Kolom tanggal: rentang tanggal. Beberapa filter digabung dengan AND. |
| Sort | Klik judul kolom; satu kolom saja. Siklus: naik → turun → urutan asli. |
| Cakupan | Filter, sort, dan pencarian berlaku untuk tabel, **unduhan CSV/XLSX**, dan **grafik**. |
| Di luar cakupan | Menyimpan filter di URL; sort multi-kolom; tabel lain di dashboard (`components/SdiTable.tsx`). |

### User stories

1. Sebagai pembaca, saya memilih "Wilayah = Jakarta Selatan" di dataset museum,
   lalu tabel dan jumlah baris hanya menampilkan museum Jakarta Selatan.
2. Sebagai pembaca, saya mengklik judul "Jumlah Kamar", lalu baris terurut dari
   kecil ke besar di **seluruh** dataset, bukan hanya 50 baris yang sudah termuat.
3. Sebagai pembaca, saya mengunduh CSV setelah memfilter, dan berkas berisi
   persis baris yang terfilter dengan urutan yang sama.
4. Sebagai pembaca, grafik yang saya buat mencerminkan baris terfilter.

## Tech Stack

- Next.js 15.0.7, React 19.0.0, TypeScript 5, Tailwind (sudah dipakai)
- ClickHouse lewat `platform-v2/lib/ch/store.ts`, membaca `silver.*` dengan
  user read-only `dispar_app`
- ECharts lewat `echarts-for-react` (`components/DatasetCharts.tsx`), dan
  `xlsx` 0.18 untuk unduhan
- **Tidak ada dependensi baru.**

## Desain

### 1. Tipe kolom dan facet

Tipe filter diturunkan dari **skema Silver yang sebenarnya**
(`DESCRIBE silver.<tabel>`), bukan dari kolom `tipe` metadata SDI, karena
Silver sudah bertipe.

| Tipe ClickHouse (setelah melepas `Nullable`/`LowCardinality`) | Filter |
|---|---|
| `Int*`, `UInt*`, `Float*`, `Decimal*` | rentang min–maks |
| `Date`, `Date32`, `DateTime*` | rentang tanggal |
| `String` dengan ≤ 50 nilai unik | pilihan nilai (multi) |
| `String` dengan > 50 nilai unik | tanpa filter kolom; cukup pakai pencarian teks |

Kolom tersembunyi yang sudah ada (`HIDDEN` di page, kolom audit) tidak mendapat
filter.

Endpoint baru `GET /api/sdi/[slug]/facets` mengembalikan per kolom:
`{ key, kind: "kategori"|"angka"|"tanggal"|"none", values?: {v, n}[], min?, max? }`.
Facet dihitung atas **seluruh** dataset, bukan atas hasil filter, supaya
pilihan tidak hilang saat filter lain aktif.

### 2. Parameter query bersama

`/api/sdi/[slug]`, `/api/sdi/[slug]/export`, dan endpoint agregasi grafik
menerima parameter yang sama:

```
q=<teks>                    pencarian teks (sudah ada)
f=<kolom>:in:<v1>|<v2>      filter kategori (boleh berulang untuk kolom lain)
f=<kolom>:range:<min>..<max> filter angka/tanggal; salah satu ujung boleh kosong
sort=<kolom>:asc|desc       satu kolom
```

Satu modul baru, `platform-v2/lib/ch/query-filter.ts`, mem-parse parameter itu
dan menyusun klausa `WHERE` serta `ORDER BY`. Ketiga route memakai modul yang
sama, sehingga tabel, unduhan, dan grafik selalu konsisten.

**Aturan keamanan (wajib):**

- Nama kolom divalidasi terhadap hasil `DESCRIBE` tabel. Kolom yang tidak
  dikenal **ditolak dengan 400**, tidak diabaikan diam-diam. Nama kolom yang
  lolos dikutip dengan backtick.
- Semua nilai dikirim sebagai **parameter query ClickHouse**
  (`{f0:String}` dan seterusnya), tidak pernah disambung ke string SQL.
- Arah sort hanya boleh `asc` atau `desc`.
- Batas jumlah filter dan jumlah nilai per filter (mis. 20 dan 100) untuk
  mencegah query raksasa.
- Tidak ada `clickhouse_settings` dari klien app (user `dispar_app` read-only).

### 3. Tabel

- Baris tetap dimuat 50 per gulir. Mengubah filter atau sort mereset ke
  offset 0, seperti pencarian sekarang.
- Judul kolom bisa diklik dan memperlihatkan ikon arah sort.
- Panel filter berada di atas tabel, sebaris dengan kotak pencarian. Filter yang
  aktif tampil sebagai *chip* yang bisa dihapus satu per satu, ditambah tombol
  "Hapus semua filter".
- Teks status menjadi "Menampilkan X dari Y baris (terfilter dari Z)".
- Tanpa sort, urutannya tetap urutan Silver yang sekarang.

### 4. Unduhan

Tombol CSV/XLSX mengirim `q`, `f`, dan `sort` yang aktif. Ketika ada filter
atau pencarian aktif, label tombol menjelaskan bahwa yang diunduh adalah hasil
terfilter, dan tersedia tautan "unduh semua baris" untuk dataset utuh. Nama
berkas diberi akhiran `-terfilter` kalau ada filter.

### 5. Grafik

Saat ini grafik dihitung di browser dari baris yang sudah termuat (50 per
gulir). Supaya grafik mencerminkan seluruh baris terfilter, agregasi
dipindahkan ke server:

- Endpoint baru `GET /api/sdi/[slug]/aggregate?x=<kolom>&y=<kolom>&agg=sum|avg|count|max|min&...filter`
  mengembalikan `{ label, value }[]`. Endpoint memakai `GROUP BY` atas seluruh
  baris terfilter, mengambil 30 kategori teratas, sama dengan batas sekarang.
- `DatasetCharts` meminta data per grafik ke endpoint itu dan tidak lagi
  menghitung dari `rows`. Penyimpanan konfigurasi di localStorage tetap.
- Label "Grafik dari N baris termuat" diganti menjadi "Grafik dari N baris
  (terfilter)".

## Commands

```bash
cd platform-v2
npm run dev                      # http://localhost:3032 (membaca ClickHouse produksi, read-only)
npx tsc --noEmit                 # wajib lulus sebelum commit
npm run build                    # pemeriksaan build sebelum deploy
```

## Project Structure

| Berkas | Perubahan |
|---|---|
| `platform-v2/lib/ch/query-filter.ts` | **baru**: parse parameter dan susun WHERE/ORDER BY ter-parameter |
| `platform-v2/lib/ch/store.ts` | `rowsPage`, `rowsForRaw` menerima filter/sort; fungsi baru `facets`, `aggregate`, `schemaFor` |
| `platform-v2/app/api/sdi/[slug]/route.ts` | teruskan `f` dan `sort` |
| `platform-v2/app/api/sdi/[slug]/export/route.ts` | teruskan `q`, `f`, dan `sort` |
| `platform-v2/app/api/sdi/[slug]/facets/route.ts` | **baru** |
| `platform-v2/app/api/sdi/[slug]/aggregate/route.ts` | **baru** |
| `platform-v2/app/sdi/[slug]/page.tsx` | state filter/sort, header bisa diklik, panel filter, tautan unduh |
| `platform-v2/components/DatasetFilters.tsx` | **baru**: panel filter dan chip |
| `platform-v2/components/DatasetCharts.tsx` | ambil data agregat dari server |

Semua penempatan mengikuti `PROJECT_STRUCTURE.md`: route API di `app/api/**/route.ts`,
helper ClickHouse di `lib/ch/`, dan komponen umum PascalCase di `components/`.

## Code Style

Ikuti gaya `store.ts` yang sudah ada: komentar dan label UI dalam Bahasa
Indonesia, query dengan parameter bernama ClickHouse, nama tabel dari
`tableFor` dalam backtick.

```ts
// lib/ch/query-filter.ts — contoh bentuk
export type Filter =
  | { col: string; op: "in"; values: string[] }
  | { col: string; op: "range"; min?: string; max?: string };

/** Susun WHERE dari filter yang kolomnya sudah divalidasi terhadap skema Silver. */
export function buildWhere(filters: Filter[], schema: Map<string, string>, search: string) {
  const clauses: string[] = [];
  const params: Record<string, unknown> = {};
  filters.forEach((f, i) => {
    if (!schema.has(f.col)) throw new FilterError(`Kolom tidak dikenal: ${f.col}`);
    const col = `\`${f.col}\``;
    if (f.op === "in") {
      clauses.push(`toString(${col}) IN {f${i}:Array(String)}`);
      params[`f${i}`] = f.values;
    }
    // range: bandingkan dengan tipe kolomnya, nilai lewat parameter
  });
  // ...
}
```

## Testing Strategy

`platform-v2` **belum punya test runner**, dan menambahkannya termasuk
"Tanyakan dulu" (lihat Open Questions). Usulan:

- Logika murni `query-filter.ts` (parse parameter, validasi kolom, susunan
  klausa dan parameter, penolakan input jahat seperti nama kolom berisi
  backtick atau `; DROP`) diuji dengan unit test, **kalau disetujui menambah
  Vitest**.
- Tanpa test runner, verifikasi dilakukan dengan:
  1. `npx tsc --noEmit` lulus.
  2. Pemeriksaan API dengan `curl` ke dev lokal: jumlah baris hasil filter
     dicocokkan dengan `SELECT count() … WHERE …` langsung ke ClickHouse
     untuk minimal 3 dataset (mis. `museum-jakarta`, `kegiatan-mice-jakarta-2026`,
     satu dataset SDI primer bertanggal).
  3. Uji di browser (desktop dan mobile): filter kategori, rentang angka,
     rentang tanggal, sort naik/turun/asli, kombinasi dengan pencarian,
     unduhan CSV terfilter, dan grafik terfilter.
  4. Input jahat ke API (kolom tidak dikenal, nilai berisi kutip) menghasilkan
     400 atau hasil aman, bukan error 500 atau query yang dieksekusi.

## Boundaries

- **Always:** validasi nama kolom terhadap skema Silver; nilai selalu lewat
  parameter query; `npx tsc --noEmit` lulus sebelum commit; label UI Bahasa
  Indonesia; ikuti tampilan halaman yang ada (warna `NAVY`, kartu putih
  `rounded-xl`).
- **Ask first:** menambah dependensi atau test runner; mengubah `SdiTable`
  atau halaman lain di luar `/sdi/[slug]`; mengubah skema atau view Silver;
  deploy ke produksi.
- **Never:** menyambung nilai input pengguna ke SQL; mengatur
  `clickhouse_settings` dari klien app; mengubah perilaku pencarian teks yang
  sudah ada selain menggabungkannya dengan filter.

## Success Criteria

1. Di `/sdi/museum-jakarta`, memilih Wilayah = "KOTA ADM. JAKARTA SELATAN" membuat
   jumlah baris di halaman sama dengan hasil `SELECT count()` ClickHouse untuk
   kondisi yang sama.
2. Klik judul kolom angka mengurutkan **seluruh** dataset: baris pertama sama
   dengan `ORDER BY kolom ASC LIMIT 1` (lalu `DESC` pada klik kedua). Klik
   ketiga mengembalikan urutan asli.
3. Filter kategori, rentang angka, rentang tanggal, dan pencarian bisa aktif
   bersamaan (AND). Setiap perubahan mereset daftar ke baris pertama, dan
   lazy-load tetap bekerja.
4. CSV/XLSX yang diunduh saat filter aktif berisi tepat jumlah baris terfilter
   dalam urutan sort aktif. Tautan "unduh semua baris" tetap mengunduh dataset
   utuh.
5. Grafik yang dibuat saat filter aktif dihitung dari seluruh baris terfilter
   (cocok dengan `GROUP BY` langsung ke ClickHouse), bukan hanya baris termuat.
6. Kolom yang tidak ada di skema atau input berbahaya di `f`/`sort` menghasilkan
   respons 400, tidak pernah 500 atau SQL yang dieksekusi.
7. Dataset tanpa kolom yang bisa difilter tetap tampil normal; panel filter
   hanya menampilkan pencarian.
8. `npx tsc --noEmit` dan `npm run build` lulus.

## Keputusan atas pertanyaan terbuka (19 Okt 2026)

1. **Tanpa Vitest.** Verifikasi lewat `tsc`, `npm run build`, pemeriksaan API dengan
   `curl` yang dicocokkan ke ClickHouse, dan uji browser.
2. **Ambang kategori ≤ 50 nilai unik** dipakai.
3. **Berhenti di commit.** Tidak di-push dan tidak di-deploy.
