"""Model respons fitur dataset (bentuk `data`; kontrak lengkap di `openapi.yaml`).

Dipasang sebagai `response_model` dengan `response_model_exclude_unset=True`, sehingga kunci yang
tidak dikirim service (mis. `mart` pada medallion non-gold) tetap tidak muncul, sama dengan Next.js.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel


class Medallion(BaseModel):
    level: str
    mart: str | None = None


class MedallionDetail(Medallion):
    table: str


class KatalogItem(BaseModel):
    id: str
    title: str
    description: str
    tags: list[str]
    tier: str
    sumber: str
    source: str
    size_label: str
    href: str
    external: bool
    medallion: Medallion | None


class KatalogStats(BaseModel):
    total: int
    tags: int
    views: int
    last_updated: str | None


class Katalog(BaseModel):
    items: list[KatalogItem]
    stats: KatalogStats
    layer_counts: dict[str, int]


class Periode(BaseModel):
    min: str
    max: str


class Detail(BaseModel):
    slug: str
    title: str
    description: str
    sumber_data: list[str]
    frekuensi: str | None
    satuan: str | None
    periode: Periode | None
    klasifikasi: str | None
    kontak: str | None
    author: str | None
    medallion: MedallionDetail | None
    total_bronze: int


class Kolom(BaseModel):
    key: str
    desc: str | None
    type: str | None


class DaftarKolom(BaseModel):
    items: list[Kolom]


class NilaiFacet(BaseModel):
    v: str
    n: int


class Facet(BaseModel):
    key: str
    kind: str
    min: str | None = None
    max: str | None = None
    values: list[NilaiFacet] | None = None


class DaftarFacet(BaseModel):
    items: list[Facet]


class Baris(BaseModel):
    # Satu baris Silver apa adanya (nama kolom dataset, nilai dari ClickHouse).
    items: list[dict[str, Any]]


class ItemAgregat(BaseModel):
    name: str
    value: int | float | None


class Agregat(BaseModel):
    items: list[ItemAgregat]
