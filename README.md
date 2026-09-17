# Platform Data Disparekraf DKI Jakarta

Satu tempat untuk data pariwisata Jakarta: ditarik dari berbagai sumber,
dibersihkan lewat lakehouse, lalu disajikan sebagai dashboard untuk Dinas
Pariwisata dan Ekonomi Kreatif DKI Jakarta.

**Live: <https://dispar.rantai.dev>**

```
SDI + berkas Excel + pendataan lapangan
        ↓  Dagster — otomatis tiap hari 02:00
   Bronze    Iceberg @ RustFS — apa adanya, semua kolom teks, ada jejak audit
        ↓
   Silver    view ClickHouse bertipe — angka jadi angka, tanggal jadi tanggal,
             klasifikasi BPS dibersihkan
        ↓
   Gold      serving.mart_* — agregat siap pakai
        ↓
   app dispar-v2 (Next.js)  →  dispar.rantai.dev
```

Seluruhnya berjalan di **satu server milik Dinas**, memakai perangkat lunak
berlisensi terbuka (Apache 2.0/MIT). Tidak ada langganan cloud.

## Isinya sekarang

| | |
|---|---|
| Dataset di katalog | **199** (primer Satu Data Jakarta + sekunder olahan) |
| Baris data mentah | **253.543** |
| Model data bersih | **224** view Silver |
| Mart penyaji | **7** — wisman, kesiapan GCI, kuliner, kunjungan DTW, event, atlas, hotel |

*(angka per 17 September 2026, dibaca langsung dari lakehouse)*

## Peta repo

| Path | Isi |
|---|---|
| `platform-v2/` | **App yang LIVE.** Next.js 15, membaca ClickHouse. Ini yang dikerjakan sehari-hari. |
| `lakehouse/` | Mesin data: compose, ingest (Python), SQL Silver/Gold, orkestrasi Dagster. |
| `app/`, `lib/`, `components/` | App Atlas GCI — peta & dataset daya saing kota. |
| `scripts/` | Skrip pengambilan & pengayaan data (geocoding, GCI, halal, scraper). |
| `data/`, `*.tsv` | Data mentah, dataset sekunder, dan TSV deliverable untuk Dinas. |
| `buku/` | App naskah buku "Statistika Pariwisata Perkotaan". |
| `platform/` | App v1 (Postgres). **Beku** — cadangan, tidak dipakai publik. |
| `report/`, `dokumen/`, `mom/` | Laporan, paparan, notulen, KAK. |

## Mulai dari mana

```bash
git clone https://github.com/RantAI-dev/DisparDataPlatform.git
cd DisparDataPlatform/platform-v2
npm install
cp .env.example .env.local      # isi CH_* — nilainya dari pengelola
npm run dev                     # http://localhost:3032
```

| Kalau kamu… | Baca |
|---|---|
| Engineer baru di tim | **[`docs/HANDOVER.md`](docs/HANDOVER.md)** — akses, setup, runbook, utang teknis |
| Memakai Claude Code di repo ini | **[`CLAUDE.md`](CLAUDE.md)** — peta kerja, aturan, jebakan |
| Mau paham mesin datanya | [`lakehouse/README.md`](lakehouse/README.md) |
| Mau memakai datanya lewat API | <https://dispar.rantai.dev/docs> |

## Bekerja dengan Claude

Repo ini disiapkan sebagai ruang kerja bersama manusia + Claude. Tersedia agen
khusus (`data-lakehouse`, `dispar-v2-dev`, `deploy-portainer`), perintah
(`/status-infra`, `/deploy-v2`, `/refresh-data`), dan skill untuk tiga pekerjaan
utama: crawling data, menyusun laporan bulanan, dan menambah halaman di app.
Rinciannya di [`CLAUDE.md`](CLAUDE.md).

## Dua aturan yang tidak bisa ditawar

1. **Repo ini publik.** Jangan pernah commit password, API key, token, atau
   connection string berisi sandi. Nilai asli hanya hidup di Portainer stack Env.
2. **Setiap angka yang masuk laporan harus berasal dari sistem yang jalan** —
   hasil query, bukan ingatan atau perkiraan.

---

Dikerjakan untuk Dinas Pariwisata dan Ekonomi Kreatif Provinsi DKI Jakarta —
kegiatan Penyediaan dan Pengelolaan Data Statistik Pariwisata, TA 2026.
