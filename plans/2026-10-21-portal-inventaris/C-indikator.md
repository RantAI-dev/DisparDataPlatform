# Inventaris C — Indikator GCI/GPCI + halaman pariwisata (platform-v2 → Nuxt 3 + Laravel 10)

- Basis kode: `/home/uaa/Dinas-Pariwisata/platform-v2` @ `a0580ba`. Path di bawah relatif ke `platform-v2/` kecuali disebut lain.
- Verifikasi live: halaman `https://dispar.rantai.dev/...` dan `GET /api/sdi/<slug>` diambil **2026-10-21**. ClickHouse `:18123` **tidak terjangkau** dari mesin ini (curl exit 7), jadi tidak ada query SQL langsung. Angka "live" di bawah = hasil render produksi, bukan query.
- Ditandai **belum terverifikasi** bila tidak dicek ke kode/live.

---

## 0. Ringkasan temuan penting (baca dulu)

1. **Latar belakang lama terkonfirmasi.** Dataset indikator dipilih **saat runtime** dengan mencocokkan kata kunci `match[]` ke JUDUL katalog (`lib/indicator-data.ts:22-34`). Lalu `SELECT * FROM silver.<table>` (`lib/ch/store.ts:259-266`) dan agregasi di JS (`lib/agg.ts`). Readiness dihitung di JS oleh `computeReadiness()` (`lib/gci/readiness.ts:221-269`).
2. **Status readiness = `draftReadiness` dari JSON** untuk ke-28 indikator (dibatasi atas oleh draft; semua yang punya kata kunci saat ini punya dataset berisi). Live: GCI 3 Ready / 2 Partial / 3 Gap; GPCI 5 / 9 / 6.
3. **Kolom "Nilai terbaru" di tabel readiness berisi sampah heuristik**, mis. CE2 `9.999 · periode 9999`, CE4 `291.801 · periode TAMAN MINI INDONESIA INDAH`, CI-CX `4 · periode YUSMI HANIFAH`. Ini dari `latestValue()` (`lib/gci/readiness.ts:272-302`).
4. **"Sum of averages" terkonfirmasi:**
   - **CI-SH** — "Rata-rata keseluruhan" = jumlah rata-rata 3 negara = **6.864.986** (`components/indicators/CiSh.tsx:12-22`).
   - **CI-LH** — `byPeriod(...,"rata_rata")` menjumlah. Saat ini aman karena 1 baris per (periode, jenis_hotel) — dicek live, 155 baris, tanpa duplikat. Tapi ini rapuh.
   - **`/gpci/hotel`** — KPI okupansi & lama menginap = rata-rata tak berbobot (lihat §3.9).
5. **Swap lat/lng terkonfirmasi** di CE4, CI-TA, **dan juga CI-WH, CI-MU** (`lat: Number(r.longitude), lng: Number(r.latitude)`). Swap ini **benar secara data**: kolom di sumbernya memang tertukar, live `longitude=-5.745, latitude=106.615`.
6. **Pilihan dataset runtime yang salah secara makna (live):**
   - **CE3** memakai `data-pemberian-rekomendasi-penyelenggaraan-pertunjukan-musik`. Dataset ini tak punya kolom `nama_event`/`nama_venue`, sehingga live tampil "Venue unik 1", venue "—" 624, dan "Tidak ada baris event."
   - **CI-AM** memakai `indeks-kepuasan-layanan-penunjang-...-tahun-2023` (survei kepuasan ASN!). Kata kunci "ekonomi kreatif" cocok ke judul itu.
   - **CI-CX** memakai `jumlah-pelaku-usaha-...-industri-halal-dan-ekonomi-syariah` (18 baris).
7. **Penghitungan ganda lintas tahun:**
   - **CE2/CI-DI** "Total restoran **18.869**" menjumlah periode 2024 + 2026. Halaman kuliner-michelin memakai tahun terbaru saja → **12.932**.
   - KPI "Total kunjungan" CE4/CI-TA/CI-WH/CI-MU hanya menjumlah **top-15** obyek, dan KPI "Obyek wisata/Museum" dibatasi 15.
8. **CE1/CI-FV "Top negara asal"** memuat `LAINNYA` serta `TIONGKOK` dan `CHINA` terpisah. Padahal MomNote CI-FV berbunyi "Klasifikasi negara pada data BPS telah distandarkan" — klaim ini tidak benar untuk dataset yang dipakai.
9. **Enam subhalaman statis.** `restoran-gci`, `direktori-restoran`, `pertunjukan-budaya`, `gpci/hotel`, `lapangan-golf`, dan `toko-suvenir` **tidak membaca lakehouse sama sekali**. Semuanya array TS yang di-bundle ke client (detail §3.4–§3.9).
10. **Salinan indikator di lakehouse basi.** `serving.mart_gci_readiness` (`lakehouse/clickhouse/sql/31-gold-more.sql:6-20`) dibangun dari `/home/uaa/Dinas-Pariwisata/data/gci-gpci-indicators.json` (root). Salinan itu **basi**: tanpa `officialNo`, `note` lama (dicek dengan `diff`). Mart ini hanya berisi `draftReadiness` dan **tidak dipakai app**.

---

## 1. Model indikator

### 1.1 `data/gci-gpci-indicators.json` (sumber kebenaran app; dimuat `lib/gci/indicators.ts:1-40`)

Array berisi **28** objek. Skema (`lib/gci/indicators.ts:12-32`):

| field | tipe | arti |
|---|---|---|
| `framework` | `"GCI"\|"GPCI"` | |
| `dimension` | string | mis. "Cultural Experience", "Cultural Interaction", "Business Activity", "Human Capital", "Accessibility" |
| `group` | string | sub-baris di tabel (mis. "Cultural", "Volume of Interaction", "Trendsetting", "Cultural Resources", "Facilities for Visitors", "Shopping/Dining", "International", "MICE", "Akses") |
| `code` | string | kunci route `/gci/{code}` atau `/gpci/{code}` (uppercase) |
| `officialNo?` | number | nomor di tabel Methodology GPCI 2025. **Hanya ada di GPCI (20 indikator)** |
| `name` | string | judul h1 / link tabel |
| `definition` | string | subjudul hero detail |
| `owner` | string | OPD pemilik |
| `dataAvailable` | boolean | `false` → halaman "Data belum tersedia" |
| `draftReadiness` | `"ready"\|"partial"\|"gap"` | plafon status |
| `match` | string[] | kata kunci lowercase untuk dicocokkan ke judul dataset (substring, `includes`) |
| `measure` | string\|null | regex kolom nilai untuk heuristik `latest`/`trend` |
| `note` | string | teks di panel "Kelengkapan data" & kartu belum-tersedia |

**Jumlah:**
- GCI 8: CE1, CE2, CE3, CE4, BA-MICE, CE5, CE6, HC-VISA.
- GPCI 20: CI-FV, CI-IC, CI-CE, CI-CX, CI-AM, CI-TA, CI-WH, CI-TH, CI-MU, CI-HR, CI-LH, CI-SH, CI-DI, CI-NL, CI-FR, CI-ST, AC-DF, AC-AP, AC-AR, AC-TT.
- `dataAvailable:false` + `draftReadiness:"gap"` + `match:[]` ada **9**: CE5, CE6, HC-VISA, CI-FR, CI-ST, AC-DF, AC-AP, AC-AR, AC-TT.
- Draft ready (8): CE1, CE2, CE3, CI-FV, CI-CE, CI-TA, CI-HR, CI-DI.
- Draft partial (11): CE4, BA-MICE, CI-IC, CI-CX, CI-AM, CI-WH, CI-TH, CI-MU, CI-LH, CI-SH, CI-NL.

Tabel lengkap (urutan = urutan JSON; dipakai GCI tabel & semua panel):

| fw | No | code | dimension / group | name | owner | draft | match | measure |
|---|---|---|---|---|---|---|---|---|
| GCI | – | CE1 | Cultural Experience / Cultural | Wisatawan internasional | DISPAREKRAF | ready | wisatawan mancanegara, kunjungan wisatawan, **tic** | jumlah\|kunjungan |
| GCI | – | CE2 | CE / Cultural | Kuliner beragam | DISPAREKRAF | ready | makanan dan minuman, restoran, food court, kuliner | jumlah |
| GCI | – | CE3 | CE / Cultural | Seni visual & pertunjukan | DISPAREKRAF | ready | seni pertunjukan, pertunjukan musik, penyelenggaraan event | jumlah |
| GCI | – | CE4 | CE / Cultural | Museum | Dinas Kebudayaan | partial | obyek wisata, desa wisata | null |
| GCI | – | BA-MICE | Business Activity / MICE | Konferensi internasional (ICCA) | DISPAREKRAF | partial | pertemuan, konferensi, pameran | jumlah |
| GPCI | 37 | CI-FV | Cultural Interaction / Volume of Interaction | Jumlah wisatawan asing (Foreign Visitors) | DISPAREKRAF | ready | wisatawan mancanegara, kunjungan | jumlah\|kunjungan |
| GPCI | 22 | CI-IC | CI / Volume of Interaction | Jumlah konferensi internasional | DISPAREKRAF | partial | pertemuan, konferensi, pameran | jumlah |
| GPCI | 23 | CI-CE | CI / Trendsetting | Jumlah event budaya (Cultural Events) | DISPAREKRAF | ready | event pariwisata, seni pertunjukan, pengunjung event, penyelenggaraan event | jumlah |
| GPCI | 24 | CI-CX | CI / Trendsetting | Nilai ekspor konten budaya (Cultural Content Export) | DISPAREKRAF (Ekraf) | partial | ekonomi kreatif, kekayaan intelektual | jumlah\|persen |
| GPCI | 25 | CI-AM | CI / Trendsetting | Lingkungan pasar seni (Art Market) | DISPAREKRAF (Ekraf) / Disbud | partial | seni, ekonomi kreatif | null |
| GPCI | 26 | CI-TA | CI / Cultural Resources | Daya tarik wisata (Tourist Attractions) | DISPAREKRAF | ready | obyek wisata, desa wisata, kepuasan | jumlah\|nilai |
| GPCI | 27 | CI-WH | CI / Cultural Resources | Kedekatan situs warisan dunia | Dinas Kebudayaan | partial | obyek wisata | null |
| GPCI | 29 | CI-TH | CI / Cultural Resources | Jumlah teater | Dinas Kebudayaan / DISPAREKRAF | partial | seni pertunjukan | null |
| GPCI | 30 | CI-MU | CI / Cultural Resources | Jumlah museum | Dinas Kebudayaan | partial | obyek wisata | null |
| GPCI | 32 | CI-HR | CI / Facilities for Visitors | Jumlah kamar hotel | DISPAREKRAF | ready | kamar hotel, penyediaan akomodasi, rekapitulasi usaha dan kamar | kamar\|jumlah |
| GPCI | 33 | CI-LH | CI / Facilities for Visitors | Jumlah kamar hotel mewah | DISPAREKRAF | partial | tingkat hunian | hunian\|rata\|persen |
| GPCI | 34 | CI-SH | CI / Shopping/Dining | Daya tarik belanja (Shopping) | DISPAREKRAF | partial | belanja, pengeluaran | persen\|nilai\|rata |
| GPCI | 35 | CI-DI | CI / Shopping/Dining | Daya tarik kuliner (Dining) | DISPAREKRAF | ready | kuliner, makanan dan minuman, pengeluaran, restoran | persen\|nilai\|rata\|jumlah |
| GPCI | 28 | CI-NL | CI / Shopping/Dining | Pilihan hiburan malam (Nightlife) | DISPAREKRAF | partial | malam, hiburan | persen\|jumlah |
| GCI | – | CE5 | CE / Cultural | Event olahraga besar | Dispora | gap | – | – |
| GCI | – | CE6 | CE / Cultural | Sister city | Biro Kerja Sama Daerah | gap | – | – |
| GCI | – | HC-VISA | Human Capital / Akses | Kemudahan masuk (visa/entry) | Imigrasi (nasional) | gap | – | – |
| GPCI | 36 | CI-FR | CI / Volume of Interaction | Jumlah penduduk asing (Foreign Residents) | Disdukcapil / Imigrasi | gap | – | – |
| GPCI | 31 | CI-ST | CI / Facilities for Visitors | Jumlah stadion | Dispora | gap | – | – |
| GPCI | 63 | AC-DF | Accessibility / International | Kota dengan penerbangan langsung internasional | Dishub / AP II | gap | – | – |
| GPCI | 65 | AC-AP | Accessibility / International | Jumlah penumpang udara | AP II / Dishub | gap | – | – |
| GPCI | 66 | AC-AR | Accessibility / International | Kedatangan/keberangkatan bandara | AP II | gap | – | – |
| GPCI | 69 | AC-TT | Accessibility / International | Waktu tempuh ke bandara | Dishub | gap | – | – |

`definition`/`note` per kode: salin apa adanya dari JSON (string panjang; jangan diketik ulang).

> Catatan: AC-DF kini punya dataset sekunder `penerbangan-langsung-jakarta` (`lib/secondary.ts:137-146`, "Menutup gap indikator GPCI AC-DF"). Meski begitu, JSON masih `dataAvailable:false` dan `match:[]`, sehingga halaman tetap "Data belum tersedia". Keputusan: ikut paritas atau sambungkan.

### 1.2 `data/gci-gpci-benchmarks.json` (dimuat `lib/gci/benchmark.ts:1-20`)

Bentuknya objek `Record<code, Benchmark>` dengan **28 kunci**: semua kode. Kunci GCI berbentuk `CE1..CE6, BA-MICE, HC-VISA`.

```ts
{ indexMetric: string; indexSource: string; unit: string;
  frontier: { city: string; value: string };
  jakarta: { value: string | null; note: string };
  target: string;
  dataNeeded: { label: string; status: "punya"|"proksi"|"belum"; owner: string }[] }
```

Semua isinya teks statis. Contoh: CE1 frontier `Seoul (GCI)` = `18.936.562`, jakarta `~2 juta/th`, target `10 juta+/tahun`. CI-HR punya 2 item `dataNeeded`; yang lain 1. Status `punya` saat ini tidak dipakai (hanya `proksi`/`belum`). Dirender oleh `IndexContext` (§2.2).

### 1.3 Aturan readiness persis (`lib/gci/readiness.ts:221-269`, dipanggil `lib/report.ts:27-35`)

Untuk tiap indikator `ind`:

1. `catalog` = UNION `lake.bronze_meta.dataset_catalog` + `lake.bronze_meta_sec.dataset_catalog` (`slug, title, …`) (`lib/ch/store.ts:28-42`).
2. `matched` = dataset yang `title.toLowerCase().includes(kw)` untuk **salah satu** `kw ∈ ind.match`. Substring mentah, jadi `"tic"` juga cocok ke judul apa pun yang mengandung "tic".
3. `withData` = `matched` dengan `syncTotal(slug) > 0`. `syncTotal` berasal dari `bronze_meta[_sec].dataset_sync.total`. Hasilnya diurutkan `total` menurun.
4. Status:
   - `matched.length===0` → `gap`
   - `withData.length>0` → `ready`
   - selain itu → `partial`
   - lalu **diturunkan ke `draftReadiness` bila lebih tinggi** (urutan `gap 0 < partial 1 < ready 2`, `lib/gci/indicators.ts:36-40`).
   - Efek bersihnya: `status = min(computed, draft)`.
5. `datasets` = 5 teratas `withData` (`{slug,title,total}`) → kolom "Dataset / Pemilik".
6. `latest`/`trend` hanya dari `withData[0]`. Langkahnya:
   - `labelCol` = kolom pertama yang cocok `/periode|tahun|bulan|tanggal/i`; kalau tidak ada, kolom pertama.
   - `valueCol` = kolom pertama yang cocok regex `measure`, bukan label, dan ≥90% barisnya numerik (`/^-?\d+(\.\d+)?$/`). Fallback: kolom numerik pertama.
   - `latest` = nilai numerik dari baris dengan label terbesar (urut string).
   - `trend` = 24 titik terakhir.

   **Hasil live sampah** (lihat §0.3), karena `withData[0]` sering dataset registri (kolom `nomor`/`kbli` lolos sebagai "numerik").
7. **Cache:** `unstable_cache(..., revalidate 86400)` plus ISR halaman `revalidate = 86400`. `getReportRaw()` selalu `null` di v2 (`lib/report-store.ts`), jadi snapshot dinonaktifkan. Gagal → `[]`.

Ringkasan kartu (`components/FrameworkView.tsx:57-74`):
- `TOTAL INDIKATOR` = jumlah baris
- `DATA ADA` = jumlah `dataAvailable===true`
- `READY` / `PARTIAL` / `GAP` = hitung status

Live: GCI `8 / 5 / 3 / 2 / 3`, GPCI `20 / 14 / 5 / 9 / 6`.

**Rekomendasi port:**
- Data API menghitung `status` dari pemetaan dataset eksplisit (§4.2), bukan judul: `ready` bila dataset terpetakan berisi, lalu `min(…, draft)`.
- `latest` diganti nilai yang didefinisikan per indikator, **atau** kolom dikosongkan "—". Ini keputusan pemilik. Untuk paritas visual, kolom tetap ada.

