---
description: Cek kesehatan seluruh platform Dispar — stack, container, endpoint, kesegaran data
---

Laporkan kondisi Platform Data Dispar apa adanya. **Hanya baca — jangan ubah apa pun.**

Periksa dan rangkum:

1. **Stack** — `StackList`, khususnya id `1` (`dispar-platform`) dan `6`
   (`dispar-lakehouse`). Catat status dan commit git yang sedang jalan.

2. **Container** — `docker_proxy` `/containers/json` dengan
   `query_params={"all":"true","filters":"{\"name\":[\"dispar\"]}"}`, lalu ulangi
   untuk `lake`. (Tanpa filter keluarannya terpotong.) Yang harus hidup:
   `dispar-v2`, `dispar-cloudflared`, `dispar-db`, `lake-rustfs`, `lake-catalog`,
   `lake-clickhouse`, `lake-meta`, `lake-dagster`.

3. **Endpoint benar-benar menjawab**
   ```bash
   curl -s -o /dev/null -w "app v2 (13032): %{http_code}\n" http://192.168.18.187:13032/
   curl -s -o /dev/null -w "publik:         %{http_code}\n" https://dispar.rantai.dev/
   curl -s -o /dev/null -w "dagster:        %{http_code}\n" http://192.168.18.187:13030/
   curl -s -o /dev/null -w "clickhouse:     %{http_code}\n" http://192.168.18.187:18123/ping
   ```

4. **Kesegaran data** — run terakhir Dagster, dan waktu sync terakhir di
   `bronze_meta.dataset_sync`.

5. **Sumber daya** — `systemInfo` untuk sisa RAM/disk host (pernah kena ENOSPC).

Sajikan sebagai tabel ringkas dengan status per komponen. Sebutkan dengan jelas
apa yang **tidak** bisa kamu verifikasi, jangan diam-diam diasumsikan sehat.
