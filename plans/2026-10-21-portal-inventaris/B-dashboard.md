# B — Inventaris menu `/dashboard` (platform-v2 @ a0580ba) untuk port ke Nuxt 3 + Laravel 10

Dibaca: `platform-v2/app/dashboard/**`, `components/dashboard/*`, `lib/dashboard/*`, `lib/ch/client.ts`,
komponen chart bersama (`components/charts/*`, `components/pariwisata/DashboardKit.tsx`), `components/Nav.tsx` (dropdown).
Contoh nilai berasal dari payload RSC halaman live `https://dispar.rantai.dev/dashboard/*` yang diambil 2026-10-21
(ClickHouse :18123 tidak terjangkau dari mesin ini, jadi SQL **tidak** dijalankan ulang langsung — nilai contoh = keluaran
produksi saat itu). Hal yang tidak bisa dicek ditandai **belum terverifikasi**.

`components/Dashboard.tsx` dan `components/pariwisata/WismanDashboard.tsx` **TIDAK dipakai** oleh `/dashboard/*`
(dipakai `app/gci/pariwisata/*`). Hanya disebut karena duplikasi `TARGET_WISMAN` (lihat Quirk Q1).

---

## 0. Kerangka bersama

### 0.1 Layout `app/dashboard/layout.tsx` (server component)
- `metadata.title` = `"Dashboard Statistik Pariwisata & Ekonomi Kreatif — DKI Jakarta"` (L3-5).
- `<main class="min-h-screen">` → container `max-w-[1320px] px-6 py-8`.
- Eyebrow (11.5px, uppercase, tracking-wider, warna `#6b6459`): `Dashboard · Mandat RPJMD 2025–2029` (L13).
- H1 28px bold tracking-tight `#1c1a17`: `Dashboard Statistik Pariwisata dan Ekonomi Kreatif` (L14-16).
- `<DashboardSubnav/>` lalu `<div class="mt-6">{children}</div>`.

### 0.2 Menu — `lib/dashboard/menu.ts` (L2-17), dipakai Subnav, Nav dropdown, dan beranda
```
Kinerja Pariwisata
  /dashboard/wisman     "Wisatawan Mancanegara"  sub "2024–2026 · tahunan & bulanan"
  /dashboard/wisnus     "Wisatawan Nusantara"    sub "kota tujuan · lama menginap"
Kinerja Ekonomi Kreatif
  /dashboard/pdrb-ekraf "PDRB Ekonomi Kreatif"   sub "2017–2025 · kontribusi vs target RPJMD"
  /dashboard/tenaga-kerja "Tenaga Kerja Ekraf"   sub "jumlah · subsektor · tren"
```
Menu statis → tidak perlu endpoint (boleh di-hardcode di Nuxt).

### 0.3 `DashboardSubnav` (`components/dashboard/DashboardSubnav.tsx`, client — butuh `usePathname`)
- Grid `md:grid-cols-2 gap-3`; tiap grup = kartu `rounded-xl border(#ece6df) bg-white p-2 shadow-sm`.
- Header grup 11px semibold uppercase `#6b6459`. Item: grid 2 kolom, `rounded-lg px-3 py-2`; label 13.5px semibold; sub 11px.
- Aktif bila `path === href || path.startsWith(href+"/")` → background `#ed6b23`, teks putih (sub `white/85`). Non-aktif hover `bg-black/[0.04]`.

### 0.4 Nav global (`components/Nav.tsx` L77-104)
Tombol "Dashboard Statistik" + chevron; aktif (oranye `#ed6b23`) bila path `/dashboard*`. Dropdown hover/focus-within lebar 300px berisi `DASHBOARD_MENU` (label 13px semibold `#1c1a17`, sub 11px `#9c948a`, header grup 10.5px uppercase `#9c948a`).

### 0.5 Kit UI (`components/dashboard/Kit.tsx`, `components/pariwisata/DashboardKit.tsx`)
| Komponen | Spesifikasi |
|---|---|
| `SectionHead({title,desc})` | `mb-3 mt-8 first:mt-0`; h2 18px bold; desc `apple-fine` (11.5px/1.4) `#6b6459` |
| `SourceNote` | `<p class="mt-6 apple-fine text-ink-muted-48">` |
| `ModeToggle` | pill group `rounded-xl border bg-white p-1 shadow-sm`; tombol `rounded-lg px-4 py-1.5 13px semibold`; aktif bg `#ed6b23` putih, `aria-pressed` |
| `BULAN` | `["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"]` |
| `idNum(v,d=0)` | `toLocaleString("id-ID",{min=max=d desimal})` → "1.257.285", "9,0" |
| `KpiRow` | `grid gap-4 sm:grid-cols-2 lg:grid-cols-4` |
| `KpiStat` (`components/charts/KpiStat.tsx`) | kartu `bg-white rounded-xl border-slate-200 shadow-sm p-5`; label 11px **font-mono** uppercase tracking-wider `slate-400`; value 30px bold tabular-nums `slate-900` (number → `toLocaleString("id-ID")`); sub 12px `slate-500` |
| `Kpi({label,value,sub,delta})` | = KpiStat, tetapi jika `delta` finite: sub diganti `"▲|▼ {abs(delta) id-ID max 1 desimal}% {sub}"` (▲ bila delta ≥ 0). **Catatan:** tidak ada warna hijau/merah walau komentar bilang "berwarna" — hanya karakter panah. |
| `ChartCard` = `ExpandableChartCard` (`components/charts/ChartExpand.tsx` L122-) | `utility-card` (bg putih, border `#ece6df`, radius 12, shadow kecil; hover border oranye 30%) `p-5`; header `border-l-2 #ed6b23 pl-2.5`: title 14px semibold, sub apple-fine. Tombol "Perbesar grafik" kanan atas → modal fullscreen (max 1400px, tinggi `min(92vh,860px)`), chart dirender ulang dengan label nilai + dataZoom slider, tinggi `min(68vh,640px)`; Esc/klik backdrop menutup, focus trap. |
| `ChartGrid({cols})` | cols=2 → `grid gap-4 md:grid-cols-2`; 3 → `md:grid-cols-2 lg:grid-cols-3` |
| Kotak error | `rounded-xl border border-red-200 bg-red-50 p-5 text-[13px] text-red-700` |

Warna tema: `--ink #1c1a17`, `--ink-muted-80 #33302b`, `--ink-muted-48 #6b6459`, `--hairline #ece6df`, aksen `#ed6b23` (oranye), hijau `#0e7c42`.

### 0.6 Komponen chart (semua ECharts via `echarts-for-react`, client) — wajib ditiru di Nuxt (vue-echarts)
Umum: sumbu label `#94a3b8` 11px, axisLine `#e2e8f0`, splitLine `#eef2f7`, tanpa axisTick; legend atas `#475569` 11px ikon circle; angka id-ID. Kosong → `"Tidak ada data."` (13px slate-400 center).

| Komponen | Opsi kunci |
|---|---|
| `ComboBarLine` | bar `#ed6b23` barMaxWidth 40 radius [4,4,0,0]; line `#0e7c42` smooth, dashed, width 2.5, symbolSize 7, `connectNulls`; `dualAxis` default true (kanan = line, label `v+unit`); `dualAxis=false` → satu sumbu. Tooltip axis/cross, null → "—". Tinggi 320. grid top 36. |
| `VerticalBars` | warna default `#ed6b23`, barMaxWidth 34, radius [4,4,0,0]; `labelFmt` mengubah label x; tooltip `v+unit`; tinggi 280. |
| `GroupedBars` | palette default `["#ed6b23","#f0a13a","#c2410c","#9a3412","#fb923c","#7c2d12"]` (bisa `colors`), barMaxWidth 22, radius [3,3,0,0]; data dipetakan ke `categories` by label, kosong → `missingValue` (default 0, LosByClass pakai null). Tinggi 300. |
| `GroupedLines` | palette `["#ed6b23","#f0a13a","#0e7c42","#b3261e","#7c3aed","#0891b2"]`; sumbu-x = **union label semua seri, diurut `localeCompare`** (label mentah, mis. "2024-01"); smooth, symbol circle 5, connectNulls; legend 12px; tinggi 300. |
| `BarBreakdown` | bar horizontal, y kategori `inverse` (urutan data = atas→bawah), label y `#475569` width 150 truncate; warna default `#ed6b23` atau `colors[i]`; label nilai kanan 12px `v+unit`; tinggi `max(160, n*34+20)`. |
| `Donut` | palette `["#ed6b23","#f0a13a","#0e7c42","#2563eb","#7c3aed","#0891b2","#e11d48","#65a30d","#db2777","#0d9488"]`; `colorMap` label→warna; label "Lainnya" (regex `^lainnya$`i) → `#cbd5e1`; `showPercent` → radius ["44%","64%"], label luar `"{percent id-ID max1}%"` 11px 600 `#33302b`, `minShowLabelAngle 7`; legend scroll bawah; center ["50%","44%"]; tooltip `"{name}: {value} ({percent}%)"`; tinggi 288. Persen dihitung ECharts dari `value`. |

