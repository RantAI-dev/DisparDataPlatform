"""Autentikasi Bearer: token disimpan sebagai hash SHA-256 di env `DATA_API_TOKENS` (`nama:hash`).

Token mentah tidak pernah disimpan atau dicatat; yang dicatat hanya nama klien.
"""

from __future__ import annotations

import hashlib
import hmac

from fastapi import Request

from .errors import Unauthorized


def nama_klien(authorization: str | None, token: dict[str, str]) -> str:
    """Kembalikan nama klien pemilik token, atau lempar 401."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise Unauthorized("Token tidak ada atau tidak dikenal")
    hash_ = hashlib.sha256(authorization[7:].strip().encode()).hexdigest()
    cocok = None
    for nama, simpanan in token.items():
        # bandingkan semua (waktu konstan per entri) supaya urutan daftar tidak bocor lewat waktu
        if hmac.compare_digest(hash_, simpanan):
            cocok = nama
    if cocok is None:
        raise Unauthorized("Token tidak ada atau tidak dikenal")
    return cocok


def wajib_token(request: Request) -> str:
    """Dependensi FastAPI: semua endpoint kecuali `/v1/health`."""
    nama = nama_klien(request.headers.get("authorization"), request.app.state.konf.token)
    request.state.klien = nama
    return nama


def wajib_dagster(request: Request) -> None:
    """`POST /v1/admin/cache/flush` hanya untuk token bernama `dagster`."""
    if wajib_token(request) != "dagster":
        raise Unauthorized("Hanya token dagster yang boleh mengosongkan cache")
