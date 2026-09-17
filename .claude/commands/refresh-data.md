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