### 0.7 Akses data — `lib/ch/client.ts`
- `ch()` lazy singleton `@clickhouse/client`, env `CH_URL` (default `http://localhost:18123`), `CH_USER` (default `dispar_app`), `CH_PASSWORD` (default placeholder — **jangan disalin**). Tanpa `clickhouse_settings` (profil `app_readonly` memaksa readonly/limit; set setting → error READONLY).
- `q<T>(sql, params)` → `query({query, query_params, format:"JSONEachRow"}).json()`.
- `lib/dashboard/data.ts` membungkus tiap query dengan `safe()` (L20-27): exception → `console.error` + **array kosong** (halaman tetap render dengan pesan "belum dapat ditampilkan"). Semua angka di-`toString()` di SQL lalu `Number()` di JS (hindari UInt64 sebagai string).
- Semua halaman berdata: `export const dynamic = "force-dynamic"` (tanpa `revalidate`) — tiap request query ClickHouse. `pdrb-ekraf` **tidak** diberi dynamic → statis (data konstanta).

---

## 1. Fungsi data `lib/dashboard/data.ts` — SQL persis

### 1.1 `TARGET_WISMAN` (L10-18) — konstanta, 6 baris
`Record<string, number>`: `{"2025":1286092,"2026":1289257,"2027":1594162,"2028":1848874,"2029":2105833,"2030":2332494}`.
Sumber: RPJMD 2025–2029 Tabel III.2 indikator 2.1.c "Jumlah Tamu Mancanegara".

### 1.2 `getWisman()` (L38-78) — 3 query paralel
**(a) bulanan** — `serving.mart_wisman`
```sql
SELECT concat(toString(w.tahun), '-', leftPad(toString(w.bulan_no), 2, '0')) AS periode,
       toString(w.tahun) AS tahun,
       toString(w.bulan_no) AS bulan,
       toString(sum(w.jumlah)) AS jumlah
FROM serving.mart_wisman w
WHERE w.tahun >= 2024
GROUP BY periode, tahun, bulan ORDER BY periode
```
→ `{periode:"2024-01", tahun:"2024", bulan:1, jumlah:186773}`. Live: 31 baris 2024-01…2026-07; total 2024=2.526.842 (12 bln), 2025=2.754.220 (12), 2026=1.586.937 (7).

**(b) negara** — `serving.mart_wisman`
```sql
SELECT concat(toString(w.tahun), '-', leftPad(toString(w.bulan_no), 2, '0')) AS periode, w.negara AS negara,
       toString(sum(w.jumlah)) AS jumlah
FROM serving.mart_wisman w
WHERE w.tahun >= 2024
GROUP BY periode, negara ORDER BY periode
```
→ `{periode, negara, jumlah}`. Live: 22 nilai negara, termasuk bucket sumber `"Lainnya"` (Amerika Serikat, Arab Saudi, Australia, Bahrain, Belanda, Filipina, Hong Kong, India, Inggris, Jepang, Jerman, Korea Selatan, Lainnya, Malaysia, Mesir, Perancis, Rusia, Singapura, Taiwan, Thailand, Tiongkok, Uni Emirat Arab).

**(c) pintu semesteran** — `silver.jumlah_wisatawan` (SDI)
```sql
SELECT toString(toYear(periode_data)) AS tahun, toString(semester) AS semester,
       pintu_masuk AS pintu, toString(sum(jumlah)) AS jumlah
FROM silver.jumlah_wisatawan
WHERE periode_data IS NOT NULL AND toYear(periode_data) >= 2024
GROUP BY tahun, semester, pintu ORDER BY tahun, semester
```
→ `{tahun:"2024", semester:1, pintu:"SOEKARNO HATTA", jumlah:839864}`. Live: 15 baris (2024 S1,S2; 2025 S1,S2; 2026 S1), pintu UPPERCASE: `SOEKARNO HATTA`, `HALIM PERDANA KUSUMA`, `TANJUNG PRIOK`.

### 1.3 `getLamaMenginap()` (L86-103) — `silver.data_rata_rata_lama_menginap_wisatawan_mancanegara_dan_wisatawan_nusantara_pada_hotel_berbintang_di_provinsi_dki_jakarta`
```sql
SELECT formatDateTime(periode_data, '%Y-%m') AS periode, jenis_hotel, jenis_tamu,
       toString(avg(rata_rata)) AS rata
FROM silver.data_rata_rata_lama_menginap_wisatawan_mancanegara_dan_wisatawan_nusantara_pada_hotel_berbintang_di_provinsi_dki_jakarta
WHERE periode_data IS NOT NULL AND rata_rata IS NOT NULL
GROUP BY periode, jenis_hotel, jenis_tamu ORDER BY periode
```
JS: `jenisTamu = /MANCANEGARA/i.test(jenis_tamu) ? "Wisman" : "Wisnus"` (apa pun selain mancanegara → Wisnus). → `{periode:"2023-11", jenisHotel:"BINTANG 3", jenisTamu:"Wisman", rataRata:2.32}`. Live: 330 baris, 2023-11…2026-07, kelas `BINTANG 1`…`BINTANG 5`. Dipakai halaman wisman & wisnus.

### 1.4 `getSertifikasi()` (L108-125) — UNION 2 tabel silver
```sql
SELECT toString(periode_data) AS tahun,
       trimBoth(replaceRegexpAll(replaceRegexpAll(upper(bidang), '\\s+AMP\\s+', ' DAN '), '\\s+', ' ')) AS bidang,
       toString(sum(jumlah_peserta)) AS jumlah
FROM (
  SELECT periode_data, bidang, jumlah_peserta FROM silver.jumlah_tenaga_kerja_pariwisata_dan_ekonomi_kreatif_yang_tersertifikasi
  UNION ALL
  SELECT periode_data, bidang, jumlah_peserta FROM silver.jumlah_tenaga_kerja_pariwisata_dan_ekonomi_kreatif_yang_tersertifikasi_tahun_2023_dan_2024
)
WHERE bidang IS NOT NULL
GROUP BY tahun, bidang ORDER BY tahun
```
(Di TS ditulis `'\\\\s+AMP\\\\s+'` dalam template literal → SQL menerima `'\\s+AMP\\s+'` → regex RE2 `\s+AMP\s+`; membersihkan sisa entitas HTML `&amp;` yang sudah jadi kata "AMP".) `periode_data` diasumsikan tahun (angka) — tipe kolom **belum terverifikasi**. Risiko dobel-hitung bila kedua tabel memuat tahun yang sama — **belum terverifikasi** (live per tahun: 2023=800, 2024=800, 2025=802).
→ `{tahun:"2023", bidang:"KEPEMANDUAN", jumlah:100}`. Live bidang (setelah titleCase JS): Kepemanduan, Mice, Hotel Dan Restoran, Spa, Edukator Museum, Musik, Fotografi, Film.

### 1.5 `getWisnusKotaTujuan()` (L130-147) — `silver.wisnus_perjalanan_per_kota_tujuan`
```sql
SELECT formatDateTime(periode, '%Y-%m') AS periode, kota_tujuan AS kota, toString(sum(jumlah_perjalanan)) AS jumlah
FROM silver.wisnus_perjalanan_per_kota_tujuan
WHERE periode IS NOT NULL AND kota_tujuan IS NOT NULL
GROUP BY periode, kota ORDER BY periode, kota
```
JS menambah `tahun = periode.slice(0,4)`, `bulan = Number(periode.slice(5,7))`. → `{periode:"2019-01", tahun:"2019", bulan:1, kota:"Jakarta Barat", jumlah:1044844}`. Live: 534 baris, 2019-01…2026-05, 6 kota (Jakarta Barat/Pusat/Selatan/Timur/Utara, Kepulauan Seribu); 72 baris/tahun 2019–2025, 30 baris 2026 (5 bulan).

