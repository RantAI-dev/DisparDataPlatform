# E — SDI catalog, dataset detail, and all `app/api/**` routes (inventory for the Nuxt 3 + Laravel 10 port)

Source: `/home/uaa/Dinas-Pariwisata/platform-v2`. Paths are relative to that folder unless noted.
Snapshot taken 2026-10-21 (read-only, no files changed).

> ## ⚠ READ FIRST: HEAD a0580ba is NOT what production runs
>
> Local `main` = **a0580ba**. `origin/main` = **6b858eb** (2026-10-21) and is **4 commits ahead**. Two of those
> commits change this feature:
> - `df42d51 feat(v2): filter dan sort di halaman detail dataset`
> - `22ab172 fix(v2): tampilkan periode_data di detail dataset SDI`
>
> Production at **https://dispar.rantai.dev** already serves the origin/main behaviour. I verified this live on
> 2026-10-21: `/api/sdi/{slug}` returns a `periode` field, `/facets` and `/aggregate` answer, and `sort=` and `f=` work.
> **The owner wants "looks like the current pages", so the spec should follow origin/main.** Each section
> below gives HEAD (a0580ba) first, then the **Δ origin/main** delta. Files that exist only on origin/main:
> `lib/ch/query-filter.ts`, `components/DatasetFilters.tsx`, `app/api/sdi/[slug]/facets/route.ts`,
> `app/api/sdi/[slug]/aggregate/route.ts`. You can read them with `git show origin/main:platform-v2/<path>`.
>
> ClickHouse at 192.168.18.187:18123 could not be reached from this machine (curl rc=7). All "verified live"
> statements below come from the public HTTPS API, not from direct SQL.

---

## 0. Route and page map

| Kind | Path | File | Notes |
|---|---|---|---|
| Page | `/sdi` | `app/sdi/page.tsx:1-5` | `<CatalogView primaryOnly />` |
| Page | `/katalog` | `app/katalog/page.tsx` | `<CatalogView />` (primary + secondary). Shares the same component, so include it in the port |
| Page | `/sdi/[slug]` | `app/sdi/[slug]/page.tsx` (434 lines HEAD; about 500 on origin/main) | client component |
| Page | `/docs` | `app/docs/page.tsx:1-12` + `app/docs/docs-client.tsx` (676 lines) | API reference (content is **stale**, see §5) |
| Embedded | `SdiTable` | `components/SdiTable.tsx` | used by `components/pariwisata/DashboardKit.tsx:3,93` (indicator pages) |
| API | `GET /api/sdi` | `app/api/sdi/route.ts` | catalog (primary only) |
| API | `GET /api/sdi/medallion` | `app/api/sdi/medallion/route.ts` | bronze/silver/gold layer per dataset |
| API | `GET /api/sdi/{slug}` | `app/api/sdi/[slug]/route.ts` | metadata + paged rows |
| API | `GET /api/sdi/{slug}/export` | `app/api/sdi/[slug]/export/route.ts` | CSV/XLSX download |
| API | `GET /api/sdi/{slug}/facets` | **origin/main only** | filter options |
| API | `GET /api/sdi/{slug}/aggregate` | **origin/main only** | chart data, computed on the server |
| API | `GET /api/spatial` | `app/api/spatial/route.ts` | map points from Silver (consumer: `components/GmtiMapView.tsx:165`) |
| API | `GET /api/hotels/scraped` | `app/api/hotels/scraped/route.ts` | Booking POC (consumer: `app/scraped-hotels/page.tsx:80`) |
| API | `POST /api/admin/sync` | `app/api/admin/sync/route.ts` | **dead**: always reports an error per slug |
| API | `GET\|POST /api/admin/report` | `app/api/admin/report/route.ts` | effectively a no-op in v2 |
| API | `POST /api/ai/ask`, `POST /api/ai/text-to-sql` | `app/api/ai/*` | **AI is out of scope**; listed only |
| Cron | `vercel.json:4-6` | `{ "path": "/api/admin/report", "schedule": "0 18 * * *" }` | Vercel only (`regions: ["sin1"]`). Not active on Portainer (belum terverifikasi whether any other scheduler calls it) |

Nav label: `components/Nav.tsx:12` `{ href: "/sdi", label: "SDI" }`.

Theme constants shared by every SDI page: accent `#ed6b23` (named `NAVY` in code), gold `#f0a13a`, green `#0e7c42`,
link `#2563eb`, page background `#faf6f2`. The hero background is
`radial-gradient(900px 320px at 88% -25%, rgba(237,107,35,0.28), transparent 62%), linear-gradient(160deg, #2a2521 0%, #16130f 100%)`.
Content width is `max-w-[1320px] px-6`. Numbers use `toLocaleString("id-ID")`.

---

## 1. Pages

### 1.1 `/sdi`: catalog (`components/CatalogView.tsx`, called with `primaryOnly=true`)

**Data loading** (`CatalogView.tsx:92-120`):
1. Initial state is the static seed `lib/sdi-data.json` (182 entries, `lib/sdi.ts:28`). It is a placeholder only.
2. `fetch("/api/sdi")`. If `datasets.length` is non-empty, it replaces the seed. Live count on 2026-10-21 was **184**.
3. `fetch("/api/sdi/medallion")` gives `datasets` map → `medal` state.
4. Errors are swallowed silently and the seed stays.

The port can drop the seed and load from Laravel. Keep a skeleton or placeholder so the first paint isn't empty.

**Layout, top to bottom (exact strings):**

1. **Hero band** (`:153-185`), using the hero background and `pt-8 pb-12`:
   - Eyebrow (mono, uppercase, `text-white/60`, 12px): a gold `●` followed by `SDI · Satu Data Jakarta`. Non-primary mode uses `Katalog Data Terkonsolidasi` instead.
   - H1 (30px, 38px on md, bold): `Satu Data Jakarta`. Non-primary: `Katalog Data`.
   - Lead (15px, `text-white/75`): `Dataset primer Dinas Pariwisata Dan Ekonomi Kreatif dari Satu Data Jakarta.` (built from `SDI_ORG_NAME`, `lib/sdi.ts:24`). Non-primary: `Seluruh dataset primer dan sekunder pariwisata serta ekonomi kreatif Jakarta. Daftar tematik GCI, GPCI, dan GMTI tetap terhubung ke katalog.`
   - Stat tiles: `grid-cols-2 sm:grid-cols-4`, max-w 720. Each tile is `bg-white/10 border-white/15`, label 11px mono, value 22px bold.
     - `DATA PRIMER (SDI)` = `stats.total`, the row count. It has a dot, coloured gold because `dot===NAVY` maps to GOLD.
     - (non-primary only) `DATA SEKUNDER` = `secondaryDatasets().length`, green dot.
     - `TOPIK / TAG` = number of distinct lowercase tags.
     - `TOTAL DILIHAT` = sum of `views`, formatted id-ID.
     - Formula: `lib/sdi.ts:36-50` (`sdiStats`). All stats are computed on the client from the catalog list.
2. **Toolbar card** (`:187-262`). It overlaps the hero (`-mt-6`) and is a white rounded-xl card. On `lg` it lays out as a row:
   - Search input: `aria-label="Cari dataset"`, placeholder `Cari dataset, deskripsi, sumber, atau tag…`.
   - Tier segmented control (**hidden on /sdi**; shown on /katalog): `Semua` | `Primer` | `Sekunder`.
   - Medallion segmented control: `Semua lapisan` | `Bronze` | `Silver` | `Gold`. Each non-"all" button shows a count next to it when the count is > 0. Tooltip is `MEDAL[x].note`, or `Semua lapisan lakehouse` for "all". The active button is styled `bg #ed6b23`, white text.
   - `{filtered.length} baris`.
   - Pill `◆ LAKEHOUSE` (bg `#eef2f9`, colour accent), tooltip `Katalog dibaca dari database lakehouse; penarikan SDI dilakukan pipeline terjadwal.`
3. **Table** (`:265-370`). Header row has bg `#ed6b23`, white text, uppercase 12px. Columns:
   `#` | `Nama Dataset` | `Tag` (hidden < md) | `Lapisan` | `Sumber` | `Ukuran` (right-aligned, hidden < sm) | `Aksi` (centred).
   - `#` is i+1 within the filtered list.
   - Nama Dataset: bold title, then **TierBadge**, then a description underneath (13px slate-500, `line-clamp-2`, max 60ch).
   - Tag: first **4** tags as grey rounded-full chips.
   - Lapisan: **MedalBadge** (§1.1.1), or a grey `—` if the dataset has no layer.
   - Sumber: `SDI · Satu Data Jakarta` for primary rows. Secondary rows show `Dinas Pariwisata & Ekraf DKI Jakarta` if `external===false`, otherwise `Pendataan Jakarta`.
   - Ukuran: `"{views id-ID} dilihat"` for primary, `"{rows} baris"` for secondary.
   - Aksi: internal `Lihat data →` link to `/sdi/{slug}`, or external `Lihat data ↗` with target=_blank. Colour `#2563eb`.
   - Empty state: `Tidak ada dataset yang cocok.` (colSpan 7).
   - **No pagination.** All rows render at once (~184).
