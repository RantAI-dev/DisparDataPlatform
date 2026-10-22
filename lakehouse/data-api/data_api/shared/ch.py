"""Klien ClickHouse: HTTP polos (httpx) + `FORMAT JSONEachRow`.

`clickhouse-connect` tidak dipakai: di bawah profil `app_readonly` ia gagal saat inisialisasi
karena membaca `system.*` (error 719, dibuktikan di plan 02 langkah 0). Aturan SPEC §3.3:
- tidak ada setting sesi apa pun (readonly=1 menolaknya);
- request id ditulis sebagai komentar SQL `/* rid=... */`, bukan `log_comment`;
- nilai input selalu parameter terikat sisi server (`{nama:Tipe}` + `param_nama`).
"""

from __future__ import annotations

import json
import re
from typing import Any

import httpx

from .errors import Upstream

_RID = re.compile(r"^[A-Za-z0-9._-]{1,64}$")


# ClickHouse membaca nilai parameter dalam format "escaped"; sama dengan `formatQueryParams`
# @clickhouse/client yang dipakai Next.js.
_ESCAPE = str.maketrans({"\t": "\\t", "\n": "\\n", "\r": "\\r", "'": "\\'", "\\": "\\\\"})


def _nilai_param(v: Any) -> str:
    """Nilai parameter dalam format teks ClickHouse (array: `['a','b']`)."""
    if isinstance(v, (list, tuple)):
        return "[" + ",".join(_literal(x) for x in v) + "]"
    if isinstance(v, bool):
        return "1" if v else "0"
    if isinstance(v, str):
        return v.translate(_ESCAPE)
    return str(v)


def _literal(v: Any) -> str:
    return f"'{_nilai_param(v)}'" if isinstance(v, str) else _nilai_param(v)


def rid_aman(rid: str | None) -> str | None:
    """Request id hanya masuk komentar SQL bila polanya aman (tidak bisa menutup komentar)."""
    return rid if rid and _RID.match(rid) else None


class ClickHouse:
    def __init__(
        self,
        url: str,
        user: str,
        password: str,
        timeout: float = 30.0,
        coba_ulang: int = 1,
        transport: httpx.BaseTransport | None = None,
    ):
        self._coba_ulang = coba_ulang
        self._url = url.rstrip("/") + "/"
        self._klien = httpx.Client(auth=(user, password), timeout=timeout, transport=transport)

    def _kirim(self, sql: str, params: dict[str, Any] | None, rid: str | None) -> httpx.Response:
        rid = rid_aman(rid)
        teks = (f"/* rid={rid} */ " if rid else "") + sql.strip() + "\nFORMAT JSONEachRow"
        qp = {f"param_{k}": _nilai_param(v) for k, v in (params or {}).items()}
        req = self._klien.build_request("POST", self._url, params=qp, content=teks.encode())
        for sisa in range(self._coba_ulang, -1, -1):
            try:
                res = self._klien.send(req)
                break
            except httpx.TransportError as e:
                # Server sesekali macet di luar batas waktunya sendiri; semua query hanya baca, jadi
                # aman diulang sekali untuk timeout/gangguan koneksi.
                if sisa == 0:
                    raise Upstream("Lakehouse tidak dapat dibaca", type(e).__name__) from e
        if res.status_code != 200:
            isi = res.text.strip()
            raise Upstream("Lakehouse tidak dapat dibaca", isi.splitlines()[0][:300] if isi else str(res.status_code))
        return res

    def query(self, sql: str, params: dict[str, Any] | None = None, rid: str | None = None) -> list[dict[str, Any]]:
        res = self._kirim(sql, params, rid)
        return [json.loads(baris) for baris in res.text.splitlines() if baris]

    def tutup(self) -> None:
        self._klien.close()