### 1.6 `getPintuBulanan()` (L152-163) — `silver.wisman_per_pintu_masuk_bulanan_bps`
```sql
SELECT formatDateTime(periode, '%Y-%m') AS periode, pintu_masuk AS pintu, toString(sum(jumlah_kunjungan)) AS jumlah
FROM silver.wisman_per_pintu_masuk_bulanan_bps
WHERE periode IS NOT NULL
GROUP BY periode, pintu ORDER BY periode
```
→ `{periode:"2024-01", pintu:"Bandara Soekarno-Hatta", jumlah:157979}`. Live: 36 baris, **hanya 2024-01…2024-12**; pintu: `Bandara Soekarno-Hatta`, `Bandara Halim Perdana Kusuma`, `Pelabuhan Tanjung Priok`.

### 1.7 `getTenagaKerjaEkraf()` (L173-202) — 2 query
**(a) dki** — `silver.tenaga_kerja_ekraf_per_provinsi`
```sql
SELECT toString(toUInt16(tahun)) AS tahun,
       toString(sumIf(jumlah_tenaga_kerja, kode_wilayah = 31 AND jenis_kelamin = 'Total')) AS total,
       toString(sumIf(jumlah_tenaga_kerja, kode_wilayah = 31 AND jenis_kelamin = 'Laki-laki')) AS laki,
       toString(sumIf(jumlah_tenaga_kerja, kode_wilayah = 31 AND jenis_kelamin = 'Perempuan')) AS perempuan,
       toString(sumIf(jumlah_tenaga_kerja, jenis_kelamin = 'Total')) AS nasional
FROM silver.tenaga_kerja_ekraf_per_provinsi
WHERE tahun IS NOT NULL
GROUP BY tahun ORDER BY tahun
```
`nasional` = jumlah SELURUH baris `Total` (semua provinsi). Bila tabel memuat baris agregat "Indonesia", nasional akan dobel — **belum terverifikasi** (porsi live ~4,75–5,15% terlihat wajar).
Live: 2020–2024: total 998.923 / 1.089.729 / 1.167.869 / 1.277.261 / 1.257.285; laki 494.896/529.852/601.235/630.031/616.756; perempuan 504.027/559.877/566.634/647.230/640.529; porsi 5,15/4,98/4,87/5,13/4,75%.

**(b) subsektorNasional** — `silver.tenaga_kerja_ekraf_per_subsektor_nasional`
```sql
SELECT toString(toUInt16(tahun)) AS tahun, subsektor, toString(sum(jumlah_tenaga_kerja)) AS jumlah
FROM silver.tenaga_kerja_ekraf_per_subsektor_nasional
WHERE tahun IS NOT NULL AND subsektor IS NOT NULL
GROUP BY tahun, subsektor ORDER BY tahun
```
Live: 80 baris = 5 tahun (2020–2024) × 16 subsektor: Aplikasi dan Game Developer, Arsitektur, Desain Interior, Desain Komunikasi Visual, Desain Produk, **Fesyen**, Film, Animasi, dan Video, Fotografi, Kriya, Kuliner, Musik, Penerbitan, Periklanan, Seni Pertunjukan, Seni Rupa, Televisi dan Radio. Contoh `{tahun:"2020", subsektor:"Kuliner", jumlah:10670832}`.

### 1.8 Konstanta PDRB — `lib/dashboard/pdrb-ekraf.ts` (statis, TIDAK dari ClickHouse)
Header L1-9: disalin dari "PDRB Ekonomi Kreatif DKI Jakarta Tahun 2016-2025 Sem 1.xlsx" (Dinas, MoM 21 Sep 2026); "SEMENTARA (mockup)… Jalur resmi = … serving.mart_pdrb_ekraf". Keberadaan `serving.mart_pdrb_ekraf` di lake **belum terverifikasi** (kode tidak membacanya).
- `PDRB_SUMBER` (L10) = `"PDRB Ekonomi Kreatif DKI Jakarta 2016–Sem I 2025 (BPS × Disparekraf)"`.
- `PDRB_MAKRO` (L13): objek kolom-paralel, **9 periode** `["2017",…,"2024","S1 2025"]`, field (Rp miliar / %):
  `adhbEkraf, adhbDki, kontribusi, adhkEkraf, tumbuhEkraf, tumbuhNonEkraf, tumbuhDki` (masing-masing array 9).
  Nilai 2024: adhbEkraf 410568.43, adhbDki 3679358.6, kontribusi 11.16, adhkEkraf 272419.52, tumbuhEkraf 8.13, tumbuhNonEkraf 4.45, tumbuhDki 4.91. S1 2025: 222969.2 / 1934128.99 / 11.53 / 144967.62 / 9.42 / 4.45 / 5.07.
  `kontribusi` konsisten = adhbEkraf/adhbDki×100 (dicek 2019–S1 2025). `adhbDki` tidak dipakai UI.
- `PDRB_SUB_PERIODE` (L16) = 7 periode `["2019","2020","2021","2022","2023","2024","S1 2025"]`.
- `PDRB_SUBSEKTOR` (L17-498): **16 subsektor** × `{nama, adhb[7], adhk[7], tumbuh[7]}`. Urutan: Arsitektur, Desain Interior, Desain Komunikasi Visual, Desain Produk, Film, Animasi, dan Video, Fotografi, Kriya, Kuliner, Musik, Fashion, Aplikasi dan Pengembang Permainan, Penerbitan, Periklanan, Televisi dan Radio, Seni Pertunjukan, Seni Rupa. Σadhb per periode = adhbEkraf (selisih ≤0,02 pembulatan). `adhk` tidak dipakai UI.
- `TARGET_KONTRIBUSI_RPJMD` (L501): 5 baris `{"2025":10.51,"2026":10.87,"2027":11.0,"2028":11.12,"2029":11.24}`.

### 1.9 `lib/dashboard/subsektor-colors.ts`
`warnaSubsektor(nama)`: normalisasi (lowercase, `&`→" dan ", non-alnum→spasi, rapatkan spasi) → `ALIAS` → `WARNA`; tak dikenal → `#94a3b8`.
WARNA (16): aplikasi dan pengembang permainan `#2563eb`, arsitektur `#64748b`, desain interior `#0891b2`, desain komunikasi visual `#7c3aed`, desain produk `#db2777`, fashion `#e11d48`, film animasi dan video `#f0a13a`, fotografi `#0d9488`, kriya `#a16207`, kuliner `#ed6b23`, musik `#9333ea`, penerbitan `#65a30d`, periklanan `#0e7c42`, seni pertunjukan `#c2410c`, seni rupa `#4f46e5`, televisi dan radio `#0369a1`.
ALIAS: "aplikasi dan game developer"/"aplikasi game"/"pengembang permainan"→aplikasi…; "dkv"→dkv; "film animasi video"→film…; "tv dan radio"/"televisi radio"→televisi dan radio.
Rekomendasi: kirim `warna` per baris dari API (lihat kontrak) agar Nuxt tak perlu menduplikasi logika — atau port fungsi ini apa adanya.

---

## 2. Halaman `/dashboard` (beranda) — `app/dashboard/page.tsx`
- Server component, `dynamic = "force-dynamic"` (L7). Data: `getWisman()` (hanya `bulanan` dipakai — query negara & pintu ikut jalan, boros).
- `t2025 = Σ bulanan.jumlah where tahun==="2025"`; `iK = PDRB_MAKRO.periode.indexOf("2024")`.
- **Baris KPI** (`KpiStat` langsung, grid 1/2/4 kolom):
  1. label `Wisman 2025`; value `t2025 || "—"` (number → id-ID, live "2.754.220"); sub `target RPJMD 1.286.092` (`TARGET_WISMAN["2025"].toLocaleString("id-ID")`).
  2. `Kontribusi PDRB Ekraf 2024`; value `"11,16%"`; sub `target 2025 10,51%`.
  3. `Nilai PDRB Ekraf 2024`; value `` `Rp ${Math.round(adhbEkraf[iK]/1000).toLocaleString("id-ID")} T` `` → `"Rp 411 T"`; sub `ADHB`.
  4. `Pertumbuhan Ekraf 2024`; value `"8,13%"`; sub `DKI 4,91%`.
- **Kartu menu** (`mt-6 grid gap-4 md:grid-cols-2`): untuk tiap item `DASHBOARD_MENU` → `<Link class="utility-card block p-5 hover:shadow-md">`: eyebrow = nama grup (apple-fine uppercase), label 17px semibold + `" →"`, sub 13px muted. 4 kartu.
- Tidak ada SourceNote.

**Kontrak data:**
`GET /v1/dashboard/ringkasan` →
```json
{ "wisman": {"tahun":"2025","jumlah":2754220,"target":1286092},
  "pdrb":   {"tahun":"2024","kontribusi_pct":11.16,"target_tahun":"2025","target_pct":10.51,
             "adhb_ekraf_miliar":410568.43,"tumbuh_ekraf_pct":8.13,"tumbuh_dki_pct":4.91} }
```
(Tahun "2025"/"2024" saat ini hard-code di kode; API boleh menetapkan, tapi label UI harus tetap sama → kirim `tahun`.)

