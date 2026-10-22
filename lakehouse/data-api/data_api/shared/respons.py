"""Amplop respons sukses SPEC §3.3: `{"data": …, "meta": {generated_at, source, request_id, …}}`."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any

# WIB tanpa DST; offset tetap supaya image tidak butuh tzdata.
WIB = timezone(timedelta(hours=7), "WIB")


def sekarang() -> str:
    return datetime.now(WIB).isoformat(timespec="seconds")


def sukses(data: Any, rid: str, source: list[str], **meta: Any) -> dict[str, Any]:
    return {"data": data, "meta": {"generated_at": sekarang(), "source": source, "request_id": rid, **meta}}
