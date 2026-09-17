---
name: crawling-data
description: Use when collecting data from outside the lakehouse — crawling, scraping, geocoding, enriching venues, hitting Google Places/OSM/TripAdvisor/Booking, or resuming a half-finished crawl. Triggers include "crawl", "scrape", "ambil data dari", "geocode", "enrich", "lengkapi alamat", "cari rating", "tarik data situs".
---

# Crawling data eksternal

## Langkah 0 — pastikan datanya memang belum ada

Jangan pernah mulai crawl sebelum mengecek empat tempat ini. Sering kali datanya
sudah ada, atau sudah ada proksinya:

```bash
grep -i "<topik>" platform-v2/lib/sdi-data.json      # 183 dataset primer SDI
grep -i "<topik>" data/gci-gpci-indicators.json      # indikator + catatan proksi
ls data/sekunder/                                    # 16 dataset olahan kita sendiri
```

Lalu katalog lakehouse (`bronze_meta.dataset_catalog` + `bronze_meta_sec.*`) —
pakai agen `data-lakehouse`. Laporkan temuannya ke pengguna sebelum crawl:
"sudah ada X, yang belum ada Y" menghemat berhari-hari kerja.

## Bentuk pengambilan

| Kalau | Pakai | Runtime |
|---|---|---|
| Sekali jalan, sumber ramah (Overpass/OSM, Photon, berkas) | skrip tunggal `scripts/<nama>.py` | Python |
| Enrichment lewat API berbayar/REST | skrip tunggal `scripts/<nama>.ts` | `bun` |
| Berulang, situs komersial, butuh browser, ada ToS | paket `scripts/scrapers/<nama>/` | `bun` + Playwright |

Skrip di `scripts/` memakai **path relatif dari root repo**
(`CACHE = "scripts/geocode_cache.json"`) — jalankan dari root, bukan dari `scripts/`.

## Wajib: cache + resume

Crawl selalu putus. Satu berkas JSON sebagai cache, dikunci nama yang sudah
dinormalkan, tiap baris menyimpan **status** — bukan hanya hasil:

```python
CACHE = "scripts/geocode_cache.json"
cache = json.load(open(CACHE))
todo = [(k, v) for k, v in cache.items() if v["match"] == "NOT FOUND"]
...
json.dump(cache, open(CACHE, "w"), ensure_ascii=False, indent=0)   # simpan tiap batch
```

Simpan **tiap batch**, bukan di akhir. Baris ragu ditandai di status itu sendiri
(`"match": "photon (review)"`) — itu konvensi yang dipakai di seluruh repo.
Untuk serah-terima ke manusia, ada satu preseden berkas terpisah:
`data/202607 Event Geocode - PERLU REVIEW.csv`.

## Wajib: sopan (situs komersial)

Salin safeguard dari `scripts/scrapers/booking-jakarta/README.md` §Safeguards —
robots.txt dicek saat start, User-Agent jujur + header kontak, jeda dengan jitter
±20%, batas keras per run, **berhenti total saat 403/429 atau tantangan
Cloudflare**. Kalau diblokir kita mundur: tanpa rotasi proxy, tanpa stealth
plugin. Jangan turunkan standarnya.

> **Dua peringatan soal paket contoh itu.** (a) Ia menyebut dirinya sendiri
> "RESEARCH-GRADE POC, not for production" — salin *polanya*, jangan anggap
> bentuk akhirnya sudah benar. (b) Ada bug: `src/schema.ts` default
> `CH_USER="dispar_app"` (read-only) sedangkan `src/clickhouse.ts` default
> `"dispar"`. DDL akan gagal izin kalau `CH_USER` tidak di-set eksplisit.

Kalau situs melarang otomasi dan tidak punya jalan resmi, **katakan itu ke
pengguna sebelum menulis kode**. Tulis juga jalan keluarnya di README: API
resmi/kemitraan mana yang menggantikan scraper ini nanti.

## Hemat biaya Google Places (New)

