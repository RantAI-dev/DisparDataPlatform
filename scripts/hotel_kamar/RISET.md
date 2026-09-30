# Riset jumlah kamar hotel terkini (cara mengulang)

Cara mengulang riset web jumlah kamar hotel DKI Jakarta tanpa bergantung pada
`/tmp`. Hasil riset masuk ke `scripts/hotel_kamar/riset/batch_NN.json`, lalu
dirakit oleh `build.py`.

## Perkakas

- `searxng_searxng_web_search` (param `query`) — pencarian.
- `searxng_web_url_read` — buka halaman hasil.
- `crawl4ai_md` — ambil teks halaman dinamis bila perlu.

## Anggaran pencarian per golongan (jeda 3–5 detik antar pencarian; tanpa sleep panjang)

- `BINTANG*`: maks 3 pencarian per hotel.
- `MELATI*`, `MOTEL`, `HUNIAN WISATA`, `NON BINTANG`, `HOTEL`: maks 1 pencarian.

## Sumber

- Prioritas: situs resmi hotel / jaringan — Accor (`all.accor.com`), Marriott,
  IHG, Santika (`mysantika.com`), POP! Hotels, favehotels/Archipelago,
  Wikipedia, fact sheet MICE, berita resmi.
- OTA (Booking/Agoda/Traveloka/Tripadvisor) hanya boleh dibaca sebagai snippet
  pendukung. **Jangan scrape halaman OTA** dan jangan jadikan satu-satunya
  sumber bila ada sumber resmi.
- Hotel bisa rebranding atau tutup permanen sejak 2020 — catat nama terkini.

## Bentuk entry

```json
{
  "H001": {"status": "DITEMUKAN", "nama_terkini": "Hotel Contoh", "kamar_terkini": 120,
           "tahun_sumber": "2024", "sumber": "https://situs-resmi.example/rooms",
           "catatan": null},
  "H002": {"status": "TUTUP", "nama_terkini": null, "kamar_terkini": null,
           "tahun_sumber": "2023", "sumber": "https://berita.example/tutup", "catatan": "tutup sejak COVID"}
}
```

- `status` salah satu: `DITEMUKAN`, `TUTUP`, `TIDAK_DITEMUKAN`, `RAGU`.
- `kamar_terkini`: int > 0 untuk `DITEMUKAN`; **null** untuk `TUTUP` dan
  `TIDAK_DITEMUKAN`.
- `tahun_sumber`: string 4 digit atau `"?"`.
- `sumber`: URL asli halaman yang dikonsultasikan (bukan URL mesin cari);
  wajib ada untuk semua status.
- `catatan`: wajib bila rasio `kamar_terkini / kamar_2020` > 3 atau < 1/3.
  Tidak boleh memuat kata "placeholder" (case-insensitive).
- Jangan mengarang angka. Ragu → `RAGU` atau `TIDAK_DITEMUKAN`.

## Jalankan ulang

1. Tulis satu berkas `riset/batch_NN.json` per batch (objek JSON, kunci = id).
   Batch `NN` = `H{NN*18+1}` … `H{min(NN*18+18, 425)}`, `NN` = `00..23`.
2. Rakit dari root repo:

   ```bash
   python scripts/hotel_kamar/build.py
   ```

   Output: `data/sekunder/hotel-kamar-jakarta.json` +
   `platform-v2/data/hotel-kamar-jakarta.json`.
3. Validasi otomatis:

   ```bash
   uv run --no-project --with pytest python -m pytest scripts/hotel_kamar/tests -q
   ```