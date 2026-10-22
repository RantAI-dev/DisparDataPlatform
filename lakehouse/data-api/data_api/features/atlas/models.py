"""Model respons fitur atlas (bentuk `data`; kontrak lengkap di `openapi.yaml`).

Angka memakai `int | float` supaya bilangan bulat tetap tercetak tanpa ".0", sama dengan `JSON.stringify`.
"""

from __future__ import annotations

from pydantic import BaseModel

Angka = int | float


class Tautan(BaseModel):
    label: str
    url: str


class RestoranGciItem(BaseModel):
    id: str
    name: str
    cuisine: str
    area: str
    address: str | None
    address_display: str
    city: str
    hotel: str | None
    tier: str
    source: str
    lat: Angka | None
    lng: Angka | None
    rating: Angka | None
    review_count: int | None
    rating_source: str | None
    place_id: str | None
    price_level: str | None
    price_source: str | None
    needs_verify: bool
    maps_url: str


class StatsGci(BaseModel):
    total: int
    rated: int
    hotel: int
    cafe: int
    restoran: int


class RestoranGci(BaseModel):
    items: list[RestoranGciItem]
    stats: StatsGci
    curated: int
    tiers: list[str]
    cities: list[str]


class DirektoriItem(BaseModel):
    id: str
    name: str
    cuisine: str
    category: str
    area: str
    city: str
    address: str | None
    price_range: str | None
    price_note: str | None
    rating: Angka | None
    review_count: int | None
    rating_source: str | None
    highlights: list[str]
    description: str | None
    sources: list[Tautan]
    source: str
    lat: Angka | None
    lng: Angka | None
    osm_id: str | None
    phone: str | None
    website: str | None
    maps_url: str
    embed_url: str


class StatsDirektori(BaseModel):
    total: int
    cuisines: int
    rated: int
    avg_rating: Angka


class DirektoriRestoran(BaseModel):
    items: list[DirektoriItem]
    stats: StatsDirektori
    cities: list[str]
    cuisines: list[str]


class Event(BaseModel):
    id: str
    organizer: str
    name: str
    date: str
    date_sort: int
    venue: str
    type: str
    visitors: str
    visitors_needs_verify: bool
    note: str
    category: str
    source: str | None


class StatsEvent(BaseModel):
    total: int
    konser: int
    festival: int
    budaya: int


class Pertunjukan(BaseModel):
    items: list[Event]
    stats: StatsEvent
    categories: list[str]


class GolfItem(BaseModel):
    id: str
    name: str
    kind: str
    holes: int | None
    par: int | None
    designer: str | None
    established: int | None
    membership: str | None
    city: str
    area: str
    address: str | None
    lat: Angka
    lng: Angka
    website: str | None
    description: str | None
    highlights: list[str]
    sources: list[Tautan]
    maps_url: str


class StatsGolf(BaseModel):
    total: int
    courses: int
    ranges: int
    total_holes: int


class Golf(BaseModel):
    items: list[GolfItem]
    stats: StatsGolf


class SuvenirItem(BaseModel):
    id: str
    name: str
    category: str
    relevance: str
    product: str | None
    address: str | None
    city: str | None
    district: str | None
    lat: Angka | None
    lng: Angka | None
    coord_source: str | None
    phone: str | None
    rating: Angka | None
    reviews: int | None
    status: str | None
    note: str | None
    url: str | None
    maps_url: str
    embed_url: str


class StatsSuvenir(BaseModel):
    total: int
    ya: int
    sebagian: int
    tidak: int
    belum_pasti: int
    avg_rating: Angka
    geo: int


class Suvenir(BaseModel):
    items: list[SuvenirItem]
    stats: StatsSuvenir
    products: list[str]
    cities: list[str]


class KpiHotel(BaseModel):
    hotels: int
    rooms: int
    occupancy_latest: Angka
    occupancy_period: str | None
    los_latest: Angka
    los_period: str | None


class Seri(BaseModel):
    name: str
    data: list[Angka | None]


class Grafik(BaseModel):
    periods: list[str]
    series: list[Seri]


class HotelRegistri(BaseModel):
    nama: str
    jenis_usaha: str
    golongan: str
    kamar: int
    alamat: str
    wilayah: str
    periode: str


class FilterHotel(BaseModel):
    wilayah: list[str]
    golongan: list[str]


class Hotel(BaseModel):
    built: str
    registry_period: str
    sources: list[str]
    kpi: KpiHotel
    tpk_chart: Grafik
    los_chart: Grafik
    registry: list[HotelRegistri]
    filters: FilterHotel
