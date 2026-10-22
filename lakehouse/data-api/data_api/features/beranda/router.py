"""Endpoint fitur beranda (KONTRAK §2.6)."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends

from data_api.shared.konteks import Konteks, ambil_konteks
from data_api.shared.respons import Amplop, sukses

from . import models, service

router = APIRouter(tags=["beranda"])


@router.get("/beranda/ringkasan", response_model=Amplop[models.Ringkasan], response_model_exclude_unset=True)
def ringkasan(k: Annotated[Konteks, Depends(ambil_konteks)]):
    data = k.cache.ambil(("beranda", "ringkasan"), k.konf.cache_ttl_default, lambda: service.ringkasan(k))
    return sukses(data, k.rid, service.SUMBER)
