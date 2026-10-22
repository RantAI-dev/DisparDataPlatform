"""Konfigurasi dari environment. Dibaca sekali saat start; nilai rahasia tidak pernah dicatat."""

from __future__ import annotations

import os
from dataclasses import dataclass


class KonfigurasiError(RuntimeError):
    """Konfigurasi tidak sah; aplikasi menolak start."""


@dataclass(frozen=True)
class Konfigurasi:
    ch_url: str
    ch_user: str
    ch_password: str
    # nama klien → hash SHA-256 token (hex)
    token: dict[str, str]
    cache_ttl_default: int
    export_max_rows: int
    docs: bool
    produksi: bool
    indikator_berkas: str | None


def _token(mentah: str) -> dict[str, str]:
    hasil: dict[str, str] = {}
    for bagian in mentah.split(","):
        bagian = bagian.strip()
        if not bagian:
            continue
        nama, _, hash_ = bagian.partition(":")
        if not nama or len(hash_) != 64:
            raise KonfigurasiError("DATA_API_TOKENS harus berupa daftar `nama:sha256hex` dipisah koma")
        hasil[nama] = hash_.lower()
    return hasil


def muat(env: dict[str, str] | None = None) -> Konfigurasi:
    e = dict(os.environ) if env is None else env
    token = _token(e.get("DATA_API_TOKENS", ""))
    if not token:
        # SPEC §3.3: tanpa token aplikasi menolak start.
        raise KonfigurasiError("DATA_API_TOKENS kosong; Data API menolak start tanpa token")
    produksi = e.get("DATA_API_ENV", "") == "produksi"
    indikator_berkas = e.get("INDIKATOR_BERKAS") or None
    if produksi and indikator_berkas:
        raise KonfigurasiError("INDIKATOR_BERKAS hanya untuk panggung; ditolak bila DATA_API_ENV=produksi")
    return Konfigurasi(
        ch_url=e.get("CH_URL", "http://localhost:8123").rstrip("/"),
        ch_user=e.get("CH_USER", "dispar_app"),
        ch_password=e.get("CH_PASSWORD", ""),
        token=token,
        cache_ttl_default=int(e.get("CACHE_TTL_DEFAULT", "300")),
        export_max_rows=int(e.get("EXPORT_MAX_ROWS", "100000")),
        docs=e.get("DATA_API_DOCS") == "1",
        produksi=produksi,
        indikator_berkas=indikator_berkas,
    )
