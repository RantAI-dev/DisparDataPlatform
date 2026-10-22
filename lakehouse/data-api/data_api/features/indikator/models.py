"""Model respons fitur indikator (bentuk `data`; kontrak lengkap di `openapi.yaml`).

Halaman pariwisata mencerminkan struktur halaman Next.js (`kartu`, `komponen`), jadi isinya dibiarkan
fleksibel (`dict`); nilai persisnya dijaga uji panggung terhadap golden.
"""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel

Angka = int | float


class Ringkas(BaseModel):
    label: str
    value: str


class DatasetIndikator(BaseModel):
    slug: str
    title: str
    total: int


class Terbaru(BaseModel):
    label: str
    value: Angka
    datasetSlug: str


class BarisIndikator(BaseModel):
    no: int | None
    code: str
    framework: str
    dimension: str
    group: str | None
    name: str
    status: str
    data_available: bool
    owner: str | None
    note: str | None
    datasets: list[DatasetIndikator]
    latest: Terbaru | None


class DaftarIndikator(BaseModel):
    framework: str
    summary: list[Ringkas]
    rows: list[BarisIndikator]
    gaps: list[str]


class Sumber(BaseModel):
    slug: str
    title: str
    tier: str


class KpiStat(BaseModel):
    label: str
    value: str | Angka
    sub: str | None


class Blok(BaseModel):
    type: str
    title: str
    layout: str
    data: Any


class DetailIndikator(BaseModel):
    code: str
    sources: list[Sumber]
    source_text: str | None
    kpis: list[KpiStat]
    blocks: list[Blok]
    teks_fallback: list[str] | None


class Peringkat(BaseModel):
    y2024: int
    y2025: int


class SumberRanking(BaseModel):
    label: str
    url: str


class Ranking(BaseModel):
    cultural: Peringkat
    overall: Peringkat
    sumber: SumberRanking
    catatan: str


class KartuResmi(BaseModel):
    label: str
    nilai: str
    satuan: str
    tahun: str
    sumber: str
    catatan: str | None
    href: str | None


class GciResmi(BaseModel):
    ranking: Ranking
    kartu: list[KartuResmi]


class ItemTematik(BaseModel):
    no: str
    title: str
    href: str
    total: int | None


class DatasetTematik(BaseModel):
    items: list[ItemTematik]


class KpiHalaman(BaseModel):
    label: str
    value: str | Angka
    sub: str | None
    delta: float | None = None


class Kartu(BaseModel):
    judul: str
    sub: str | None
    komponen: str
    data: dict[str, Any]


class Raw(BaseModel):
    slug: str
    title: str
    count: int


class Tabel(BaseModel):
    header: list[str]
    rows: list[list[str]]


class HalamanPariwisata(BaseModel):
    shell: dict[str, str]
    kpis: list[KpiHalaman]
    kartu: list[Kartu]
    raw: list[Raw]
    komponen: dict[str, Any]
    tabel: list[Tabel]
