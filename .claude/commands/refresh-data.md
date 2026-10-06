---
description: Segarkan data lakehouse (Bronze → Silver → Gold) dan pastikan dashboard ikut terbarui
---

Segarkan data Dispar. Gunakan agen `data-lakehouse`, dan `deploy-portainer`
kalau perlu menjalankan container.

Jadwal harian Dagster 02:00 biasanya sudah menanganinya — **cek dulu apakah
memang perlu manual**:

1. **Periksa kesegaran data**
   - Buka Dagster <http://192.168.18.187:13030>, lihat run terakhir job
     `refresh_lakehouse` — sukses? kapan?
   - Bandingkan dengan `bronze_meta.dataset_sync` (kolom waktu sync) dan
     `_silver_meta.rowcount_history`.
   - Kalau run terakhir sukses dan masih hari ini, **berhenti di sini** dan
     laporkan bahwa data sudah segar.

2. **Kalau memang perlu refresh** — cara termudah: trigger job
   `refresh_lakehouse` dari Dagster UI, lalu tunggu dan pantau.

3. **Kalau Dagster bermasalah**, jalankan manual. Ingat pembagiannya:
   - **Bronze WAJIB in-network** (Lakekeeper mengiklankan URL internal
     `lake-catalog:8181`, jadi pyiceberg dari luar pasti gagal) — jalankan
     container `dispar-lake-ingest-data:latest` di network
     `dispar-lakehouse_lakenet`.
   - **Silver + Gold boleh dari laptop** lewat ClickHouse HTTP `:18123`:
     ```bash
     cd lakehouse/ingest
     CH_HOST=192.168.18.187 CH_PORT=18123 CH_PASSWORD=... \
       uv run --with clickhouse-connect python -c \
       "from dispar_ingest import refresh; refresh.run_all()"
     ```

4. **Periksa hasilnya**
   - Jumlah baris masuk akal dibanding `rowcount_history`?
   - `_silver_meta.quality` — ada cek yang berubah jadi gagal?
   - `_silver_meta.karantina` — lonjakan baris gagal konversi?

5. **Segarkan halaman ISR** kalau `/gci` atau `/gpci` ikut berubah:
   ```bash
   curl -X POST https://dispar.rantai.dev/api/admin/report \
     -H "x-sync-secret: $SYNC_SECRET"
   ```

6. **Lapor** angka sebelum → sesudah, dan anomali apa pun yang muncul.

## Refresh terarah wisman

Jika permintaan hanya menyentuh `silver.wisman` dan `serving.mart_wisman`,
jangan jalankan `refresh.run_all()` atau materialisasi seluruh lakehouse.
Pastikan tidak ada run refresh aktif di Dagster sebelum menjalankan perintah.

1. Bandingkan periode terbaru SDI pada slug
   `data-jumlah-wisatawan-mancanegara-berdasarkan-kebangsaan` dengan Silver primer.
   Jika primer tertinggal, ingest **hanya slug tersebut** lewat
   `python -m dispar_ingest.run_bronze sdi --only <slug>` di network lakehouse,
   kemudian perbarui Silver primer terkait sebelum kurasi.
2. Terapkan sumber kode/SQL terbaru pada runtime ingest, lalu jalankan
   `python -m dispar_ingest.refresh wisman` dengan `CH_PASSWORD` dari Env stack
   dan `SQL_DIR` menunjuk direktori SQL repo yang terbaru.
3. Perintah memvalidasi konflik nilai, duplikasi riwayat, karantina negara,
   periode terakhir, serta jumlah baris/kunjungan Silver dan Gold.
   Data terbaru diberi pintu masuk **Tidak dirinci**; riwayat lama tetap
   Soekarno-Hatta. Sumber baru menggantikan kunci negara/bulan yang tumpang tindih.
4. Mart dibuat melalui bayangan khusus `serving.mart_wisman_refresh_baru` dan
   EXCHANGE atomik. Mart sebelumnya dipertahankan pada bayangan itu untuk
   rollback; jangan hapus atau truncate sesudah refresh tanpa pemeriksaan.

Perintah ini tidak meregenerasi dimensi, membangun ulang database `lake`,
menjalankan mart lain, atau memublikasikan seluruh Gold ke Iceberg.
