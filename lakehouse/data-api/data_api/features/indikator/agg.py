"""Port `platform-v2/lib/agg.ts` + peniru perilaku JavaScript yang dipakai halaman indikator.

Baris Silver dibaca apa adanya dari ClickHouse (JSONEachRow): angka JSON, Int64 sebagai teks,
tanggal sebagai teks, NULL sebagai `None`. Kolom yang tidak ada di baris = `undefined` di JS.
"""

from __future__ import annotations

import math
import re
from typing import Any

from data_api.shared.atlas_gabungan import kunci_kolasi
from data_api.shared.format import teks_sel

Row = dict[str, Any]
Point = dict[str, Any]  # {"label": str, "value": number}

_JS_WS = "\t\n\v\f\r                  　﻿"
_NUM_LITERAL = re.compile(r"^[+-]?(\d+\.?\d*|\.\d+)(e[+-]?\d+)?$", re.IGNORECASE)


class _Undefined:
    """Penanda kunci yang tidak ada di baris (`r[k]` → undefined)."""

    def __repr__(self) -> str:
        return "undefined"


UNDEFINED = _Undefined()


def ambil(r: Row, k: str) -> Any:
    return r.get(k, UNDEFINED)


def js_string(v: Any) -> str:
    """`String(v)`."""
    if v is UNDEFINED:
        return "undefined"
    if v is None:
        return "null"
    if isinstance(v, bool):
        return "true" if v else "false"
    if isinstance(v, float):
        if math.isnan(v):
            return "NaN"
        if math.isinf(v):
            return "Infinity" if v > 0 else "-Infinity"
    return teks_sel(v)


def nullish(v: Any, ganti: str) -> str:
    """`String(v ?? ganti)`."""
    return ganti if v is None or v is UNDEFINED else js_string(v)


def js_number(v: Any) -> float:
    """`Number(v)`: null → 0, undefined → NaN, teks kosong/spasi → 0, teks tak sah → NaN."""
    if v is UNDEFINED:
        return math.nan
    if v is None or v is False:
        return 0.0
    if v is True:
        return 1.0
    if isinstance(v, (int, float)):
        return float(v)
    s = str(v).strip(_JS_WS)
    if not s:
        return 0.0
    if s in ("Infinity", "+Infinity"):
        return math.inf
    if s == "-Infinity":
        return -math.inf
    if re.fullmatch(r"0[xX][0-9a-fA-F]+", s):
        return float(int(s, 16))
    if _NUM_LITERAL.match(s):
        return float(s)
    return math.nan


def truthy(v: Any) -> bool:
    if v is UNDEFINED or v is None:
        return False
    if isinstance(v, float) and math.isnan(v):
        return False
    return bool(v)


def id_num(v: Any) -> float | None:
    """`idNum`: "51,85"→51.85, "1.234.567"→1234567, "3645837"→3645837."""
    s = nullish(v, "").strip(_JS_WS)
    if not s:
        return None
    if "," in s and not re.search(r"\.[0-9]", s):
        s = s.replace(".", "").replace(",", ".", 1)
    else:
        s = s.replace(",", "")
    n = js_number(re.sub(r"[^0-9.-]", "", s))
    return n if math.isfinite(n) else None


def group_sum(rows: list[Row], group_key: str, value_key: str) -> list[Point]:
    m: dict[str, float] = {}
    for r in rows:
        k = nullish(ambil(r, group_key), "—")
        m[k] = m.get(k, 0.0) + (id_num(ambil(r, value_key)) or 0.0)
    return [{"label": k, "value": v} for k, v in m.items()]


def group_count(rows: list[Row], group_key: str) -> list[Point]:
    m: dict[str, float] = {}
    for r in rows:
        k = nullish(ambil(r, group_key), "—")
        m[k] = m.get(k, 0.0) + 1
    return [{"label": k, "value": v} for k, v in m.items()]


def urut_label(arr: list[Point]) -> list[Point]:
    """`sort((a, b) => a.label.localeCompare(b.label))` (stabil)."""
    return sorted(arr, key=lambda p: kunci_kolasi(p["label"]))


def by_period(rows: list[Row], period_key: str, value_key: str | None = None) -> list[Point]:
    agg = group_sum(rows, period_key, value_key) if value_key else group_count(rows, period_key)
    return urut_label(agg)


def urut_nilai(arr: list[Point]) -> list[Point]:
    """`sort((a, b) => b.value - a.value)` (stabil)."""
    return sorted(arr, key=lambda p: -p["value"])


def top_n(arr: list[Point], n: int = 10) -> list[Point]:
    return urut_nilai(arr)[:n]


def total(arr: list[Point]) -> float:
    s = 0.0
    for x in arr:
        s += x["value"]
    return s


def _kunci_set(v: Any) -> Any:
    """Kesetaraan SameValueZero `Set` JS: angka dibandingkan sebagai Number, objek per identitas."""
    if v is UNDEFINED or v is None:
        return (repr(v),)
    if isinstance(v, bool):
        return ("bool", v)
    if isinstance(v, (int, float)):
        return ("num", float(v))
    if isinstance(v, str):
        return ("str", v)
    return ("obj", id(v))


def distinct(rows: list[Row], k: str) -> int:
    """`new Set(rows.map((r) => r[k])).size`."""
    return len({_kunci_set(ambil(r, k)) for r in rows})