4. **Legend line** (`:372-383`): `[Data Primer] = Satu Data Jakarta (satudata.jakarta.go.id)` (link to `https://satudata.jakarta.go.id`) and `[Data Sekunder] = data sekunder pariwisata dan ekonomi kreatif`.
5. **Medallion explainer card** (`:385-421`):
   - Title: `Lapisan data (arsitektur medallion lakehouse)`.
   - Text: `Setiap dataset melewati tiga lapisan di lakehouse Dinas. Label pada kolom <em>Lapisan</em> menunjukkan lapisan tertinggi yang sudah dicapai dataset tersebut.`
   - Three cards: a badge plus `{n} dataset`, then the paragraph. Exact strings are at `:409-413`:
     - Bronze: "Salinan apa adanya dari sumber (Satu Data Jakarta / berkas pendataan), disimpan dalam format terbuka Apache Iceberg lengkap dengan kolom audit: waktu tarik, alamat sumber, dan nomor batch."
     - Silver: "Sudah dibersihkan dan bertipe (angka, tanggal, teks) serta diselaraskan dengan dimensi bersama. Baris yang gagal dikonversi masuk karantina, tidak dibuang dan tidak dipakai. Inilah lapisan yang tampil di halaman dataset."
     - Gold: "Sudah diringkas menjadi mart penyaji (serving.mart_*) yang dibaca dashboard indikator — mis. wisman, kuliner, event, kunjungan DTW."
   - Footer: `Dataset yang belum tersalin ke lakehouse tidak diberi label lapisan.`

**Search / filter / sort** (`:130-143`). Everything is client-side:
- The search term is lowercased and matched with `includes` on title, description, source, or any tag.
- Tier and medallion filters are AND-ed with the search.
- **No user sort.** Order comes from the API: `updatedAt` descending by string compare (`app/api/sdi/route.ts:28-30`).
- Medallion counts (`:121-128`) only count rows in the current catalog (primary only on /sdi). They ignore the search and tier filters.

#### 1.1.1 Badges
- **TierBadge** (`:427-440`): 10px, uppercase, semibold, `px-1.5 py-0.5 rounded`.
  - Primary: text `Data Primer`, bg `#eef2f9`, fg `#ed6b23`.
  - Secondary: text `Data Sekunder`, bg `#e8f5ee`, fg `#0e7c42`.
- **MedalBadge** (`:442-461`) shows `◆ {Label}`. The tooltip is `"{Label} — {note}"` with ` ({mart})` appended for gold.

| level | bg | fg | catalog note (`CatalogView.tsx:37-56`) | detail-page note (`[slug]/page.tsx:35-54`) |
|---|---|---|---|---|
| bronze | `#f6ebe1` | `#8a5223` | tersalin apa adanya ke lakehouse (mentah, belum bertipe) | salinan mentah apa adanya di lakehouse (Apache Iceberg) — belum ada model bertipe |
| silver | `#eef1f5` | `#4a5a6b` | sudah dibersihkan & bertipe — inilah yang ditampilkan di halaman dataset | sudah dibersihkan & bertipe; tabel di halaman ini dibaca dari lapisan Silver |
| gold | `#fbf0d6` | `#8a6a12` | sudah dipakai mart penyaji dashboard | sudah diringkas menjadi mart penyaji yang dibaca dashboard indikator |

- **medalKey**: primary rows use the slug. Secondary rows use the slug after `/sdi/` when `href` starts with `/sdi/`, otherwise the secondary `id` (e.g. `sec-gci-resto`) (`:85`).

### 1.2 `/sdi/[slug]`: dataset detail (`app/sdi/[slug]/page.tsx`)

The whole page is a client component that fetches `/api/sdi/{slug}`. Page size: `PAGE = 50` (`:15`).

**Hero** (`:172-203`), `pt-7 pb-10`:
- Back link (12px mono uppercase, white/60): `← Katalog Pariwisata & Ekraf` → `/sdi`.
- H1 (26px, 32px on md): `meta.title`. Before meta loads it falls back to `humanize(slug)`.
- Description (15px, white/75, max 75ch), shown if present.
- Meta row. Each item renders as `LABEL:` (11px uppercase white/50) followed by the value in gold `#f0a13a`:
  - `Baris data` = `total` (id-ID)
  - **Δ origin/main**: `Periode` = `fmtPeriode(periode)`, e.g. `Jan 2024 – Jul 2026`. Months are `Jan Feb Mar Apr Mei Jun Jul Agu Sep Okt Nov Des`. A year-only value stays as-is. If min equals max, only one point is shown (origin `page.tsx:479-492`).
  - `Satuan`, if set
  - `Frekuensi`, if set
  - `Sumber` = `sumberData.join(", ")`, if non-empty
  - Note: **`klasifikasi`, `kontak` and `author` are returned by the API but NOT shown.**
- **MedallionNote** (`:344-380`), shown when `medallion` is set. It is a pill box `bg-white/10`:
  - Label `LAPISAN LAKEHOUSE:`.
  - A path: `Bronze → Silver → Gold`, truncated at the current level. The current level is drawn as the badge `◆ {Label}`.
  - Then `{detail note}{ (mart) if gold}.`

**Body** (`:205-338`):
- Error box (red): `{error}. Coba buka di portal SDI ↗.` The link goes to `https://satudata.jakarta.go.id/open-data/{slug}`. The 404 error text is `Dataset belum tersedia di lakehouse`. A network failure shows `Gagal memuat data`.
- While loading: white card `Memuat data dari Satu Data Jakarta…`.
- **DatasetCharts** is shown when `rows.length > 0` (§1.3).
- Toolbar:
  - Search input, placeholder `Cari di dalam data…`, debounced **350 ms** and trimmed.
  - Download buttons `⤓ CSV` and `⤓ XLSX`. They are plain `<a href>` links to `/api/sdi/{slug}/export?format=csv|xlsx`. Tooltips: `Unduh semua baris sebagai CSV` and `Unduh semua baris sebagai Excel (XLSX)`.
  - Counter `{loaded} / {count} baris`, with ` (hasil pencarian)` appended when q is set.
  - **Δ origin/main**:
    - The links carry the active `q`/`f`/`sort`, and the labels become `CSV (terfilter)` / `XLSX (terfilter)`.
    - An extra link `unduh semua baris` (unfiltered CSV) appears when filtered.
    - The counter suffix becomes ` (terfilter dari {total})`.
    - Tooltips change to `Unduh baris hasil filter sebagai CSV|Excel (XLSX)`.
- **Δ origin/main: `DatasetFilters` panel** (origin `components/DatasetFilters.tsx`), placed between the toolbar and the table:
  - Toggle button `[funnel] Filter (n) ▾/▴`.
  - Each active filter shows as a chip (accent border, bg `#fdf3ec`), e.g. `Kebangsaan: JEPANG, MALAYSIA`. With more than 2 values it reads `Kebangsaan: 5 nilai`; ranges read `Col: lo – hi`, with `…` for an open end. Each chip has a `×` to remove it.
  - `Hapus semua filter` link.
  - Expanded grid (1/2/3 cols), one fieldset per usable facet:
    - category: checkbox list (max-h 44, scrollable) showing the value and its count. Counts are sorted desc, then by value.
    - number/date: two `<input type=number|date>` fields with placeholders `min {lo}` and `maks {hi}`. The filter applies **500 ms** after the user stops typing.
  - A facet is usable when its kind ≠ `none` and, for categories, it has ≥ 2 values. Facets are also limited to keys that appear in the displayed columns.
- **Table**:
  - Header bg `#ed6b23`. First column is `#`, then one column per entry in `columns`. The header label is `humanize(key)`: underscores become spaces and each word is Title-Cased. The header tooltip is the column `desc`.
  - Columns come from the `columns` metadata. If none exist, they come from the keys of the first row minus `HIDDEN` = {`id, user_id, uid_upload, batch_upload, jadwal_rilis, tanggal_upload, tanggal_update, created_at, updated_at`} (`:56-66`).
  - Cell rendering (`renderCell :404-439`):
    - null or "" → `—`.
    - A URL becomes a blue link. The label is `Peta ↗` for key `gmaps`, `TripAdvisor ↗` if the key contains tripadvisor, `Sumber ↗` for key `sumber` or keys containing `url`, otherwise `Buka ↗`.
    - An all-digit string with more than 4 digits is formatted id-ID (e.g. `12345` → `12.345`). 4-digit years are left alone.
  - Empty state: `Tidak ada baris data.`
  - **Δ origin/main sort**: clicking a header cycles asc ▲ → desc ▼ → off ↕. Only Silver-schema columns, i.e. those present in facets, are sortable. Sorting is single-column and runs on the server.
  - **Δ origin/main**: while refiltering, the table dims to `opacity-60` (`aria-busy`). Stale responses are discarded using a request sequence counter.
