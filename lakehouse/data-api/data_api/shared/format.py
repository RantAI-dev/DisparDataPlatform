"""Format angka dan teks yang ikut dikirim API (label yang sekarang dibangun dari data)."""

from __future__ import annotations

import math
from decimal import ROUND_HALF_UP, Decimal


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


def lokal_id(v: float, min_desimal: int = 0, maks_desimal: int = 3) -> str:
    """`v.toLocaleString("id-ID", {minimumFractionDigits, maximumFractionDigits})`.

    Bawaan JS: 0–3 desimal. Pembulatan "halfExpand" Intl (setengah menjauhi nol) atas representasi
    desimal terpendek bilangan (sama dengan `repr` Python), pemisah ribuan `.`, desimal `,`.
    """
    d = Decimal(repr(v)) if isinstance(v, float) else Decimal(v)
    d = d.quantize(Decimal(1).scaleb(-maks_desimal), rounding=ROUND_HALF_UP)
    tanda = "-" if d.is_signed() else ""
    bulat, _, pecahan = f"{abs(d):f}".partition(".")
    pecahan = pecahan.rstrip("0").ljust(min_desimal, "0")
    teks = f"{int(bulat):,}".replace(",", ".")
    return tanda + teks + ("," + pecahan if pecahan else "")


def id_num(v: float, d: int = 0) -> str:
    """`idNum` platform-v2 (`components/dashboard/Kit.tsx`): tepat `d` desimal."""
    return lokal_id(v, d, d)


def js_round(x: float) -> float:
    """`Math.round`: setengah dibulatkan ke atas (+∞), bukan ke genap seperti `round` Python."""
    return float(math.floor(x + 0.5))


def to_fixed(x: float, d: int) -> str:
    """`Number.prototype.toFixed(d)`: nilai biner persis, seri dibulatkan menjauhi nol; x < 0 → "-" + …"""
    if x < 0:
        return "-" + to_fixed(-x, d)
    return f"{Decimal(abs(x)).quantize(Decimal(1).scaleb(-d), rounding=ROUND_HALF_UP):f}"
