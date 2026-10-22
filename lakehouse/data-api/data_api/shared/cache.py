"""Cache in-process dengan TTL, dikosongkan oleh `POST /v1/admin/cache/flush`.

Hanya benar dengan satu worker uvicorn (SPEC §3.3). Daftar tabel Silver/serving juga di-cache di
sini (TTL 10 menit) supaya tabel baru terbaca tanpa restart, berbeda dengan platform-v2 yang
menyimpannya selamanya (inventaris E §3).
"""

from __future__ import annotations

import threading
import time
from collections.abc import Callable
from typing import Any, TypeVar

T = TypeVar("T")


class Cache:
    def __init__(self, jam: Callable[[], float] = time.monotonic, batas: int = 10_000):
        self._isi: dict[Any, tuple[float, Any]] = {}
        # Kunci memuat input pengguna (slug), jadi ukuran dibatasi: entri basi dibuang bila penuh.
        self._batas = batas
        self._kunci = threading.Lock()
        self._jam = jam

    def ambil(self, kunci: Any, ttl: float, buat: Callable[[], T]) -> T:
        sekarang = self._jam()
        with self._kunci:
            hit = self._isi.get(kunci)
            if hit and hit[0] > sekarang:
                return hit[1]
        nilai = buat()
        with self._kunci:
            if len(self._isi) >= self._batas:
                self._isi = {k: v for k, v in self._isi.items() if v[0] > sekarang}
                if len(self._isi) >= self._batas:
                    self._isi.clear()
            self._isi[kunci] = (sekarang + ttl, nilai)
        return nilai

    def kosongkan(self) -> int:
        with self._kunci:
            n = len(self._isi)
            self._isi.clear()
        return n
