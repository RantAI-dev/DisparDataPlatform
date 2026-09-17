---
name: laporan-bulanan-tenaga-ahli
description: Use when producing the monthly Dispar consultant reports (laporan pelaksanaan tugas tenaga ahli) — building next month's docx/pdf set, updating an existing month, or refreshing the evidence and figures inside them. Triggers include "laporan bulanan", "laporan tenaga ahli", "bulan ke-4", "buat laporan", "laporan pelaksanaan tugas", "monthly report".
---

# Laporan bulanan tenaga ahli

Generator Python sendiri (python-docx) → `.docx` → LibreOffice → `.pdf`.

**Prinsip: setiap angka diambil dari sistem yang benar-benar jalan.** Bukan
ingatan, bukan angka bulan lalu yang disalin. Belum diverifikasi = jangan ditulis.

## Letak berkas

```
report/tenaga-ahli/
  build_reports.py            # bulan 1 — menulis LOOSE ke direktori ini, tak ada bulan-1/
  build_reports_bulan2.py     # bulan 2 — 7 laporan saja (14 berkas), TANPA laporan utama
  build_reports_bulan3.py     # bulan 3 — 7 laporan + laporan utama (16 berkas) ← salin ini
  assets/ assets-bulan2/ assets-bulan3/    # .png di bulan 2, .jpg di bulan 3
  bulan-2/ bulan-3/
  one-pager-bulan3.html       # ringkasan eksekutif HTML — deliverable tambahan bulan 3
```

Laporan utama **baru ada sejak bulan 3**. Untuk bulan ≥4 salin
`build_reports_bulan3.py` — jangan bulan 2.

## Langkah 1 — salin & ganti SEMUA penanda bulan

Ini langkah yang paling sering setengah dikerjakan. Ada ~40 string yang memuat
bulan, bukan 4. Jangan cari-ganti sekali lalu anggap selesai.

```bash
cd report/tenaga-ahli
cp build_reports_bulan3.py build_reports_bulan4.py
```

Lalu ganti, semuanya, di berkas baru itu:

| Yang diganti | Berapa | Catatan |
|---|---|---|
| `assets-bulan3` → `assets-bulan4` | 1 | konstanta `ASSETS` |
| `"bulan-3"` → `"bulan-4"` | **2** | `build()` **dan** `build_utama()` punya `outdir` sendiri-sendiri |
| `00-Laporan-Utama-Bulan-3.docx` | 1 | nama berkas, bukan nama direktori |
| `"Bulan ke-3 (Laporan Bulanan Ketiga)"` | 1 | blok identitas laporan anggota — **ordinal dieja** |
| `"Bulan ke-3 (Agustus 2026)"` | 1 | blok identitas laporan utama — format berbeda |
| `26 Agustus 2026` | **11** | catatan sumber tiap `TABLES`, baris Tanggal Verifikasi, bagian V & IX |
| `ketiga` / `bulan ketiga` | **14** | di `PENDAHULUAN_UMUM`, `RTL_UMUM`, tiap `pendahuluan_peran` |

Verifikasi sebelum lanjut — harus nol:

```bash
grep -cE "bulan-3|assets-bulan3|Bulan-3|ke-3|ketiga|Agustus 2026" build_reports_bulan4.py
```

## Langkah 2 — verifikasi angka DULU, sebelum menulis narasi

Query ClickHouse 187 untuk tiap angka yang akan disebut: jumlah tabel
Bronze/Silver/Gold, isi mart, hasil quality gate, isi karantina. Pakai agen
`data-lakehouse`. Catat query mana menghasilkan angka mana — nanti dilaporkan.

## Langkah 3 — tangkapan layar

Ke `assets-bulan{N}/`, dinomori sesuai urutan muncul. Bulan 3 butuh **12** layar
dari tiga sistem berbeda: konsol Rantai Lake (`01-lake-catalog`,
`02-lake-pipelines`, `03-lake-observability`, `04-bi-dashboard`,
`05-bi-chart-gallery`, `06-ai-copilot`), app Dispar (`07-app-home`,
`08-wisman-target`, `09-chart-builder`, `10-api-docs`), dan situs buku
(`11-buku-home`, `12-buku-bab`). Sesuaikan dengan apa yang benar-benar dikerjakan
bulan ini — jangan mendaur ulang gambar bulan lalu.

## Langkah 4 — tulis isi

### Laporan anggota (7×, dari `MEMBERS`)

Bagian tetap, jangan diubah urutan atau judulnya:

```
KOP → identitas → I PENDAHULUAN → II URAIAN TUGAS → III PELAKSANAAN PEKERJAAN BULAN INI
→ IV BUKTI PELAKSANAAN → V RENCANA TINDAK LANJUT — PENGEMBANGAN PLATFORM AI-DATA
→ VI PENUTUP → tanda tangan (PPK Bima Agung, NIP 197907162011011008)
```

| Kunci | Isi |
|---|---|
| `filename` | `01-PM-Analisis-Data-Dashboard` … `07-Business-Analyst-1` |
| `jabatan`, `kualifikasi`, `uraian_tugas` | **bawa apa adanya dari bulan lalu — jangan diubah.** Identik antar bulan; asalnya `report/Uraian+Tugas+Tenaga+Ahli (2).pdf` + KAK |
| `pendahuluan_peran` | peran orang ini bulan ini |
| `pelaksanaan_intro` | paragraf pembuka realisasi |
| `realisasi` | list `(uraian, realisasi)` → tabel 2 kolom |
| `bukti_intro`, `bukti` | lihat bawah |
| `rtl_peran`, `rtl_bukti` | RTL khusus peran; `rtl_bukti` list `(gambar, caption)`, boleh `[]` |
| `penutup` | paragraf penutup |

Item `bukti`: `("img", "07-app-home.jpg", "Gambar 2. …")` atau `("lake", "Teks pengantar:")`
yang merujuk kunci di `TABLES`.

**Nomor "Gambar N" ditulis tangan di dalam caption.** Kalau urutan `bukti`
berubah, nomornya harus dibetulkan manual — tidak ada penomoran otomatis.

**Entri `TABLES` adalah 4-tuple:** `(HEADER, ROWS, WIDTHS, "Sumber: …")`. Elemen
keempat wajib — `build()` merendernya sebagai catatan sumber, dan 3-tuple
langsung `IndexError`. Catatan sumber itulah yang membuat angka bisa ditelusuri.

### Laporan utama (`build_utama()`)

Punya **sembilan** bagian + lampiran, bukan enam:

```
I RINGKASAN EKSEKUTIF · II CAPAIAN BULAN INI · III STRUKTUR DATA YANG DIBANGUN
IV PENJAMINAN MUTU DATA · V BUKTI PELAKSANAAN · VI REKAP INDIKATOR TERPILIH
VII KENDALA, RISIKO, DAN MITIGASI · VIII RENCANA BULAN BERIKUTNYA · IX PENUTUP
LAMPIRAN — LAPORAN PELAKSANAAN TUGAS TENAGA AHLI
```

Bagian VII/VIII/LAMPIRAN dibangun dari `KENDALA_ROWS`, `RENCANA_ROWS`,
`LAMPIRAN_ROWS` — **wajib diperbarui tiap bulan**, dan paling sering terlupa.
`build_utama()` juga punya **daftar gambar hardcoded sendiri** (9 tuple, terpisah
dari `MEMBERS`) dengan penomoran "Gambar 1…9" yang harus ikut dibetulkan.

## Langkah 5 — bangun & konversi

`python-docx`, `Pillow`, dan `soffice` sudah terpasang di mesin ini.

```bash
python3 build_reports_bulan4.py
soffice --headless --convert-to pdf --outdir bulan-4 bulan-4/*.docx
```

**`--outdir` wajib.** Tanpa itu LibreOffice menulis PDF ke direktori kerja, bukan
ke `bulan-4/`, dan pemeriksaan di bawah pasti gagal.

## Bahasa

Indonesia formal pemerintahan, istilah teknis **diterjemahkan** untuk pembaca
non-teknis: "lake house tiga lapis", "tampilan data bersih", "mart penyaji",
"gerbang mutu harian" — bukan "Bronze/Silver/Gold layer", "view", "quality gate".

Tiap orang harus terdengar berbeda; realisasinya spesifik ke perannya. Tujuh
dokumen dengan paragraf yang sama dibaca berurutan oleh satu orang yang sama di
Dinas.

## Sebelum bilang selesai

1. `grep -cE "ke-3|ketiga|Agustus 2026|bulan-3" build_reports_bulan4.py` → **0**.
2. `ls bulan-4/` → **16 berkas** (8 docx + 8 pdf).
3. Buka minimal satu PDF: gambar tampil, tabel tidak terpotong, nomor "Gambar N"
   urut.
4. Sebutkan ke pengguna dari query mana tiap angka kunci diambil.
5. Commit keluarannya — `.docx`/`.pdf` bulan-bulan sebelumnya ikut di repo.
6. Tanyakan apakah one-pager HTML juga diperlukan bulan ini.