- **Paging is infinite scroll**, not page numbers.
  - An IntersectionObserver watches a sentinel with `rootMargin: 600px`. When it triggers, the page fetches `offset = rows.length`, `limit = 50`.
  - The sentinel text reads `Memuat baris berikutnya…` while loading, otherwise `Gulir untuk memuat lebih banyak`.
  - More rows are available while `rows.length < count`.
- Footer: `Menampilkan {loaded} dari {count} baris · Sumber: Satu Data Indonesia — Jakarta · lihat di portal ↗`. Δ origin/main inserts ` (terfilter dari {total})` after `baris`.

### 1.3 Chart builder (`components/DatasetCharts.tsx`)

- Section header: `Visualisasi Data`, with the right-hand note `Grafik dari {rows.length} baris termuat · tersimpan di browser ini`.
  - **Δ origin/main**: `Grafik dari {count} baris{ (terfilter)} · tersimpan di browser ini`.
- **Chart types** (`KINDS :19-26`): `Batang` (bar), `Batang horizontal` (hbar), `Garis` (line), `Area`, `Pie`, `Donat` (donut).
- **Aggregations** (`AGGS :27-33`): `Total (sum)`, `Rata-rata` (avg), `Jumlah baris (count)`, `Maksimum`, `Minimum`. When no numeric column exists, only count is offered.
- **Allowed columns**:
  - Start from `columns` minus `HIDDEN` (same set as the page).
  - A column is a **measure** (Y) when `isNumericCol` (`:76-92`) is true:
    1. Rejected if the key matches `(^|_)(tahun|triwulan|semester|kuartal|bulan|periode|tanggal|waktu|kode|id|no|nomor|nama|wilayah|kecamatan|kelurahan|kota|lokasi|kategori|jenis|status|slug|latitude|longitude|lat|lon|importance)(_|$)`.
    2. Accepted if the type hint matches `/int|num|dec|float|double|angka|real|money|rupiah/`.
    3. Otherwise accepted if, in the first 80 loaded rows, there are ≥ 3 non-empty values and ≥ 80% of them parse as numbers. Parsing strips spaces and turns `,` into `.`.
  - **Dimensions** (X) are all non-measures. If that set is empty, all columns are dimensions. The X select lists dimensions first, then measures.
  - Default X (`pickDefaultDim :61-75`):
    - Skip keys matching `(^|_)(no|nomor|id|kode|uuid|slug)(_|$)`.
    - Prefer a column with 2 ≤ distinct < rowCount, choosing the score closest to 8 distinct values. Columns with more than 40 distinct values are penalised.
  - Default Y is the first measure. Default agg is `sum` if a measure exists, otherwise `count`.
- **Form**: one row with `Tipe grafik`, `Kategori (X)`, `Agregasi`, and `Nilai (Y)`. The Y field is hidden when agg = count. If Y has no options it shows `(tak ada kolom angka)`.
  - Button `+ Tambah grafik` (accent bg) prepends the chart to the list.
  - When no numeric columns exist, a hint shows: `Tak ada kolom angka terdeteksi — pakai **Jumlah baris (count)** untuk frekuensi per kategori.`
- **Empty list**: a dashed card `Belum ada grafik. Pilih tipe & kolom di atas, lalu “Tambah grafik”.`
- **Chart cards**: 2-column grid on md.
  - Title: `{AggLabel}{ " " + humanize(y) unless count} per {humanize(x)}`, with a subtitle naming the kind.
  - `Hapus` button.
  - Height 300 px. Empty state: `Tak ada nilai untuk dirangkum.`
  - **Δ origin/main**: also `Memuat grafik…` while loading and `Gagal memuat grafik.` (red) on failure.
- **Aggregation semantics**:
  - The group label is `String(x).trim()`; an empty label becomes `—`.
  - Non-numeric Y values are skipped. Groups with no numeric values are dropped, except for count.
  - line/area: sorted by label, numerically when both labels parse as numbers, otherwise by `localeCompare("id")`. **No top-N cut.**
  - bar/hbar/pie/donut: sorted by value desc and **cut to the top 30**.
- **Where aggregation runs**:
  - HEAD: on the client, over the **loaded rows only** (50, 100, … depending on scroll) (`aggregate :332-357` in the HEAD listing).
  - **Δ origin/main**: on the server via `GET /api/sdi/{slug}/aggregate?x&y&agg&q&f…`, over **all rows** that match the search/filters. Sort is not applied. The server returns up to 1000 groups and the client still cuts to 30. The loaded rows are now used only to guess column types and the default X.
- **ECharts styling**:
  - Palette `#ed6b23 #f0a13a #c94f18 #f6b860 #8a3b12 #e8813f #b5651d #f4a259 #6b2d0e #ffc98a`.
  - Bars have radius 4 and `barMaxWidth: 34`.
  - Category labels rotate 30° when there are more than 6 categories (not for hbar). hbar reverses the order.
  - Value axis uses `fmtCompact`: `rb` (thousand), `jt` (million), `M` (billion), in id-ID.
  - Line is smooth and only `line` shows symbols. Area uses an orange gradient fill.
  - pie radius is `70%`; donut is `["45%","72%"]`. Legend at the bottom, scrollable, circle icons. Labels hidden.
  - Tooltip trigger is `item` for pie/donut, `axis` otherwise. Values use `fmtInt` (2 decimals, id-ID).
- **Persistence**:
  - Saved to `localStorage["dispar:dataset-charts:{slug}"]` as `[{kind,x,y,agg}]`.
  - On load, invalid kinds, aggs, or columns are dropped. An empty list removes the key.
  - Port the same key format so charts survive the migration if the domain stays the same (belum terverifikasi whether the domain stays the same).

### 1.4 `SdiTable` (embedded, `components/SdiTable.tsx`)

- Same fetch, debounce, and infinite scroll as the detail page (PAGE 50, `:11`, `:66-118`). No hero, no charts, no export, no filter or sort, even on origin/main.
- Optional `columns` prop: a whitelist plus ordering of keys (`:120-135`).
- Cells use `fmtCell` only. URLs are not turned into links, unlike the detail page.
- Footer: `Menampilkan {n} dari {total||count} baris · Sumber: Satu Data Indonesia — Jakarta · lihat di portal ↗`. Note this uses **total** here, while the detail page footer uses **count**.

### 1.5 `/docs`: API reference page

- `app/docs/page.tsx`: metadata title `Dokumentasi API — Platform Data Pariwisata & Ekraf DKI Jakarta`, plus a description.
- `app/docs/docs-client.tsx`:
  - Hero eyebrow: `Dokumentasi · REST API · v1`.
  - H1: `API Data Pariwisata & Ekonomi Kreatif`.
  - Lead: `Akses terprogram ke katalog dataset … ekspor CSV/XLSX. Seluruh respons berformat JSON.`
  - Base URL box (`https://dispar.rantai.dev`) with a copy button. Pills: `5 endpoint`, `JSON`, `Baca publik tanpa autentikasi`.
  - Layout: 220 px sticky sidebar with scroll-spy (`Di halaman ini`, a `Jelajahi katalog` link to /sdi), next to the content.
  - Sections: `Pengantar`, then 5 endpoints: Katalog dataset, Detail & baris data, Ekspor CSV / XLSX, Sinkronisasi dataset, Bangun ulang report. Then `Kode status` (200/400/401/404/500/502) and an error-shape block. Footer: `Dinas Pariwisata & Ekonomi Kreatif Provinsi DKI Jakarta · Sumber data: Satu Data Indonesia — Jakarta`.
  - Each endpoint section has:
    - a GET/POST method badge (GET green `#0f7a54`, POST accent);
    - a param table `Parameter | Letak | Tipe | Keterangan`, with a `wajib` mark on required params;
    - cURL and response code blocks (dark `#1f1a15`, hand-rolled syntax highlighting, `Salin`/`Tersalin` copy button);
    - error rows;
    - a `Coba di browser` button.
- **The content is stale.** It documents things that no longer exist or are no longer true:
  - a `?live=1` parameter;
  - `source: db|snapshot|live` (production returns `"lakehouse"`);
  - an SDI live fallback;
  - status 502 (it is now 503);
  - `/admin/sync` as working;
  - the `/admin/report` response `{indicators,rowSnapshots}` (the code returns `{ok,readiness,datasets}`).
  - It also omits medallion, facets, aggregate, spatial, and hotels.

  **Recommendation:** keep the visual layout, but generate the content from the Laravel OpenAPI spec (Scribe or l5-swagger). That also covers the "API docs required" rule.

---

## 2. API routes (HEAD a0580ba, with Δ origin/main)