- Tagihan mengikuti **tier tertinggi** yang disentuh field mask. Menambah field
  di tier sama tidak menambah biaya; minta "semua field" melompat ke
  Enterprise+Atmosphere.
- `formattedAddress` = **Essentials**, kuota gratis **10k/bulan**. Pro 5k,
  Enterprise 1k.
- Hitung dulu dan sebutkan angkanya: ~2.600 venue itu mahal, 84 baris deliverable
  beberapa dolar saja.
- Alternatif gratis lemah untuk venue kelas atas: tag alamat OSM ~28%, Nominatim
  salah ~separuh (pernah menaruh Henshin di kode pos Tangerang). **Jangan kirim
  alamat Nominatim ke deliverable resmi.**

## Ke mana hasilnya — pilih jalur yang benar

### Jalur baku: dataset sekunder (hampir selalu ini)

Inventori venue, hasil kurasi, tabel olahan — semuanya lewat sini. Enam belas
dataset sudah memakai jalur ini (TripAdvisor restoran/souvenir, 6 dataset halal,
wisman bersih, event, artis).

1. Tulis `data/sekunder/<slug>.json` berbentuk
   `{slug, title, description, columns, rows}`.
2. **Salin berkas itu juga ke `platform-v2/data/`** — app membaca mirror-nya.
3. Ingest: `dispar_ingest.secondary_ingest` → `bronze_sec.<slug>` +
   `bronze_meta_sec.{dataset_catalog,dataset_sync,dataset_column}` (tier=`sekunder`).
   **Wajib in-network** — jalankan di network `dispar-lakehouse_lakenet`.
4. Regenerasi Silver supaya barisnya bertipe (`silver.<slug>`) — boleh dari
   laptop lewat ClickHouse HTTP `:18123`.
5. Daftarkan di `platform-v2/lib/secondary.ts` (`slug`, `title`, `description`,
   `href: "/sdi/<slug>"`) supaya muncul di katalog `/sdi`.

Tanpa langkah 5 datanya ada di lake tapi tak terlihat siapa pun.

### Jalur pengecualian: mart langsung

Hanya untuk **snapshot deret waktu** yang memang bukan katalog dataset — sejauh
ini satu-satunya contoh adalah `serving.mart_hotel_scraped_booking` (harga hotel
per tanggal check-in). Konsekuensinya lebih berat:

- DDL **ditulis tangan** dan dijalankan terpisah (`src/schema.ts`, `bun run schema`)
  — tabel tidak terbuat sendiri.
- Namanya wajib memuat `scraped` supaya tak tertukar data resmi.
- Halaman dan route API **dibuat tangan** (`app/api/hotels/scraped/route.ts`)
  — lihat skill `menambah-halaman-dispar-v2`.
- Contoh yang ada memakai `TTL scraped_at + INTERVAL 30 DAY`. **Putuskan sadar:**
  TTL itu higiene untuk data POC, tapi akan menghapus deret waktu untuk indikator
  tahunan. Tanyakan ke pengguna kalau datanya dimaksudkan awet.

### Deliverable untuk Dinas

TSV di root repo, mis. `data-restoran-GCI-jakarta.tsv`. Ini terpisah dari jalur
lakehouse — sebuah dataset sering perlu keduanya.

## Kredensial ClickHouse

`CH_URL=http://192.168.18.187:18123`, user **`dispar`** untuk DDL dan tulis
(`dispar_app` read-only, akan gagal). Sandi hanya dari Portainer stack 6 Env —
jangan pernah menulisnya ke berkas repo, repo ini **publik**. Detail di `CLAUDE.md`.

## Sebelum bilang selesai

1. Jalankan ulang skripnya — harus **idempoten** (yang sudah sukses dilewati).
2. Hitung baris dengan `SELECT count()` ke ClickHouse, jangan percaya log skrip.
3. Kalau menyentuh TypeScript di `platform-v2/`: `npx tsc --noEmit` lulus.
4. Laporkan cakupan sejujurnya: berapa ketemu, berapa gagal, berapa perlu review.
   Jangan memoles baris yang tidak yakin, dan jangan membuangnya.
