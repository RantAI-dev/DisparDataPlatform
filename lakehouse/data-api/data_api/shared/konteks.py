"""Konteks per request untuk fitur: klien ClickHouse, cache, konfigurasi, dan request id."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from fastapi import Request

from .cache import Cache
from .ch import ClickHouse
from .konfigurasi import Konfigurasi


@dataclass
class Konteks:
    ch: ClickHouse
    cache: Cache
    konf: Konfigurasi
    rid: str

    def q(self, sql: str, params: dict[str, Any] | None = None) -> list[dict[str, Any]]:
        return self.ch.query(sql, params, self.rid)


def ambil_konteks(request: Request) -> Konteks:
    s = request.app.state
    return Konteks(s.ch, s.cache, s.konf, request.state.rid)
