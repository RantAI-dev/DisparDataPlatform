"""Endpoint fitur dataset (KONTRAK §2.1): katalog, detail, kolom, facet, baris, agregat, ekspor."""

from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Path, Query, Request
from fastapi.responses import StreamingResponse

from data_api.shared.errors import InvalidParam
from data_api.shared.filters import parse_row_query
from data_api.shared.konteks import Konteks, ambil_konteks
from data_api.shared.paging import halaman
from data_api.shared.respons import Amplop, sukses

from . import models, service

router = APIRouter(tags=["dataset"])

KonteksDep = Annotated[Konteks, Depends(ambil_konteks)]
Slug = Annotated[str, Path(pattern=r"^[a-z0-9][a-z0-9-]*$")]
F = Annotated[list[str], Query()]
SILVER = ["silver.<tabel>"]


@router.get("/katalog", response_model=Amplop[models.Katalog], response_model_exclude_unset=True)
def katalog(k: KonteksDep, tier: str = "semua", page: str | None = None, size: str | None = None):
    if tier not in ("semua", "primer", "sekunder"):
        raise InvalidParam("tier harus semua, primer, atau sekunder")
    data, total = service.katalog(k, tier, halaman(page, size, 500, 500))
    return sukses(data, k.rid, service.SUMBER_KATALOG, total=total)


@router.get("/dataset/{slug}", response_model=Amplop[models.Detail], response_model_exclude_unset=True)
def detail(k: KonteksDep, slug: Slug):
    data, total = service.detail(k, slug)
    return sukses(
        data, k.rid, ["lake.bronze_meta*.dataset_catalog", "lake.bronze_meta*.dataset_sync", *SILVER], total=total
    )


@router.get("/dataset/{slug}/kolom", response_model=Amplop[models.DaftarKolom], response_model_exclude_unset=True)
def kolom(k: KonteksDep, slug: Slug):
    return sukses({"items": service.kolom(k, slug)}, k.rid, ["lake.bronze_meta*.dataset_column", *SILVER])


@router.get("/dataset/{slug}/facet", response_model=Amplop[models.DaftarFacet], response_model_exclude_unset=True)
def facet(k: KonteksDep, slug: Slug):
    return sukses({"items": service.facet(k, slug)}, k.rid, SILVER)


@router.get("/dataset/{slug}/baris", response_model=Amplop[models.Baris], response_model_exclude_unset=True)
def baris(
    request: Request,
    k: KonteksDep,
    slug: Slug,
    page: str | None = None,
    size: str | None = None,
    sort: str | None = None,
    q: str | None = None,
    f: F = [],  # noqa: B006 — FastAPI menyalin nilai bawaan per request
):
    hal = halaman(page, size, 50, 200)
    items, total = service.baris(k, slug, hal, parse_row_query(q, f, sort))
    request.state.baris = len(items)
    return sukses(
        {"items": items},
        k.rid,
        SILVER,
        total=total,
        page=hal.page,
        size=hal.size,
        has_more=hal.offset + len(items) < total,
    )


@router.get("/dataset/{slug}/agregat", response_model=Amplop[models.Agregat], response_model_exclude_unset=True)
def agregat(
    k: KonteksDep,
    slug: Slug,
    x: str = "",
    y: str = "",
    agg: str = "",
    q: str | None = None,
    f: F = [],  # noqa: B006
):
    items = service.agregat(k, slug, parse_row_query(q, f, None), x, y, agg)
    return sukses({"items": items}, k.rid, SILVER)


@router.get("/dataset/{slug}/ekspor")
def ekspor(
    request: Request,
    k: KonteksDep,
    slug: Slug,
    format: str = "csv",
    q: str | None = None,
    sort: str | None = None,
    f: F = [],  # noqa: B006
):
    fmt = format.lower()
    if fmt not in ("csv", "xlsx"):
        raise InvalidParam("format harus csv atau xlsx")
    e = service.ekspor(k, slug, parse_row_query(q, f, sort), fmt)
    request.state.baris = e.jumlah
    return StreamingResponse(
        e.isi,
        media_type=e.media_type,
        headers={
            "Content-Disposition": f'attachment; filename="{e.nama_berkas}"',
            "Cache-Control": "no-store",
            "X-Row-Count": str(e.jumlah),
        },
    )
