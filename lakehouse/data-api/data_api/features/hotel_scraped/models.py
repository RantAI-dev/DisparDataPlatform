"""Model respons fitur hotel-scraped (bentuk `data`; kontrak lengkap di `openapi.yaml`)."""

from __future__ import annotations

from typing import Any

from pydantic import BaseModel

Angka = int | float


class BarisHotel(BaseModel):
    hotel_id: str | None
    hotel_name: str | None
    hotel_url: str | None
    address: str | None
    city: str | None
    country: str | None
    latitude: Angka | None
    longitude: Angka | None
    distance_km: Angka | None
    star_rating: int | None
    review_score: Angka | None
    review_label: str | None
    review_count: int | None
    price_idr: int | None
    price_currency: str | None
    price_raw: str | None
    rooms_left: int | None
    total_room_types: int | None
    is_available: int | None
    room_types_json: str | None
    checkin: str | None
    checkout: str | None
    adults: int | None
    scraped_at: str | None
    source: str | None
    room_types: list[dict[str, Any]]


class Stats(BaseModel):
    total: int | None
    with_coords: int | None
    with_address: int | None
    with_rooms_left: int | None
    with_rooms: int | None
    avg_price: int | None
    min_price: int | None
    max_price: int | None
    distinct_cities: int | None
    total_room_types: int | None
    avg_room_types_per_hotel: Angka | None


class Ember(BaseModel):
    bucket: str
    count: int


class HotelScraped(BaseModel):
    rows: list[BarisHotel]
    stats: Stats
    price_histogram: list[Ember]
    last_checkin: str | None
    source: str
    note: str