---

## 3. Halaman `/dashboard/wisman` — `app/dashboard/wisman/page.tsx` + `components/dashboard/WismanStat.tsx` (client) + `LosByClass.tsx` (client)

Server: `dynamic="force-dynamic"`; `Promise.all([getWisman(), getLamaMenginap(), getPintuBulanan()])`; render `<WismanStat data los target={TARGET_WISMAN} pintuBulanan/>`. Seluruh agregasi di klien.

### 3.1 Header halaman (page.tsx L12-15)
Eyebrow `Kinerja Pariwisata`; h2 22px bold `Wisatawan Mancanegara (2024–2026)`.

### 3.2 State & turunan (WismanStat L69-131)
- `years` = tahun unik di `bulanan`, sort. `year` default `"2025"` bila ada, else tahun terakhir.
- `periods` = `bulanan.map(periode)`; `month` default periode terakhir.
- `total(y)` = Σjumlah bulanan tahun y; `nMonths(y)` = jumlah baris bulanan tahun y; `partial(y)` = nMonths<12.
- `yLabel(y)` = partial ? `` `${y} (s/d ${BULAN[nMonths-1]})` `` : y → live `"2026 (s/d Jul)"`. (Asumsi bulan berurutan dari Jan; jika ada bulan bolong label salah — Q8.)
- `full` = tahun non-parsial; `lastFull`, `prevFull`; `growth = (total(lastFull)-total(prevFull))/total(prevFull)*100` → live 2025 vs 2024 ≈ 9,0%.
- `topN(map, n=8)` (L20-26): buang label "LAINNYA" (case-insensitive) dari peringkat, sort desc, ambil n; `rest = Σsemua (termasuk Lainnya sumber) − Σtop`; tambahkan `{label:"Lainnya", value:rest}` bila rest>0.
- `titlePintu(s)` = Title Case + `"Soekarno Hatta"`→`"Soekarno-Hatta"` → "Soekarno-Hatta", "Halim Perdana Kusuma", "Tanjung Priok".
- `PINTU_COLORS` (L35-39): Soekarno-Hatta `#0e7c42`, Halim Perdana Kusuma `#ed6b23`, Tanjung Priok `#2563eb`.
- `NEGARA_COLORS` (L45-55): Tiongkok `#0e7c42`, Malaysia `#ed6b23`, Singapura `#f0a13a`, Jepang `#2563eb`, Korea Selatan `#7c3aed`, Amerika Serikat `#0891b2`, Australia `#e11d48`, India `#65a30d`, Arab Saudi `#0d9488`. Negara lain → palette Donut berurutan; Lainnya → `#cbd5e1`.
- Jika `bulanan` kosong → kotak merah: `Data wisatawan mancanegara belum dapat ditampilkan. Coba muat ulang halaman.`

### 3.3 Seksi top-to-bottom
0. `<p class="mb-5 apple-fine">Data tersedia {labelBulan(periods[0])} – {labelBulan(periods[last])}</p>` → "Data tersedia Jan 2024 – Jul 2026". `labelBulan("2024-01")` = `"Jan 2024"`.
1. **SectionHead** `1 · Tahunan` / desc `Capaian vs target RPJMD dan komposisi wisman per tahun.`
2. **KpiRow** — satu Kpi per tahun di `years`: label `` `Capaian ${yLabel(y)}` ``, value `total(y)`, sub `target RPJMD {idNum(target[y])}` atau `target RPJMD belum ditetapkan` (2024). Lalu Kpi `Pertumbuhan {lastFull}`, value `"{idNum(growth,1)}%"` / "—", delta growth, sub `vs {prevFull}` → sub tampil "▲ 9% vs 2024". (Dengan 3 tahun → 4 kartu.)
3. **ChartCard** `Capaian vs Target Wisman` / sub `Capaian = batang (kunjungan wisman) · Target RPJMD = garis` → `ComboBarLine` categories `years.map(yLabel)`, bar `{name:"Capaian", values: years.map(total)}`, line `{name:"Target RPJMD", values: target[y] ?? null}`, `dualAxis=false`. Catatan di bawah: `RPJMD 2025–2029 mencantumkan target dimulai dari tahun 2025 (Tabel III.2 indikator 2.1.c).` + bila tahun terakhir parsial `" {last} masih berjalan — capaian parsial s/d {BULAN}."`.
4. **Filter tahun**: label `Filter berdasarkan Tahun` (apple-fine uppercase) + `ModeToggle` opsi `years`.
5. **ChartGrid 2**:
   - `Persentase Wisman berdasarkan Kebangsaan · {yLabel(year)}` / `8 negara terbesar + lainnya` → Donut showPercent, data `topN(Σ negara per tahun)`, colorMap NEGARA_COLORS.
   - `Persentase Wisman berdasarkan Pintu Masuk · {year}` (tanpa yLabel) / sub `` `Soekarno-Hatta, Halim, Tanjung Priok · semester ${semYear.join(" & ") || "—"}` `` → Donut showPercent, data Σ pintu semesteran SDI tahun itu per titlePintu, colorMap PINTU_COLORS. (Sumber semesteran SDI, bukan BPS bulanan.)
6. **SectionHead** `2 · Tren Bulanan` / `Tren bulanan, perbandingan year-on-year, komposisi per bulan, dan lama menginap.`
7. **ChartCard** `Grafik Wisman per bulan` / `kunjungan wisman per bulan, seluruh periode` → VerticalBars (oranye) data `bulanan {label: periode, value: jumlah}`, unit `" kunjungan"`, labelFmt labelBulan.
8. **ChartGrid 2**:
   - `Wisman year-on-year` / `bulan yang sama dibandingkan lintas tahun · • = tahun berjalan` → GroupedBars categories `BULAN`, series per tahun (name `"2026 •"` bila parsial), data `{label: BULAN[bulan-1], value}`, unit `" kunjungan"`, colors `["#f4a672","#ed6b23","#0e7c42"]` (urut tahun lama→baru).
   - `Pertumbuhan YoY per bulan (%)` / `vs bulan yang sama tahun sebelumnya` → VerticalBars color `#0e7c42`, unit `"%"`, labelFmt labelBulan; data: untuk tiap bulan yang punya pembanding tahun−1: `round(((j−p)/p)*1000)/10` (1 desimal). Live mulai 2025-01.
9. **Pilih bulan**: label `Pilih bulan` + `<select>` semua `periods` (urut naik, teks labelBulan), default periode terakhir. Kelas `rounded-lg border bg-white px-3 py-1.5 13px semibold shadow-sm`.
10. **KpiRow** bulan:
   - `Wisman {labelBulan(month)}` value `mRow.jumlah ?? 0`, sub `kunjungan`.
   - `YoY bulan ini` value `"{idNum(yoy,1)}%"`/"—", delta yoy, sub `vs {labelBulan(prevYearSame)}` atau `tak ada pembanding`.
   - `Negara terbanyak` value `topN(negaraMonth,1)[0].label` / "—", sub `"{idNum(value)} kunjungan"`.
   - `Lama menginap wisman` value `losAvg("Wisman")[month]` (toLocaleString id-ID) / "—", sub `hari · hotel bintang (rata-rata kelas)`.
11. **ChartGrid 2**:
   - `Persentase Wisman berdasarkan Kebangsaan · {labelBulan(month)}` / `8 negara terbesar + lainnya` → Donut topN(negara bulan itu).
   - Bila ada baris BPS bulanan untuk `month`: `Persentase Wisman berdasarkan Pintu Masuk · {labelBulan(month)}` / `data bulanan BPS DKI Jakarta` → Donut, label = pintu tanpa prefix `^(Bandara|Pelabuhan) ` (→ "Soekarno-Hatta" dll.), colorMap PINTU_COLORS.
     Selain itu (fallback): `Persentase Wisman berdasarkan Pintu Masuk · Semester {1|2} {tahun}` / `data bulanan BPS belum tersedia untuk bulan ini — ditampilkan data semesteran SDI` → Donut semester SDI (semester = bulan≤6 ? 1 : 2); bila kosong teks `Semester ini belum dirilis.` (py-10 center 13px).