Common details:
- Next runtime: Node.
- ClickHouse client: `lib/ch/client.ts:9-21`. User `dispar_app` (read-only, profile `app_readonly`). Format is `JSONEachRow`, so **UInt64/Int64 values arrive as JSON strings**, which is why the code wraps them in `toString()` and `Number()`. No session settings are allowed (READONLY).
- Parameters are passed with `{name:Type}` placeholders.
- **No auth on public reads.**

### 2.1 `GET /api/sdi`: catalog (`app/api/sdi/route.ts:1-41`)
- Params: none. (The `live` param in the docs page no longer exists.)
- SQL: `store.catalog()` (§3.1), then filter `tier === "primer"` in JS, then map to the legacy `SdiDataset` shape, then sort `updatedAt` desc.
- Cache: `Cache-Control: public, s-maxage=86400, stale-while-revalidate=604800`. Verified live; Cloudflare reports `cf-cache-status: DYNAMIC`.
- 200 response (live example, 2026-10-21, `count: 184`):
```json
{ "source": "lakehouse", "count": 184, "datasets": [
  { "id": 0, "title": "Data Jumlah Wisatawan Mancanegara Berdasarkan Kebangsaan",
    "description": "Data ini berisikan data kunjungan wisatawan mancanegara …",
    "slug": "data-jumlah-wisatawan-mancanegara-berdasarkan-kebangsaan",
    "tags": ["wisatawan mancanegara","kebangsaan","kunjungan","pariwisata"],
    "views": 1598, "datasetCount": 0, "createdAt": null,
    "updatedAt": "2026-10-21T03:19:38.000000Z" } ] }
```
  `id`, `datasetCount` and `createdAt` are always `0`/`0`/`null`. They are legacy fields and can be dropped in the new contract.
- Error 503: `{ "source":"lakehouse","count":0,"datasets":[],"error":"<String(e)>" }`.

### 2.2 `GET /api/sdi/medallion` (`app/api/sdi/medallion/route.ts:1-45`)
- SQL: `store.medallion()` plus `store.medallionForTables(Object.values(ATLAS_TABLES))` (§3.7–3.8).
- The keys are catalog slugs (primary **and** secondary) plus the Atlas ids `sec-gci-resto` and `sec-events`.
- Cache: `public, s-maxage=3600, stale-while-revalidate=86400`.
- 200 response (live counts 2026-10-21: `{"bronze":2,"silver":216,"gold":5}`):
```json
{ "source":"lakehouse", "counts":{"bronze":2,"silver":216,"gold":5},
  "datasets": { "jumlah-hotel-dan-kamar-hotel-2": {"level":"silver"},
                "data-jumlah-kunjungan-dan-ranking-…": {"level":"gold","mart":"mart_wisman"} } }
```
  The second (gold) entry is illustrative; I did not check its exact slug. `mart` is absent unless the level is gold. `table` is NOT included here.
- Error 503: `{ "source":"lakehouse","counts":{},"datasets":{},"error":"…" }`.

### 2.3 `GET /api/sdi/{slug}`: detail + paged rows (`app/api/sdi/[slug]/route.ts`)

**Query params:**
- `offset`: int ≥ 0, default 0.
- `limit`: int clamped to 1..200, default 50.
- `q`: trimmed string.
- **Δ origin/main**: `f` (repeatable) and `sort`. Grammar in §2.3.1.

**Flow:**
1. `store.columns(slug)` (Δ: `displayColumns`). If empty → **404**.
2. `store.rowsPage(...)`.
3. `store.sync(slug)`.
4. `store.medallion()`. This loads the **full catalog on every request** to look up one slug.
5. Δ: `store.periode(slug)`.

Steps run sequentially except the two queries inside `rowsPage` on origin/main.

**Cache:**
- HEAD: `public, s-maxage=86400, stale-while-revalidate=604800` **unless `q` is set**. Then no header.
- Δ origin/main: no header when q, f, or sort is set. Verified live: a sorted/filtered request had no Cache-Control.

**200 response** (live, origin/main, `limit=2`):
```json
{ "source":"lakehouse","slug":"data-jumlah-wisatawan-mancanegara-berdasarkan-kebangsaan",
  "title":"Data Jumlah Wisatawan Mancanegara Berdasarkan Kebangsaan","description":"…",
  "sumberData":["Badan Pusat Statistik Provinsi DKI Jakarta"],"frekuensi":"1 Bulan Sekali","satuan":"Orang",
  "periode":{"min":"2024-01-01","max":"2026-07-01"},
  "klasifikasi":null,"kontak":"disparekraf@jakarta.go.id","author":"Ruth Magdalena",
  "medallion":{"level":"silver","table":"data_jumlah_wisatawan_mancanegara_berdasarkan_kebangsaan"},
  "columns":[{"key":"periode_data","desc":null,"type":null},
             {"key":"kebangsaan","desc":"komponen","type":"varchar"},
             {"key":"jumlah_kunjungan","desc":"komponen","type":"varchar"}, …],
  "rows":[{"periode_data":"2025-01-01","kebangsaan":"JERMAN","jumlah_kunjungan":2357,
           "perbandingan_bulan_sebelumnya":-20.34,"perbandingan_tahun_sebelumnya":2.3}, …],
  "total":664,"count":664,"offset":0,"limit":2 }
```

**Response semantics:**
- `total` = `dataset_sync.total`. This is the **Bronze row count** written by `fill_totals`, `lakehouse/ingest/dispar_ingest/meta.py:304`. It falls back to `count`.
- `count` = number of Silver rows matching the filter.
- **Caveat**: total (Bronze) and count (Silver, unfiltered) can differ when rows were quarantined.
- Silver rows are **typed**: numbers arrive as JSON numbers and dates as `"YYYY-MM-DD"`. The column `type` in metadata is the SDI hint (`varchar`), **not** the Silver type.
- Audit columns `_ingested_at,_source_url,_batch_id,_row_hash,_tenant` are stripped.
- If no `ORDER BY` is given (HEAD, or origin/main without sort), row order is **not deterministic** in ClickHouse.

**Errors:**
- 404 (verified live): `{"source":"lakehouse","slug":"tidak-ada","error":"Dataset belum tersedia di lakehouse","columns":[],"rows":[],"total":0,"count":0,"offset":0,"limit":50}`
- 503: `{"error":"Gagal membaca dari lakehouse","detail":"<String(e)>"}`
- Δ 400 (FilterError, verified live): `{"error":"Kolom tidak dikenal: xx"}`, `{"error":"Format filter tidak valid: bad"}`
- Edge case: a slug that has metadata columns but **no Silver table** returns **200** with `rows:[]`, `count:0`.

**SQL:** see `rowsPage` in §3.10.

#### 2.3.1 Filter grammar (origin `lib/ch/query-filter.ts`)
- `q=<text>`: at most 500 chars, translated to `positionCaseInsensitive(toString(tuple(*)), {q:String}) > 0`.
- `f=<col>:in:<value>`: repeat it to add more values for the same column. Translated to `toString(\`col\`) IN {fN:Array(String)}`.
- `f=<col>:range:<min>..<max>`: either end may be empty.
  - Number columns (`Int|UInt|Float|Decimal`): `\`col\` >= {fNlo:Float64}` and `<= {fNhi:Float64}`. Values must match `^-?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$`.
  - Date columns (`Date|Date32|DateTime`): `toDate(\`col\`) >= {fNlo:Date}`. Values must match `^\d{4}-\d{2}-\d{2}$`.
  - Text columns → 400.
- `sort=<col>:asc|desc` gives `ORDER BY \`col\` ASC|DESC NULLS LAST, cityHash64(toString(tuple(*)))`. The second key is a deterministic tie-break.
- Limits:
  - ≤ 20 filtered columns.
  - ≤ 100 values per column.
  - Value length ≤ 500.
  - No duplicate column, and `in` and `range` cannot be mixed on one column.
  - The column must exist in the Silver schema (`DESCRIBE`, cached 5 min) and must not contain a backtick.
- Type detection strips `Nullable(...)` and `LowCardinality(...)` wrappers.

### 2.4 `GET /api/sdi/{slug}/export`: download (`app/api/sdi/[slug]/export/route.ts`)
- Params:
  - `format=csv|xlsx`. Default csv. Any other value → CSV.
  - Δ: `q`, `f`, `sort`, using the same grammar.
- `dynamic="force-dynamic"`, `maxDuration=120`.
- **Flow (HEAD):**
  - The header is `store.columns(slug)` keys (the metadata `key_asli`, in `ord` order).
  - The rows are `rowsForRaw(slug)`, i.e. **`SELECT * FROM silver.<t>` with no LIMIT**.
  - Cells are looked up by header key. Silver keys that are not in the metadata are dropped, e.g. `periode_data` on HEAD. Δ origin/main uses `displayColumns`, so `periode_data` comes first.
  - Δ: when filtered, rows come from `rowsFiltered(slug, rq)` and the filename gets the suffix `-terfilter`.
