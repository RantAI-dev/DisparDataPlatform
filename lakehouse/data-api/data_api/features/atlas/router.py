"""Endpoint fitur atlas (KONTRAK §2.4): enam subhalaman statis dari `lake.bronze_file.*`."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from data_api.shared.konteks import Konteks, ambil_konteks
from data_api.shared.respons import Amplop, sukses

from . import models, service

router = APIRouter(prefix="/atlas", tags=["atlas"])

KonteksDep = Annotated[Konteks, Depends(ambil_konteks)]
_OPS = {"response_model_exclude_unset": True}


def _sumber(*tabel: str) -> list[str]:
    return [f"lake.bronze_file.{t}" for t in tabel]


def _jawab(k: Konteks, data: dict, total: int, sumber: list[str]) -> dict:
    return sukses(data, k.rid, sumber, total=total)


@router.get("/restoran-gci", response_model=Amplop[models.RestoranGci], **_OPS)
def restoran_gci(k: KonteksDep):
    data = service.restoran_gci(k)
    return _jawab(k, data, len(data["items"]), _sumber(*service.GCI))


@router.get("/direktori-restoran", response_model=Amplop[models.DirektoriRestoran], **_OPS)
def direktori_restoran(k: KonteksDep):
    data = service.direktori_restoran(k)
    return _jawab(k, data, len(data["items"]), _sumber(*service.DIREKTORI))


@router.get("/pertunjukan", response_model=Amplop[models.Pertunjukan], **_OPS)
def pertunjukan(k: KonteksDep, tahun: Annotated[str | None, Query(pattern=r"^20[0-9]{2}$")] = None):
    data = service.pertunjukan(k, tahun)
    return _jawab(k, data, len(data["items"]), _sumber("event_pertunjukan"))


@router.get("/golf", response_model=Amplop[models.Golf], **_OPS)
def golf(k: KonteksDep):
    data = service.golf(k)
    return _jawab(k, data, len(data["items"]), _sumber("golf"))


@router.get("/suvenir", response_model=Amplop[models.Suvenir], **_OPS)
def suvenir(k: KonteksDep):
    data = service.suvenir(k)
    return _jawab(k, data, len(data["items"]), _sumber("souvenir"))


@router.get("/hotel", response_model=Amplop[models.Hotel], **_OPS)
def hotel(k: KonteksDep):
    data = service.hotel(k)
    return _jawab(k, data, len(data["registry"]), _sumber(*service.HOTEL))
