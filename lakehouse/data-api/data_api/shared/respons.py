"""Amplop respons sukses SPEC §3.3: `{"data": …, "meta": {generated_at, source, request_id, …}}`."""

from __future__ import annotations

import math
from datetime import datetime, timedelta, timezone
from typing import Any

from pydantic import BaseModel, ConfigDict

# WIB tanpa DST; offset tetap supaya image tidak butuh tzdata.
WIB = timezone(timedelta(hours=7), "WIB")


def sekarang() -> str:
    return datetime.now(WIB).isoformat(timespec="seconds")


def sukses(data: Any, rid: str, source: list[str], **meta: Any) -> dict[str, Any]:
    return {"data": data, "meta": {"generated_at": sekarang(), "source": source, "request_id": rid, **meta}}


class Meta(BaseModel):
    """`meta` SPEC §3.3; kunci tambahan per endpoint (total, page, size, has_more, …) ikut diteruskan."""

    model_config = ConfigDict(extra="allow")

    generated_at: str
    source: list[str]
    request_id: str


class Amplop[T](BaseModel):
    """`response_model` router: `data` divalidasi dengan model fitur (`features/<fitur>/models.py`)."""

    data: T
    meta: Meta


def angka_js(v: Any) -> Any:
    """Angka seperti `JSON.stringify`: float bulat → bilangan bulat, NaN/±Infinity → null."""
    if isinstance(v, float):
        if not math.isfinite(v):
            return None
        return int(v) if v.is_integer() and abs(v) < 2**53 else v
    if isinstance(v, list):
        return [angka_js(x) for x in v]
    if isinstance(v, tuple):
        return tuple(angka_js(x) for x in v)
    if isinstance(v, dict):
        return {kk: angka_js(x) for kk, x in v.items()}
    return v