- **CSV:**
  - UTF-8 BOM `﻿`, CRLF line endings, RFC4180 quoting when a value contains `" , \n \r`. null becomes empty.
  - Headers: `Content-Type: text/csv; charset=utf-8`, `Content-Disposition: attachment; filename="{slug}.csv"`, `Cache-Control: no-store`.
  - Verified live: 664 data lines with header `periode_data,kebangsaan,jumlah_kunjungan,perbandingan_bulan_sebelumnya,perbandingan_tahun_sebelumnya`.
- **XLSX:**
  - SheetJS `aoa_to_sheet`. Sheet name `Data`. No column widths are set.
  - `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, filename `{slug}.xlsx`, `no-store`.
- Errors:
  - 404 JSON `{"error":"Dataset belum tersedia di lakehouse"}`. A ClickHouse error is also swallowed into this 404.
  - Δ 400 `{"error":"…"}` on a bad filter.
- **Risk:** there is no row cap. The largest Silver table size is belum terverifikasi. The ClickHouse profile `max_result_rows` may truncate or fail large exports (belum terverifikasi). For Laravel, stream the file (chunked or `StreamedResponse`) instead of buffering it.
- `lib/export.ts` is a separate **client-side** helper: CSV with BOM, plus XLS/XLSX via a lazy-loaded SheetJS with auto column widths (8–50 chars). It is **not used by the SDI pages**, which use the server route. Other dashboards use it (belum terverifikasi which; grep `downloadSpreadsheet`).

### 2.5 Δ origin/main `GET /api/sdi/{slug}/facets`
- `force-dynamic`, but it sets `Cache-Control: public, s-maxage=86400, stale-while-revalidate=604800`.
- 200 response (live):
```json
{ "slug":"…kebangsaan","facets":[
  {"key":"periode_data","kind":"tanggal","min":"2024-01-01","max":"2026-07-01"},
  {"key":"kebangsaan","kind":"kategori","values":[{"v":"AMERIKA","n":31},{"v":"AUSTRALIA","n":31}, …]},
  {"key":"jumlah_kunjungan","kind":"angka","min":"3","max":"74529"} ] }
```
- `kind`: `kategori` (text with ≤ 50 distinct values), `angka`, `tanggal`, or `none` (text with more than 50 distinct values, or another type).
- Facets are computed over the **whole** dataset, not the filtered subset.
- An unknown slug returns `{facets:[]}` with 200.
- Error 503: `{error:"Gagal membaca dari lakehouse",detail}`.

### 2.6 Δ origin/main `GET /api/sdi/{slug}/aggregate`
- Params: `x` (required), `y` (required unless agg=count), `agg ∈ sum|avg|count|max|min`, plus `q` and `f` (sort is ignored). `force-dynamic`, no cache header.
- 200 response (live): `{"slug":"…","data":[{"name":"LAINNYA","value":1430933},{"name":"MALAYSIA","value":1101933}, …]}`. Ordered by value desc, at most 1000 groups.
- Errors:
  - 400 `{"error":"Parameter grafik tidak valid"}` when x is missing or agg is invalid (verified live).
  - 400 `{"error":"Kolom grafik tidak dikenal"}`.
  - 503 `{error:"Gagal membaca dari lakehouse",detail}`.

### 2.7 `GET /api/spatial` (`app/api/spatial/route.ts:1-78`)
- `revalidate = 300` (ISR), `maxDuration = 120`. No explicit Cache-Control header was observed live.
- **Flow:**
  - Read `catalog()`, keep `table_name` values matching `^[a-zA-Z_][a-zA-Z0-9_]*$`, and add `serving.mart_hotel_scraped_booking` (slug `hotel-poc`, href `/scraped-hotels`).
  - For each distinct table, run `DESCRIBE TABLE silver.\`t\``. Error code 60 (unknown table) is skipped silently; other errors add the slug to `failed`.
  - Pick columns case-insensitively:
    - lat ∈ `lat, latitude, lintang`
    - lng ∈ `lon, lng, longitude, bujur, long`
    - name ∈ `nama, name, nama_usaha, nama_dagang, nama_tempat, nama_hotel, hotel_name, venue, nama_masjid`
    - city ∈ `kota, city, wilayah, kabupaten_kota, kota_administrasi`
    - address ∈ `alamat, address, formatted_address`
  - Then page through the table with:
```sql
SELECT DISTINCT name, city, address, lat, lng FROM (
  SELECT toString(`<name>`) AS name, toString(`<city>`) AS city, toString(`<addr>`) AS address,
         toFloat64OrNull(toString(`<lat>`)) AS lat, toFloat64OrNull(toString(`<lng>`)) AS lng
  FROM <db>.`<table>`)
WHERE isNotNull(lat) AND isNotNull(lng)
ORDER BY lat, lng, name, city, address LIMIT {limit:UInt32} OFFSET {offset:UInt32}   -- PAGE=2000
```
  - A missing column becomes the literal `''`.
- Points are built in JS:
  - `category = spatialCategory(slug)`: regex on the slug (`lib/spatial.ts:61-76`).
  - `city = spatialCity()`: maps English names to `Jakarta Pusat` etc., otherwise Title-Case.
  - Points failing `hasSpatialCoordinates` are dropped: lat must be within ±90, lng within ±180, and (0,0) is rejected.
- 200 response (live: 1056 points, `complete: true`):
```json
{ "points":[{"id":"lake-<slug>-0","name":"…","category":"wisata","city":"","address":"JL. SITU BABAKAN …",
             "lat":-6.339255313,"lng":106.8250668,"href":"/sdi/<slug>","source":"<title>"}],
  "inventory":[{"slug":"jumlah-kunjungan-wisatawan-ke-obyek-wisata-…","coordinates":28}],
  "failed":[], "complete":true }
```
- Error 503: `{points:[],inventory:[],failed:[],complete:false,error:"Sumber titik lakehouse belum dapat dimuat."}`.
- **Performance:** about 200 sequential DESCRIBE calls plus paged queries per request. Good candidate for a precomputed Data API endpoint or cron snapshot.

### 2.8 `GET /api/hotels/scraped` (`app/api/hotels/scraped/route.ts:1-120`)
- Params: `limit` (default 100, max 500). Note `Number("abc")` gives NaN, which is not guarded. `force-dynamic`, `maxDuration=30`. No cache header.
- SQL 1 (rows):
```sql
SELECT * FROM serving.mart_hotel_scraped_booking
WHERE (checkin, hotel_id, scraped_at) IN (
  SELECT checkin, hotel_id, max(scraped_at) FROM serving.mart_hotel_scraped_booking GROUP BY checkin, hotel_id)
ORDER BY review_score DESC NULLS LAST, price_idr ASC NULLS LAST
LIMIT {limit:UInt32}
```
  Each row also gets `room_types`, the parsed `room_types_json` (`[{name,beds?,sleeps?,price_min_idr,price_max_idr,price_raw_min,price_raw_max,breakfast_included,cancellation?,rate_count}]`).
- SQL 2 (stats, last 7 days):
```sql
SELECT count() AS total,
  countIf(latitude IS NOT NULL AND longitude IS NOT NULL) AS with_coords,
  countIf(address != '') AS with_address, countIf(rooms_left IS NOT NULL) AS with_rooms_left,
  countIf(length(room_types_json) > 2) AS with_rooms, round(avg(price_idr)) AS avg_price,
  min(price_idr) AS min_price, max(price_idr) AS max_price, uniqExact(city) AS distinct_cities
FROM serving.mart_hotel_scraped_booking WHERE scraped_at > now() - INTERVAL 7 DAY
```
- SQL 3:
```sql
WITH per_hotel AS (SELECT hotel_id, anyLast(total_room_types) AS rooms_for_hotel
  FROM serving.mart_hotel_scraped_booking WHERE scraped_at > now() - INTERVAL 7 DAY
  GROUP BY hotel_id HAVING rooms_for_hotel IS NOT NULL)
SELECT sum(rooms_for_hotel) AS total_room_types, round(avg(rooms_for_hotel), 1) AS avg_room_types_per_hotel FROM per_hotel
```
- 200 response shape: `{rows, stats:{total,with_coords,with_address,with_rooms_left,with_rooms,avg_price,min_price,max_price,distinct_cities,total_room_types,avg_room_types_per_hotel}, last_checkin, source:"booking.com-poc", note:"Sandbox table from research-grade POC scraper. Exit-strategy → Booking Demand API."}`.
  - **Live 2026-10-21: `rows` is empty, `stats.total` is 0, and `last_checkin` is null.** The mart is empty, at least for the last 7 days.
- Error 500: `{error: message}`.

