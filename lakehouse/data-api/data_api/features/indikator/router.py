"""Endpoint fitur indikator (KONTRAK §2.3): indikator GCI/GPCI, `gci/resmi`, `dataset-tematik`, dan
halaman `/gci/pariwisata/*` berdata lake."""

from __future__ import annotations

from typing import Annotated, Any

from fastapi import APIRouter, Depends

from data_api.shared.konteks import Konteks, ambil_konteks
from data_api.shared.respons import Amplop, angka_js, sukses

from . import models, pariwisata, service

router = APIRouter(tags=["indikator"])

KonteksDep = Annotated[Konteks, Depends(ambil_konteks)]
INDIKATOR = "lake.bronze_file.gci_gpci_indicators"
KATALOG = "lake.bronze_meta*.dataset_catalog"
KEARNEY = "lake.bronze_file.gci_kearney_resmi"
_OPS = {"response_model_exclude_unset": True}


def _cache(k: Konteks, kunci: tuple, buat):
    return k.cache.ambil(("indikator",) + kunci, k.konf.cache_ttl_default, buat)


@router.get("/indikator", response_model=Amplop[models.DaftarIndikator], **_OPS)
def daftar(k: KonteksDep, framework: str):
    data = _cache(k, ("daftar", framework), lambda: angka_js(service.daftar(k, framework)))
    return sukses(data, k.rid, [INDIKATOR, KATALOG, "silver.*"])


@router.get("/indikator/{code}", response_model=Amplop[models.DetailIndikator], **_OPS)
def detail(k: KonteksDep, code: str):
    data, terpilih = _cache(k, ("detail", code.upper()), lambda: angka_js(service.detail(k, code)))
    return sukses(
        data, k.rid, [INDIKATOR, KATALOG, "silver.*", "lake.bronze_file.gci_gpci_benchmark"], dataset_terpilih=terpilih
    )


@router.get("/gci/resmi", response_model=Amplop[models.GciResmi], **_OPS)
def gci_resmi(k: KonteksDep):
    return sukses(service.gci_resmi(k), k.rid, [KEARNEY])


@router.get("/dataset-tematik", response_model=Amplop[models.DatasetTematik], **_OPS)
def dataset_tematik(k: KonteksDep, framework: str):
    return sukses(
        service.dataset_tematik(k, framework), k.rid, ["shared/hitungan.py (tabel sumber atlas + katalog sekunder)"]
    )


def _halaman(k: Konteks, hasil: tuple[dict[str, Any], list[str]], source: list[str]) -> dict[str, Any]:
    data, peringatan = hasil
    return sukses(angka_js(data), k.rid, source, **({"peringatan": peringatan} if peringatan else {}))


@router.get("/pariwisata/wisatawan-internasional", response_model=Amplop[models.HalamanPariwisata], **_OPS)
def wisatawan_internasional(k: KonteksDep):
    sumber = [
        "silver.wisman_jakarta_per_bulan",
        "silver.wisman_jakarta_per_negara",
        "silver.wisman_jakarta_per_pintu_masuk",
        "lake.bronze_file.target_wisman",
        KEARNEY,
    ]
    return _halaman(k, pariwisata.wisatawan_internasional(k), sumber)


@router.get("/pariwisata/kuliner-michelin", response_model=Amplop[models.HalamanPariwisata], **_OPS)
def kuliner_michelin(k: KonteksDep):
    sumber = [
        "silver.jumlah_restoran_per_kelurahan",
        "silver.data_usaha_jasa_makanan_dan_minuman_jenis_usaha_restoran_di_dki_jakarta",
        "silver.restoran_tripadvisor_jakarta",
        KEARNEY,
    ]
    return _halaman(k, pariwisata.kuliner_michelin(k), sumber)


@router.get("/pariwisata/seni-pertunjukan", response_model=Amplop[models.HalamanPariwisata], **_OPS)
def seni_pertunjukan(k: KonteksDep, tahun: str | None = None):
    sumber = [
        "silver.data_seni_pertunjukan_dan_visual",
        "silver.jumlah_penyelenggaraan_event",
        "silver.artis_top_global_chart",
        "silver.data_penyelenggaraan_event_pariwisata_dan_budaya_dki_jakarta",
        "silver.data_event_pariwisata_dan_kebudayaan_dki_jakarta_2011_2019",
        "silver.data_rekomendasi_penyelenggaraan_pertunjukan_musik",
        "lake.bronze_file.seni_venue",
        "lake.bronze_file.artis_tampil_jakarta",
        KEARNEY,
    ]
    return _halaman(k, pariwisata.seni_pertunjukan(k, tahun), sumber)
