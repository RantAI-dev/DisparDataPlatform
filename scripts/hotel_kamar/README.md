# Pipeline dataset jumlah kamar hotel DKI Jakarta (terkini)

Skrip ini menggabungkan tiga sumber menjadi satu dataset sekunder hotel
DKI Jakarta + jumlah kamar terkini:

1. **Baseline SDI 2020** — `scripts/hotel_kamar/baseline_2020.jsonl`
   (425 hotel, hasil dedup nama+alamat dari `silver.data_jumlah_hotel_berbintang_dan_non_bintang`).
2. **Rekapitulasi 2023** — `scripts/hotel_kamar/rekap_2023.jsonl`
   (120 hotel, snapshot `silver.data_jumlah_rekapitulasi_usaha_dan_kamar_hotel`).
3. **Riset web** — folder `scripts/hotel_kamar/riset/batch_XX.json`,
   diisi manual oleh plan 02 (satu JSON object per file, kunci = id hotel).

## Aturan prioritas `kamar_terkini`

Untuk setiap baris, `kamar_terkini` dipilih dengan urutan:

1. **Riset DITEMUKAN** (`riset_web`, tahun = `tahun_sumber`).
2. **Riset TUTUP** → `kamar_terkini = null` (hotel tutup; baris tetap ada di
   dataset tapi dikecualikan dari ringkasan total).
3. **Riset RAGU / TIDAK_DITEMUKAN / tanpa riset** → fallback ke:
   - **Rekap 2023** (`rekap_2023`, tahun = 4 digit awal `r_periode`).
   - **SDI 2020** (`sdi_2020`, tahun = `2020`) bila tidak ada di rekap.

`status_operasi`: `TUTUP` (riset TUTUP), `BEROPERASI` (riset DITEMUKAN atau
ada di rekap 2023), `TIDAK_DIKETAHUI` (selain itu). `status_riset`: `BELUM`
bila belum ada entry riset, atau status risetnya (`DITEMUKAN`/`TUTUP`/
`TIDAK_DITEMUKAN`/`RAGU`).

Baris 2023 yang tidak cocok ke baseline manapun ditambahkan sebagai baris
baru dengan id `N001..` (kemungkinan hotel yang dibuka setelah 2020).

## Cara menjalankan

```bash
# Dari root repo:
python scripts/hotel_kamar/build.py
```

Akan menulis:

- `data/sekunder/hotel-kamar-jakarta.json`
- `platform-v2/data/hotel-kamar-jakarta.json` (mirror untuk app v2)

Idempoten: menjalankan dua kali dengan input sama menghasilkan berkas
byte-identical (terverifikasi oleh `tests/test_build.py`).

## Struktur folder

```
scripts/hotel_kamar/
├── README.md             ← berkas ini
├── baseline_2020.jsonl   ← 425 hotel, sumber SDI 2020 (sudah dedup)
├── rekap_2023.jsonl      ← 120 hotel, sumber rekapitulasi 2023
├── build.py              ← pipeline utama (impor-able + CLI)
├── tests/
│   └── test_build.py     ← pytest, jalankan dari root:
│                          uv run --no-project --with pytest python -m pytest scripts/hotel_kamar/tests -q
└── riset/                ← folder hasil riset plan 02
    ├── .gitkeep
    └── batch_00.json ..  ← satu JSON object per file (id → entry)
```

## Cara plan 02 mengisi riset

Buat satu file JSON per batch di `scripts/hotel_kamar/riset/`. Bentuk
setiap file:

```json
{
  "H001": {
    "status": "DITEMUKAN",
    "nama_terkini": "FAIRMONT REBRANDED",
    "kamar_terkini": 550,
    "tahun_sumber": "2024",
    "sumber": "https://situs-resmi-hotel.example/fact-sheet",
    "catatan": "rebranding 2024"
  },
  "H002": {"status": "TUTUP", "kamar_terkini": null, "sumber": "...", "catatan": "tutup COVID"},
  "H003": {"status": "TIDAK_DITEMUKAN", "kamar_terkini": null, "sumber": null, "catatan": "..."},
  "H004": {"status": "RAGU", "kamar_terkini": 250, "sumber": "...", "catatan": "sumber lemah"}
}
```

- `status` wajib salah satu dari: `DITEMUKAN`, `TUTUP`, `TIDAK_DITEMUKAN`,
  `RAGU` (nilai lain → pipeline `build.py` exit non-zero dengan pesan jelas).
- Id harus ada di dataset (baseline `H001..` atau baris baru `N001..`).
  Id tak dikenal → exit non-zero.
- `kamar_terkini` hanya dipakai bila `status = DITEMUKAN` dan nilainya
  integer > 0. Untuk status lain, `kamar_terkini` disimpan di
  `kamar_riset_ragu` (RAGU) atau diabaikan.
- `tahun_sumber` opsional; boleh `"?"` atau kosong (diperlakukan null).