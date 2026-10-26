"""Endpoint fitur spasial (KONTRAK §2.5)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from data_api.shared.errors import NotFound
from data_api.shared.konteks import Konteks, ambil_konteks
from data_api.shared.respons import Amplop, sukses

from . import models, service

router = APIRouter(prefix="/spasial", tags=["spasial"])

KonteksDep = Annotated[Konteks, Depends(ambil_konteks)]
SUMBER = [
    "lake.bronze_file.* (atlas, seni_venue, gmti)",
    "silver.<tabel berkoordinat>",
    "serving.mart_hotel_scraped_booking",
]
_OPS = {"response_model_exclude_unset": True}


@router.get("", response_model=Amplop[models.Spasial], **_OPS)
def spasial(k: KonteksDep):
    data, per_kategori = service.spasial(k)
    return sukses(data, k.rid, SUMBER, total=len(data["points"]), per_kategori=per_kategori)


@router.get("/titik/{id}", response_model=Amplop[models.Titik], **_OPS)
def titik(k: KonteksDep, id: str):
    p = service.titik(k, id)
    if p is None:
        raise NotFound("Titik tidak ditemukan", id)
    return sukses(p, k.rid, ["sama dengan /v1/spasial"])