12. **SectionHead** `Length of Stay — rata-rata lama menginap` / `Rata-rata lama menginap (hari) per bulan, wisman vs wisnus.`
13. **ChartGrid 2**:
   - `RTL Bintang · tren bulanan` / `rata-rata sederhana Bintang 1–5 (hari)` → GroupedLines series `Wisman`, `Wisnus` = `losAvg(tamu)`: per periode, rata-rata **tak berbobot** atas kelas Bintang yang ada, `round(x*100)/100`. Label x mentah "YYYY-MM".
   - `LosByClass guest="Wisman"` (lihat 3.4).
   (Komentar L250: RTL Non Bintang belum ditampilkan.)
14. **SourceNote** (page.tsx L17-20): `Sumber: Satu Data Jakarta (kunjungan bulanan dan kebangsaan, mulai 2024; pintu masuk semesteran), BPS Provinsi DKI Jakarta (pintu masuk bulanan 2024; rata-rata lama menginap hotel bintang). Diperbarui otomatis setiap hari.`

### 3.4 `LosByClass({los, guest})` (dipakai wisman & wisnus)
- rows = los filter jenisTamu==guest & finite; `periods` unik sort; state `selected` default periode terakhir.
- `losComparison(rows, period)`: `previous = "{tahun-1}-{bulan}"`; kelas = union kelas di periode & pembanding, sort; tiap kelas `{label: hotel.replace("BINTANG","Bintang"), value, baseline, yoy = (value−baseline)/baseline*100 | null}`.
- ChartCard title `Per kelas hotel · {Bln YYYY}`, sub `{guest.toLowerCase()} · hari · perbandingan YoY` (→ "wisman · hari · perbandingan YoY").
- Kosong → `<p role="status">Data lama menginap belum tersedia.</p>`.
- `<label>Periode <select aria-label="Periode Length of Stay {guest}">` opsi periode **terbaru di atas** (reverse), teks "Bln YYYY".
- GroupedBars categories label kelas; series [`{label periode}` = value, `{label pembanding}` = baseline], `missingValue=null`, unit `" hari"`, palette default (oranye `#ed6b23`, `#f0a13a`).
- Catatan: `YoY membandingkan bulan yang sama pada tahun sebelumnya.` atau `Data {prevLabel} belum tersedia; YoY tidak dihitung.`
- Tabel 12px tabular-nums, kolom: `Kelas hotel` | `{prevLabel}` | `{label}` | `YoY`; nilai `idNum(v,2)` / "—"; YoY `"+x,x%"` (tanda + bila >0) / "—". Caption sr-only `Length of Stay {guest} per kelas hotel dan perubahan YoY`.

### 3.5 Kontrak data — wisman
Semua angka sudah final; Nuxt hanya memformat (id-ID) dan memilih.
1. `GET /v1/dashboard/wisman/tahunan` →
```json
{ "data_tersedia": {"dari":"2024-01","sampai":"2026-07"},
  "tahun": [ {"tahun":"2024","label":"2024","jumlah":2526842,"n_bulan":12,"parsial":false,"target":null},
             {"tahun":"2025","label":"2025","jumlah":2754220,"n_bulan":12,"parsial":false,"target":1286092},
             {"tahun":"2026","label":"2026 (s/d Jul)","jumlah":1586937,"n_bulan":7,"parsial":true,"target":1289257} ],
  "pertumbuhan": {"tahun":"2025","pembanding":"2024","persen":8.998},
  "target_sumber": "RPJMD 2025–2029 Tabel III.2 indikator 2.1.c",
  "tahun_default": "2025" }
```
   (Target dari tabel konfigurasi target RPJMD di API, bukan konstanta frontend.)
2. `GET /v1/dashboard/wisman/bulanan` →
```json
{ "rows": [ {"periode":"2025-01","tahun":"2025","bulan":1,"label":"Jan 2025","jumlah":0,"yoy_pct":-1.2,"pembanding":"2024-01"} ] }
```
   (`yoy_pct` dibulatkan 1 desimal sama seperti grafik YoY; null bila tak ada pembanding.) Dipakai: grafik per bulan, YoY grouped bars (frontend hanya mengelompokkan by `tahun` — atau sediakan `?bentuk=yoy` → `{kategori: BULAN, seri:[{nama:"2026 •",tahun:"2026",parsial:true,nilai:[12 angka|null]}]}`), grafik YoY %, dropdown bulan, KPI bulan.
3. `GET /v1/dashboard/wisman/kebangsaan?tahun=2025` **atau** `?periode=2026-07` (`&top=8` default) →
```json
{ "periode":"2025", "items":[ {"label":"Tiongkok","value":123,"warna":"#0e7c42"}, …, {"label":"Lainnya","value":456,"warna":"#cbd5e1"} ] }
```
   Aturan topN persis 3.2 (Lainnya sumber digabung ke Lainnya). KPI "Negara terbanyak" = `items[0]`.
4. `GET /v1/dashboard/wisman/pintu-masuk?tahun=2025` →
   `{ "sumber":"sdi_semester", "semester":[1,2], "items":[{"label":"Soekarno-Hatta","value":2760838,"warna":"#0e7c42"}, …] }`
   `GET /v1/dashboard/wisman/pintu-masuk?periode=2026-07` → bila ada BPS bulanan: `{"sumber":"bps_bulanan","items":[…]}`; else `{"sumber":"sdi_semester","tahun":"2026","semester":2,"items":[]}` (items kosong → "Semester ini belum dirilis."). Label pintu sudah dinormalisasi (titlePintu / strip prefix).
5. `GET /v1/dashboard/lama-menginap/rata-rata` → `{ "rows":[ {"periode":"2026-07","wisman":1.95,"wisnus":1.6} ] }` (rata-rata sederhana antar kelas, 2 desimal; null bila tak ada). Dipakai KPI "Lama menginap wisman" & GroupedLines RTL.
6. `GET /v1/dashboard/lama-menginap/per-kelas?tamu=wisman|wisnus[&periode=YYYY-MM]` →
```json
{ "periode_list":["2023-11", …, "2026-07"], "periode":"2026-07", "pembanding":"2025-07",
  "rows":[ {"kelas":"BINTANG 1","label":"Bintang 1","nilai":1.8,"pembanding":1.7,"yoy_pct":5.88} ] }
```
   + (untuk wisnus) `GET /v1/dashboard/lama-menginap/series?tamu=wisnus` → `{ "series":[{"nama":"Bintang 1","data":[{"periode":"2023-11","nilai":1.6}]}] }`.

---

## 4. Halaman `/dashboard/wisnus` — `app/dashboard/wisnus/page.tsx` + `WisnusStat.tsx` (client) + `WisnusLos.tsx` (client) + `LosByClass`

Server: `dynamic="force-dynamic"`; `Promise.all([getLamaMenginap(), getWisnusKotaTujuan()])`.

### 4.1 Header & seksi page.tsx
- Eyebrow `Kinerja Pariwisata`; h2 `Wisatawan Nusantara`; `<p class="apple-fine">Wisatawan Nusantara Berdasarkan Kota Tujuan</p>`.
- SectionHead `Tahunan · Capaian` / `Jumlah perjalanan wisatawan nusantara menurut kabupaten/kota tujuan di DKI Jakarta, 2019–2026 (Berdasarkan data BPS).` → `<WisnusStat rows/>`.
- SectionHead `Bulanan · Length of Stay` / `Rata-rata lama menginap wisatawan nusantara di hotel bintang (hari).` → `<WisnusLos los/>`.
- SourceNote: `Sumber: BPS Provinsi DKI Jakarta (Jumlah Perjalanan Wisatawan Nusantara Menurut Kabupaten/Kota Tujuan; rata-rata lama menginap tamu hotel bintang via Satu Data Jakarta).`

### 4.2 WisnusStat — state & turunan (L19-95)
- Konstanta `SEMUA = "Semua kota"`, `SELURUH = "Seluruh Jakarta"`.
- `kotaList` unik sort; `years` unik sort; state `kota`=SEMUA, `yoyKota`=SELURUH, `year` default = tahun terakhir yang barisnya ≥ 12×|kotaList| (live 2025), else tahun terakhir.
- Kosong → `Data wisatawan nusantara belum dapat ditampilkan. Coba muat ulang halaman.`
- `sel` = rows (SEMUA) atau filter kota. `nBulan(y)` = jumlah bulan unik tahun y **di seluruh rows** (bukan sel). `partial`, `yLabel` seperti wisman (live "2026 (s/d Mei)").
- `total(y, src=sel)`; `lastFull/prevFull/growth` (pakai `sel`, jadi ikut filter kota).
- `missing` = tahun bolong antara min..max (teks catatan).
- YTD: `last` = tahun terakhir; `ytdMonths = partial(last) ? nBulan(last) : 12`; `ytd(y)` = Σ sel tahun y bulan ≤ ytdMonths.
- `perKota(y)` = Σ per kota tahun y dari **rows (tidak terfilter kota)**, sort desc. `topKota = perKota(lastFull ?? last)[0]`.
- `monthlySeries`: SEMUA → satu seri per kota; else satu seri kota itu; data `{label: periode, value}`.
- YoY: `yoyRows` = rows (SELURUH) atau satu kota; jumlahkan per periode + catat set kota per periode; `yoyYears` = 3 tahun terakhir; series name `"{y} •"` bila partial; `yoyPct` = `round((j/p − 1)*100*10)/10` **hanya jika set kota di bulan ini == set kota bulan pembanding**.

