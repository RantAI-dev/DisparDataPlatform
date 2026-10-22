"""Endpoint fitur GMTI (KONTRAK §2.5)."""

from __future__ import annotations

from typing import Annotated, Literal

from fastapi import APIRouter, Depends, Query

from data_api.shared.konteks import Konteks, ambil_konteks
from data_api.shared.paging import Halaman
from data_api.shared.respons import Amplop, sukses

from . import models, service

router = APIRouter(prefix="/gmti", tags=["gmti"])

KonteksDep = Annotated[Konteks, Depends(ambil_konteks)]
SUMBER = [f"lake.bronze_file.{t}" for t in service.TABEL]
_OPS = {"response_model_exclude_unset": True}


@router.get("/ringkasan", response_model=Amplop[models.IkhtisarGmti], **_OPS)
def ringkasan(k: KonteksDep):
    return sukses(service.ringkasan(k), k.rid, SUMBER)


@router.get("/tempat", response_model=Amplop[models.Tempat], **_OPS)
def tempat(
    k: KonteksDep,
    page: Annotated[int, Query(ge=1)] = 1,
    size: Annotated[int, Query(ge=1, le=200)] = 200,
    pilar: Literal["semua", "ibadah", "makan", "menginap", "destinasi", "program"] = "semua",
    kota: str | None = None,
    jenis: str | None = None,
    q: str | None = None,
):
    h = Halaman(page, size)
    items, facets, total = service.tempat(k, pilar, kota, jenis, q, h)
    return sukses(
        {"items": items, "facets": facets},
        k.rid,
        SUMBER,
        total=total,
        page=page,
        size=size,
        has_more=h.offset + len(items) < total,
    )
