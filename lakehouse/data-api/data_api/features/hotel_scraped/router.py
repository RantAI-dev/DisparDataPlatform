"""Endpoint fitur hotel-scraped (KONTRAK §2.5)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from data_api.shared.konteks import Konteks, ambil_konteks
from data_api.shared.respons import Amplop, sukses

from . import models, service

router = APIRouter(tags=["hotel-scraped"])

KonteksDep = Annotated[Konteks, Depends(ambil_konteks)]


@router.get("/hotel-scraped", response_model=Amplop[models.HotelScraped], response_model_exclude_unset=True)
def hotel_scraped(k: KonteksDep, limit: Annotated[int, Query(ge=1, le=500)] = 100):
    data = service.hotel_scraped(k, limit)
    return sukses(data, k.rid, [f"lake.bronze_file.{service.TABEL}"], total=len(data["rows"]))