### 4.3 Seksi WisnusStat top-to-bottom
1. Filter: `Kota tujuan` (uppercase) + `<select>` [`Semua kota`, …kotaList] + teks `Berdasarkan Kota/Kabupaten Tujuan Wisatawan Nusantara`.
2. KpiRow:
   - `Capaian {lastFull}` value total(lastFull) (number) / "—", sub `perjalanan`.
   - `Pertumbuhan {lastFull}` value `"{idNum(growth,1)}%"`, delta, sub `vs {prevFull}`.
   - label `{yLabel(last)}` (mis. "2026 (s/d Mei)") value total(last), sub bila parsial: `` `Jan–${BULAN[ytdMonths-1]} ${lastFull}: ${idNum(ytd(lastFull))}` `` (perbandingan YTD), else `perjalanan`.
   - `Tujuan terbanyak {lastFull}` value topKota.label, sub `"{idNum(value)} perjalanan"`.
3. ChartCard `Capaian tahunan · {kota}` / `jumlah perjalanan wisnus per tahun` → VerticalBars (oranye) `{label: yLabel(y), value: total(y)}`, unit `" perjalanan"`; catatan bila ada `missing`: `Tahun {list} belum tersedia.`
4. `Filter berdasarkan Tahun` + ModeToggle years.
5. ChartGrid 2 (tidak terpengaruh filter kota):
   - `Persentase per kota tujuan · {yLabel(year)}` / `% dari total perjalanan ke DKI Jakarta` → Donut showPercent perKota(year) (tanpa colorMap → palette berdasarkan urutan nilai).
   - `Perjalanan per kota tujuan · {yLabel(year)}` / `perjalanan` → BarBreakdown perKota(year) (oranye), unit `" perjalanan"`.
6. ChartCard `Tren bulanan · {kota}` / `perjalanan per bulan menurut kota tujuan` → GroupedLines monthlySeries (label x mentah YYYY-MM).
7. Filter `Kota/kabupaten (YoY)` + `<select>` [`Seluruh Jakarta`, …kotaList].
8. ChartGrid 2:
   - `Wisnus year-on-year · {yoyKota}` / `bulan yang sama dibandingkan lintas tahun · • = tahun berjalan` → GroupedBars categories BULAN, yoySeries, unit `" perjalanan"`, colors `["#f4a672","#ed6b23","#0e7c42"].slice(-n)`.
   - `Pertumbuhan YoY per bulan (%) · {yoyKota}` / `vs bulan yang sama tahun sebelumnya` → VerticalBars `#0e7c42`, unit "%", labelFmt "Bln YYYY".

### 4.4 WisnusLos
- w = los Wisnus; kosong → kotak merah `Data lama menginap belum dapat ditampilkan.`
- ChartGrid 2: ChartCard `Lama menginap wisnus per bulan` / `hari · per kelas hotel bintang` → GroupedLines satu seri per kelas (nama "Bintang N", sort), label YYYY-MM; + `LosByClass guest="Wisnus"` (sub "wisnus · hari · perbandingan YoY").

### 4.5 Kontrak data — wisnus
1. `GET /v1/dashboard/wisnus/meta` → `{ "kota":["Jakarta Barat",…,"Kepulauan Seribu"], "tahun":["2019",…,"2026"], "tahun_hilang":[], "tahun_default":"2025", "data_tersedia":{"dari":"2019-01","sampai":"2026-05"} }`
2. `GET /v1/dashboard/wisnus/tahunan?kota=Semua%20kota|<kota>` →
```json
{ "tahun":[ {"tahun":"2025","label":"2025","jumlah":0,"n_bulan":12,"parsial":false} ],
  "kpi": { "capaian":{"tahun":"2025","jumlah":0},
           "pertumbuhan":{"tahun":"2025","pembanding":"2024","persen":0.0},
           "berjalan":{"tahun":"2026","label":"2026 (s/d Mei)","jumlah":0,"ytd_pembanding":{"tahun":"2025","bulan_akhir":5,"jumlah":0}},
           "tujuan_teratas":{"tahun":"2025","kota":"Jakarta Selatan","jumlah":0} } }
```
   (`n_bulan`/`parsial` dihitung dari seluruh kota, `tujuan_teratas` tidak ikut filter — pertahankan.)
3. `GET /v1/dashboard/wisnus/per-kota?tahun=2025` → `{ "label":"2025", "items":[{"label":"Jakarta Selatan","value":0}] }` (sort desc).
4. `GET /v1/dashboard/wisnus/bulanan?kota=…` → `{ "series":[{"nama":"Jakarta Barat","data":[{"periode":"2019-01","nilai":1044844}]}] }`.
5. `GET /v1/dashboard/wisnus/yoy?kota=Seluruh%20Jakarta|<kota>` →
```json
{ "kategori":["Jan",…,"Des"],
  "seri":[{"nama":"2024","tahun":"2024","parsial":false,"nilai":[…12, null bila tak ada]}],   // 3 tahun terakhir
  "pertumbuhan":[{"periode":"2020-01","label":"Jan 2020","persen":-3.2}] }
```
6. Lama menginap: pakai `/v1/dashboard/lama-menginap/series?tamu=wisnus` dan `/per-kelas?tamu=wisnus` (bagian 3.5).

---

## 5. Halaman `/dashboard/tenaga-kerja` — `app/dashboard/tenaga-kerja/page.tsx` (server) + `TkSubsektor.tsx` (client)

Server, `dynamic="force-dynamic"`; `Promise.all([getTenagaKerjaEkraf(), getSertifikasi()])`. Semua agregasi di server component (L16-27).

### 5.1 Turunan
- `dki = tk.dki.filter(total>0)`; `last`, `prev` = dua terakhir; `growth = (last.total−prev.total)/prev.total*100` (live 2024: −1,6%).
- `share(r) = round(r.total/r.nasional*10000)/100` (2 desimal).
- `titleCase(s)` = lowercase lalu kapital tiap awal kata (`\b\w`) → "MICE"→"Mice", "HOTEL DAN RESTORAN"→"Hotel Dan Restoran".
- `years` sertifikasi unik sort; `bidang` unik **urut kemunculan** (SQL order by tahun saja → urutan dalam tahun tak deterministik — Q11).
- `sertPerTahun` = Σ per tahun; `sertSeries` = per tahun, data per bidang (0 bila tak ada).

### 5.2 Seksi top-to-bottom
1. Eyebrow `Kinerja Ekonomi Kreatif`; h2 `Tenaga Kerja Ekonomi Kreatif`.
2. SectionHead `1 · Jumlah tenaga kerja ekonomi kreatif` / `Statistik resmi Kemenekraf (olahan Sakernas BPS dengan Kemenekraf)`.
3. KpiRow (bila `last`; else kotak merah `Data tenaga kerja ekonomi kreatif belum dapat ditampilkan. Coba muat ulang halaman.`):
   - `Tenaga kerja ekraf DKI {last.tahun}` value last.total (live 1.257.285), sub `orang`.
   - `Pertumbuhan {last.tahun}` value `"{idNum(growth,1)}%"` (live "-1,6%"), delta, sub `vs {prev.tahun}` → tampil "▼ 1,6% vs 2023".
   - `Porsi terhadap nasional {tahun}` value `"{idNum(share,2)}%"` (4,75%), sub `nasional {idNum(nasional)} orang`.
   - `Laki-laki / Perempuan {tahun}` value `"616.756 / 640.529"`, sub `orang`.
4. SectionHead `2 · Rincian berdasarkan subsektor ekonomi kreatif` (tanpa desc) → `TkSubsektor`:
   - ModeToggle tahun (default terakhir, 2024).
   - ChartCard `Tenaga Kerja Ekonomi Kreatif per Subsektor di Tingkat Nasional - Tahun {tahun}` (tanpa sub) → BarBreakdown sort desc, unit `" orang"`, colors `warnaSubsektor(label)`.
