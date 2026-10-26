"""Halaman (`page`/`size`) dengan perilaku jepit seperti Next.js (`parseInt` + batas)."""

from __future__ import annotations

import re
from dataclasses import dataclass

# Batas profil ClickHouse `app_readonly`: satu query tidak boleh mengembalikan lebih dari ini.
BATAS_BARIS_QUERY = 100_000

_AWAL_INT = re.compile(r"^\s*[+-]?\d+")


def _parse_int(s: str | None) -> int | None:
    """Padanan `parseInt(s, 10)`: angka di awal teks, sisanya diabaikan; None bila bukan angka."""
    m = _AWAL_INT.match(s or "")
    return int(m.group()) if m else None


@dataclass(frozen=True)
class Halaman:
    page: int
    size: int

    @property
    def offset(self) -> int:
        return (self.page - 1) * self.size


def halaman(page: str | None, size: str | None, bawaan: int, maks: int) -> Halaman:
    """Nilai tidak sah jatuh ke bawaan; `size` dijepit ke 1..maks, `page` minimal 1."""
    p = _parse_int(page) or 1
    s = _parse_int(size) or bawaan
    return Halaman(max(1, p), min(maks, max(1, s)))
