"""Model respons fitur spasial (bentuk `data`; kontrak lengkap di `openapi.yaml`)."""

from __future__ import annotations

from pydantic import BaseModel

Angka = int | float


class TitikRingkas(BaseModel):
    id: str
    name: str
    category: str
    city: str
    lat: Angka
    lng: Angka
    href: str
    kind: str | None
    source: str | None


class Kepadatan(BaseModel):
    total: int
    byCat: dict[str, int]


class Inventaris(BaseModel):
    slug: str
    coordinates: int


class Spasial(BaseModel):
    points: list[TitikRingkas]
    cities: list[str]
    kepadatan_berkoordinat: dict[str, Kepadatan]
    kepadatan_tanpa_koordinat: dict[str, int]
    inventory: list[Inventaris]
    failed: list[str]
    complete: bool
    catatan: str


class Titik(TitikRingkas):
    address: str
    cert: str | None