5. SectionHead `3 · Tren Tenaga Kerja Sektor Ekonomi Kreatif Provinsi DKI Jakarta` / `5 tahun terakhir`.
6. ChartGrid 2:
   - `Tenaga kerja ekraf DKI & porsi nasional` / `batang = orang · garis = % terhadap nasional` → ComboBarLine (dualAxis default true) categories tahun, bar `Tenaga kerja (orang)`, line `Porsi nasional` unit `%`.
   - `Menurut jenis kelamin` / `orang` → GroupedBars series `Laki-laki`, `Perempuan`, unit `" orang"`, colors `["#ed6b23","#0e7c42"]`.
7. SectionHead `Tenaga kerja tersertifikasi / pendampingan Dinas` / `Peserta pelatihan dan sertifikasi tenaga kerja pariwisata dan ekonomi kreatif yang didampingi Dinas, dipisahkan dari data tenaga kerja umum.`
8. ChartGrid 2:
   - `Peserta sertifikasi per tahun` / `Pelatihan dan sertifikasi tenaga kerja sektor pariwisata dan ekonomi kreatif` → BarBreakdown (horizontal) sertPerTahun, unit `" orang"`, color `#0e7c42`. Live 2023=800, 2024=800, 2025=802.
   - `Per bidang sertifikasi` / `orang · per tahun` → GroupedBars categories bidang titleCase, series per tahun, unit `" orang"`, colors `["#f4a672","#ed6b23","#0e7c42"]`.
9. SourceNote: `Sumber: Satu Data Ekraf (Kemenekraf, olahan Sakernas BPS dan Kemenekraf) — satudata.ekraf.go.id; Satu Data Jakarta — tenaga kerja pariwisata & ekraf tersertifikasi (2023–2025).`

### 5.3 Kontrak data — tenaga kerja
1. `GET /v1/dashboard/tenaga-kerja/dki` →
```json
{ "rows":[ {"tahun":"2024","total":1257285,"laki":616756,"perempuan":640529,"nasional":26470000,"porsi_pct":4.75} ],
  "kpi": {"tahun":"2024","total":1257285,"pembanding":"2023","pertumbuhan_pct":-1.56,"porsi_pct":4.75,"nasional":26470000,"laki":616756,"perempuan":640529} }
```
   (rows sudah difilter total>0; nilai `nasional` contoh di atas ilustratif — **belum terverifikasi**.)
2. `GET /v1/dashboard/tenaga-kerja/subsektor?tahun=2024` → `{ "tahun_list":["2020",…,"2024"], "tahun":"2024", "items":[{"label":"Kuliner","value":0,"warna":"#ed6b23"}] }` (sort desc; warna via warnaSubsektor).
3. `GET /v1/dashboard/tenaga-kerja/sertifikasi` →
```json
{ "per_tahun":[{"label":"2023","value":800},{"label":"2024","value":800},{"label":"2025","value":802}],
  "bidang":["Kepemanduan","Mice","Hotel Dan Restoran","Spa","Edukator Museum","Musik","Fotografi","Film"],
  "seri":[{"nama":"2023","nilai":[100,240,360,100,0,0,0,0]}] }
```

---

## 6. Halaman `/dashboard/pdrb-ekraf` — `app/dashboard/pdrb-ekraf/page.tsx` (server, statis) + `PdrbEkrafStat.tsx` (client)

Tidak ada `dynamic`/`revalidate`; tidak ada query — semua dari konstanta 1.8.

### 6.1 Turunan (PdrbEkrafStat L14-50)
- `label(p)` = `"S1 2025"` → `"2025 (Sem I)"`, lainnya apa adanya.
- `iLast` = indeks terakhir (S1 2025); `iFull` = indeks "2024".
- State `sub` (Sebaran) default `"2024"`; `subTumbuh` (Pertumbuhan) default `"2024"`; opsi = PDRB_SUB_PERIODE (7).
- `cats` = 9 periode + `"2026","2027","2028","2029"` (13 kategori); `capaian` = kontribusi atau null; `target` = `T[c==="S1 2025" ? "2025" : c] ?? null`.
- `totalSub` = Σadhb subsektor periode `sub`; `pct(v) = round(v/totalSub*10000)/100`.
- `urut` = subsektor `{label:nama, value:adhb}` sort desc; donut = 5 teratas (label pendek via `PENDEK`) + `Lainnya` = Σ sisa; nilai donut = **persen** (bukan Rp).
- `PENDEK` (L17-22): "Aplikasi dan Pengembang Permainan"→"Aplikasi & Game", "Televisi dan Radio"→"TV & Radio", "Film, Animasi, dan Video"→"Film & Animasi", "Desain Komunikasi Visual"→"DKV".
- `warnaDonut` = peta label pendek → warnaSubsektor(nama asli).
- `nilaiSub = urut.slice(0,10)`; `tumbuhSub` = 16 subsektor `{label, value: tumbuh[iTumbuh]}` sort desc.

### 6.2 Seksi top-to-bottom
1. Eyebrow `Kinerja Ekonomi Kreatif`; h2 `PDRB Ekonomi Kreatif (2017–2025)`.
2. KpiRow:
   - `Kontribusi 2024` value `"11,16%"` (idNum 2), sub `terhadap PDRB DKI · Sem I 2025: 11,53%`.
   - `Target RPJMD 2025` value `"10,51%"`, sub `2029: 11,24%`.
   - `Nilai PDRB Ekraf 2024` value `"Rp 410,6 T"` (`idNum(adhb/1000,1)`), sub `atas dasar harga berlaku`.
   - `Pertumbuhan 2024` value `"8,13%"`, sub `PDRB DKI 4,91%` (tanpa delta).
3. SectionHead `Kontribusi` / `Kontribusi Sektor Ekonomi Kreatif terhadap PDRB Provinsi DKI Jakarta (%, ADHB) — KPI utama RPJMD.`
4. ChartCard `Capaian vs Target RPJMD 2025–2029` / `Capaian = batang · Target RPJMD = garis` → ComboBarLine `dualAxis=false`, categories `cats.map(label)`, bar `Capaian (%)`, line `Target RPJMD (%)`. Catatan: `Data 2025 baru mencakup Semester I sehingga belum dapat dibandingkan langsung dengan target setahun penuh. Target RPJMD: 2025 10,51% · 2026 10,87% · 2027 11,00% · 2028 11,12% · 2029 11,24%.`
5. SectionHead `Nilai` / `Besaran PDRB Ekonomi Kreatif (Rp miliar).`
6. ChartGrid 2:
   - `PDRB Ekraf atas dasar harga berlaku (ADHB)` / `Rp miliar` → VerticalBars (oranye) 9 periode adhbEkraf, unit `" miliar"`.
   - `PDRB Ekraf atas dasar harga konstan (ADHK)` / `Rp miliar · riil, tanpa efek harga` → VerticalBars `#0e7c42` adhkEkraf.
7. Header baris (bukan SectionHead): h2 18px `Sebaran` + ModeToggle (7 opsi, label "2025 (Sem I)").
8. ChartGrid 2:
   - `Distribusi per subsektor · {label(sub)}` / `% terhadap total PDRB Ekraf (ADHB) · 5 terbesar + lainnya` → Donut showPercent sebaran, colorMap warnaDonut.
   - `10 subsektor dengan nilai terbesar · {label(sub)}` / `Rp miliar (ADHB)` → BarBreakdown nilaiSub, unit `" miliar"`, colors warnaSubsektor.
   (Komentar L96: sebaran per wilayah disembunyikan.)
9. SectionHead `Pertumbuhan` / `Laju pertumbuhan PDRB atas dasar harga konstan (%, yoy).` lalu ModeToggle `subTumbuh` (div mb-3).
10. ChartGrid 2:
   - `Pertumbuhan Ekraf vs Non-Ekraf vs DKI` / `% yoy (ADHK)` → GroupedLines series `PDRB Ekraf`, `PDRB Non-Ekraf`, `PDRB DKI` (9 periode; label "2025 (Sem I)" — sort localeCompare tetap benar). Tidak terpengaruh toggle.
   - `Pertumbuhan per subsektor · {label(subTumbuh)}` / `% yoy (ADHK)` → BarBreakdown tumbuhSub (16 batang), unit `"%"`, colors warnaSubsektor.
11. SourceNote: `Sumber: PDRB Ekonomi Kreatif DKI Jakarta 2016–Sem I 2025 (BPS × Disparekraf). Angka 2017–2018 berasal dari pemutakhiran (updating) PDRB; 2019–Semester I 2025 dari penyusunan terbaru. Target kontribusi: RPJMD 2025–2029.`

