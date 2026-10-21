# Plan 05 — Data API: atlas, gmti, spasial, hotel-scraped (needs 02)

Repo: ini. Branch `feat/data-api-atlas`.
Commit: `feat(data-api): endpoint atlas gmti spasial dan hotel scraped`.

## Hasil akhir

Empat fitur, yaitu `atlas`, `gmti`, `spasial`, dan `hotel_scraped`, mengimplementasikan KONTRAK
§2.4–2.5. Semua data statis dibaca dari `lake.bronze_file.*` (F §2). Hasilnya identik dengan
golden statis plan 01.

## Sumber logika yang diporting (inventaris D, C §3.4–3.9)

| Logika | Lokasi asal |
|---|---|
| Merge GCI | `lib/gci.ts` + `gci-osm`, `-ratings`, `-addresses`, `-pricelevels`, `-hotel-restos`; rantai join dan dedup placeId atau nama ≤ 60 m (D ringkasan butir 3, D §2.3) |
| Direktori restoran | `lib/restaurants.ts` + `restaurants-osm.ts`: dedup kurasi vs OSM, filter DKI (D §2.4) |
| Event, golf, suvenir, hotel | D §2.5–2.8; hotel TPK/LoS dikirim siap-seri |
| GMTI | `lib/gmti.ts`, `lib/gmti-data.ts`: `GMTI_META` dihitung ulang (tidak diekspor batch 1), kolam pilar (D §2.1) |
| Spasial | `lib/spatial.ts` + `app/api/spatial/route.ts`: tebakan kolom lat/lon, regex kategori, dedup `category\|name\|lat\|lng`, agregat kepadatan per kecamatan (point-in-polygon terhadap `dki-jakarta.geojson`, yang disalin ke `data_api/features/spasial/` sebagai aset peta, bukan data) |
| Hotel-scraped | SQL `app/api/hotels/scraped/route.ts` dengan sumber diganti `bronze_file.booking_hotel_2026_09_15` dan tanpa jendela 7 hari (SPEC P5). **Hanya untuk `/v1/hotel-scraped`.** `/v1/spasial` tetap membaca `serving.mart_hotel_scraped_booking` seperti `app/api/spatial/route.ts:20` (sekarang 0 titik) |

## Aturan

- `restoran_osm` dan `gci_venue_osm` di Bronze masih **mentah**, jadi dedup terjadi di Data API.
  `restoran_kurasi` dan `gci_venue_kurasi` sudah hasil merge.
- Kolom bersarang yang batch 1 ratakan (`induk_anak`) dan array yang disimpan sebagai string
  JSON dikembalikan ke bentuk aslinya, seperti di golden.
- Titik di luar DKI pada `/v1/spasial` **ditiru** (SPEC P6). Dropdown wilayah 30 nilai juga
  ditiru.
- `/v1/gmti/tempat` berhalaman 200 per halaman. Filter pilar, kota, dan cari diproses di
  server, dan hasilnya harus sama dengan filter klien sekarang. Tes membandingkan halaman 1–3
  dan total untuk 4 kombinasi filter.
- `/v1/spasial` dikirim penuh (±4.825 titik) dalam bentuk ringkas. Ukuran gzip dicatat di PR.
  Detail popup diambil lewat `/v1/spasial/titik/{id}`.

## Test

- **Unit:**
  - dedup GCI: kasus placeId sama, nama sama ≤ 60 m, nama sama > 60 m, rename hotel-resto;
  - dedup restoran;
  - kolam pilar GMTI;
  - tebakan kolom lat/lon;
  - point-in-polygon pada tepi poligon.
- **Golden:** respons setiap endpoint statis sama dengan `tests/golden/*.json`, dibandingkan
  setelah kunci diurutkan. Ini **gate**, bukan panggung, karena sumbernya Bronze yang
  kelasnya snapshot.
  - Untuk `/v1/spasial`, gate hanya mencakup **porsi statis** (titik dari bundel atlas, seni
    venue, GMTI). Porsi Silver berkoordinat berubah tiap hari, jadi diuji di panggung terhadap
    golden live.
  - Panggung tetap dijalankan sekali, untuk memastikan bacaan Bronze live sama dengan golden.
- **Contract:** semua endpoint.

## Gate lokal

```bash
cd lakehouse/data-api && uv run --extra dev ruff check . && uv run --extra dev pytest -q
uv run --extra dev pytest -q -m panggung -k "atlas or gmti or spasial or hotel"
```

## Kriteria selesai

1. Golden sama untuk semua endpoint statis. Jumlah record per endpoint tercatat di PR: 2.577,
   604, 308, 14, 67, 120/145/310, 8.331 (+335), 4.825, 72. Setiap beda dijelaskan.
2. Panggung lulus.

## STOP

- Golden berbeda dan sebabnya ada di data Bronze (misalnya `gci_resto_hotel` 107 vs 108 baris
  di TS).
- Tulis selisihnya per record, lalu berhenti. Jangan menambal data di Data API.
