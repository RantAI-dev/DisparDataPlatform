"""Kosongkan cache Data API setelah lakehouse diperbarui (plan 06 bagian A).

Data API (`dispar-data-api`) meng-cache jawaban di memori. Setelah `refresh_lakehouse` menulis data
baru, cache itu dikosongkan lewat `POST /v1/admin/cache/flush` dengan token klien `dagster`
(satu-satunya token yang boleh memanggil rute admin).

Langkah ini tidak pernah menggagalkan job: env `DATA_API_FLUSH_TOKEN` kosong → dilewati; Data API
tidak bisa dihubungi atau menolak → dicatat, lalu job tetap sukses. Cache Data API juga habis
sendiri sesuai TTL-nya.
"""

from __future__ import annotations

import os
import urllib.error
import urllib.request

URL_BAWAAN = "http://dispar-data-api:8080/v1/admin/cache/flush"


def flush_cache() -> str:
    """Panggil flush cache Data API. Return ringkasan satu baris untuk log Dagster."""
    token = os.environ.get("DATA_API_FLUSH_TOKEN", "").strip()
    if not token:
        return "dilewati: DATA_API_FLUSH_TOKEN kosong"
    url = os.environ.get("DATA_API_FLUSH_URL", "").strip() or URL_BAWAAN
    req = urllib.request.Request(url, data=b"", method="POST", headers={"Authorization": f"Bearer {token}"})
    try:
        with urllib.request.urlopen(req, timeout=15) as r:
            return f"sukses: HTTP {r.status} {r.read(200).decode('utf-8', 'replace')}"
    except urllib.error.HTTPError as e:
        return f"gagal: HTTP {e.code} {e.read(200).decode('utf-8', 'replace')}"
    except (urllib.error.URLError, OSError) as e:
        return f"gagal: {e}"