### 6.3 Kontrak data — PDRB (data harus dipindah ke lake/Data API; saat ini konstanta)
1. `GET /v1/dashboard/pdrb-ekraf/makro` →
```json
{ "sumber":"PDRB Ekonomi Kreatif DKI Jakarta 2016–Sem I 2025 (BPS × Disparekraf)",
  "rows":[ {"periode":"2024","label":"2024","parsial":false,"adhb_ekraf":410568.43,"adhb_dki":3679358.6,"kontribusi_pct":11.16,
            "adhk_ekraf":272419.52,"tumbuh_ekraf_pct":8.13,"tumbuh_non_ekraf_pct":4.45,"tumbuh_dki_pct":4.91},
           {"periode":"S1 2025","label":"2025 (Sem I)","parsial":true, …} ],
  "target_kontribusi":[ {"tahun":"2025","target_pct":10.51}, … {"tahun":"2029","target_pct":11.24} ] }
```
   Frontend menyusun 13 kategori kontribusi-vs-target dari ini (atau API menyediakan `kontribusi_vs_target: [{label,capaian|null,target|null}]` 13 baris — disarankan, agar nol logika).
2. `GET /v1/dashboard/pdrb-ekraf/subsektor?periode=2024` →
```json
{ "periode_list":["2019",…,"S1 2025"], "periode":"2024", "label":"2024", "total_adhb":410568.42,
  "distribusi":[ {"label":"Kuliner","nama":"Kuliner","pct":38.94,"warna":"#ed6b23"}, …5…, {"label":"Lainnya","pct":…,"warna":"#cbd5e1"} ],
  "nilai_top10":[ {"label":"Kuliner","value":159870.42,"warna":"#ed6b23"} ],
  "pertumbuhan":[ {"label":"Kuliner","value":9.25,"warna":"#ed6b23"} ] }
```
   (Toggle Sebaran dan Pertumbuhan independen → frontend memanggil dua kali dengan periode berbeda, atau pisah `/subsektor/sebaran` dan `/subsektor/pertumbuhan`.)

---

## 7. Quirks / bug (pertahankan atau putuskan secara eksplisit)

| # | Lokasi | Temuan | Saran |
|---|---|---|---|
| Q1 | `lib/dashboard/data.ts:11-18` & `components/pariwisata/WismanDashboard.tsx:33-40` | `TARGET_WISMAN` terduplikasi (nilai sama; versi kedua juga punya `KONDISI_AWAL_WISMAN = 1273358` L41). | Satu sumber di Data API (tabel target RPJMD). |
| Q2 | `WismanStat.tsx:127-131`, `:212`, `:240` | LOS "rata-rata kelas" = rata-rata **tak berbobot** dari rata-rata per kelas Bintang 1–5 (rata-rata dari rata-rata), dan SQL sendiri `avg(rata_rata)` per periode×kelas×tamu (rata-rata lagi bila ada >1 baris). Label UI jujur ("rata-rata sederhana"). | Pertahankan angka; dokumentasikan. |
| Q3 | `page.tsx` (beranda) L20 vs `PdrbEkrafStat.tsx:57` | Nilai PDRB 2024: beranda `"Rp 411 T"` (Math.round), halaman PDRB `"Rp 410,6 T"` (1 desimal). Beranda juga pakai `KpiStat` + `toLocaleString` (bukan `idNum`) → "11,16%" sama, tapi format bisa beda untuk nilai bulat (mis. "11%" vs "11,00%"). | Tiru persis atau samakan (keputusan pemilik). |
| Q4 | `TkSubsektor` + `subsektor-colors.ts` | Subsektor Kemenekraf `"Fesyen"` tidak ada di WARNA/ALIAS (kunci `fashion`) → tampil **abu-abu `#94a3b8`**. | Tambah alias `fesyen→fashion` (bug) atau tiru. |
| Q5 | `pdrb-ekraf.ts:13` | `tumbuhNonEkraf` 2024 dan S1 2025 sama-sama `4.45` — kemungkinan salah salin dari xlsx. **Belum terverifikasi** terhadap berkas sumber. | Cek xlsx saat ingest. |
| Q6 | `pdrb-ekraf.ts` | Data PDRB statis di repo ("SEMENTARA (mockup)"); `serving.mart_pdrb_ekraf` belum dibaca kode (keberadaan **belum terverifikasi**). Halaman PDRB tidak memakai ClickHouse sama sekali. | Data API harus menyediakan dari lake atau seed tabel. |
| Q7 | `WismanStat.tsx:186` | YoY grouped bars memakai 3 warna untuk **semua** tahun (tanpa slice); bila >3 tahun, ECharts mengulang warna. Wisnus membatasi 3 tahun terakhir (`WisnusStat.tsx:75`). | Saat ini 3 tahun → aman; catat. |
| Q8 | `WismanStat.tsx:75,87` | `nMonths` = jumlah baris, `yLabel` pakai `BULAN[nMonths-1]` → asumsi bulan berurutan mulai Jan. Bulan bolong → label "s/d" salah. Sama di Wisnus (pakai bulan unik). | API kirim `bulan_akhir` eksplisit. |
| Q9 | Wisman: pintu tahunan (SDI semester) vs total bulanan (mart) | Sumber beda: Σ semester SDI 2024 = 2.284.917 vs Σ mart_wisman 2024 = 2.526.842. Donut persentase aman, tapi angka absolut tidak boleh disandingkan. SDI 2026 S1 Tanjung Priok = **2** (mencurigakan). | Tandai di API `sumber`. |
| Q10 | `WismanStat.tsx:110` | `pintuSem.set(..., r.jumlah)` menimpa (bukan menjumlah) — aman karena SQL sudah GROUP BY, kecuali dua varian ejaan pintu yang ter-titleCase sama. | Jumlahkan di API. |
| Q11 | `getSertifikasi` + `tenaga-kerja/page.tsx:22` | Urutan `bidang` = urutan kemunculan, SQL hanya `ORDER BY tahun` → urutan kategori tak deterministik. `titleCase` menghasilkan "Mice", "Hotel Dan Restoran". UNION dua tabel bisa dobel tahun 2023/2024 (**belum terverifikasi**). | API tetapkan urutan; pertimbangkan "MICE". |
| Q12 | `tenaga-kerja/page.tsx:56` | Desc "5 tahun terakhir" tetapi tidak ada slicing — tampil semua tahun `dki` (kebetulan 5: 2020–2024). | API `?n=5` atau biarkan. |
| Q13 | `getTenagaKerjaEkraf` | `nasional` = Σ semua baris `Total` di tabel per-provinsi; bila ada baris agregat nasional → dobel. **Belum terverifikasi.** | Cek isi `kode_wilayah`. |
| Q14 | `Kpi` (`DashboardKit.tsx:14-32`) | Delta hanya prefiks ▲/▼, tanpa warna (komentar menyebut hijau/merah). | Tiru apa adanya. |
| Q15 | `WisnusStat.tsx:52-55` | Donut/Bar per kota & "Tujuan terbanyak" mengabaikan filter `Kota tujuan`; KPI capaian/pertumbuhan/YTD ikut filter. `nBulan/partial` selalu dari seluruh kota. | Pertahankan semantik di kontrak. |
| Q16 | `WisnusStat.tsx:84-89` | YoY % hanya dihitung jika himpunan kota sama di kedua bulan (cegah distorsi). | Pertahankan di API. |
| Q17 | beranda | `getWisman()` menjalankan 3 query tapi hanya `bulanan` dipakai. | Endpoint ringkasan khusus. |
| Q18 | `getLamaMenginap` | `jenisTamu` = "Wisman" bila regex MANCANEGARA, **selain itu** "Wisnus" (nilai tak dikenal ikut Wisnus). | Petakan eksplisit di API. |
| Q19 | `getPintuBulanan` | Data BPS bulanan hanya 2024 → bulan 2025–2026 selalu jatuh ke fallback semesteran SDI. | Info. |
| Q20 | `GroupedLines` | Sumbu-x LOS & tren wisnus menampilkan label mentah "2024-01" (tidak di-format "Jan 2024"), beda dengan VerticalBars. | Tiru agar identik. |
| Q21 | `safe()` `data.ts:20-27` | Error ClickHouse ditelan → halaman menampilkan kotak merah/“Tidak ada data.” bukan error 5xx. | Laravel: kembalikan 200 + array kosong, atau 503 + UI fallback teks yang sama. |
| Q22 | `pdrb-ekraf/page.tsx` | Tidak `force-dynamic` → halaman dibangun statis saat build (benar karena konstanta). Setelah pindah ke API, perlakukan dinamis/cached. | — |
