"""Model respons fitur GMTI (bentuk `data`; kontrak lengkap di `openapi.yaml`)."""

from __future__ import annotations

from pydantic import BaseModel

Angka = int | float


class MetaGmti(BaseModel):
    source: str
    source_url: str
    fetched_at: str
    ibadah_total: int
    masjid: int
    mushalla: int
    ibadah_non_signature: int
    ibadah_signature: int
    ibadah_berkoordinat: int
    halal_total: int
    halal_berkoordinat: int
    kecamatan: int
    kecamatan_tanpa_poligon: list[str]
    tanpa_kecamatan: int


class Pilar(BaseModel):
    id: str
    label: str
    desc: str
    color: str


class Kecamatan(BaseModel):
    kecamatan: str
    kota: str
    geo_key: str
    masjid: int
    mushalla: int
    total: int


class Tipologi(BaseModel):
    tipologi: str
    jenis: str
    count: int


class Capaian(BaseModel):
    nama: str
    pemberi: str | None
    tahun: str | None
    tingkat: str | None
    deskripsi: str | None


class IkhtisarGmti(BaseModel):
    meta: MetaGmti
    pillars: list[Pilar]
    kecamatan: list[Kecamatan]
    tipologi: list[Tipologi]
    capaian: list[Capaian]
    award: Capaian | None


class TempatItem(BaseModel):
    id: str
    name: str
    pillar: str
    kind: str
    dataset: str
    href: str | None
    address: str | None
    city: str | None
    district: str | None
    lat: Angka | None
    lon: Angka | None
    cert: str | None
    note: str | None
    maps_url: str


class Facets(BaseModel):
    kota: list[str]
    jenis: list[str]


class Tempat(BaseModel):
    items: list[TempatItem]
    facets: Facets
