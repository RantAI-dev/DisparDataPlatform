"""Aplikasi FastAPI Data API: pasang router tiap fitur, request id, log JSON, bentuk error.

Jalankan dengan `uv run data-api` (satu worker uvicorn; cache in-process hanya benar begitu).
"""

from __future__ import annotations

import json
import logging
import os
import sys
import time
import uuid
from contextlib import asynccontextmanager
from importlib.metadata import version

from fastapi import APIRouter, Depends, FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from data_api.features.beranda.router import router as beranda
from data_api.features.dashboard.router import router as dashboard
from data_api.features.dataset.router import router as dataset
from data_api.features.indikator.router import router as indikator
from data_api.shared import indikator_sumber, queries
from data_api.shared.auth import wajib_dagster, wajib_token
from data_api.shared.cache import Cache
from data_api.shared.ch import ClickHouse
from data_api.shared.errors import ApiError, InvalidParam, NotFound, Upstream
from data_api.shared.konfigurasi import Konfigurasi, muat
from data_api.shared.konteks import Konteks
from data_api.shared.respons import sukses

log = logging.getLogger("data_api")
VERSI = version("dispar-data-api")


def _log_json(**isi) -> None:
    print(json.dumps(isi, ensure_ascii=False), file=sys.stdout, flush=True)


def _error(e: ApiError, rid: str) -> JSONResponse:
    return JSONResponse(e.isi(), status_code=e.status, headers={"X-Request-Id": rid})


def buat_app(konf: Konfigurasi | None = None, ch: ClickHouse | None = None) -> FastAPI:
    konf = konf or muat()

    @asynccontextmanager
    async def lifespan(app: FastAPI):
        if konf.produksi:
            # Peringatan saja: salinan Bronze daftar indikator belum diperbarui sampai plan 06.
            k = Konteks(app.state.ch, app.state.cache, konf, "start")
            try:
                if not indikator_sumber.bronze_punya_official_no(k):
                    log.warning("bronze_file.gci_gpci_indicators belum memuat officialNo")
            except ApiError as e:
                log.warning("pemeriksaan daftar indikator gagal: %s", e.detail)
        yield
        app.state.ch.tutup()

    docs = konf.docs
    app = FastAPI(
        title="Data API Disparekraf",
        version=VERSI,
        lifespan=lifespan,
        docs_url="/docs" if docs else None,
        redoc_url="/redoc" if docs else None,
        openapi_url="/openapi.json" if docs else None,
    )
    app.state.konf = konf
    app.state.cache = Cache()
    app.state.ch = ch or ClickHouse(konf.ch_url, konf.ch_user, konf.ch_password)

    @app.middleware("http")
    async def request_id(request: Request, call_next):
        rid = (request.headers.get("x-request-id") or "")[:128] or uuid.uuid4().hex
        request.state.rid = rid
        mulai = time.perf_counter()
        respons = await call_next(request)
        respons.headers["X-Request-Id"] = rid
        # Satu baris JSON per request; token tidak pernah dicatat, hanya nama klien.
        _log_json(
            request_id=rid,
            metode=request.method,
            path=request.url.path,
            status=respons.status_code,
            durasi_ms=round((time.perf_counter() - mulai) * 1000, 1),
            baris=getattr(request.state, "baris", None),
            klien=getattr(request.state, "klien", None),
        )
        return respons

    @app.exception_handler(ApiError)
    async def api_error(request: Request, e: ApiError):
        return _error(e, request.state.rid)

    @app.exception_handler(RequestValidationError)
    async def validasi(request: Request, e: RequestValidationError):
        pertama = e.errors()[0] if e.errors() else {}
        lokasi = ".".join(str(x) for x in pertama.get("loc", ()))
        return _error(InvalidParam("Parameter tidak valid", f"{lokasi}: {pertama.get('msg', '')}"), request.state.rid)

    @app.exception_handler(StarletteHTTPException)
    async def http_error(request: Request, e: StarletteHTTPException):
        err = NotFound("Path tidak dikenal") if e.status_code == 404 else InvalidParam(str(e.detail))
        err.status = e.status_code
        return _error(err, request.state.rid)

    @app.exception_handler(Exception)
    async def tak_terduga(request: Request, e: Exception):
        # Sama dengan Next.js: kegagalan lain dilaporkan sebagai lakehouse tak terbaca (503).
        log.exception("galat tak terduga")
        return _error(Upstream("Gagal membaca dari lakehouse", type(e).__name__), request.state.rid)

    @app.get("/v1/health", tags=["sistem"])
    def health(request: Request):
        try:
            queries.ping(Konteks(app.state.ch, app.state.cache, konf, request.state.rid))
        except ApiError as e:
            return _error(e, request.state.rid)
        return {"status": "ok", "clickhouse": "ok", "versi": VERSI}

    admin = APIRouter(prefix="/v1/admin", tags=["sistem"], dependencies=[Depends(wajib_dagster)])

    @admin.post("/cache/flush")
    def flush(request: Request):
        return sukses({"dikosongkan": app.state.cache.kosongkan()}, request.state.rid, [])

    app.include_router(admin)
    for r in (dataset, beranda, dashboard, indikator):
        app.include_router(r, prefix="/v1", dependencies=[Depends(wajib_token)])
    return app


def jalankan() -> None:
    import uvicorn

    logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s %(message)s", stream=sys.stderr)
    uvicorn.run(buat_app(), host="0.0.0.0", port=int(os.environ.get("PORT", "8080")), workers=1, access_log=False)
