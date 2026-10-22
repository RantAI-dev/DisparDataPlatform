"""Endpoint fitur dashboard (KONTRAK §2.2)."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends, Query

from data_api.shared.konteks import Konteks, ambil_konteks
from data_api.shared.respons import sukses

from . import service
from .service import Muat

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

KonteksDep = Annotated[Konteks, Depends(ambil_konteks)]
MART_WISMAN = "serving.mart_wisman"
LOS = (
    "silver.data_rata_rata_lama_menginap_wisatawan_mancanegara_dan_wisatawan_nusantara"
    "_pada_hotel_berbintang_di_provinsi_dki_jakarta"
)
WISNUS = "silver.wisnus_perjalanan_per_kota_tujuan"
PDRB_MAKRO = ["lake.bronze_file.pdrb_ekraf_makro", "lake.bronze_file.target_kontribusi_ekraf_rpjmd"]
PDRB_SUB = ["lake.bronze_file.pdrb_ekraf_subsektor"]


def _js(v: Any) -> Any:
    """Angka bulat bertipe float ditulis sebagai bilangan bulat, seperti `JSON.stringify`."""
    if isinstance(v, float) and v.is_integer() and abs(v) < 2**53:
        return int(v)
    if isinstance(v, list):
        return [_js(x) for x in v]
    if isinstance(v, dict):
        return {kk: _js(x) for kk, x in v.items()}
    return v


def _jawab(k: Konteks, m: Muat, data: Any, source: list[str]) -> dict[str, Any]:
    # Q21: query yang gagal → data kosong + peringatan, bukan 5xx.
    extra = {"peringatan": m.peringatan} if m.peringatan else {}
    return sukses(_js(data), k.rid, source, **extra)


@router.get("/ringkasan")
def ringkasan(k: KonteksDep):
    m = Muat(k)
    sumber = [MART_WISMAN, "lake.bronze_file.target_wisman", *PDRB_MAKRO]
    return _jawab(k, m, service.ringkasan(m), sumber)


@router.get("/wisman/tahunan")
def wisman_tahunan(k: KonteksDep):
    m = Muat(k)
    return _jawab(k, m, service.wisman_tahunan(m), [MART_WISMAN, "lake.bronze_file.target_wisman"])


@router.get("/wisman/bulanan")
def wisman_bulanan(k: KonteksDep, periode: str | None = None):
    m = Muat(k)
    return _jawab(k, m, service.wisman_bulanan(m, periode), [MART_WISMAN, LOS])


@router.get("/wisman/kebangsaan")
def wisman_kebangsaan(
    k: KonteksDep, tahun: str | None = None, periode: str | None = None, top: Annotated[int, Query(ge=1, le=50)] = 8
):
    m = Muat(k)
    return _jawab(k, m, service.wisman_kebangsaan(m, tahun, periode, top), [MART_WISMAN])


@router.get("/wisman/pintu-masuk")
def wisman_pintu_masuk(k: KonteksDep, tahun: str | None = None, periode: str | None = None):
    m = Muat(k)
    sumber = [MART_WISMAN, "silver.jumlah_wisatawan", "silver.wisman_per_pintu_masuk_bulanan_bps"]
    return _jawab(k, m, service.wisman_pintu_masuk(m, tahun, periode), sumber)


@router.get("/lama-menginap/rata-rata")
def lama_menginap_rata_rata(k: KonteksDep):
    m = Muat(k)
    return _jawab(k, m, service.lama_menginap_rata_rata(m), [LOS])


@router.get("/lama-menginap/per-kelas")
def lama_menginap_per_kelas(k: KonteksDep, tamu: str, periode: str | None = None):
    m = Muat(k)
    return _jawab(k, m, service.lama_menginap_per_kelas(m, tamu, periode), [LOS])


@router.get("/lama-menginap/seri")
def lama_menginap_seri(k: KonteksDep, tamu: str):
    m = Muat(k)
    return _jawab(k, m, service.lama_menginap_seri(m, tamu), [LOS])


@router.get("/wisnus/meta")
def wisnus_meta(k: KonteksDep):
    m = Muat(k)
    return _jawab(k, m, service.wisnus_meta(m), [WISNUS])


@router.get("/wisnus/tahunan")
def wisnus_tahunan(k: KonteksDep, kota: str | None = None):
    m = Muat(k)
    return _jawab(k, m, service.wisnus_tahunan(m, kota), [WISNUS])


@router.get("/wisnus/per-kota")
def wisnus_per_kota(k: KonteksDep, tahun: str | None = None):
    m = Muat(k)
    return _jawab(k, m, service.wisnus_per_kota(m, tahun), [WISNUS])


@router.get("/wisnus/bulanan")
def wisnus_bulanan(k: KonteksDep, kota: str | None = None):
    m = Muat(k)
    return _jawab(k, m, service.wisnus_bulanan(m, kota), [WISNUS])


@router.get("/wisnus/yoy")
def wisnus_yoy(k: KonteksDep, kota: str | None = None):
    m = Muat(k)
    return _jawab(k, m, service.wisnus_yoy(m, kota), [WISNUS])


@router.get("/tenaga-kerja/dki")
def tenaga_kerja_dki(k: KonteksDep):
    m = Muat(k)
    return _jawab(k, m, service.tenaga_kerja_dki(m), ["silver.tenaga_kerja_ekraf_per_provinsi"])


@router.get("/tenaga-kerja/subsektor")
def tenaga_kerja_subsektor(k: KonteksDep, tahun: str | None = None):
    m = Muat(k)
    sumber = ["silver.tenaga_kerja_ekraf_per_subsektor_nasional"]
    return _jawab(k, m, service.tenaga_kerja_subsektor(m, tahun), sumber)


@router.get("/tenaga-kerja/sertifikasi")
def tenaga_kerja_sertifikasi(k: KonteksDep):
    m = Muat(k)
    sumber = [
        "silver.jumlah_tenaga_kerja_pariwisata_dan_ekonomi_kreatif_yang_tersertifikasi",
        "silver.jumlah_tenaga_kerja_pariwisata_dan_ekonomi_kreatif_yang_tersertifikasi_tahun_2023_dan_2024",
    ]
    return _jawab(k, m, service.tenaga_kerja_sertifikasi(m), sumber)


@router.get("/pdrb-ekraf/makro")
def pdrb_makro(k: KonteksDep):
    m = Muat(k)
    return _jawab(k, m, service.pdrb_makro(m), PDRB_MAKRO)


@router.get("/pdrb-ekraf/subsektor/sebaran")
def pdrb_sebaran(k: KonteksDep, periode: str | None = None):
    m = Muat(k)
    return _jawab(k, m, service.pdrb_sebaran(m, periode), PDRB_SUB)


@router.get("/pdrb-ekraf/subsektor/pertumbuhan")
def pdrb_pertumbuhan(k: KonteksDep, periode: str | None = None):
    m = Muat(k)
    return _jawab(k, m, service.pdrb_pertumbuhan(m, periode), PDRB_SUB)
