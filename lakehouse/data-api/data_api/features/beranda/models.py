"""Model respons fitur beranda (bentuk `data`; kontrak lengkap di `openapi.yaml`)."""

from __future__ import annotations

from pydantic import BaseModel


class Indikator(BaseModel):
    gci: int
    gpci: int
    total: int


class Ringkasan(BaseModel):
    dataset_primer: int
    dataset_sekunder: int
    baris_sekunder: int
    indikator: Indikator
    indeks_global: int