### 2.9 `POST /api/admin/sync` (`app/api/admin/sync/route.ts:1-37`)
- Auth: header `x-sync-secret` must equal env `SYNC_SECRET`, else 401 `{"error":"unauthorized"}` (verified live).
- Params: `slug=<slug>|all` (required, else 400 `{"error":"slug wajib diisi"}`). `all` uses the **static** `SDI_DATASETS` seed list.
- Calls `syncDataset()` (`lib/sync.ts:6-11`). In v2 this **always throws** "Sync via app dinonaktifkan di v2. Jalankan pipeline lakehouse (… `refresh_lakehouse`)."
- The response is therefore always `{synced:0,total:N,results:[{slug,error:"Error: Sync via app dinonaktifkan…"}]}`.
- **Do not port as an HTTP endpoint.** Ingestion belongs to Dagster `refresh_lakehouse` (daily 02:00). If an admin trigger is wanted, see §4.4.
- `lib/sdi-fetch.ts` (live SDI `detail`/`get-table-data` client with 3 retries and 5000 rows per page) and `lib/sdi.ts:fetchSdiLive` are **unused by v2 routes**; they are legacy. Per project rule, the app must never fetch SDI.

### 2.10 `GET|POST /api/admin/report` (`app/api/admin/report/route.ts:1-40`)
- Auth: either `Authorization: Bearer $CRON_SECRET` or header `x-sync-secret: $SYNC_SECRET`. Otherwise 401 `{"error":"unauthorized"}` (verified live).
- `force-dynamic`, `maxDuration=300`.
- **Flow:**
  - `buildReports()` (`lib/report.ts:43-63`):
    - `computeReadiness()` → `putReport("readiness")`.
    - For each GCI indicator dataset with `0 < total ≤ 6000`: `rowsForRaw(slug)` → `putReport("rows:<slug>")`.
  - Then `revalidatePath("/gci")` and `revalidatePath("/gpci")`.
- **In v2 `putReport` is a no-op and `getReportRaw` always returns null** (`lib/report-store.ts:9-17`). The job therefore only burns CPU and revalidates two ISR paths. Readiness is computed live and cached 24 h through `unstable_cache` (`lib/report.ts:19-35`).
- Responses:
  - 200: `{ok:true, readiness:<n>, datasets:<n>}`.
  - 500: `{ok:false,error}`.
- Cron: `vercel.json` `0 18 * * *` (18:00 UTC = 01:00 WIB). Only relevant on Vercel.

### 2.11 AI (out of scope, listed only)
- `POST /api/ai/ask`: body `{question}`. Searches the catalog by keyword (SQL joins catalog and sync, primary + secondary), then calls the LLM. Returns `{answer, datasets:[{id,title,tier,rows}]}`. 400 or 503 on errors.
- `POST /api/ai/text-to-sql`: body `{question, run?}`. The LLM generates SQL, a SELECT-only guard checks it, then it executes with up to 2 self-repair attempts. Returns `{sql, explanation, assumptions, repaired, repairAttempts, repairLog, rows?, rowCount?, columns?, runError?}`. 400, 422, or 503 on errors.

---

## 3. `lib/ch/store.ts`, function by function

Lakehouse metadata tables are read through the Iceberg catalog DB `lake`. Constants at HEAD `:15-20`:

| const | table | writer |
|---|---|---|
| `META` | ``lake.`bronze_meta.dataset_catalog` `` | `lakehouse/ingest/dispar_ingest/meta.py:170-193` |
| `META_SEC` | ``lake.`bronze_meta_sec.dataset_catalog` `` | `…/secondary_ingest.py` |
| `SYNC` / `SYNC_SEC` | ``lake.`bronze_meta[_sec].dataset_sync` `` | `meta.py:195-251`; `total` filled by `fill_totals` `:304` |
| `COL` / `COL_SEC` | ``lake.`bronze_meta[_sec].dataset_column` `` | `meta.py:199-259` |

Schemas, from `meta.py`. All columns are Iceberg strings unless noted. I could not run `DESCRIBE` against ClickHouse, so the `_sec` schemas are assumed identical (belum terverifikasi).
- `dataset_catalog`: `slug, title, description, tags (JSON array string), views int64, updated_at (string ISO), tier ('primer'|'sekunder'), table_name (= safe_name(slug))`
- `dataset_sync`: `slug, title, description, sumber_data (JSON array string), frekuensi, satuan, klasifikasi, kontak, author, total int64 (Bronze row count), table_name, synced_at timestamp(us, UTC)`
- `dataset_column`: `slug, ord int64, key_asli, key_safe, tipe (SDI hint e.g. 'varchar'), deskripsi`

Other databases: `silver` (ClickHouse views over Iceberg) and `serving` (MergeTree marts).

| # | Function (HEAD line) | SQL | Purpose / notes |
|---|---|---|---|
| 3.1 | `catalog()` `:28-42` | `SELECT slug, title, description, tags, toString(views) AS views, updated_at, tier, table_name FROM META UNION ALL SELECT … FROM META_SEC` | All datasets. Tags are parsed with `safeJsonArray`, views become a Number, and an empty updated_at becomes null. Used by `/api/sdi`, medallion, spatial, readiness, and indicator-data. |
| 3.2 | `sync(slug)` `:51-70` | `SELECT slug, title, description, sumber_data, frekuensi, satuan, klasifikasi, kontak, author, toString(total) AS total, table_name FROM SYNC WHERE slug={slug:String} UNION ALL SELECT … FROM SYNC_SEC WHERE slug={slug:String} LIMIT 1` | Metadata for one dataset. Empty strings become null. |
| 3.3 | `syncTotals()` `:73-79` | `SELECT slug, toString(total) AS total FROM SYNC UNION ALL SELECT slug, toString(total) AS total FROM SYNC_SEC` | slug→total map (readiness). |
| 3.4 | `columns(slug)` `:84-96` | `SELECT key_asli, deskripsi, tipe, toString(ord) AS ord FROM COL WHERE slug={slug:String} UNION ALL SELECT … FROM COL_SEC WHERE slug={slug:String} ORDER BY ord` | Column defs `{key, description, type, ordinal}`. **Empty → treated as "dataset not in lakehouse" (404)**. |
| 3.5 | `columnKeys(slugs)` `:99-113` | `SELECT slug, key_asli FROM COL WHERE slug IN {slugs:Array(String)} UNION ALL SELECT slug, key_asli FROM COL_SEC WHERE slug IN {slugs:Array(String)}` | slug→Set(keys) (indicator pages). |
| 3.6 | `tiers(slugs)` `:116-126` | `SELECT slug, tier FROM META WHERE slug IN {slugs:Array(String)} UNION ALL SELECT slug, tier FROM META_SEC WHERE slug IN {slugs:Array(String)}` | slug→tier (`IndicatorShell`). |
| — | `tableFor(slug)` `:129-136` (private) | `SELECT table_name FROM META WHERE slug={slug:String} UNION ALL SELECT table_name FROM META_SEC WHERE slug={slug:String} LIMIT 1` | slug → Silver table name. |
| — | `silverAda()` `:139-145` (private) | `SHOW TABLES FROM silver` | **Memoised in module scope forever.** A Silver table created after the process started is invisible until the container restarts. The Data API should use a TTL instead. |
| — | `servingAda()` `:184-190` (private) | `SHOW TABLES FROM serving` | Same permanent memoisation. |
| 3.7 | `medallion()` `:198-218` | uses catalog, silverAda, servingAda | slug → `{level, table, mart?}`. A table listed in `GOLD_SOURCES` whose mart exists is **gold**. Otherwise a table present in `silver` is **silver**. Otherwise **bronze**. |
| 3.8 | `medallionForTables(tables)` `:231-248` | same logic per table name | Used for the Atlas entries. |
| 3.9 | `rowsForRaw(slug)` / alias `rowsFor` `:259-266` | ``SELECT * FROM silver.`<table>` `` (no LIMIT, no ORDER) | Full dump. Audit columns stripped. Returns `[]` if there is no Silver table. Used by export, readiness, and indicator-data. |
| 3.10 | `rowsPage(slug, offset, limit, search)` `:269-285` | ``SELECT * FROM silver.`<t>` [WHERE positionCaseInsensitive(toString(tuple(*)), {q:String}) > 0] LIMIT {limit:UInt32} OFFSET {offset:UInt32}`` then ``SELECT toString(count()) AS c FROM silver.`<t>` [same WHERE]`` | Paged rows plus the matching count. |
| — | `safeJsonArray` `:287-295` | — | Safe JSON array parse. |