### 1.4 Halaman `/gci` (overview) — urutan render

File: `app/gci/page.tsx:22-31`. Isinya `GciOfficial` → `FrameworkDataLinks framework="GCI"` → `<Suspense fallback="Memuat kesiapan data GCI…">` `FrameworkView`. **Ada dua hero gelap berturut-turut** (GciOfficial, lalu header FrameworkView).

Warna & token bersama:
- `HERO = radial-gradient(900px 320px at 88% -25%, rgba(237,107,35,0.28), transparent 62%), linear-gradient(160deg, #2a2521 0%, #16130f 100%)`
- aksen `#ed6b23`, emas `#f0a13a`, link di atas hero `#8ab4ff`, link di latar terang `#2563eb`
- latar halaman `#faf6f2`
- kelas CSS `atlas-display`, `atlas-display-md`, `atlas-italic`, `apple-lead`, `apple-fine`, `apple-caption`, `utility-card`, `text-ink`, `text-ink-muted-48` (#6b6459), `border-hairline` (#ece6df) — didefinisikan di `app/globals.css` (mis. `.atlas-display-md` :84, `.utility-card` :176)
- Kontainer selalu `mx-auto max-w-[1320px] px-6`.

**A. Hero GciOfficial** (`components/GciOfficial.tsx:116-159`)
- Eyebrow (mono 12px uppercase, white/60): `●` (#f0a13a) + ` Kearney · Global Cities Index — Indikator Pariwisata Jakarta`
- h1 `atlas-display`: `GCI Jakarta · ` + span italic emas `Pengalaman Budaya`
- Lead `apple-lead` white/75: `Sub-indikator pariwisata yang mengisi dimensi Pengalaman Budaya (Cultural Experience) GCI Jakarta.`
- Dua chip peringkat (rounded-xl, border white/12, bg white/4%). Formatnya: label + angka 2024 (14px, white/45) + `→` + angka 2025 (18px bold putih) + tren.
  - `Peringkat Pengalaman Budaya`: **52 → 58**, tren `▼ turun 6` warna `#f7a6a1`.
  - `GCI keseluruhan`: **74 → 71**, tren `▲ naik 3` warna `#7ee2a8`.
  - Rumus `trend(a,b)` (`:109-114`): `d = y2024 − y2025`; `d>0` → `▲ naik d` (#7ee2a8); `d<0` → `▼ turun |d|` (#f7a6a1); `0` → `▬ tetap` (#cfc8bf). Peringkat kecil = baik.
- Footnote 12px white/50: `Sumber: ` + link `jakarta.go.id/competitiveness ↗` (https://www.jakarta.go.id/competitiveness, #8ab4ff) + ` · Kearney GCI 2025. Peringkat makin kecil makin baik.`
- **Semua angka hard-coded** (`:96-107`).

**B. 4 kartu indikator pariwisata** (`GciOfficial.tsx:161-219`)
- Judul `atlas-display-md`: `Indikator Pariwisata (Pengalaman Budaya)`. Kanan: `4 indikator · sumber resmi`.
- Grid `sm:2 lg:4`. Tiap kartu `utility-card p-5`, dan berupa Link bila ada `href`. Isi kartu:
  - pill aksen putih uppercase 11px = label
  - angka 34px bold + satuan
  - catatan (min-h 28px)
  - garis hairline, lalu baris `Tahun` & `Sumber`
  - `Lihat detail →` (aksen) bila ada link

| label | nilai | satuan | tahun | sumber | catatan | href |
|---|---|---|---|---|---|---|
| Jumlah Museum | 79 | Museum | 2025 | satudata.jakarta.go.id | – | – (bukan link) |
| Seni Visual & Pertunjukan | 156 | Karya / kegiatan | 2024 | Dinas Pariwisata & Ekraf | Belum mencakup data Dinas Kebudayaan. | /gci/pariwisata/seni-pertunjukan |
| Wisatawan Internasional | 2.767.622 | Wisatawan | 2025 | jakarta.bps.go.id | – | /gci/pariwisata/wisatawan-internasional |
| Penawaran Kuliner (Michelin) | 0 | Restoran Michelin | 2025 | Michelin | Belum ada Michelin Star di Jakarta. | /gci/pariwisata/kuliner-michelin |

- Footnote 12px: `Hanya indikator <b>pariwisata</b> (domain Dispar/atraksi wisata). Indikator Cultural Experience lain — Kegiatan Olahraga (Dispora) & Kota Kembar (Biro KSD) — tidak ditampilkan di sini.`

**C. `FrameworkDataLinks`** (`components/FrameworkDataLinks.tsx:43-80`, `lib/data-sections.ts`)
- `<section aria-label="Dataset GCI">`, h2 `Dataset GCI`, grid `sm:2 lg:3`.
- Kartu `utility-card press-scale p-6` (hover naik 1). Isi kartu:
  - nomor 2 digit (mono)
  - ikon SVG 22px dalam kotak 44px `bg-primary/10` (hover jadi oranye, ikon putih)
  - h3 judul
  - deskripsi (min-h 54px)
  - baris bawah: `{count id-ID} {unit}` oranye + panah `→`
- `count` = `secondaryDatasets().find(href).rows` (**angka hard-coded/statis** di `lib/secondary.ts`).
- Penomoran mengikuti urutan global `DATA_SECTIONS` (GCI 01–04, GPCI 05–07).

| no | judul | href | deskripsi | count | unit |
|---|---|---|---|---|---|
| 01 | Restoran GCI | /gci/pariwisata/restoran-gci | Seluruh restoran & kafe se-Jakarta (termasuk resto hotel bintang 3–4) untuk Global City Index — dengan tier, rating, harga. | 2.577 | entri |
| 02 | Direktori Restoran | /gci/pariwisata/direktori-restoran | Restoran & kafe pilihan Jakarta dengan sumber sitasi publik terverifikasi. | 604 | entri |
| 03 | Pertunjukan & Budaya | /gci/pariwisata/pertunjukan-budaya | Konser, festival, tari, teater, seni rupa, dan film 2025–2026. | 308 | entri |
| 04 | Hotel MICHELIN Key | /sdi/michelin-keys-indonesia | Hotel & resor peraih MICHELIN Key 2026 se-Indonesia (1–3 Key), lengkap dengan lokasi dan sumber verifikasi. | 47 | hotel |
| 05 | Lapangan Golf | /gpci/lapangan-golf | Lapangan & driving range golf di Jakarta dan sekitarnya. | 14 | entri |
| 06 | Toko Suvenir | /gpci/toko-suvenir | Toko suvenir, oleh-oleh & kerajinan dari TripAdvisor, ditandai mana yang benar-benar toko suvenir. | 67 | listing |
| 07 | Hotel & Akomodasi | /gpci/hotel | Pasokan kamar, okupansi (TPK), dan lama menginap hotel berbintang — data resmi Satu Data Jakarta / BPS. | 120 | hotel |

Path SVG ikon ada di `FrameworkDataLinks.tsx:5-41`; salin apa adanya.

**D. `FrameworkView`** (`components/FrameworkView.tsx`)
- **Header** `FrameworkHeader` (`:19-36`):
  - eyebrow `● Dashboard Indikator Pariwisata`
  - h1 28/36px bold
  - p white/70 14px
  - GCI: title `Kesiapan Data Indikator GCI`, subtitle `Status kesiapan data Dispar untuk mengisi tiap indikator GCI (Kearney) — sumber dataset, tren, dan gap.`
- **5 kartu** `grid-cols-2 sm:grid-cols-5 max-w-[820px]`:
  - kartu `rounded-lg bg-white/10 border-white/15`
  - label mono 11px + titik warna: DATA ADA #f0a13a, READY #4ade80, PARTIAL #fbbf24, GAP #f87171
  - angka 22px
- **`afterHeader` slot**: dipakai hanya GPCI (DataLinks).
- **Tabel "Kesiapan indikator"** (`:79-150`):
  - h2 16px bold slate-800; kartu putih rounded-xl.
  - thead bg `#2a2521`, putih, 12px uppercase.
  - Kolom:
    - `No.` (hanya bila ada `officialNo`, jadi hanya GPCI)
    - `Kode`
    - `Indikator` = link biru `#2563eb` ke `/{framework lower}/{code}` + `group` 12px slate-400
    - `Status` = pill: Ready `#e8f5ee/#0e7c42`, Partial `#fff6e9/#b5651d`, Gap `#fdecec/#b3261e`
    - `Dataset / Pemilik` = daftar link `/sdi/{slug}` judul dataset (maks 5), atau teks `owner` bila kosong
    - `Nilai terbaru` = angka bold `id-ID` + `periode {label}` 11px, atau `—` slate-300
  - **Urutan:** bila ada `officialNo`, urut naik (GPCI 22→69). Bila tidak, urutan JSON.
- **Tren indikator** (`:152-174`): disembunyikan di GCI & GPCI (`showTrend={false}`). Tidak perlu diport kecuali diminta.
- **"Kelengkapan data ({n})"** (`:176-216`):
  - Berisi semua baris `status !== "ready"`, dalam **urutan JSON** (bukan urutan No.).
  - Tiap baris: pill status, nama (14px medium), lalu `{note || "—"} · {owner}`.
  - GCI live n=5, GPCI live n=15.

### 1.5 Halaman `/gpci` (overview)

File: `app/gpci/page.tsx`. Urutannya: `FrameworkView` (hero) → slot `afterHeader` = `FrameworkDataLinks framework="GPCI"` → tabel (ada kolom `No.`) → Kelengkapan data. **Tanpa GciOfficial** dan tanpa ranking Kearney.

- Title: `Mori — Global Power City Index (GPCI)`
- Subtitle: `Fungsi Cultural Interaction + konektivitas (Accessibility) pariwisata. Kesiapan data Dispar untuk mengisi indikator GPCI.`
- Fallback Suspense: header + DataLinks + `Memuat kesiapan data GPCI…`

### 1.6 `/readiness`

`app/readiness/page.tsx` → `redirect("/gci")`. Port: redirect 301/302 ke `/gci`.

### 1.7 Status live per baris (2026-10-21) — untuk uji paritas

| code | status | "Dataset / Pemilik" (top-5 slug, urut total turun) | Nilai terbaru (live, heuristik) |
|---|---|---|---|
| CE1 | Ready | data-pengunjung-tic-upt-pusat-pengembangan-dan-pelayanan-informasi-pariwisata; data-pengunjung-tic-bandara-soetta-upt-…-dki-jakarta; data-pengunjung-tic-tourist-information-center-bali; data-pengunjung-tourist-information-center-tic-up-kawasan-kota-tua-dki-jakarta; jumlah-kunjungan-wisatawan-ke-obyek-wisata-menurut-lokasi-di-provinsi-dki-jakarta | — |
| CE2 | Ready | jumlah-usaha-jasa-makanan-dan-minuman-pariwisata-yang-memiliki-perizinan; data-usaha-jasa-makanan-dan-minuman-jenis-usaha-restoran-di-dki-jakarta; jumlah-restoran-per-kelurahan; restoran-halal-jakarta; data-usaha-jasa-makanan-minuman-food-court | 9.999 · periode 9999 |
| CE3 | Ready | data-pemberian-rekomendasi-penyelenggaraan-pertunjukan-musik; data-seni-pertunjukan-dan-visual; data-penyelenggaraan-event-pariwisata-dan-budaya-dki-jakarta; data-rekomendasi-penyelenggaraan-pertunjukan-musik; jumlah-penyelenggaraan-event | — |
| CE4 | Partial | jumlah-kunjungan-…-obyek-wisata-menurut-lokasi-di-provinsi-dki-jakarta; jumlah-kunjungan-…-obyek-wisata-unggulan-…-tahun-2024; data-desa-wisata; jumlah-kunjungan-…-unggulan-…-dki-jakarta-tahun-2023 | 291.801 · periode TAMAN MINI INDONESIA INDAH |
| BA-MICE | Partial | jumlah-usaha-penyelenggaraan-pertemuan-…-memiliki-perizinan; data-kegiatan-pameran-dki-jakarta; data-daftar-kegiatan-pameran-di-dki-jakarta | 2 · periode 999 |
| CE5/CE6/HC-VISA | Gap | (owner) | — |
| CI-IC (22) | Partial | = BA-MICE | 2 · periode 999 |
| CI-CE (23) | Ready | data-event-pariwisata-dan-kebudayaan-dki-jakarta-2011-2019; jumlah-pengunjung-event-2026; jumlah-pengunjung-event; data-seni-pertunjukan-dan-visual; data-penyelenggaraan-event-pariwisata-dan-budaya-dki-jakarta | — |
| CI-CX (24) | Partial | indeks-kepuasan-layanan-penunjang-…-tahun-2023; jumlah-produkjasa-ekonomi-kreatif-yang-didaftarkan-kekayaan-intelektualnya; tenaga-kerja-ekraf-per-provinsi; indeks-kepuasan-layanan-penunjang-…-pada-dinas-…; tenaga-kerja-ekraf-per-subsektor-nasional | 4 · periode YUSMI HANIFAH |
| CI-AM (25) | Partial | indeks-kepuasan-…-2023; jumlah-produkjasa-…; tenaga-kerja-ekraf-per-provinsi; data-seni-pertunjukan-dan-visual; indeks-kepuasan-…-pada-dinas-… | 4 · periode YUSMI HANIFAH |
| CI-TA (26) | Ready | nilai-kepuasan-pengunjung-objek-wisata-tahun-2023; jumlah-kunjungan-…-obyek-wisata-menurut-lokasi-…; indeks-kepuasan-…-2023; indeks-kepuasan-…-pada-dinas-…; jumlah-kunjungan-…-unggulan-…-2024 | 72,22 · periode 2023 |
| CI-WH (27) | Partial | = CE4 tanpa desa wisata (3) | 291.801 · periode TAMAN MINI… |
| CI-NL (28) | Partial | jumlah-usaha-penyelenggaraan-kegiatan-hiburan-dan-rekreasi-…; data-jumlah-usaha-pariwisata-bidang-hiburan-dan-rekreasi-menurut-jenis-usaha-dan-kecamatan; …-kecamatan-titik; data-usaha-hiburan-dan-rekreasi-di-dki-jakarta-2018; jumlah-usaha-pariwisata-bidang-hiburan-dan-rekreasi-menurut-jenis-usaha-di-dki-jakarta | 3 · periode 999 |
| CI-TH (29) | Partial | data-seni-pertunjukan-dan-visual | — |
| CI-MU (30) | Partial | = CI-WH | 291.801 · periode TAMAN MINI… |
| CI-ST (31) | Gap | Dispora | — |
| CI-HR (32) | Ready | jumlah-usaha-penyediaan-akomodasi-…; data-jumlah-rekapitulasi-usaha-dan-kamar-hotel; data-usaha-pariwisata-bidang-usaha-penyediaan-akomodasi-di-dki-jakarta; jumlah-hotel-dan-kamar-hotel-2 | 3 · periode 9999 |
| CI-LH (33) | Partial | data-rata-rata-tingkat-hunian-kamar-…-provinsi-dki-jakarta; …-di-dki-jakarta-tahun-2023; …-provinsi-dki-jakarta-tahun-2011-2018 | 51,85 · periode BINTANG 5 |
| CI-SH (34) | Partial | data-proyeksi-penerimaan-devisa-dari-wisman-dan-akumulasi-belanja-wisatawan-nusantara; persentase-tingkat-pengaruh-wisata-belanjakulinermalam-…; rata-rata-pengeluaran-kunjungan-wisatawan | 1.325,3 · periode 2007 |
| CI-DI (35) | Ready | jumlah-usaha-jasa-makanan-…-perizinan; data-usaha-jasa-makanan-…-restoran-…; jumlah-restoran-per-kelurahan; restoran-halal-jakarta; restoran-tripadvisor-jakarta | 9.999 · periode 9999 |
| CI-FR (36) | Gap | Disdukcapil / Imigrasi | — |
| CI-FV (37) | Ready | jumlah-kunjungan-…-obyek-wisata-menurut-lokasi-…; data-jumlah-wisatawan-mancanegara-berdasarkan-kebangsaan; data-jumlah-kunjungan-dan-pertumbuhan-wisatawan-mancanegara-ke-indonesia-berdasarkan-bulan; data-jumlah-kunjungan-wisman-ke-indonesia-berdasarkan-pintu-masuk-di-dki-jakarta; data-kunjungan-wisatawan-nusantara-dan-wisatawan-mancanegara-ke-tic-dki-jakarta-titik | 291.801 · periode TAMAN MINI… |
| AC-DF/AP/AR/TT | Gap | owner | — |

Slug lengkap (tanpa "…") ada di HTML live. Ambil ulang lewat `curl https://dispar.rantai.dev/gpci | grep -o '/sdi/[^"]*'`.

---

## 2. Halaman detail indikator `/gci/[code]` dan `/gpci/[code]`

### 2.1 Routing (`app/gci/[code]/page.tsx:9-19`, `app/gpci/[code]/page.tsx` identik)

- Langkahnya: `code.toUpperCase()`. Bila kode tidak ada di INDICATORS → `notFound()` (404). Lalu `INDICATOR_VIEWS[key]` atau `IndicatorFallback`. ISR `revalidate=86400`.
- **Kedua prefix menerima kode mana pun.** `/gpci/CE1` dan `/gci/CI-FV` tetap merender; breadcrumb mengikuti `ind.framework`, bukan URL. Port: boleh di-redirect ke prefix yang benar (keputusan) atau dibiarkan sama.
- Registry (`components/indicators/registry.tsx:30-50`): 19 view bespoke = semua kode `dataAvailable:true`. 9 sisanya → `IndicatorFallback` varian "Data belum tersedia".

### 2.2 Bingkai `IndicatorShell` (`components/indicators/IndicatorShell.tsx`)

`<main class="min-h-screen bg-[#faf6f2]">`:

1. **Hero** (HERO gradient, `pt-7 pb-10`):
   - Link breadcrumb (mono 12px uppercase, white/60 → hover putih) = `← {framework} · {dimension}`, mengarah ke `/{gci|gpci}`.
   - h1 26/32px bold `max-w-[30ch]` = `name`.
   - p white/75 14px = `definition`.
   - **Baris sumber:**
     - Bila `sources.length>0`: `Sumber data:`, atau `Sumber data (2):` bila lebih dari 1 (white/50, 12px). Lalu tiap sumber: link `#8ab4ff` ke `/sdi/{slug}` = judul dataset + **TierBadge** (`Primer` bg white/18%, atau `Sekunder` bg `rgba(240,161,58,0.28)`; 9px uppercase) + `↗` white/40.
     - Bila tidak ada sumber tapi ada `source`: `Sumber: {source}` warna emas `#f0a13a`. Hanya dipakai kartu belum-tersedia, dengan `source = ind.name`.
     - Tier dari `store.tiers()` (meta catalog). Live semua `Primer`.
2. **Konten** `py-8 pb-20 space-y-8`:
   - **IndexContext** (`IndexContext.tsx:14-88`). Tidak dirender bila tidak ada benchmark; ke-28 punya. Bentuknya grid `md:grid-cols-3` berisi 3 kartu putih:
     1. `Cara indeks mengukur` (mono 11px):
        - `indexMetric` (14px medium)
        - `Sumber resmi indeks: {indexSource}`
        - `Satuan: {unit}`
     2. `Jakarta vs frontier`, 3 baris kiri-kanan:
        - `Jakarta (data proksi)` = `jakarta.value ?? "—"`
        - `Frontier ({frontier.city})` = `frontier.value` (#ed6b23)
        - `Target` = `target` (#b5651d)
        - lalu `jakarta.note` 11px slate-400 bila ada
     3. `Data pendukung yang dibutuhkan`: daftar item. Tiap item:
        - badge status: `Punya` #e8f5ee/#0e7c42, `Proksi` #fff6e9/#b5651d, `Belum ada` #fdecec/#b3261e
        - `label`
        - ` · {owner}`
   - Lalu `children` view.
3. **Komponen bersama:**
   - `Block({title})` (`IndicatorShell.tsx:115-122`): h2 15px semibold slate-800 + kartu putih `rounded-xl border-slate-200 shadow-sm p-5`.
   - `KpiStat` (`components/charts/KpiStat.tsx`):
     - kartu putih p-5
     - label mono 11px uppercase slate-400
     - nilai 30px bold; number → `toLocaleString("id-ID")`, string → apa adanya
     - `sub` 12px slate-500
     - Baris KPI selalu `grid sm:grid-cols-3 gap-4`.
   - `MomNote` (`MomNote.tsx`):
     - kotak `border #f4a06b bg #fff4ec rounded-xl p-4`
     - badge `Catatan kriteria` (putih di atas #ed6b23, 10px bold uppercase)
     - teks 13px #4a453d
4. **Grafik** (semua ECharts via `echarts-for-react`, client):
   - `BarBreakdown` (`components/charts/BarBreakdown.tsx`):
     - Bar **horizontal**, warna default `#ed6b23` (bisa diganti prop `color`). Kategori di sumbu-Y `inverse:true`, jadi urutan data = atas ke bawah.
     - Label nilai di kanan (id-ID + unit).
     - Tinggi `max(160, n*34+20)`.
     - Kosong → `Tidak ada data.`
   - `LineTrend` (`components/charts/LineTrend.tsx`):
     - Area line `smooth`, oranye, gradien `rgba(237,107,35,.28→.02)`.
     - Sumbu-X `name:"Periode"`, label lewat `fmtPeriode`. `"YYYYMM"` → `"Jan 2018"`; **tanggal `"2025-01-01"` tidak terformat dan tampil mentah**.
     - Sumbu-Y `name:"Kunjungan"`; tooltip `{v} kunjungan`.
     - Tinggi 260.
     - Kurang dari 2 titik → `Data tren belum cukup.`
   - `RankedList` (`RankedList.tsx`): `<ol>` dengan nomor (slate-400) + label (truncate) + nilai id-ID. Kosong → `Tidak ada data.`
   - `Donut` (`Donut.tsx`):
     - Palet `#ed6b23,#f0a13a,#0e7c42,#2563eb,#7c3aed,#0891b2,#e11d48,#65a30d,#db2777,#0d9488`; irisan "Lainnya" `#cbd5e1`.
     - Radius 52–74%, legend scroll di bawah, tinggi 288.
     - Tooltip `{name}: {v} ({pct}%)`.
   - `GroupedLines` (`GroupedLines.tsx`):
     - Multi-line, palet `#ed6b23,#f0a13a,#0e7c42,#b3261e,#7c3aed,#0891b2`.
     - Legend di atas, x = gabungan label terurut, `connectNulls`, tinggi 300.
   - `PointMap` (`PointMap.tsx`, Leaflet + react-leaflet, ssr:false; loading `Memuat peta…`):
     - Tile OSM `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`, center `[-6.2,106.84]` z11.
     - `fitBounds(padding 30, maxZoom 13)`, tinggi 420, rounded-xl.
     - `CircleMarker` oranye fillOpacity .5, radius `4 + 14*v/max`.
     - Popup `<strong>{label}</strong><br>{v id-ID} kunjungan`.
     - Kosong → `Tidak ada titik dengan koordinat valid.`
   - Mode "perbesar" (`ChartExpand.tsx`) hanya dipakai di `ChartCard` halaman pariwisata, **tidak** di halaman indikator. Di indikator, `Block` membungkus grafik tanpa tombol perbesar.

### 2.3 Fungsi pemilihan data (`lib/indicator-data.ts`)

- **`datasetsFor(code)`**: katalog yang judulnya cocok `match`, `total>0`, diurutkan total turun.
- **`primaryData(code)`**: dataset **terbesar** (`ds[0]`), baris = `SELECT * FROM silver.<table>` (audit dibuang).
- **`pickData(code, requiredCols)`**:
  - Kandidat = dataset yang `dataset_column.key_asli` memuat **semua** `requiredCols` dan punya baris.
  - Urutkan menurut `max(periode_data)` turun (perbandingan **string**), lalu total turun.
  - Bila tidak ada kandidat → fallback ke dataset terbesar.
- **Agregasi** (`lib/agg.ts`):
  - `idNum` — parse angka format ID.
  - `groupSum(rows,g,v)` — Σ`idNum(v)` per `g`. Nilai null jadi `"—"`. Urutan = urutan kemunculan pertama.
  - `groupCount` — jumlah baris per `g`.
  - `byPeriod(rows,p,v?)` — groupSum/groupCount lalu sort label naik (string).
  - `topN(arr,n)` — sort nilai turun, ambil n.
  - `total(arr)` — Σ.

### 2.4 Per-indikator (19 view bespoke)

Konvensi: "KPI" = baris 3 `KpiStat`; blok berurutan dari atas. `→` = mengikuti kondisi tampil. Angka "live" = render produksi 2026-10-21.

#### Arketipe B — tren + lokasi: **CE1** (`Ce1.tsx`) dan **CI-FV** (`CiFv.tsx`)

- **Data:**
  - `d = pickData(code, ["lokasi","jumlah"])` → live `data-kunjungan-wisatawan-nusantara-dan-wisatawan-mancanegara-ke-tourist-information-center-tic-provinsi-dki-jakarta`. Kolom `periode_data(Date), lokasi, alamat, jumlah`; 188 baris; 10 lokasi; periode 2025-01..2026-08.
  - `nd = pickData(code, ["kebangsaan","jumlah_kunjungan"])` → live `data-jumlah-wisatawan-mancanegara-berdasarkan-kebangsaan`. Kolom `periode_data, kebangsaan, jumlah_kunjungan, perbandingan_*`; 664 baris.
  - `sources = [d, nd]`, sehingga hero menampilkan "Sumber data (2):".
- **Agregasi:**
  - `trend = byPeriod(d,"periode_data","jumlah")`
  - `perLokasi = groupSum(d,"lokasi","jumlah")` sort turun
  - `perNegara = topN(groupSum(nd,"kebangsaan","jumlah_kunjungan"),12)` — **tanpa** buang `LAINNYA`, tanpa normalisasi negara
- **Layout:**
  - **CI-FV saja:** MomNote `Menampilkan total wisatawan <b>per bulan</b> dan <b>per pintu masuk</b>, selain per kebangsaan. Klasifikasi negara pada data BPS telah distandarkan.` (Klaim ini tidak tercermin di data; lihat §0.8.)
  - KPI:
    - `Total kunjungan` = Σtrend (live **34.812**; TIC = wisnus + wisman)
    - `Lokasi TIC` = |perLokasi| (live 10)
    - `Periode terdata` = |trend| (live 20)
  - → bila trend ≥2: Block `Tren kunjungan per periode` → LineTrend
  - Block `Per lokasi TIC` → BarBreakdown
  - → bila perNegara >0: Block `Top negara asal` → RankedList. Live: LAINNYA 1.430.933, MALAYSIA 1.101.933, TIONGKOK 890.453, SINGAPURA 535.576, CHINA 411.525, JEPANG 348.477, SAUDI ARABIA 301.993, KOREA SELATAN 278.994, AMERIKA 227.370, AUSTRALIA 197.417, INDIA 193.650, BELANDA 179.833.

#### Arketipe C — breakdown wilayah: **CE2** (`Ce2.tsx`), **CI-DI** (`CiDi.tsx`), **CI-CX** (`CiCx.tsx`)

- **Data:** `pickData(code, ["wilayah","jumlah"])`.
  - CE2/CI-DI live `jumlah-restoran-per-kelurahan` (517 baris; periode 2024 & 2026; kolom `periode_data(int), wilayah, kecamatan, kelurahan, jumlah`).
  - CI-CX live `jumlah-pelaku-usaha-pariwisata-dan-ekonomi-kreatif-yang-difasilitasi-terkait-industri-halal-dan-ekonomi-syariah` (18 baris, 2025).
- **Agregasi:**
  - `perWilayah = groupSum(rows,"wilayah","jumlah")` sort turun
  - `perKecamatan = topN(groupSum(rows,"kecamatan","jumlah"),12)`
  - `grand = Σ perWilayah`
  - **Semua periode dijumlahkan** (CE2/CI-DI dobel 2024 + 2026).
- **Layout:**
  - **CE2 saja:** MomNote `Kearney saat ini hanya mengakui data restoran <b>Michelin Star</b> dan <b>TripAdvisor</b>; data Google belum diakui. Karena belum ada restoran Michelin Star di Jakarta, indikator ini dihitung dari data <b>TripAdvisor</b>.` (Dataset yang dipakai sebenarnya data perizinan, bukan TripAdvisor.)
  - KPI:
    - `Total restoran` (CE2) / `Total usaha kuliner` (CI-DI) / `Total usaha ekraf` (CI-CX) = grand. Live 18.869 / 18.869 / 20.
    - `Wilayah` = |perWilayah|. Live 6 / 6 / 3.
    - `Kecamatan terdata` = distinct `kecamatan`. Live 44 / 44 / 10.
  - Block `Sebaran per wilayah (kota)` → BarBreakdown. Label mentah, mis. `KOTA ADM. JAKARTA SELATAN`.
  - Block `Top kecamatan` → RankedList. Live CE2: KEBAYORAN BARU 1.491, KEBAYORAN LAMA 1.029, PASAR MINGGU 1.005, SETIABUDI 997, PENJARINGAN 835, TANAH ABANG 696, CILANDAK 657, TEBET 637, MENTENG 634, KELAPA GADING 601, MAMPANG PRAPATAN 572, KEBON JERUK 547.

#### Arketipe E — daftar event: **CE3** (`Ce3.tsx`), **CI-CE** (`CiCe.tsx`), **CI-AM** (`CiAm.tsx`), **CI-TH** (`CiTh.tsx`)

- **Data:**
  - CE3, CI-AM, CI-TH: `primaryData(code)` (terbesar).
  - CI-CE: `pickData("CI-CE", ["nama_venue"])`.
  - Live:
    - CE3 → `data-pemberian-rekomendasi-penyelenggaraan-pertunjukan-musik` (624 baris; **tanpa** nama_event/nama_venue)
    - CI-CE dan CI-TH → `data-seni-pertunjukan-dan-visual` (352 baris; `periode_data, nama_event, lokasi_venue, nama_venue`; semua periode 2025)
    - CI-AM → `indeks-kepuasan-layanan-penunjang-urusan-pemerintahan-daerah-dinas-pariwisata-dan-ekonomi-kreatif-tahun-2023` (898 baris, tak relevan)
- **Agregasi:**
  - `trend = byPeriod(rows,"periode_data")` (count)
  - `topVenue = groupCount(rows,"nama_venue")` sort turun, ambil 12
  - `recent` = baris dengan `nama_event`, diurutkan `periode_data` turun (string), ambil 20
- **Layout:**
  - **CE3 saja:** MomNote `Kearney hanya mengakui event seni/pertunjukan yang menghadirkan artis <b>Top 10 Global Chart</b> (Billboard/Spotify) selama <b>5 tahun berturut-turut</b>.`
  - KPI:
    - `Total event` (CI-TH: `Total pertunjukan`) = jumlah baris
    - `Venue unik` = distinct `nama_venue`; undefined dihitung 1
    - `Periode` = |trend|
    - Live: CE3 624/1/1; CI-CE 352/187/1; CI-AM 898/1/4; CI-TH 352/187/1
  - → bila trend ≥2: Block `Tren jumlah event per periode` (CI-TH: `Tren jumlah pertunjukan per periode`) → LineTrend. Unit tetap "kunjungan" (bawaan).
  - Block `Top venue (jumlah event)` (CI-TH: `Top venue (jumlah pertunjukan)`) → RankedList. Live CI-CE: THE H CLUB SCBD, JAKARTA 18; THE KASABLANKA HALL, JAKARTA 13; TENNIS INDOOR SENAYAN, JAKARTA 12; BLACK OWL PIK, JAKARTA 12; … (12 baris).
  - Block `Event terbaru` (CI-TH: `Pertunjukan terbaru`) → tabel 13px:
    - kolom `Tanggal` (=periode_data, mis. "2025"), `Event`, `Venue`
    - header 11px uppercase slate-500
    - kosong → `Tidak ada baris event.`

#### Arketipe A — peta titik: **CE4** (`Ce4.tsx`), **CI-TA** (`CiTa.tsx`), **CI-WH** (`CiWh.tsx`), **CI-MU** (`CiMu.tsx`)

- **Data:**
  - CE4, CI-WH, CI-MU: `primaryData`.
  - CI-TA: `pickData(["obyek_wisata","jumlah_kunjungan"])`.
  - Live keempatnya → `jumlah-kunjungan-wisatawan-ke-obyek-wisata-menurut-lokasi-di-provinsi-dki-jakarta`. 975 baris; 29 obyek; `periode_data(Date 2025-01..2026-08), obyek_wisata, alamat, longitude, latitude, jenis_wisatawan ∈ {WISATAWAN NUSANTARA, WISATAWAN MANCANEGARA}, jumlah_kunjungan`.
- **Filter `obyek_wisata`** (regex, case-insensitive):
  - CE4 `/museum|monumen/`
  - CI-WH `/kota tua|heritage|fatahillah|onrust/`
  - CI-MU `/museum/`
  - CI-TA tanpa filter
- **Agregasi:**
  - `byObyek = topN(groupSum(f,"obyek_wisata","jumlah_kunjungan"),15)`
  - `trend = byPeriod(f,"periode_data","jumlah_kunjungan")`
  - `points` = **satu titik per baris** (bukan per obyek): `{lat:Number(longitude), lng:Number(latitude), label:obyek_wisata, value:idNum(jumlah_kunjungan)}`, difilter finite
  - `wisman = groupSum(f,"jenis_wisatawan","jumlah_kunjungan")`
- **Layout:**
  - KPI:
    - `Total kunjungan` = Σ**byObyek (top-15 saja)**
    - label kedua: `Obyek wisata` (CE4, CI-TA) / `Obyek heritage` (CI-WH) / `Museum` (CI-MU) = |byObyek| (**maks 15**)
    - `Titik terpetakan` = |points|
    - Live: CE4 14.169.816 / 15 / 618; CI-TA 51.665.492 / 15 / 975; CI-WH 4.574.698 / 2 / 80; CI-MU 3.331.667 / 15 / 578
  - Block peta. Judul: `Sebaran titik obyek wisata` (CE4, CI-TA) / `Sebaran titik obyek heritage` (CI-WH) / `Sebaran titik museum` (CI-MU). Isi: PointMap.
  - Grid `md:grid-cols-2`:
    - Block `Top 15 obyek (kunjungan)` (CI-MU: `Top 15 museum (kunjungan)`) → RankedList
    - Block `Komposisi wisman / wisnus` → Donut
  - → bila trend ≥2: Block `Tren kunjungan per periode` → LineTrend
- **Contoh live:**
  - CE4 top: MONUMEN NASIONAL 10.842.251, MUSEUM NASIONAL 1.073.579, MUSEUM WAYANG 815.599, …
  - CI-WH: KAWASAN KOTA TUA 4.548.972, MUSEUM ARKEOLOGI ONRUST 25.726

#### Arketipe D — registri usaha: **BA-MICE** (`BaMice.tsx`), **CI-IC** (`CiIc.tsx`), **CI-HR** (`CiHr.tsx`), **CI-NL** (`CiNl.tsx`)

- **Data:** `primaryData`. Live:
  - BA-MICE/CI-IC → `jumlah-usaha-penyelenggaraan-pertemuan-perjalanan-insentif-konferensi-dan-pameran-pariwisata-yang-memiliki-perizinan` (8.636)
  - CI-HR → `jumlah-usaha-penyediaan-akomodasi-pariwisata-yang-memiliki-perizinan` (25.363)
  - CI-NL → `jumlah-usaha-penyelenggaraan-kegiatan-hiburan-dan-rekreasi-pariwisata-yang-memiliki-perizinan` (7.713)
  - Kolom (sama di ketiganya): `periode_data(2023..2026), nomor, kbli, uraian_kbli, jenis_usaha, nama_perusahaan_atau_pelaku_usaha, nama_usaha_atau_kegiatan, alamat_usaha, provinsi, kabupaten_atau_kota, kecamatan, kelurahan, jumlah_tki, skala_usaha, status_permodalan`
  - **Semua periode dihitung.** Satu usaha bisa tercatat lebih dari sekali lintas tahun (**belum terverifikasi** seberapa besar).
- **Agregasi:**
  - `perJenis = topN(groupCount("uraian_kbli"),10)`
  - `perSkala = groupCount("skala_usaha")` sort turun
  - `perKota = groupCount("kabupaten_atau_kota")` sort turun
- **Layout:**
  - KPI:
    - label pertama: `Total usaha MICE` (BA-MICE) / `Total usaha` (CI-IC) / `Total usaha akomodasi` (CI-HR) / `Total usaha hiburan` (CI-NL) = jumlah baris
    - `Jenis (KBLI)` = distinct `uraian_kbli`
    - `Kota/Kab` = |perKota|
    - Live: 8.636/3/9; 8.636/3/9; 25.363/9/16; 7.713/30/18
  - Block judul pertama: `Per jenis usaha MICE (KBLI)` (BA-MICE) / `Per jenis usaha (KBLI)` (CI-IC, CI-NL) / `Per jenis akomodasi (KBLI)` (CI-HR). Isi: BarBreakdown oranye.
  - Grid `md:grid-cols-2`:
    - Block `Per skala usaha` → BarBreakdown `#0e7c42`
    - Block `Per kota/kabupaten` → BarBreakdown `#e8a33d`

#### Arketipe F — okupansi: **CI-LH** (`CiLh.tsx`)

- **Data:** `pickData("CI-LH", ["jenis_hotel","rata_rata"])` → live `data-rata-rata-tingkat-hunian-kamar-pada-hotel-berbintang-di-provinsi-dki-jakarta`. 155 baris = 31 periode × `BINTANG 1..5`; `rata_rata` float (mis. 51.85); periode Date 2024-01..2026-07.
- **Agregasi:**
  - per `jenis_hotel`: `series.data = byPeriod(rs,"periode_data","rata_rata")` → **menjumlah** rata-rata per periode. Aman selama 1 baris per pasangan; dicek live tanpa duplikat.
  - `star5` = baris dengan `jenis_hotel` cocok `/5\s*[★*]?|bintang\s*5/i` dan periode terbesar
  - `latest5 = idNum(star5.rata_rata)`
- **Layout:**
  - KPI:
    - `Jenis hotel` = 5
    - `Baris data` = 155
    - `Okupansi bintang 5 (terbaru)` = `latest5.toFixed(2)+"%"`. Desimal **titik**, mis. live `50.45%`. Sub = periode mentah, live `2026-07-01`.
  - Block `Okupansi per jenis hotel (% rata-rata)` → GroupedLines. Seri dinamai `BINTANG 1`…`BINTANG 5`, urutan kemunculan.

#### Arketipe G — survei pengeluaran: **CI-SH** (`CiSh.tsx`)

- **Data:** `pickData("CI-SH", ["asal_negara","rata_rata"])` → live `rata-rata-pengeluaran-kunjungan-wisatawan` (3 baris 2025: `jenis_wisatawan, asal_negara, jumlah_responden, rata_rata`).
- **Agregasi:**
  - `perNegara = groupSum("asal_negara","rata_rata")` sort turun, ambil 15
  - `wisman = groupSum("jenis_wisatawan","rata_rata")` — **jumlah rata-rata**
- **Layout:**
  - KPI:
    - `Total responden` = Σ jumlah_responden (live 101)
    - `Negara asal` = |perNegara| (3)
    - `Rata-rata keseluruhan` = `Math.round(Σ perNegara)` (live **6.864.986**) — **salah secara statistik**
  - Block `Rata-rata pengeluaran per negara asal` → BarBreakdown
  - → bila wisman >0: Block `Komposisi wisman / wisnus` → Donut

### 2.5 Indikator "Data belum tersedia" (9: CE5, CE6, HC-VISA, CI-FR, CI-ST, AC-DF, AC-AP, AC-AR, AC-TT)

`IndicatorFallback` (`registry.tsx:52-123`): `IndicatorShell code source={ind.name}`. Hero menampilkan `Sumber: {name}` emas, lalu IndexContext tetap tampil, lalu kartu:

- `rounded-xl border-2 border-dashed border-slate-300 bg-white p-8 max-w-[760px]`
- pill `Data belum tersedia` (mono 11px, bg-red-50 text-red-700) + `{framework} · {dimension}` (mono slate-400)
- `{code} · {name}` (18px semibold)
- `definition` (14px slate-600)
- `<dl>` 2 kolom:
  - `Owner / OPD pemilik` = owner
  - `Status readiness` = pill **`gap`** (#fdecec/#b3261e; huruf kecil, hard-coded)
  - (span 2) `Keterangan` = note

Varian lain:
- Kode tak dikenal: tidak terjangkau, karena halaman sudah `notFound()`.
- "Visualisasi indikator ini belum tersedia": tidak terpakai saat ini.

### 2.6 Defect yang terlihat di layar (putuskan: paritas vs perbaiki)

| # | Indikator | Gejala live | Sebab | Usulan perbaikan |
|---|---|---|---|---|
| D1 | CE3 | Venue unik 1, "—" 624, tabel kosong | dataset terbesar tanpa kolom event/venue | petakan ke `data-seni-pertunjukan-dan-visual` |
| D2 | CI-AM | 898 "event" dari survei kepuasan ASN | kata kunci "ekonomi kreatif" | petakan ke dataset seni/ekraf relevan, atau tandai belum tersedia |
| D3 | CI-CX | 20 "usaha ekraf" = fasilitasi halal | kata kunci | petakan ke `jumlah-produkjasa-ekonomi-kreatif-yang-didaftarkan-kekayaan-intelektualnya` (kolom **belum terverifikasi**) |
| D4 | CE2/CI-DI | 18.869 (2024+2026 dobel) | groupSum semua periode | filter periode terbaru (kuliner-michelin = 12.932) |
| D5 | CE4/TA/WH/MU | total & jumlah obyek dibatasi top-15; titik per-baris (975) | KPI dari `topN` | KPI dari seluruh hasil filter; titik per obyek |
| D6 | CI-SH | "Rata-rata keseluruhan" 6.864.986 | Σ rata-rata | rata-rata tertimbang responden |
| D7 | CE1/CI-FV | LAINNYA, TIONGKOK+CHINA terpisah | tanpa normalisasi | pakai `wisman-jakarta-per-negara` (bersih) atau `silver.dim_negara` |
| D8 | CE1/CI-FV | "Total kunjungan" = TIC wisnus+wisman | dataset TIC | label/ dataset |
| D9 | overview | "Nilai terbaru" sampah | heuristik `latestValue` | nilai terdefinisi per indikator, atau "—" |
| D10 | semua tren | label sumbu `2025-01-01` mentah | `fmtPeriode` hanya `YYYYMM` | API kirim label terformat |

---

## 3. Subhalaman `/gci/pariwisata/*` dan `/gpci/*`

Dua keluarga yang berbeda gaya:

- **(P) "PariwisataShell"**, dirender server dari lakehouse (`force-dynamic`): wisatawan-internasional, kuliner-michelin, seni-pertunjukan.
- **(S) View statis** (client-only `dynamic(...,{ssr:false})`, data = array TS di bundle): restoran-gci, direktori-restoran, pertunjukan-budaya, gpci/hotel, lapangan-golf, toko-suvenir.
  - Loading: `<main class="min-h-screen bg-paper px-6 py-8"><p role="status">Memuat data…</p></main>`.
  - **`AtlasNav` merender `null` bila prop `view` tak diberikan** (`components/atlas/AtlasNav.tsx:22`). Akibatnya restoran-gci, pertunjukan-budaya, lapangan-golf, dan toko-suvenir **tidak punya toggle bahasa yang terlihat**. Hanya direktori-restoran (`view="list"`) yang menampilkannya.
  - Semua S-view memakai `ExportButton` (`components/atlas/ExportButton.tsx`, `lib/export.ts`):
    - menu `CSV .csv` / `XLS .xls` / `XLSX .xlsx`
    - CSV ber-BOM UTF-8 + CRLF; XLS/XLSX lewat SheetJS (lazy), lebar kolom 8–50 (ada bug kecil indeks di `lib/export.ts:89-90`)

### 3.0 `PariwisataShell` + DashboardKit (dipakai keluarga P)

**`components/pariwisata/PariwisataShell.tsx`** (bg `#faf6f2`):
- **Hero** (gradient yang sama, `pt-7 pb-10`):
  - breadcrumb link `/gci`: `← GCI · Pengalaman Budaya` (mono 12px white/60)
  - flex wrap, kiri `max-w-[62ch]`:
    - eyebrow opsional: `●` emas + teks (mono 12px white/55)
    - h1 `atlas-display` putih
    - baris meta 13px: `Tahun: {tahun}` (hanya bila `tahun` ada; nilai emas) dan `Sumber: {sumber} ↗`. Sumber berupa link `#8ab4ff` bila `sumberHref` ada; tanpa href → emas.
    - `catatan` dalam chip `rounded-lg border-white/12 bg-white/[0.04] 12px white/70`
  - kanan: kotak `rounded-2xl border-white/12 bg-white/[0.05] px-6 py-5`:
    - label `apple-fine uppercase white/50` = `Angka indikator` + ` {tahun}` bila ada
    - angka `46px bold` + satuan `apple-caption white/60`
- Konten `py-10 pb-20 space-y-10`.
- **`Section({title, desc})`**: h2 `atlas-display-md`, desc `apple-caption text-ink-muted-48 max-w-[80ch]`, isi `mt-4`.

**`components/pariwisata/DashboardKit.tsx`**:
- `PALETTE = ["#ed6b23","#f0a13a","#c2410c","#f4a672","#9a3412","#fb923c"]`
- `KpiRow` = grid `sm:2 lg:4 gap-4`
- `Kpi({label,value,sub,delta})` = KpiStat. Bila `delta` finite: sub menjadi `"▲|▼ {|delta| id-ID max 1 desimal}% {sub}"`.
- `ChartCard({title,sub})` = `ExpandableChartCard` (`components/charts/ChartExpand.tsx:60-184`):
  - `utility-card p-5`
  - judul 14px semibold dengan border kiri 2px oranye; sub `apple-fine`
  - tombol ikon kanan-atas `aria-label="Perbesar grafik"` membuka modal `fixed inset-0 bg-black/50`, kartu `max-w-[1400px]`, judul 16px, tombol `Tutup`
  - Di mode perbesar, grafik menampilkan label nilai, dataZoom (slider oranye), dan tinggi `min(68vh,640px)`.
- `ChartGrid({cols=3})` = `md:2 lg:3` (atau `md:2`).
- `RawDataDisclosure({slug,title,count,columns?,label="Lihat data mentah"})`:
  - `<details>` tertutup, summary `▸ {label} · {title} ({count id-ID} baris)`
  - isi `SdiTable slug` = tabel berhalaman dari `GET /api/sdi/{slug}?offset&limit&q` (`components/SdiTable.tsx:72-73`)
  - Endpoint baris dataset ini dibagi dengan halaman `/sdi/*` (inventaris lain); di sini cukup dirujuk.

### 3.1 (P) `/gci/pariwisata/wisatawan-internasional` (`app/gci/pariwisata/wisatawan-internasional/page.tsx`, `components/pariwisata/WismanDashboard.tsx`)

- **Data** (`rowsFor`, slug tetap — tidak lewat pencocokan judul):
  - `wisman-jakarta-per-bulan`: `periode_data(Date), tahun, bulan, jumlah_kunjungan`; 28 baris 2024-01..2026-04.
  - `wisman-jakarta-per-negara`: `periode_data, negara, jumlah_kunjungan`; 604 baris. Nama negara sudah bersih, mis. "Tiongkok".
  - `wisman-jakarta-per-pintu-masuk`: arsip 2010–2014, 480 baris; **hanya** untuk tabel mentah.
- **Shell (hard-coded):**
  - eyebrow `Cultural Experience · Wisatawan Internasional`
  - title `Wisatawan Internasional`
  - nilai **`2.767.622`**, satuan `Wisatawan`, tahun `2025`
  - catatan `Angka resmi 2.767.622 (BPS 2025). Data bulanan Dispar mencatat 2.754.220 untuk 2025 — selaras. Pilih tahun untuk melihat detail; tren lintas-tahun ada di bawah.` (angka 2.754.220 di teks juga hard-coded)
  - sumber `jakarta.bps.go.id` → https://jakarta.bps.go.id
- **Praproses server per tahun** (`page.tsx:50-80`):
  - `years` = distinct `tahun ?? periode_data[0:4]` dari tabel bulan, terurut.
  - Per tahun:
    - `monthly = byPeriod(bulan_y,"periode_data","jumlah_kunjungan")`
    - `total = Σ monthly`
    - `peakMonth` = maks
    - `quarterly` = Q1..Q4, hanya kuartal yang `>0`
    - `partial = (baris bulan < 12)`
  - Negara: baris tahun `y` tanpa catch-all (`LAINNYA, JUMLAH, TOTAL, -, "", PINTU LAINNYA`; `lib/pariwisata/parse.ts:69-73`).
    - `ranked` = groupSum sort turun
    - `topNegara` = top 5
    - `donutNegara` = top 8 + `Lainnya` (= total − Σtop8, bila >0)
  - `yearlyTotals`, `defaultYear` = "2025" bila ada, kalau tidak tahun terakhir.
- **WismanDashboard** (client; `useState(defaultYear)`):
  1. **Pemilih tahun:**
     - label `Pilih tahun` (apple-fine uppercase)
     - segmented `rounded-xl border bg-white p-1`; tombol aktif bg `#ed6b23` putih
     - tahun parsial diberi `•` (10px opacity 70)
     - bila tahun aktif parsial: `• {year} masih berjalan (data parsial)`
  2. **KpiRow (4):**
     - `Total wisman {year}` = total, sub `akumulasi bulanan`
     - `Negara asal terbanyak` = top1 label, sub `{v} kunjungan`
     - `Puncak bulan` = `bulanLabel(peak)` (mis. `Agu '25`), sub `{v} kunjungan`
     - `Pertumbuhan tahunan` = `${yoy.toFixed(1)}%` (titik desimal, mis. `9.0%`), `delta=yoy`, sub `vs {prevYear}` → render `▲ 9% vs 2024`
  3. **ChartGrid (3 kolom, 4 kartu):**
     - `Tren bulanan {year}` / `kunjungan per bulan (batang)` → `VerticalBars` (unit ` kunjungan`, label `bulanLabel`)
     - `Top 5 negara asal {year}` / `kunjungan per negara` → BarBreakdown
     - `Peta komposisi negara {year}` / `treemap · proporsi & detail` → `Treemap`
     - `Komposisi negara {year}` / `top 8 + lainnya (donut)` → Donut
  4. `Perbandingan kuartal antar tahun` / `Q1–Q4 dibandingkan lintas tahun` (+ ` · tahun berjalan ditandai •`) → `GroupedBars`. Seri per tahun; nama tahun parsial `"2026 •"`.
  5. `Tren wisman per tahun` / `total kunjungan tahunan` (+ penanda •) → BarBreakdown warna `PALETTE[2]` (#c2410c). Label tahun parsial `"2026 •"`.
  6. `Target vs Realisasi Wisman (RPJMD 2025–2029)` / `Batang berdampingan: realisasi (asli) vs target Jumlah Tamu Mancanegara` → GroupedBars:
     - seri `Realisasi (asli)` #ed6b23 dan `Target (RPJMD)` #0e7c42, unit ` org`
     - kategori = gabungan tahun data + tahun target
     - catatan di bawah: `Oranye = realisasi (asli) · hijau = target RPJMD. Sumber target: Tabel III.2 indikator 2.1.c (kondisi awal 1.273.358). Tahun berjalan = data parsial.`
     - **Hard-coded** `TARGET_WISMAN` (`WismanDashboard.tsx:33-40`): 2025 1.286.092; 2026 1.289.257; 2027 1.594.162; 2028 1.848.874; 2029 2.105.833; 2030 2.332.494; `KONDISI_AWAL_WISMAN = 1.273.358`. Duplikat di `lib/dashboard/data.ts` menurut plan b1-raw-04 (**belum terverifikasi** sama).
  - Bila tidak ada data: `Data wisman belum tersedia.`
- **Section** `Data mentah & sumber` / `Datamart wisman Jakarta — Dinas Pariwisata & Ekraf.`, berisi 3 RawDataDisclosure:
  - `Wisman per bulan (2024–2026)` (28 baris)
  - `Wisman per negara (s/d 2026)` (604)
  - `Wisman per pintu masuk (arsip 2010/2014, nasional)` (480)
- **Live (2026-10-21), tahun 2025:** 2.754.220; Tiongkok 504.574; Agu '25 305.104; 9.0% (▲ 9% vs 2024). Tahun yang tersedia: 2024, 2025, 2026•.
- Komponen grafik tambahan (`VerticalBars`, `Treemap`, `GroupedBars`) ada di `components/charts/`. Opsi ECharts **belum diinventaris rinci di sini**; baca berkasnya saat porting.

### 3.2 (P) `/gci/pariwisata/kuliner-michelin` (`app/gci/pariwisata/kuliner-michelin/page.tsx`)

- **Data:**
  - `jumlah-restoran-per-kelurahan` (517 baris)
  - `data-usaha-jasa-makanan-dan-minuman-jenis-usaha-restoran-di-dki-jakarta` (arsip 2014, 3.957 baris; hanya dihitung jumlahnya)
  - `restoran-tripadvisor-jakarta` (38 baris; hanya dihitung jumlahnya)
- **Agregasi:**
  - `latestYear` = maks `periode_data[0:4]` (live **2026**); `perKel` = baris tahun itu
  - `perWilayah = groupSum(titleCase(wilayah) tanpa awalan "Kota Adm.")` sort turun
  - `topKec = topN(groupSum(titleCase(kecamatan)),10)`
  - `totalResto = Σ`
  - `kelurahanTercakup` = distinct `kelurahan`
- **Shell:**
  - eyebrow `Cultural Experience · Penawaran Kuliner`
  - title `Penawaran Kuliner (Michelin)`
  - nilai **`0`**, satuan `Restoran Michelin`, tahun `2025`
  - catatan `Belum ada Michelin Star di Jakarta (2025); Panduan Michelin belum masuk Indonesia. Data pendukung menunjukkan sebaran restoran per kelurahan.`
  - sumber `Michelin Guide` → https://guide.michelin.com
- **KpiRow:**
  - `Restoran Michelin` = `0`, sub `Michelin Guide · 2025`
  - `Restoran terdata ({latestYear})` = totalResto (live 12.932), sub `sebaran per kelurahan`
  - `Kelurahan tercakup` (live 266)
  - `Wilayah terpadat` = perWilayah[0].label (live `Jakarta Selatan`)
- **ChartGrid 3:**
  - `Restoran per wilayah` (sub = tahun) → BarBreakdown unit ` resto`
  - `Top 10 kecamatan` → BarBreakdown `PALETTE[1]` unit ` resto`
  - `Share per wilayah` → Donut
- **Section** `Data mentah & sumber` / `Sumber katalog SDI — Dinas Pariwisata & Ekraf.`, berisi 3 disclosure:
  - `Jumlah restoran per kelurahan ({latestYear})` (count = **semua** 517 baris, bukan baris tahun terbaru)
  - `Daftar usaha restoran (arsip 2014)` (3.957)
  - `Kuliner TripAdvisor Jakarta (kriteria Kearney: TripAdvisor & Michelin)` (38)

### 3.3 (P) `/gci/pariwisata/seni-pertunjukan` (`app/gci/pariwisata/seni-pertunjukan/page.tsx`)

- **Data** (6 slug tetap):
  - `artis-top-global-chart` (100 baris; `tahun, chart, peringkat, artis, negara_asal, sumber`)
  - `data-seni-pertunjukan-dan-visual` (352)
  - `data-penyelenggaraan-event-pariwisata-dan-budaya-dki-jakarta` (244; korpus `kegiatan`)
  - `data-event-pariwisata-dan-kebudayaan-dki-jakarta-2011-2019` (1.391; korpus `nama_event`)
  - `data-rekomendasi-penyelenggaraan-pertunjukan-musik` (31; korpus `nama_kegiatan`)
  - `jumlah-penyelenggaraan-event` (24; `periode_data, bulan_penyelenggaraan, jumlah_event`)
  - Data statis tambahan:
    - `lib/pariwisata/seni-venues.json`: 138 venue, 284 event, semua periode "2025", 2 venue `gold`. Dibuat oleh `/home/uaa/Dinas-Pariwisata/scripts/geocode_seni_venues.py`.
    - `lib/pariwisata/jakarta-appearances.ts`: ED SHEERAN, BRUNO MARS, JUSTIN BIEBER beserta tahun/venue/URL sumber.
- **Filter tahun** (`?tahun=`; `TahunFilter.tsx`, `<select>`):
  - opsi = distinct `periode_data` dari seni + penyelenggaraan, terurut (live `2024, 2025`), dengan opsi awal `Semua tahun`
  - nilai tak valid → semua
  - **Ganti filter = navigasi `router.replace`, lalu render ulang di server.**
- **Agregasi:**
  - `eventBulanan = byPeriod({periode: periode_data + pad2(bulan_penyelenggaraan)}, "jumlah_event")` → label `YYYYMM`, diformat `fmtPeriode` (`Jan 2024`)
  - `eventPerTahun` → `periodeEvent` = tahun terpilih, atau `"{min}–{max}"`
  - `topVenue = topN(groupCount(seni,"nama_venue"),10)`
  - `perWilayah = groupCount(wilayahFromAddress(lokasi_venue))` sort turun. Fungsinya ada di `lib/pariwisata/parse.ts:9-29`: regex nama wilayah ID/EN, lalu awalan kodepos 10–14, lalu `Jakarta (tidak terinci)`.
  - `eventTotal = Σ jumlah_event`
  - `venueUnik` = distinct non-kosong
  - **Artis:**
    - `distinct` = artis unik dari chart
    - `played(a)` = ada di `JAKARTA_APPEARANCES` **atau** muncul (word-boundary, minimal 3 huruf; `parse.ts:35-46`) di korpus nama event 4 dataset (**semua tahun**)
    - `topGlobalCount` = baris seni yang `nama_event`-nya memuat artis mana pun
    - `persen = topGlobalCount/seni*100`
- **Shell:**
  - eyebrow `Cultural Experience · Seni Visual & Pertunjukan`
  - title `Seni Visual & Pertunjukan`
  - nilai = **`seni.length` (dinamis, live 352)** — bandingkan kartu overview yang hard-coded 156
  - satuan `Pertunjukan`, **tanpa tahun**
  - catatan `Berdasarkan data Dinas Pariwisata DKI Jakarta`
  - sumber `Satu Data Jakarta, Calendar of Event` → https://satudata.jakarta.go.id/open-data/data-seni-pertunjukan-dan-visual
- **Isi:**
  1. TahunFilter rata kanan.
  2. KpiRow (6 KPI, jadi 2 baris di lg):
     - `Jumlah pertunjukan` = seni.length, sub `{tahun || "semua tahun"}`
     - `Memenuhi kriteria top global` = topGlobalCount, sub `menampilkan artis Top 10 Global Chart`
     - `Persentase top global` = `{id-ID ≤1 desimal}%` atau `NA`, sub `top global / total pertunjukan`
     - `Skor Kearney (resmi)` = `"156"` bila tanpa filter atau tahun 2024, selain itu `NA` (**hard-coded**); sub `angka resmi Kearney 2024, bukan hitungan data SDI`
     - `Venue unik`
     - `Penyelenggaraan event` = eventTotal atau `NA`, sub `{tahun || "semua tahun"}`
     - Live tanpa filter: 352 / 0 / 0% / 156 / 187 / 586.
  3. ChartGrid 3:
     - `Penyelenggaraan event / bulan` / `semua event pariwisata & budaya · {periodeEvent}` → LineTrend `unit="event" yName="Event"`
     - `Top 10 venue tersibuk` → BarBreakdown `PALETTE[1]`
     - `Event per wilayah Jakarta` / `klasifikasi alamat → wilayah (lengkap)` → Donut `showPercent`
  4. Section `Peta venue seni & pertunjukan` → `VenueMapClient` (loading `Memuat peta venue…`). Venue difilter: event per venue disaring tahun, lalu venue dengan 0 event dibuang. Peta `components/pariwisata/VenueMap.tsx`:
     - **Basemap:** Esri Light Gray Base + Reference (`services.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_{Base|Reference}/MapServer/tile/{z}/{y}/{x}`).
     - **Peta:** center `[-6.2,106.85]` z11, `preferCanvas`, `fitBounds(30, maxZoom 13)`.
     - **Marker:**
       - venue biasa: dot `#ed6b23` opacity .85, stroke putih 1, radius `4 + 9·events/max`
       - venue gold: halo r18 `#e6a900` .22 + dot r9 (r11 bila terpilih), stroke `#8a6a00`
       - terpilih: stroke `#1d1d1f` 3
     - **Legend** kanan-bawah: `Venue event · radius ∝ jumlah`, `Pernah menghadirkan artis Top-10`.
     - **Panel kanan** (`md:w-[340px]`, h 420/520). Default terpilih = venue gold pertama. Isi panel:
       - iframe `https://maps.google.com/maps?q={lat},{lon}&z=16&output=embed`
       - wilayah (oranye, atau emas-gelap bila gold) + badge `★ Top-10 Venue`
       - nama 17px, alamat
       - kotak `Artis Top-10 Global Chart:` + daftar
       - `<b>{n}</b> event terdata` + daftar `• {nama_event} ({periode})`
       - footer `Buka di Maps ↗` (https://www.google.com/maps/search/?api=1&query={lat},{lon}) dan `Sumber ↗` (URL SDI di atas)
     - **Kosong:** `Belum ada venue dengan koordinat.` Tanpa venue terpilih: `Klik titik venue di peta untuk melihat detail & peta lokasi.`
  5. Section `Referensi Artis Top 10 Global Chart` (kosong → `Data artis chart belum tersedia.`):
     - **Tabel `Artis yang sudah tampil di Jakarta`:**
       - pill oranye + `{n} artis · sumber: verifikasi publik dan data event Dispar`
       - header oranye; kolom `Artis | Negara | Tahun tampil | Venue | Sumber` (`Verifikasi ↗` biru, atau abu `Data event Dispar`)
       - urut tahun tampil terakhir turun, lalu nama
       - Live 3 baris: Bruno Mars, Ed Sheeran, Justin Bieber.
     - **Per chart** (`Billboard Year-End Top Artists`, `Spotify Global Year-End`; hanya yang ada di data): matriks peringkat 1–10 × tahun.
       - pill + `peringkat 1–10 · {tahun, …}`
       - sel = artis + `✓` hijau bila played + ` · {negara}` 11px, atau `—`
  6. Section `Sumber` / `Data pendukung Dinas Pariwisata & Ekraf — event pertunjukan & seni visual di Jakarta.`:
     - RawDataDisclosure `label="Lihat data SDI"`, title `Seni Visual & Pertunjukan`, kolom `nama_event, nama_venue, lokasi_venue, periode_data`
     - kotak `Data pendukung lain (katalog SDI)` berisi 3 link biru `/sdi/{slug}`: `Penyelenggaraan Event Pariwisata & Budaya ↗`, `Event Pariwisata & Kebudayaan 2011–2019 ↗`, `Rekomendasi Penyelenggaraan Pertunjukan Musik ↗`

### 3.4 (S) `/gci/pariwisata/restoran-gci` → `components/GciView.tsx`

**Data** (statis; ±1,4 MB TS digabung saat impor `lib/gci.ts`). Sumber, dengan jumlah yang dihitung lewat `tsx`:

| Berkas | Isi | Jumlah |
|---|---|---|
| `SEED` (`lib/gci.ts:133-224`) | kurasi | 65 |
| `lib/gci-osm.ts` `GCI_OSM` | Overpass, `GCI_OSM_FETCHED_AT=2026-06-20T14:38:45Z` | 2.573 |
| `lib/gci-ratings.ts` | rating Google | 2.570 kunci, 1.785 `found` |
| `lib/gci-addresses.ts` | alamat | 2.573 |
| `lib/gci-pricelevels.ts` | tingkat harga | 1.147 |
| `lib/gci-hotel-restos.ts` | nama resto di dalam hotel | 107 |

**Aturan gabung** (`lib/gci.ts:226-386`):
- **Kurasi:**
  - rating SEED menang, kalau tidak ada pakai rating `found`
  - `city = deriveCity(area)`, fallback "Jakarta Pusat"
  - alamat berjenjang: Google → OSM via placeId → OSM via nama → OSM hotel induk
- **Baris OSM:**
  - dilewati bila `nameKey` sama dengan baris kurasi
  - nama resto-hotel diganti
- **Dedupe:**
  - placeId sama → satu baris
  - tanpa placeId: `nameKey` sama **dan** jarak ≤60 m
  - 49 baris terbuang
- **Urutan tampil:** tier (★5, ★4, ★3, Restoran, Cafe) → ber-rating dulu → `reviewCount` turun → nama.

**Tipe `GciRestaurant`:** `id, name, cuisine, area, address?, city, hotel?, tier("Hotel ★5"|"Hotel ★4"|"Hotel ★3"|"Restoran"|"Cafe"), rating?, reviewCount?, ratingSource?("Google"), source("curated"|"osm"), lat?, lng?, placeId?, priceLevel?("$".."$$$$"), priceSource?("Google"|"local"|"editorial"), needsVerify?`.

**Total 2.577:**
- tier: ★4 68, ★3 70, Restoran 1.727, Cafe 712, ★5 0
- ber-rating 1.793

**Layout** (`<main data-section="gci" class="min-h-screen flex flex-col bg-paper">`). AtlasNav tidak tampil.

1. **Hero** (`max-w-[1320px] py-10 md:py-14`):
   - baris `GLOBAL CITY INDEX · DISPAREKRAF DKI` — garis hairline — **hard-coded** `SENIN · 22 JUNI 2026 · 16.00 WIB`
   - grid 12, kiri col-7:
     - h1 `Restoran ` + italic aksen `GCI`
     - p `Inventarisasi seluruh restoran & cafe di Jakarta beserta keberagaman kuliner internasional — termasuk restoran hotel bintang 3 & 4 — untuk Global City Index.`
   - kanan col-5: `dl` 4 kolom (`gciStats()`, `lib/gci.ts:394-403`, selalu atas **seluruh** data):
     - `TOTAL` 2.577
     - `ADA RATING` 1.793
     - `HOTEL` 138
     - `CAFE` 712
2. **Strip filter** (`frosted sticky top-[56px] z-20`):
   - `FILTER ·`
   - pill tier: `Semua | Hotel ★4 | Hotel ★3 | Restoran | Cafe` (aktif = aksen putih)
   - select kota: `Semua` + yang ada dari CITY_ORDER (Jakarta Pusat, Selatan, Utara, Barat, Timur, Kepulauan Seribu)
   - select rating: `Semua (rating)` / `Ada rating` / `Belum ada rating`
   - search `Cari nama / kuliner / area…`, substring pada name, cuisine, area, address, hotel
   - kanan: `{filtered}/{2577} entri`
   - checkbox `hanya ber-rating` (default **tercentang**; title `Saat ekspor, hanya sertakan venue yang punya rating (tanpa sel kosong)`)
   - ExportButton `Ekspor Excel ({n})`
3. **Tabel**, 9 kolom: `No.` | `Nama` | `Jenis Cuisine` | `Alamat` | `Harga` | `Rating` | `Jumlah Ulasan` | `Sumber` | `Tier`.
   - **Nama:** link `gciMapsUrl`, ditambah sub-baris hotel bila ada.
   - **Alamat:** `address ?? area`.
   - **Harga:** priceLevel atau `—`; nilai editorial diberi ` *` dengan title `Perkiraan editorial — Google tidak punya data harga untuk venue ini`.
   - **Rating:** `toFixed(1)` dengan koma, atau `—`; `needsVerify` diberi ` *` dengan title `Angka belum diverifikasi`.
   - **Jumlah Ulasan:** id-ID atau `—`.
   - **Sumber:** ratingSource, atau kosong.
   - **Badge tier** (`GciView.tsx:412-418`):

     | Tier | Background | Teks |
     |---|---|---|
     | ★5 | `rgba(26,58,90,.10)` | `#1A3A5A` |
     | ★4 | `rgba(14,124,66,.10)` | `var(--accent-deep)` |
     | ★3 | `rgba(200,161,75,.16)` | `#8a6d23` |
     | Restoran | `rgba(15,23,42,.06)` | muted-80 |
     | Cafe | `rgba(139,90,43,.12)` | `#8B5A2B` |

   - Kosong: `Tidak ada entri yang cocok dengan filter.`
4. **Paging:**
   - `PAGE=200`, direset saat filter berubah
   - tombol `Muat {min(200,sisa)} lagi` dan `Tampilkan semua ({n})`
   - teks `Menampilkan {paged} dari {filtered} entri terfilter. Ekspor selalu mengikutkan seluruh {filtered} entri hasil filter.`
5. **Footer:**
   - `Sumber: Wanderlog, TripAdvisor, situs hotel resmi (data Google). GCI — Disparekraf DKI Jakarta.`
   - kanan `Diset dengan SF Pro · Inter sebagai cadangan.`

**Ekspor:**
- berkas `data-restoran-GCI-YYYY-MM-DD`, sheet `Restoran GCI`
- baris = hasil filter, minus yang tak ber-rating bila checkbox aktif
- kosong → `alert("Tidak ada data untuk diekspor — coba longgarkan filter.")`
- kolom: `No., Nama, Jenis Cuisine, Alamat, Rating, Jumlah Ulasan, Sumber Rating, Area, Tingkat Harga ("$$ (perkiraan)" bila editorial), Tier, Hotel, Catatan, Google Maps`

**Link Maps** (`lib/gci.ts:110-120`):
- `https://www.google.com/maps/search/?api=1&query={enc(name+" "+area)}&query_place_id={placeId}`
- tanpa placeId: `…query={lat},{lng}`
- tanpa koordinat: `…query={enc(name+" "+area+" Jakarta")}`

Tidak ada peta maupun grafik.

**Lakehouse:**
- `bronze_file.atlas_restoran` (`data/atlas/atlas-restoran.tsv`) hanya **84 baris** ekspor lama → `silver.atlas`.
- Plan b1-raw-04 menyiapkan `data/statis/gci-venue-*.json`. Status muat **belum terverifikasi**.
- Tabel 2.577 baris yang sudah tergabung **belum ada** di lake.

### 3.5 (S) `/gci/pariwisata/direktori-restoran` → `components/Dashboard.tsx` (+ `lib/i18n.ts`)

**Data:**
- `lib/restaurants.ts` `CURATED` 181 (dengan sumber dari peta `SRC` 30 URL agregator) + `lib/restaurants-osm.ts` 534 (`OSM_FETCHED_AT=2026-05-13`).
- Baris OSM dibuang bila sidik jari `normName|city` cocok, atau bila city bukan DKI.
- **Total 604:**
  - kurasi 181, osm 423
  - 141 ber-rating (semuanya kurasi), rata-rata 4,56
  - 103 jenis kuliner

**Tipe `Restaurant`:** `id, name, cuisine, category("Food"|"Beverage"|"Food & Beverage"), area, city, address?, priceRange?, priceNote?, rating?, reviewCount?, ratingSource?("Google"|"TripAdvisor"), highlights[], description?, sources[{label,url}], source("curated"|"osm"), lat?, lng?, osmId?, phone?, website?`.

**Bahasa:**
- **Satu-satunya halaman dengan toggle `ID / EN`** (AtlasNav `view="list"`).
- localStorage `dpj.lang`; string ada di `lib/i18n.ts` (id :14-181, en :183-350).

**Layout:**
1. **AtlasNav** (52px):
   - **VerifyControl** dengan 4 state: idle `Verifikasi sumber`, loading `Memverifikasi sumber…`, error `Tidak dapat menghubungi endpoint verifikasi.` + `Coba lagi ↗`, hasil `{ok}/{total} sumber aktif · {n} lalu` + tombol `Verifikasi ulang`
   - panel `Laporan ketersediaan sumber`
   - toggle `ID / EN`
   - ⚠ Memanggil `fetch("/api/refresh")`, yang **tidak ada di platform-v2** (hanya ada di app Atlas root). Di v2 kemungkinan state error (disimpulkan dari kode, **belum diuji live**).
2. **Hero** terpusat:
   - eyebrow `JAKARTA · KULINER INTERNASIONAL`
   - h1 `Kuliner Internasional.` / baris redup `Pilihan kami untuk Anda.`
   - lead `Daftar dari **{n} restoran dan bar** di Jakarta yang menyajikan makanan atau minuman internasional, dirangkum dari sumber publik. Setiap entri menyertakan tautan ke sumber aslinya — dan ke Google Maps.`
   - CTA `Telusuri direktori` (#directory), `Cara dibuat` (#sources)
3. **Statistik** (atas seluruh data):
   - `Tempat` 604
   - `Jenis kuliner` 103
   - `Rata-rata rating` 4.56 `/5`
   - `Sudah dinilai publik` 141
4. **Toolbar** sticky:
   - search `Cari restoran di Jakarta…` dengan `{f}/{t}`
   - toggle `Kartu | Daftar` (localStorage `dpj.view`, default kartu)
   - `Ekspor Excel`
   - select kota `Seluruh kota` (urutan Pusat, Selatan, Utara, Barat, Timur, Kep. Seribu, Tangerang, Bekasi, Depok, Bogor, lalu sisanya alfabetis)
   - select `Semua kuliner`
   - segmen kategori `Semua/Makanan/Minuman/Keduanya`
   - segmen urut `Rating tertinggi` (default) / `Paling banyak diulas` / `A–Z`
5. **Direktori:**
   - kosong → `Tidak ada hasil.` / `Coba hapus filter, atau cari **Senopati**, **Menteng**, **SCBD**.`
   - **Kartu** (grid 2/3, **tanpa paging**, 604 kartu):
     - iframe Google Maps 16:9 + chip `Buka ↗`
     - kuliner + badge `Kurasi`/`OSM`
     - nama
     - `area · {harga} {Hemat|Kasual|Premium|Fine dining}`
     - ★ rating `· {ulasan} ulasan · {sumber}`
     - deskripsi (3 baris)
     - `Buka di Maps ↗`, `Sumber ↗`
   - **Daftar:** kolom `# | Tempat | Rating | Kuliner | Harga | Aksi`
6. **Footer #sources:**
   - `Tentang direktori ini`
   - `Periksa` (`JSON mentah ↗` /api/restaurants, `Ketersediaan sumber ↗` /api/refresh — **keduanya 404 di v2**)
   - `Cakupan`
   - `© {tahun} Jakarta Restaurant Data — proyek direktori publik.`

**Filter/urut:**
- kecocokan persis kota/kuliner/kategori
- search pada name, cuisine, area, address, highlights, description
- urut rating/ulasan turun (nilai kosong = −1) atau nama

**Ekspor:**
- `jakarta-atlas-restoran-YYYY-MM-DD`, sheet `Restoran`
- 21 kolom: `No, Nama, Kuliner, Kategori, Kota, Area, Alamat, Rating, Jumlah Ulasan, Sumber Rating, Tier Harga, Catatan Harga, Highlights, Deskripsi, Tipe Data, Lat, Lng, Telepon, Website, Google Maps, Sumber`

**Link** (`lib/restaurants.ts`):
- `googleMapsUrl` = `…/maps/search/?api=1&query={lat},{lng}` atau teks
- `mapsEmbedUrl` = `https://www.google.com/maps?q={lat},{lng}&hl=en&z=17&output=embed`

**Lakehouse:** belum ada (b1-raw-04 menyiapkan `restoran-kurasi`/`restoran-osm`; muat **belum terverifikasi**).

### 3.6 (S) `/gci/pariwisata/pertunjukan-budaya` → `components/EventsView.tsx`

**Data:**
- `lib/events.ts` `SEED` → `GCI_EVENTS`, **308** baris, diurutkan `eventDateSort` naik.
- Tipe: semua string — `id, organizer, name, date, venue, type, visitors, note, category, source`.
  - `date` bisa ISO, `"A s/d B"`, `"Mei 2025"`, atau `"2026"`.
  - `visitors` berupa teks bebas, mis. `"~5.000"`, `"10.000+"`.
- 12 kategori, urutan: Konser Musik, Festival Musik, Seni Tari, Teater / Musikal, Orkestra / Klasik, Seni Tradisional, Seni Rupa, Film, Budaya, Budaya Pop, Fashion, Fan Meeting.
- Turunan:
  - `eventNeedsVerify = /perkiraan|kapasitas|target|estimasi|terjual/i.test(note)`
  - tahun = `/(20\d{2})/` pertama pada `date`

**Layout** (AtlasNav tidak tampil; bahasa praktis selalu `id`):
1. **Hero:**
   - `GLOBAL CITY INDEX · DISPAREKRAF DKI` — garis — `TAHUN 2025–2026`
   - h1 `Pertunjukan & ` + italic aksen `Budaya`
   - lead `Inventarisasi pertunjukan musik internasional & nasional serta acara budaya besar di Jakarta sepanjang 2025–2026 — konser, festival, seni tari, teater, orkestra, seni rupa, dan film — untuk Global City Index.`
   - KPI `TOTAL / KONSER / FESTIVAL / BUDAYA` — **hanya bereaksi pada filter tahun**:

     | Tahun | TOTAL | KONSER | FESTIVAL | BUDAYA |
     |---|---|---|---|---|
     | Semua | 308 | 125 | 24 | 159 |
     | 2025 | 170 | 76 | 14 | 80 |
     | 2026 | 138 | 49 | 10 | 79 |

     BUDAYA = semua kategori selain Konser Musik & Festival Musik.
2. **Filter:**
   - pill tahun `Semua tahun | 2025 | 2026`
   - pill kategori `Semua` + 12 kategori
   - search `Cari nama / penyelenggara / tempat…`
   - `{f}/{308} entri`
   - ExportButton `Ekspor Excel ({n})`
3. **Tabel** (urutan kronologis, tanpa sort):
   - `No.`
   - `Nama Pertunjukan` (link ke `source`)
   - `Penyelenggara` (atau `—`)
   - `Tanggal` (mentah)
   - `Tempat`
   - `Jenis`
   - `Jumlah Pengunjung` (mentah + ` *` bila needsVerify, title `Angka belum diverifikasi`)
   - `Keterangan`
   - Kosong: `Tidak ada entri yang cocok dengan filter.`
4. **Paging:**
   - `Muat {n} lagi` (200 per langkah)
   - `Menampilkan {p} dari {f} entri terfilter. Angka bertanda * adalah kapasitas, perkiraan, atau target dan belum diverifikasi.`
5. **Footer:** `Sumber: berita, platform tiket, situs penyelenggara (link per baris). GCI — Disparekraf DKI Jakarta.`

**Ekspor:**
- berkas `data-pertunjukan-GCI-jakarta-{2025-2026|2025|2026}-{tanggal}`, sheet `Pertunjukan GCI {tag}`
- kolom: `No., Nama Penyelenggara - Organizer, Nama Pertunjukan - Name of Performance, Tanggal Pertunjukan - Date of Performance, Tempat Pertunjukan - Place of Performance, Jenis Pertunjukan - Type of Performance, Jumlah Pengunjung - Number of Visitor, Keterangan - Notes, Sumber`

**Lakehouse:**
- `bronze_file.event_pertunjukan` (`data/statis/event-pertunjukan.json`, 308; `lakehouse/sources.toml:513-522`).
- Tidak ada Silver/Gold yang membacanya. Status muat **belum terverifikasi**.

### 3.7 (S) `/gpci/hotel` → `components/HotelView.tsx`

**Data** (statis, digenerate oleh `scripts/build-hotel.ts` langsung dari API SDI; built `2026-09-09`):

| Array | Sumber SDI | Isi |
|---|---|---|
| `HOTEL_REGISTRY` | `data-jumlah-rekapitulasi-usaha-dan-kamar-hotel` | 120 hotel (dedupe `UPPER(nama)`, ambil periode terbaru); Σkamar 24.049; periode 202301–202311 |
| `HOTEL_TPK` | `data-rata-rata-tingkat-hunian-kamar-…-provinsi-dki-jakarta` | 145 = 29 periode 202401–202605 × 5 bintang |
| `HOTEL_LOS` | `data-rata-rata-lama-menginap-wisatawan-mancanegara-dan-wisatawan-nusantara-pada-hotel-berbintang-di-provinsi-dki-jakarta` | 310 = 31 periode × 5 bintang × 2 tamu |

- `HOTEL_META`: `{built, sources[3], registryPeriod:"202301–202311", totals:{hotels:120, rooms:24049, tpkPeriods:29, losPeriods:31}}`.
- Tanpa i18n, tanpa AtlasNav.

**Layout** (`bg-canvas`):
1. **Hero:**
   - eyebrow `Data resmi · GPCI CI-HR / CI-LH (kamar hotel & hotel mewah)`
   - h1 `Hotel & ` + redup `Akomodasi`
   - lead `Pasokan kamar, okupansi (TPK), dan lama menginap hotel berbintang DKI Jakarta — seluruhnya dari <b>data resmi</b> Satu Data Jakarta / BPS, bukan scraping OTA.`
   - KPI (nilai 34px):
     - `120` `Hotel terdata` (sub `Rekapitulasi usaha & kamar`)
     - `24.049` `Total kamar`
     - `53,5%` `Okupansi rata-rata (terbaru)` (sub `Mei 2026`)
     - `1,84` `Lama menginap (malam)` (sub `Mei 2026`)
2. **Dua kartu grafik** (bg parchment):
   - **`Tingkat Penghunian Kamar (TPK)`** / `Okupansi bulanan per klasifikasi bintang · %`:
     - 5 seri `Bintang 1..5`
     - yName `Okupansi %`
   - **`Rata-rata Lama Menginap`** / `Malam per bulan · Wisman vs Wisnus (rata-rata lintas bintang)`:
     - seri `Wisman`, `Wisnus`
     - yName `Malam`
   - **Opsi bersama:**
     - warna PALETTE (B1 #ed6b23 … B5 #9a3412)
     - legend di atas
     - x = `fmtPeriode`, rotasi 45°
     - `smooth`, `showSymbol:false`, `connectNulls`
     - tinggi 300
     - kosong → `Data tren belum cukup.`
3. **Toolbar:**
   - search `Cari nama hotel, alamat…` dengan `{f}/{120}`
   - select `Semua wilayah` (5)
   - select `Semua golongan` (6)
   - ExportButton `Unduh`
4. **Tabel:**
   - caption `{n} hotel · {Σkamar} kamar (sesuai filter)`
   - header oranye #ed6b23
   - kolom `Hotel | Golongan | Kamar | Wilayah | Alamat`
   - urut **kamar turun**, tanpa paging
   - kosong: `Tidak ada hotel yang cocok dengan filter.`
5. **Footer:** `SUMBER · SATU DATA JAKARTA / BPS — REKAPITULASI USAHA & KAMAR HOTEL, TPK, RATA-RATA LAMA MENGINAP · DATA RESMI, TANPA SCRAPING OTA · DIBANGUN 2026-09-09`

**Perhitungan ⚠ (rata-rata tak berbobot):**
- **KPI okupansi** = mean 5 bintang periode terakhir = 53,536.
- **KPI LoS** = mean 10 baris (5 bintang × 2 tamu) = 1,842.
- **Grafik LoS** = mean 5 bintang per tamu.
- Baik kamar maupun tamu tidak dipakai sebagai bobot.

**Ekspor:**
- `jakarta-atlas-hotel-{tgl}`, sheet `Hotel`
- kolom `No, Nama, Jenis Usaha, Golongan, Jumlah Kamar, Wilayah, Alamat`

**Lakehouse:**
- `bronze_file.hotel_registri/hotel_tpk/hotel_los` (`sources.toml:546-577`).
- Tidak ada Silver/Gold. Status muat **belum terverifikasi**.
- Catatan: TPK yang sama juga tersedia sebagai SDI live (dipakai CI-LH).

### 3.8 (S) `/gpci/lapangan-golf` → `components/GolfView.tsx`

**Data:**
- `lib/golf.ts` `GOLF_COURSES`, **14** baris (urutan array, tanpa sort).
- Tipe: `id, name, kind("Course"|"Driving Range"|"Topgolf"), holes?, par?, designer?, established?, membership?("Public"|"Semi-private"|"Members"|"Resort"), city(EN), area, address?, lat, lng, website?, description?, highlights[], sources[]`.
- Komposisi:
  - kind: 9 Course, 4 Driving Range, 1 Topgolf
  - membership: 6 Members, 5 Public, 3 Semi-private
- ⚠ URL sumber OSM tampak placeholder (`way/123456001`…).

**Layout:**
1. **Hero:**
   - kicker **menampilkan literal `home.vol2_kicker`** (kunci i18n tidak ada → bug)
   - `JAKARTA · 6 KOTA` (hard-coded)
   - h1 `Lapangan Golf.` + italic aksen `Jumlah dan lokasi.`
   - KPI (atas seluruh data):
     - `Total venue` 14
     - `Lapangan golf` 9
     - `Driving range` 5
     - `Total holes` 171
2. **Filter:**
   - `FILTER ·`
   - select kota (`Seluruh kota`, Jakarta Pusat/Selatan/Utara/Timur)
   - pill `Semua | Lapangan | Driving Range | Topgolf`
   - `{f}/14 · titik di peta`
   - `Ekspor Excel`
3. **Split `md:grid-cols-[1.5fr_1fr]`:**
   - **Peta Leaflet** (min-h 60vh):
     - Esri Light Gray (`lib/basemap.ts:45-58`; maxNativeZoom 16, maxZoom 18)
     - `setView([-6.2,106.85],11)`, **tanpa fitBounds**
     - divIcon bulat 36px berlabel jumlah hole / `TG` / `DR`, warna per akses: Public #2E5D3C, Semi-private #C8A14B, Members #1A3A5A, Resort #8B5A2B
     - terpilih: 54px #0A5E32 dengan halo
     - markercluster diimpor tapi **tidak dipakai**; **tanpa popup**
     - legend `LEGEND` + `Angka di pin = jumlah hole. DR = driving range. TG = Topgolf.`
   - **Rail daftar:**
     - header terpilih (`TERPILIH`, tombol ✕ `Hapus pilihan`)
     - baris:
       - indeks 2 digit
       - label: `"{holes} HOLES · PAR {par}"`, `DRIVING RANGE`, atau `TOPGOLF`
       - akses
       - nama, area
       - `Desainer: … · Dibangun …`
       - `Buka di Maps →`, `Website ↗`
     - klik kartu → `flyTo(15)`; klik marker → scroll kartu
4. **Footer:** `Lokasi: OpenStreetMap. Detail lapangan: Wanderlog, What's New Indonesia, GolfLux, Deemples Golf, Leading Courses.`

**Ekspor:**
- `jakarta-atlas-golf-{tgl}`, sheet `Golf`
- 18 kolom: `No, Nama, Jenis, Jumlah Hole, Par, Desainer, Tahun Berdiri, Akses, Kota, Area, Alamat, Lat, Lng, Website, Google Maps, Deskripsi, Highlights, Sumber`

**Link:** `https://www.google.com/maps/search/?api=1&query={lat},{lng}`.

**Lakehouse:** `bronze_file.golf` (`data/statis/golf.json` 14; `sources.toml:524-533`). `silver.golf` **belum terverifikasi**.

### 3.9 (S) `/gpci/toko-suvenir` → `components/SouvenirView.tsx`

**Data:**
- `lib/souvenir.ts` `SOUVENIR_SHOPS`, **67** baris (generator `scripts/build-souvenir.ts`).
- Tipe: `id, name, category, relevance("Ya"|"Sebagian"|"Tidak"|"?"), product?, address?, city?, district?, lat?, lng?, coordSource?, phone?, rating?, reviews?, status?, note?, url?`.
- Komposisi:
  - relevance: Ya 23, Sebagian 12, Tidak 30, ? 2
  - 61 berkoordinat, 47 ber-rating

**Tanpa i18n, AtlasNav tidak tampil.**

**Layout:**
1. **Hero** terpusat:
   - kicker `Data sekunder · Daya tarik belanja (GPCI CI-SH)`
   - h1 `Toko suvenir Jakarta,` / redup `sudah disaring.`
   - lead `**67 listing** TripAdvisor kategori Shopping, ditandai satu per satu mana yang benar-benar toko suvenir — karena 30 di antaranya ternyata money changer, service HP, dan toko elektronik.` (67 dan 30 dinamis)
   - tombol `Lihat daftar`
2. **Statistik** (seluruh data):
   - `67` `Listing terdata`
   - `23` `Toko suvenir murni`
   - `4,19 /5` `Rating rata-rata`
   - `61` `Titik berkoordinat`
3. **Toolbar sticky:**
   - search `Cari nama toko, produk, atau alamat…` dengan `{f}/67`
   - toggle `Kartu | Tabel`
   - ExportButton `Unduh`
   - select `Semua wilayah`
   - select `Semua produk` (30 produk)
   - segmen relevansi `Toko suvenir` (**default**, = Ya + Sebagian = 35) | `Suvenir murni` | `Sebagian` | `Semua`
   - select urut `Ulasan terbanyak` (default) / `Rating tertinggi` / `Nama A–Z`
4. **Direktori:**
   - kosong → `Tidak ada toko yang cocok` / `Coba longgarkan filter atau kosongkan kolom pencarian.`
   - **Kartu:**
     - iframe Google `hl=id`
     - produk + badge relevansi:

       | relevance | Badge | Title |
       |---|---|---|
       | Ya | `SUVENIR` | `Toko suvenir/oleh-oleh/kerajinan` |
       | Sebagian | `SEBAGIAN` | `Pasar/mal — suvenir hanya sebagian dari isinya` |
       | Tidak | `NON-SUVENIR` | `Dikategorikan TripAdvisor sebagai gift shop, tapi bukan toko suvenir` |
       | lainnya | `BELUM TERVERIFIKASI` | – |

     - nama
     - `district · city`
     - ★ rating `· {n} ulasan · TripAdvisor`
     - alamat
     - `Koordinat telah dikoreksi.` bila `coordSource === "Koreksi riset"`
     - `Buka di Maps ↗`, `Sumber ↗`
   - **Tabel:** kolom `Nama | Produk | Wilayah | Rating | Relevansi | Maps ↗`
5. **Section #sources:**
   - `Cara data ini dikumpulkan`
   - `Yang perlu diperhatikan` (teks pecahan dinamis)
6. **Footer** hard-coded: `SUMBER · TRIPADVISOR + VERIFIKASI SUMBER TERBUKA · DIPERBARUI 29 JULI 2026`.

**Ekspor:**
- `jakarta-atlas-suvenir-{tgl}`, sheet `Suvenir`
- 17 kolom: `No, Nama, Kategori TripAdvisor, Relevan Suvenir, Produk Utama, Alamat, Kota Administrasi, Kecamatan, Lintang, Bujur, Sumber Koordinat, Telepon, Rating, Jumlah Ulasan, Status, Catatan, URL TripAdvisor`

`components/SouvenirMapView.tsx` **yatim** (tidak diimpor route mana pun).

**Lakehouse (3 salinan):**

| Tabel | Sumber | Catatan |
|---|---|---|
| `bronze_file.souvenir` | `data/statis/souvenir.json` | punya `id`; paling cocok |
| `bronze_file.atlas_souvenir` | TSV | – |
| `bronze_sec` `toko-suvenir-tripadvisor-2026` | – | snake_case, tanpa `id` |

Status silver **belum terverifikasi**.

---

## 4. Usulan DATA CONTRACT (Data API → Laravel → Nuxt)

**Prinsip:**
1. Data API memilih dataset lewat **pemetaan eksplisit** (§4.2), bukan judul.
2. Data API mengembalikan data **siap tampil (UI-grain)**: titik grafik, KPI, dan baris tabel yang sudah teragregasi, terurut, dan terpotong.
3. Frontend hanya memformat angka (`id-ID`) dan memilih komponen.

Pemformatan teks yang meniru perilaku lama dikirim di field `display`, mis. `"50.45%"` (titik desimal) dan `"9.0%"`.

Endpoint baris mentah (`RawDataDisclosure`/`SdiTable`) memakai kontrak dataset bersama `GET /v1/dataset/{slug}/rows?offset&limit&q`, yang didefinisikan di inventaris halaman `/sdi`.

### 4.1 Daftar endpoint

| Endpoint | Untuk | Cache saran |
|---|---|---|
| `GET /v1/indikator?framework=GCI\|GPCI` | overview `/gci`, `/gpci` (kartu ringkas + tabel + panel kelengkapan) | 24 jam (paritas ISR) |
| `GET /v1/indikator/{code}` | halaman detail (bingkai + konteks + payload arketipe) | 24 jam |
| `GET /v1/gci/resmi` | hero Kearney + 4 kartu (`GciOfficial`); sumber: referensi `gci-kearney-resmi` (plan b1-raw-04) | statis |
| `GET /v1/dataset-tematik?framework=GCI\|GPCI` | kartu "Dataset GCI/GPCI" (`no,title,href,description,count,unit,icon`) | statis/harian |
| `GET /v1/pariwisata/wisatawan-internasional` | §3.1 | harian |
| `GET /v1/pariwisata/kuliner-michelin` | §3.2 | harian |
| `GET /v1/pariwisata/seni-pertunjukan?tahun=` | §3.3 (termasuk venue peta & matriks artis) | harian |
| `GET /v1/gci/restoran` | §3.4 (2.577 baris sudah tergabung & terurut; filter/paging/ekspor tetap di client demi paritas) | statis |
| `GET /v1/gci/direktori-restoran` (+ opsional `/verify-sources`) | §3.5 | statis |
| `GET /v1/gci/pertunjukan` | §3.6 (308 baris + `date_sort`, `tahun`, `needs_verify`; KPI per tahun) | statis |
| `GET /v1/gpci/hotel` | §3.7 (`kpi`, `tpk{periods,labels,series}`, `los{…}`, `registry[]`, `options`) | harian |
| `GET /v1/gpci/golf` | §3.8 | statis |
| `GET /v1/gpci/souvenir` | §3.9 (`data[]`, `meta{total,ya,sebagian,tidak,belum_pasti,avg_rating,geo,products[],cities[]}`) | statis |

### 4.2 Pemetaan indikator → dataset (pengganti `datasetsFor`/`pickData`)

"Terpilih live" = slug yang dirender produksi 2026-10-21 (link sumber di hero), sehingga keyakinannya **tinggi** sebagai fakta saat ini. Kolom "Usulan" = bila pemilik memilih memperbaiki defect §2.6.

| code | arketipe | selektor sekarang | dataset terpilih live (utama) | dataset kedua | keyakinan | usulan |
|---|---|---|---|---|---|---|
| CE1 | B tren_lokasi | pickData `[lokasi,jumlah]` + `[kebangsaan,jumlah_kunjungan]` | `data-kunjungan-wisatawan-nusantara-dan-wisatawan-mancanegara-ke-tourist-information-center-tic-provinsi-dki-jakarta` | `data-jumlah-wisatawan-mancanegara-berdasarkan-kebangsaan` | tinggi | kedua → `wisman-jakarta-per-negara` |
| CI-FV | B | sama dengan CE1 | sama | sama | tinggi | sama |
| CE2 | C wilayah | pickData `[wilayah,jumlah]` | `jumlah-restoran-per-kelurahan` | – | tinggi | filter periode terbaru |
| CI-DI | C | sama | `jumlah-restoran-per-kelurahan` | – | tinggi | sama |
| CI-CX | C | sama | `jumlah-pelaku-usaha-pariwisata-dan-ekonomi-kreatif-yang-difasilitasi-terkait-industri-halal-dan-ekonomi-syariah` | – | tinggi (salah makna) | `jumlah-produkjasa-ekonomi-kreatif-yang-didaftarkan-kekayaan-intelektualnya` (kolom belum terverifikasi) |
| CE3 | E event | primaryData (terbesar) | `data-pemberian-rekomendasi-penyelenggaraan-pertunjukan-musik` | – | tinggi (render rusak) | `data-seni-pertunjukan-dan-visual` |
| CI-CE | E | pickData `[nama_venue]` | `data-seni-pertunjukan-dan-visual` | – | tinggi | – |
| CI-TH | E | primaryData | `data-seni-pertunjukan-dan-visual` | – | tinggi | – |
| CI-AM | E | primaryData | `indeks-kepuasan-layanan-penunjang-urusan-pemerintahan-daerah-dinas-pariwisata-dan-ekonomi-kreatif-tahun-2023` | – | tinggi (salah makna) | `data-seni-pertunjukan-dan-visual` atau tandai belum tersedia |
| CE4 | A peta, filter `/museum\|monumen/i` | primaryData | `jumlah-kunjungan-wisatawan-ke-obyek-wisata-menurut-lokasi-di-provinsi-dki-jakarta` | – | tinggi | opsional `museum-jakarta` (78 museum, sekunder) untuk hitung museum |
| CI-TA | A tanpa filter | pickData `[obyek_wisata,jumlah_kunjungan]` | sama | – | tinggi | – |
| CI-WH | A, filter `/kota tua\|heritage\|fatahillah\|onrust/i` | primaryData | sama | – | tinggi | – |
| CI-MU | A, filter `/museum/i` | primaryData | sama | – | tinggi | opsional `museum-jakarta` |
| BA-MICE | D registri | primaryData | `jumlah-usaha-penyelenggaraan-pertemuan-perjalanan-insentif-konferensi-dan-pameran-pariwisata-yang-memiliki-perizinan` | – | tinggi | opsional `kegiatan-mice-jakarta-2026` / `venue-mice-jakarta` |
| CI-IC | D | primaryData | sama dengan BA-MICE | – | tinggi | sama |
| CI-HR | D | primaryData | `jumlah-usaha-penyediaan-akomodasi-pariwisata-yang-memiliki-perizinan` | – | tinggi | opsional `hotel-kamar-jakarta` (484, ada kolom kamar) |
| CI-NL | D | primaryData | `jumlah-usaha-penyelenggaraan-kegiatan-hiburan-dan-rekreasi-pariwisata-yang-memiliki-perizinan` | – | tinggi | – |
| CI-LH | F okupansi | pickData `[jenis_hotel,rata_rata]` | `data-rata-rata-tingkat-hunian-kamar-pada-hotel-berbintang-di-provinsi-dki-jakarta` | – | tinggi | – |
| CI-SH | G survei | pickData `[asal_negara,rata_rata]` | `rata-rata-pengeluaran-kunjungan-wisatawan` | – | tinggi | opsional `toko-suvenir-tripadvisor-2026` |
| 9 gap | belum_tersedia | – | – | – | pasti | AC-DF → `penerbangan-langsung-jakarta`? (keputusan) |

Tabel Silver = `silver.<slug dengan - → _>`. Dicek live untuk semua slug di atas lewat `medallion.table` di `/api/sdi/{slug}`; semuanya level `silver`.

**Daftar dataset readiness** (kolom "Dataset / Pemilik" & status):
- Untuk paritas, simpan daftar top-5 di §1.7 sebagai konfigurasi per indikator: `indikator_dataset(code, slug, peran: utama|kedua|readiness, urut)`.
- `status = min(draftReadiness, ada_dataset_berisi ? ready : (ada_dataset ? partial : gap))`.

### 4.3 Bentuk JSON

**`GET /v1/indikator?framework=GPCI`**
```json
{
  "framework": "GPCI",
  "header": { "title": "Mori — Global Power City Index (GPCI)",
              "subtitle": "Fungsi Cultural Interaction + konektivitas (Accessibility) pariwisata. Kesiapan data Dispar untuk mengisi indikator GPCI." },
  "summary": { "total": 20, "dataAda": 14, "ready": 5, "partial": 9, "gap": 6 },
  "hasOfficialNo": true,
  "rows": [
    { "no": 22, "code": "CI-IC", "framework": "GPCI", "name": "Jumlah konferensi internasional",
      "group": "Volume of Interaction", "status": "partial", "dataAvailable": true,
      "owner": "DISPAREKRAF", "note": "Tersedia data Usaha MICE berizin; jumlah konferensi aktual belum tersedia.",
      "href": "/gpci/CI-IC",
      "datasets": [ { "slug": "jumlah-usaha-penyelenggaraan-pertemuan-perjalanan-insentif-konferensi-dan-pameran-pariwisata-yang-memiliki-perizinan",
                      "title": "Jumlah Usaha Penyelenggaraan Pertemuan, Perjalanan Insentif, Konferensi dan Pameran Pariwisata yang Memiliki Perizinan", "total": 8636 } ],
      "latest": null }
  ],
  "gaps": [ { "code": "CI-IC", "status": "partial", "name": "…", "note": "…", "owner": "DISPAREKRAF" } ],
  "generatedAt": "2026-10-21T02:00:00+07:00"
}
```
Ketentuan:
- `rows` sudah terurut seperti tampilan: berdasarkan `no` bila `hasOfficialNo`, selain itu urutan JSON.
- `gaps` = baris non-ready dalam **urutan JSON**.
- `latest` = `{value:number, label:string}` atau `null` (keputusan D9).

**`GET /v1/indikator/{code}`** — bingkai bersama + payload per arketipe:
```json
{
  "code": "CE1", "framework": "GCI", "dimension": "Cultural Experience",
  "name": "Wisatawan internasional", "definition": "Jumlah kedatangan wisatawan mancanegara",
  "backHref": "/gci",
  "sources": [ { "slug": "data-kunjungan-wisatawan-nusantara-dan-wisatawan-mancanegara-ke-tourist-information-center-tic-provinsi-dki-jakarta",
                 "title": "Data Kunjungan Wisatawan Nusantara dan Wisatawan Mancanegara ke Tourist Information Center (TIC) Provinsi DKI Jakarta", "tier": "primer" },
               { "slug": "data-jumlah-wisatawan-mancanegara-berdasarkan-kebangsaan", "title": "Data Jumlah Wisatawan Mancanegara Berdasarkan Kebangsaan", "tier": "primer" } ],
  "sourceText": null,
  "context": { "indexMetric": "Jumlah wisatawan internasional tahunan", "indexSource": "Kearney GCI — International travelers",
               "unit": "kunjungan/tahun", "frontier": { "city": "Seoul (GCI)", "value": "18.936.562" },
               "jakarta": { "value": "~2 juta/th", "note": "proksi data kebangsaan; normalisasi tahunan belum dilakukan" },
               "target": "10 juta+/tahun",
               "dataNeeded": [ { "label": "Wisman tahunan resmi via bandara+pelabuhan", "status": "proksi", "owner": "BPS / Imigrasi" } ] },
  "momNote": null,
  "archetype": "tren_lokasi",
  "kpis": [ { "label": "Total kunjungan", "value": 34812 },
            { "label": "Lokasi TIC", "value": 10 },
            { "label": "Periode terdata", "value": 20 } ],
  "blocks": [
    { "type": "line",   "title": "Tren kunjungan per periode", "layout": "full",
      "data": [ { "label": "2025-01-01", "value": 1234 } ] },
    { "type": "bar",    "title": "Per lokasi TIC", "layout": "full", "color": "#ed6b23",
      "data": [ { "label": "BANDARA SOEKARNO HATTA", "value": 0 } ] },
    { "type": "ranked", "title": "Top negara asal", "layout": "full",
      "data": [ { "label": "LAINNYA", "value": 1430933 }, { "label": "MALAYSIA", "value": 1101933 } ] }
  ],
  "fallback": null,
  "generatedAt": "…"
}
```
(Nilai `data` pada `line` dan `bar` di atas ilustratif; KPI dan daftar `ranked` adalah angka live.)

**Aturan blok:**
- `type ∈ {line, bar, ranked, donut, map_points, table_events, grouped_lines}`.
- `layout ∈ {full, half}`. Dua `half` berurutan dirender dalam `grid md:grid-cols-2 gap-5`.
- `color` opsional (`#0e7c42`, `#e8a33d` untuk registri).
- API **menghilangkan blok** yang di kode lama disembunyikan: trend <2 titik, `perNegara` kosong, `wisman` kosong.
- `momNote` = string HTML terbatas (`<b>` saja). Teksnya ada di §2.4.
- `map_points.data = [{lat,lng,label,value}]` **sudah di-swap** ke lat ≈ −6, lng ≈ 106.
- `table_events.data = [{tanggal,event,venue}]` maks 20, plus `emptyText`.
- `grouped_lines.data = {series:[{name, data:[{label,value}]}]}`.
- **Payload `kpis` mengikuti §2.4.** Untuk CI-LH: `{label:"Okupansi bintang 5 (terbaru)", value:50.45, display:"50.45%", sub:"2026-07-01"}`.

**Untuk `dataAvailable:false`:**
```json
{ "archetype": "belum_tersedia", "sources": [], "sourceText": "Event olahraga besar",
  "kpis": [], "blocks": [],
  "fallback": { "badge": "Data belum tersedia", "owner": "Dispora", "statusLabel": "gap",
                "note": "Data dikelola OPD lain (Dispora)." } }
```

**`GET /v1/gci/resmi`**
```json
{ "ranking": { "cultural": { "y2024": 52, "y2025": 58 }, "overall": { "y2024": 74, "y2025": 71 },
               "sumber": { "label": "jakarta.go.id/competitiveness", "url": "https://www.jakarta.go.id/competitiveness" },
               "catatan": "Kearney GCI 2025. Peringkat makin kecil makin baik." },
  "kartu": [ { "label": "Jumlah Museum", "nilai": "79", "satuan": "Museum", "tahun": "2025", "sumber": "satudata.jakarta.go.id", "catatan": null, "href": null },
             { "label": "Seni Visual & Pertunjukan", "nilai": "156", "satuan": "Karya / kegiatan", "tahun": "2024", "sumber": "Dinas Pariwisata & Ekraf", "catatan": "Belum mencakup data Dinas Kebudayaan.", "href": "/gci/pariwisata/seni-pertunjukan" },
             { "label": "Wisatawan Internasional", "nilai": "2.767.622", "satuan": "Wisatawan", "tahun": "2025", "sumber": "jakarta.bps.go.id", "catatan": null, "href": "/gci/pariwisata/wisatawan-internasional" },
             { "label": "Penawaran Kuliner (Michelin)", "nilai": "0", "satuan": "Restoran Michelin", "tahun": "2025", "sumber": "Michelin", "catatan": "Belum ada Michelin Star di Jakarta.", "href": "/gci/pariwisata/kuliner-michelin" } ] }
```
Panah dan teks tren (`▲ naik 3` / `▼ turun 6`) dihitung di frontend dengan rumus §1.4-A, atau dikirim sebagai `trend:{arrow,label,color}`.

**`GET /v1/pariwisata/wisatawan-internasional`**
```json
{ "shell": { "eyebrow": "Cultural Experience · Wisatawan Internasional", "title": "Wisatawan Internasional",
             "nilai": "2.767.622", "satuan": "Wisatawan", "tahun": "2025",
             "catatan": "Angka resmi 2.767.622 (BPS 2025). Data bulanan Dispar mencatat 2.754.220 untuk 2025 — selaras. Pilih tahun untuk melihat detail; tren lintas-tahun ada di bawah.",
             "sumber": "jakarta.bps.go.id", "sumberHref": "https://jakarta.bps.go.id" },
  "years": ["2024","2025","2026"], "defaultYear": "2025",
  "byYear": { "2025": { "total": 2754220, "partial": false,
      "monthly": [ { "label": "2025-01-01", "value": 0 } ],
      "quarterly": [ { "label": "Q1", "value": 0 } ],
      "topNegara": [ { "label": "Tiongkok", "value": 504574 } ],
      "donutNegara": [ { "label": "Tiongkok", "value": 504574 }, { "label": "Lainnya", "value": 0 } ],
      "peakMonth": { "label": "2025-08-01", "value": 305104 } } },
  "yearlyTotals": [ { "label": "2024", "value": 0 } ],
  "target": { "kondisiAwal": 1273358, "perTahun": { "2025": 1286092, "2026": 1289257, "2027": 1594162, "2028": 1848874, "2029": 2105833, "2030": 2332494 } },
  "raw": [ { "slug": "wisman-jakarta-per-bulan", "title": "Wisman per bulan (2024–2026)", "count": 28 },
           { "slug": "wisman-jakarta-per-negara", "title": "Wisman per negara (s/d 2026)", "count": 604 },
           { "slug": "wisman-jakarta-per-pintu-masuk", "title": "Wisman per pintu masuk (arsip 2010/2014, nasional)", "count": 480 } ] }
```
Bentuk ini = props `WismanDashboard` apa adanya. Nilai `0` = placeholder ilustratif; isi dari mart.

**`GET /v1/pariwisata/kuliner-michelin`** →
```json
{ "shell": {…}, "latestYear": "2026",
  "kpis": { "michelin": 0, "restoranTerdata": 12932, "kelurahanTercakup": 266, "wilayahTerpadat": "Jakarta Selatan" },
  "perWilayah": [ { "label": "Jakarta Selatan", "value": 0 } ],
  "topKecamatan": [ { "label": "…", "value": 0 } ],
  "raw": [ { "slug": "jumlah-restoran-per-kelurahan", "title": "Jumlah restoran per kelurahan (2026)", "count": 517 },
           { "slug": "data-usaha-jasa-makanan-dan-minuman-jenis-usaha-restoran-di-dki-jakarta", "title": "Daftar usaha restoran (arsip 2014)", "count": 3957 },
           { "slug": "restoran-tripadvisor-jakarta", "title": "Kuliner TripAdvisor Jakarta (kriteria Kearney: TripAdvisor & Michelin)", "count": 38 } ] }
```
`perWilayah` sudah diberi `titleCase` dan awalan "Kota Adm." sudah dibuang. Nilai `0` ilustratif.

**`GET /v1/pariwisata/seni-pertunjukan?tahun=2025`** →
```json
{ "shell": { …, "nilai": "352" },
  "tahunOpsi": ["2024","2025"], "tahun": "2025",
  "kpis": { "jumlahPertunjukan": 352, "topGlobal": 0, "persenTopGlobal": 0, "skorKearney": "156",
            "venueUnik": 187, "penyelenggaraanEvent": 0 },
  "eventBulanan": [ { "label": "202501", "display": "Jan 2025", "value": 0 } ],
  "periodeEvent": "2025",
  "topVenue": [ { "label": "THE H CLUB SCBD, JAKARTA", "value": 18 } ],
  "perWilayah": [ { "label": "Jakarta Selatan", "value": 0 } ],
  "venues": [ { "venue": "Jakarta International Stadium (JIS)", "address": "…", "wilayah": "Jakarta Utara",
                "lat": -6.121, "lon": 106.843, "eventCount": 3,
                "events": [ { "nama_event": "MAROON 5 ASIA 2025", "periode": "2025" } ],
                "gold": true, "artists": ["Ed Sheeran (2024)", "Bruno Mars (2024)"] } ],
  "artisTampil": [ { "artis": "Bruno Mars", "negara": "Amerika Serikat", "tahun": [2014,2024],
                     "venue": "GBK (2014) · JIS (2024)", "sumber": "https://en.tempo.co/…", "terverifikasi": true } ],
  "charts": [ { "key": "Billboard Year-End Top Artists", "years": ["2021","2022","2023","2024","2025"],
                "grid": [ { "rank": 1, "cells": { "2021": { "artis": "Drake", "negara": "Kanada", "played": false } } } ] } ],
  "raw": { "slug": "data-seni-pertunjukan-dan-visual", "title": "Seni Visual & Pertunjukan", "count": 352,
           "columns": ["nama_event","nama_venue","lokasi_venue","periode_data"] },
  "pendukung": [ { "slug": "data-penyelenggaraan-event-pariwisata-dan-budaya-dki-jakarta", "label": "Penyelenggaraan Event Pariwisata & Budaya" },
                 { "slug": "data-event-pariwisata-dan-kebudayaan-dki-jakarta-2011-2019", "label": "Event Pariwisata & Kebudayaan 2011–2019" },
                 { "slug": "data-rekomendasi-penyelenggaraan-pertunjukan-musik", "label": "Rekomendasi Penyelenggaraan Pertunjukan Musik" } ] }
```
Ketentuan:
- `skorKearney` = `"156"` hanya bila `tahun` ∈ {"", "2024"}, selain itu `"NA"`.
- `seni-venues.json` dan `JAKARTA_APPEARANCES` harus pindah ke lake: `seni-venue` dan `artis-tampil-jakarta`, sesuai plan b1-raw-04.
- Pencocokan artis (word-boundary) dihitung di Data API.
- Nilai `0` ilustratif.

### 4.4 Konfigurasi/angka hard-coded yang harus ikut dipindah (sumber → tujuan usulan)

| Nilai | Lokasi sekarang | Usulan |
|---|---|---|
| Peringkat Kearney 52→58, 74→71; 4 kartu (79, 156, 2.767.622, 0) | `components/GciOfficial.tsx:96-107` | `/v1/gci/resmi` (referensi `gci-kearney-resmi`) |
| Headline & catatan wisman `2.767.622` / `2.754.220` | `wisatawan-internasional/page.tsx:86-91` | `shell` endpoint (konfigurasi) |
| `TARGET_WISMAN`, kondisi awal 1.273.358 | `WismanDashboard.tsx:33-41` | `target` endpoint (referensi `target-wisman`) |
| Skor Kearney `156` (hanya 2024) | `seni-pertunjukan/page.tsx:194-197` | `kpis.skorKearney` |
| Michelin `0`, tahun 2025 | `kuliner-michelin/page.tsx:66-75` | `shell` |
| `JAKARTA_APPEARANCES` (3 artis) | `lib/pariwisata/jakarta-appearances.ts` | lake `artis-tampil-jakarta` |
| Venue seni (138) | `lib/pariwisata/seni-venues.json` | lake `seni-venue` |
| Benchmarks (28) | `data/gci-gpci-benchmarks.json` | lake `gci-gpci-benchmark` → `context` |
| Indikator (28) + match + draft | `data/gci-gpci-indicators.json` | lake `gci_gpci_indicators` (perbarui salinan root yang basi!) |
| Count kartu Dataset (2.577/604/308/47/14/67/120) | `lib/secondary.ts` | `/v1/dataset-tematik` dihitung dari tabel |
| Teks MomNote (CE2, CE3, CI-FV) | komponen view | `momNote` atau konstanta frontend |
| Tanggal hero `SENIN · 22 JUNI 2026 · 16.00 WIB`, `TAHUN 2025–2026`, `JAKARTA · 6 KOTA`, `DIPERBARUI 29 JULI 2026`, `DIBANGUN 2026-09-09` | GciView/EventsView/GolfView/SouvenirView/HotelView | konstanta frontend (paritas) atau `meta` endpoint |

### 4.5 Keputusan terbuka untuk planner/pemilik

1. **Paritas vs perbaikan** untuk D1–D10 (§2.6) dan rata-rata tak berbobot di `/gpci/hotel` (§3.7). Bila paritas dipilih, Data API harus mereplikasi bug: dataset CE3/CI-AM/CI-CX yang salah, penjumlahan dobel tahun, top-15, dan Σ rata-rata.
2. Kolom "Nilai terbaru" (D9): tiru heuristik, ganti dengan nilai terdefinisi, atau kosongkan.
3. Bug UI statis:
   - golf kicker `home.vol2_kicker`
   - toggle bahasa yang tak tampil
   - tombol Verifikasi dan link `/api/restaurants`/`/api/refresh` di direktori yang 404 di v2
   - `SouvenirMapView` yatim
4. `/gpci/CE1` & `/gci/CI-FV` (prefix silang) tetap diterima atau di-redirect.
5. AC-DF tetap "belum tersedia" atau disambungkan ke `penerbangan-langsung-jakarta`.
6. Format label periode (`2025-01-01` mentah vs `Jan 2025`).

---

## 5. Lampiran — berkas rujukan (path absolut)

- `/home/uaa/Dinas-Pariwisata/platform-v2/app/gci/page.tsx`, `/home/uaa/Dinas-Pariwisata/platform-v2/app/gpci/page.tsx`, `…/app/gci/[code]/page.tsx`, `…/app/gpci/[code]/page.tsx`, `…/app/readiness/page.tsx`
- `/home/uaa/Dinas-Pariwisata/platform-v2/components/GciOfficial.tsx`, `FrameworkView.tsx`, `FrameworkDataLinks.tsx`
- `/home/uaa/Dinas-Pariwisata/platform-v2/components/indicators/` (IndicatorShell, IndexContext, MomNote, registry, 19 view)
- `/home/uaa/Dinas-Pariwisata/platform-v2/components/charts/` (KpiStat, BarBreakdown, LineTrend, RankedList, Donut, GroupedLines, PointMap, ChartExpand, VerticalBars, Treemap, GroupedBars)
- `/home/uaa/Dinas-Pariwisata/platform-v2/components/pariwisata/` (PariwisataShell, DashboardKit, TahunFilter, VenueMap, WismanDashboard)
- `/home/uaa/Dinas-Pariwisata/platform-v2/lib/indicator-data.ts`, `lib/agg.ts`, `lib/gci/{indicators,readiness,benchmark}.ts`, `lib/report.ts`, `lib/report-store.ts`, `lib/ch/store.ts`, `lib/data-sections.ts`, `lib/secondary.ts`, `lib/pariwisata/*`
- `/home/uaa/Dinas-Pariwisata/platform-v2/data/gci-gpci-indicators.json`, `data/gci-gpci-benchmarks.json`
- S-view: `components/{GciView,Dashboard,EventsView,HotelView,GolfView,SouvenirView}.tsx`, `lib/{gci*,restaurants*,events,hotel,golf,souvenir,i18n,export,basemap}.ts`, `components/atlas/{AtlasNav,ExportButton}.tsx`
- Lakehouse: `/home/uaa/Dinas-Pariwisata/lakehouse/clickhouse/sql/11-dim-more.sql:49-62` (dim_indikator), `31-gold-more.sql:6-20` (mart_gci_readiness), `/home/uaa/Dinas-Pariwisata/lakehouse/sources.toml`
- Plan terkait: `/home/uaa/Dinas-Pariwisata/plans/2026-10-08-lakehouse-inventaris-tampilan.md`, `/home/uaa/Dinas-Pariwisata/plans/2026-10-08-b1-raw-04-data-di-kode.md`
