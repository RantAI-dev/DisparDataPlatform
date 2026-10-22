"""Format angka dan teks yang ikut dikirim API (label yang sekarang dibangun dari data)."""

from __future__ import annotations

import math


def angka_id(n: int) -> str:
    """Bilangan bulat dengan pemisah ribuan id-ID (`toLocaleString("id-ID")`): 2577 → `2.577`."""
    return f"{n:,}".replace(",", ".")


def angka_json(teks: str | None) -> int | float | None:
    """`Number(teks)` versi JSON: bilangan bulat tetap int, non-finit (nan/inf) → null."""
    if teks is None:
        return None
    try:
        v = float(teks)
    except ValueError:
        return None
    if not math.isfinite(v):
        return None
    return int(v) if v.is_integer() and abs(v) < 2**53 else v


def teks_sel(v: object) -> str:
    """`String(v)` JavaScript untuk sel ekspor: null → "", array digabung koma, bool huruf kecil."""
    if v is None:
        return ""
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, list):
        return ",".join(teks_sel(x) for x in v)
    if isinstance(v, float) and v.is_integer() and abs(v) < 1e21:
        return str(int(v))
    return str(v)