**Constants:**
- `GOLD_SOURCES` (`:172-181`), mart → base tables:
  - `mart_wisman` → `data_jumlah_kunjungan_dan_ranking_wisatawan_mancanegara_ke_provinsi_dki_jakarta_melalui_pintu_soekarno_hatta_berdasarkan_kebangsaan`
  - `mart_kuliner` → `data_usaha_jasa_makanan_dan_minuman_jenis_usaha_restoran_di_dki_jakarta`
  - `mart_event` → `data_event_pariwisata_dan_kebudayaan_dki_jakarta_2011_2019`
  - `mart_kunjungan_dtw` → `kunjungan_31_dtw_juli_2026_sumber_mentah`
  - `mart_atlas` → `atlas_restoran, atlas_souvenir, atlas_nightlife, atlas_pertunjukan`
  - `mart_gci_readiness` → `gci_gpci_indicators`

  The list is hand-maintained because `dispar_app` cannot read `system.*`. The **Data API runs as a privileged service**, so it could derive the mapping from `system.tables.dependencies_table` or from a lineage table instead (recommendation).
- `ATLAS_TABLES` (`:225-228`): `{ "sec-gci-resto": "atlas_restoran", "sec-events": "atlas_pertunjukan" }`.
- `AUDIT` (`:251`): `_ingested_at, _source_url, _batch_id, _row_hash, _tenant`.

**Δ origin/main additions** (origin `lib/ch/store.ts` line numbers):
- `displayColumns(slug)` `:106-121`
  - Returns `columns(slug)` plus the Silver schema keys that are missing from the metadata. `periode_data` goes first and the other extras go last.
  - SDI never registers `periode_data`. It is attached to every row during ingest.
- `periode(slug)` `:124-135`
  - SQL: ``SELECT toString(min(periode_data)) AS lo, toString(max(periode_data)) AS hi FROM silver.`<t>` WHERE periode_data IS NOT NULL``
  - Returns `{min,max}`, or null if the column is absent or empty.
- `schemaFor(table)` `:314-321`
  - ``DESCRIBE TABLE silver.`<t>` ``, minus the audit columns. Cached with a 5 min TTL.
- `silverTable(slug)` `:324-328`: returns `{ref, schema}` or null.
- `rowsPage(slug, offset, limit, rq)` `:331-345`
  - ``SELECT * FROM <ref> <where> <orderBy> LIMIT {limit:UInt32} OFFSET {offset:UInt32}`` and the count query, run in parallel.
- `rowsFiltered(slug, rq)` `:348-354`: ``SELECT * FROM <ref> <where> <orderBy>`` (export).
- `facets(slug)` `:362-401`
  - Query 1 (one row): `toString(min(\`c\`)) AS mn{i}, toString(max(\`c\`)) AS mx{i}` for each number/date column, plus `toString(uniqUpTo(51)(\`c\`)) AS u{i}` for each text column.
  - Query 2 (a UNION ALL across text columns with ≤ 50 distinct values): ``SELECT {k{i}:String} AS k, toString(`c`) AS v, toString(count()) AS n FROM <ref> WHERE `c` IS NOT NULL AND toString(`c`) != '' GROUP BY v``
  - `FACET_MAX_VALUES = 50`.
- `aggregate(slug, rq, x, y, agg)` `:411-428`:
```sql
SELECT if(trim(ifNull(toString(`x`), '')) = '', '—', trim(toString(`x`))) AS name,
       toString(<count() | agg(toFloat64OrNull(replaceAll(replaceAll(toString(`y`), ' ', ''), ',', '.')))>) AS value
FROM <ref> <where> GROUP BY name [HAVING count(<num>) > 0] ORDER BY <value> DESC LIMIT 1000
```

The `GOLD_SOURCES` contents on origin/main are unchanged from HEAD. Only the line numbers moved to `:211-220`.

---

## 4. Proposed contract: lakehouse **Data API** (internal) and the **Laravel public API**

Design goals:
1. The Data API is the **only** component that talks to ClickHouse. It is read-only, internal to the network, and authenticated with a service token.
2. Laravel proxies the Data API, adds the response envelope, writes audit/log history, and owns the cache.
3. Nuxt calls only Laravel.
4. No PATCH anywhere; reads are GET.
5. Shapes stay close to the current ones so the Nuxt port of the pages is mechanical.

### 4.1 Data API (`/v1`, JSON, `Authorization: Bearer <service-token>`)

Common rules:
- Request ID header `X-Request-Id`, echoed in responses.
- ISO-8601 timestamps.
- Integers are sent as **JSON numbers**, not ClickHouse strings.
- Errors use one shape everywhere: `{ "error": { "code": "DATASET_NOT_FOUND", "message": "Dataset belum tersedia di lakehouse", "detail": null } }`.

Codes, with the HTTP status for each:

| code | HTTP |
|---|---|
| `DATASET_NOT_FOUND` | 404 |
| `NOT_IN_SILVER` | 409 |
| `INVALID_FILTER` | 400 |
| `INVALID_PARAM` | 400 |
| `UPSTREAM_UNAVAILABLE` | 503 |
| `UNAUTHORIZED` | 401 |
| `TOO_LARGE` | 413 |

`NOT_IN_SILVER` is optional. Today that case returns 200 with empty rows.

#### `GET /v1/datasets`
- Query:
  - `tier=primer|sekunder|all` (default all; `/sdi` uses primer).
  - `q`, `layer=bronze|silver|gold`.
  - `sort=updated_at:desc` (default) | `title:asc` | `views:desc`.
  - `page`, `size` (default size = all, max 500). The catalog is small (~230).
- Response:
```json
{ "data": [ {
    "slug":"data-jumlah-wisatawan-mancanegara-berdasarkan-kebangsaan",
    "title":"Data Jumlah Wisatawan Mancanegara Berdasarkan Kebangsaan",
    "description":"…", "tags":["wisatawan mancanegara","kebangsaan"],
    "views":1598, "updated_at":"2026-10-21T03:19:38Z", "tier":"primer",
    "table_name":"data_jumlah_wisatawan_mancanegara_berdasarkan_kebangsaan",
    "medallion":{"level":"silver","mart":null},
    "total_rows":664 } ],
  "meta": { "count":184, "layer_counts":{"bronze":2,"silver":216,"gold":5},
            "stats":{"total":184,"distinct_tags":0,"total_views":0},
            "generated_at":"2026-10-21T05:00:00Z" } }
```
  - The `stats` numbers above are placeholders; compute them the way `sdiStats` does.
  - Embedding `medallion` removes the second `/api/sdi/medallion` round-trip.
  - `layer_counts` must be computed over the same tier filter the page uses. On `/sdi` that means primer only.
- SQL: `catalog()` LEFT JOIN `syncTotals()`, plus the medallion logic.

#### `GET /v1/datasets/medallion`
- Response: `{ "data": { "<slug-or-atlas-id>": {"level":"gold","mart":"mart_wisman","table":"…"} }, "meta":{"counts":{…}} }`
- Keeps the Atlas ids (`ATLAS_TABLES`) for `/katalog` and the Atlas pages.

#### `GET /v1/datasets/{slug}`
- Response:
```json
{ "data": { "slug":"…","title":"…","description":"…","tier":"primer",
  "sumber_data":["Badan Pusat Statistik Provinsi DKI Jakarta"],"frekuensi":"1 Bulan Sekali","satuan":"Orang",
  "klasifikasi":null,"kontak":"disparekraf@jakarta.go.id","author":"Ruth Magdalena",
  "periode":{"min":"2024-01-01","max":"2026-07-01"},
  "medallion":{"level":"silver","table":"data_jumlah_…","mart":null},
  "total_rows":664, "silver_rows":664, "synced_at":"2026-10-21T02:07:00Z",
  "portal_url":"https://satudata.jakarta.go.id/open-data/<slug>" } }
```
- `total_rows` is the Bronze count from `dataset_sync.total`. `silver_rows` is the unfiltered Silver count. Exposing both makes the difference visible.
- 404 `DATASET_NOT_FOUND` when the dataset has no metadata.

#### `GET /v1/datasets/{slug}/columns`
- Response:
```json
{ "data": [
  {"key":"periode_data","label":"Periode Data","description":null,"sdi_type":null,"silver_type":"Date",
   "kind":"tanggal","ordinal":-1,"in_metadata":false,"sortable":true,"filterable":true},
  {"key":"kebangsaan","label":"Kebangsaan","description":"komponen","sdi_type":"varchar","silver_type":"String",
   "kind":"teks","ordinal":0,"in_metadata":true,"sortable":true,"filterable":true} ] }
```
- Semantics follow `displayColumns` on origin/main. `label` is `humanize(key)`, precomputed so Nuxt and the Excel header can share it.
- `kind` is derived with `kindOf()`.
- Optional `?with=facets` embeds `facet: {kind, values?|min?,max?}`. Otherwise use the endpoint below.

#### `GET /v1/datasets/{slug}/facets`
- Same shape as §2.5, wrapped as `{data:[…]}`. Cacheable until the next refresh.

#### `GET /v1/datasets/{slug}/rows?page&size&sort&q&f`
- `page` ≥ 1, `size` 1..200 (default 50).
  - Nuxt can keep infinite scroll by requesting page = loaded/50 + 1.
  - Also accept `offset` for parity, with `offset` taking precedence. Keep a single semantics in the tests.
- `sort=<col>:asc|desc`.
- `q` is matched case-insensitively against all columns.
- `f` uses exactly the grammar in §2.3.1, repeatable. Keep the grammar so the URL and filter-chip logic port 1:1.
  - Laravel/PHP repeated-key note: PHP collapses `f=a&f=b` into the last value unless the key is `f[]`. Either use `f[]=` in the Laravel↔Nuxt hop, or parse `$_SERVER['QUERY_STRING']` by hand. **Decide this in the spec.**
- Response:
```json
{ "data":[{"periode_data":"2025-01-01","kebangsaan":"JERMAN","jumlah_kunjungan":2357}],
  "meta":{"page":1,"size":50,"offset":0,"count":664,"total_rows":664,"has_more":true,
          "applied":{"q":"","filters":[],"sort":null}} }
```
- Without a sort, the Data API should still apply a deterministic default order, e.g. `ORDER BY cityHash64(toString(tuple(*)))`. Today the unsorted order is undefined and infinite scroll can, in theory, skip or duplicate rows.
- Audit columns are always stripped.

#### `GET /v1/datasets/{slug}/aggregate?x&y&agg&q&f`
- Same semantics as §2.6. Response: `{data:[{name,value}], meta:{groups, truncated}}`.
- This endpoint is needed if Nuxt should match origin/main charts (server-side over all filtered rows).

#### `GET /v1/datasets/{slug}/export?format=csv|xlsx&q&f&sort`
- Streams the file.
  - Header row = the `columns` keys (raw keys, matching today).
  - CSV: BOM + CRLF + RFC4180.
  - XLSX: sheet `Data`.
- Filename: `{slug}.csv`, or `{slug}-terfilter.csv` when any of q/f/sort is set.
- Add `X-Row-Count`.
- Return 413 `TOO_LARGE` above a configured cap. The cap value is belum ditentukan; check the largest Silver table first.

#### Other endpoints the same Data API needs to cover the other routes
- `GET /v1/spatial/points`: same shape as §2.7. Precompute it with a 5–15 min TTL.
- `GET /v1/hotels/scraped?limit`: same shape as §2.8.

### 4.2 Laravel public API (what Nuxt calls)

**Envelope**, applied to every JSON response:
```json
{ "success": true, "message": "OK", "data": <Data API data>, "meta": <Data API meta + {"request_id":"…","cached":true}> }
```
Error form:
```json
{ "success": false, "message": "Dataset belum tersedia di lakehouse",
  "errors": {"code":"DATASET_NOT_FOUND"}, "meta": {"request_id":"…"} }
```
The HTTP status passes through from the Data API. A Data API outage maps to 503.

| Laravel route (proposal) | Method | Proxies | Replaces | Cache (Laravel) |
|---|---|---|---|---|
| `/api/v1/datasets` | GET | `/v1/datasets` | `/api/sdi` + `/api/sdi/medallion` | 1 h; bust after the daily refresh |
| `/api/v1/datasets/medallion` | GET | `/v1/datasets/medallion` | `/api/sdi/medallion` | 1 h |
| `/api/v1/datasets/{slug}` | GET | `/v1/datasets/{slug}` | meta part of `/api/sdi/{slug}` | 24 h |
| `/api/v1/datasets/{slug}/columns` | GET | `/v1/…/columns` | `columns` part | 24 h |
| `/api/v1/datasets/{slug}/facets` | GET | `/v1/…/facets` | `/facets` | 24 h |
| `/api/v1/datasets/{slug}/rows` | GET | `/v1/…/rows` | rows part | 24 h when unfiltered and unsorted; no cache otherwise (same as today) |
| `/api/v1/datasets/{slug}/aggregate` | GET | `/v1/…/aggregate` | `/aggregate` | short (5 min), keyed by the full query |
| `/api/v1/datasets/{slug}/export` | GET | `/v1/…/export` (stream) | `/export` | no-store |
| `/api/v1/spatial/points` | GET | `/v1/spatial/points` | `/api/spatial` | 5 min |
| `/api/v1/hotels/scraped` | GET | `/v1/hotels/scraped` | `/api/hotels/scraped` | none |

Splitting meta, columns, and rows means Nuxt makes three calls on first load instead of one. If page parity matters more than purity, add a combined `GET /api/v1/datasets/{slug}?include=columns,rows&page=1&size=50` that returns the old single payload (`{…meta, columns, rows, total, count, offset, limit}`). That lets the Nuxt detail page be a near-literal port.

**"Log history per module"** applies to read-only modules too. Suggested design:
- A middleware writes one row per request: `module` (catalog|dataset|export|spatial|hotel|admin), `action`, `slug`, a hash of the query params, the user/IP, status, duration, row count, request_id, and created_at.
- Exports must always be logged: who downloaded which dataset, with which filter.
- Admin and cron runs go to a `job_runs` table: job, trigger (cron|manual), user, started_at, finished_at, status, result JSON.
- Expose the logs via `GET /api/v1/logs?module=…` (admin only).

**Unit and feature test scenarios** (one per scenario). At minimum:
1. Catalog: lists items, filters by tier and by layer, the search hits title/description/source/tag, the sort order is stable, and the response handles a Data API that is down (503 envelope).
2. Detail: success, unknown slug → 404, metadata present but Silver missing.
3. Rows:
   - default page;
   - `size` clamped to 200;
   - negative offset → 0;
   - `q` match and no-match;
   - each filter form `in`, `range` number, `range` date, open-ended range;
   - invalid filter / unknown column / text range / > 20 filters / > 100 values → 400;
   - sort asc/desc, unknown sort column → 400;
   - audit columns never appear in the output.
4. Facets: category ≤ 50, text column with more than 50 values → `none`, number/date min/max.
5. Aggregate: each agg; count without y; bad agg → 400; unknown x → 400; empty label → `—`.
6. Export:
   - CSV starts with the BOM, quoting is correct, `-terfilter` filename;
   - XLSX content-type and sheet name `Data`;
   - unknown slug → 404;
   - an export log row is written.
7. Spatial: (0,0) and out-of-range coordinates dropped; missing lat/lng columns skipped; the `failed` list is populated.
8. Hotels: limit clamped to 500; non-numeric limit handled; `room_types_json` parse failure → `[]`.
9. Envelope and log middleware: request_id is propagated and a log row is written per module.
10. No route accepts PATCH (route list assertion).

### 4.3 What becomes cron or job work (not request-path HTTP)

| Current | Fate in the new stack |
|---|---|
| `POST /api/admin/sync` | **Drop.** Already dead in v2. Ingestion = Dagster `refresh_lakehouse`, daily at **02:00** (per CLAUDE.md; the schedule definition itself was not re-checked here). If the Dinas needs a button, add Laravel `POST /api/v1/admin/jobs/refresh` (admin auth). It calls the Dagster GraphQL `launchRun` (belum terverifikasi that Dagster :13030 is reachable from the government server) and logs to `job_runs`. Never fetch SDI from Laravel. |
| `GET\|POST /api/admin/report` plus Vercel cron `0 18 * * *` | **Becomes a Laravel scheduler job** (`php artisan schedule`). Suggested schedule: daily **03:00 WIB**, i.e. after the 02:00 Dagster refresh. Its jobs: (a) warm or bust the Laravel caches for catalog, medallion, facets, and spatial; (b) if the GCI/GPCI readiness pages are ported, precompute readiness through a Data API endpoint and store a snapshot. Keep a manual trigger as `POST /api/v1/admin/jobs/report` (admin), logged to `job_runs`. Today `putReport` is a no-op, so nothing is stored. Decide whether the snapshot is real in the new stack. |
| `revalidatePath("/gci","/gpci")` | Replace with Laravel cache tag flushes. Nuxt then re-fetches. With Nuxt route rules / ISR, call its purge endpoint instead (belum terverifikasi which rendering mode is chosen). |
| In-process `silverAda` / `servingAda` caches | Move into the Data API with a TTL, invalidated by the post-refresh job. |

### 4.4 Gaps and risks to record in the spec
- **HEAD vs production drift** (top of this file). Pick origin/main as the baseline.
- `total` (Bronze count) ≠ `count` (Silver) in some datasets, and the UI mixes them: the hero uses total, while the counter and footer use count.
- Row order without a sort is nondeterministic.
- Export has no row cap and buffers the whole file in memory.
- The `/docs` page content is stale. Generate it from OpenAPI.
- `klasifikasi`, `kontak` and `author` are fetched but not displayed. Decide whether to show them; showing them would break "exactly like".
- `/api/hotels/scraped` currently returns empty data (live 2026-10-21).
- `views` in the catalog is SDI's view counter, captured at ingest. It is not a local analytics count.
- The `lib/sdi-data.json` seed (182) is stale compared with live (184). Drop it.
