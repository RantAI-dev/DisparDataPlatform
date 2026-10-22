"""Fitur GMTI (plan 05): ringkasan, kolam pilar, filter server = golden statis plan 01 (gate)."""

from __future__ import annotations

import pytest

from data_api.features.gmti import logika
from data_api.shared.respons import angka_js
from tests.bronze_statis import bronze, golden, tipe

IBADAH, TEMPAT = bronze("gmti-ibadah"), bronze("gmti-tempat")


def _item(p: dict) -> dict:
    return angka_js({**p, "maps_url": logika.maps_url(p)})


def test_golden_ringkasan_meta_dihitung_ulang():
    harap = golden("gmti.ringkasan")["data"]
    hasil = angka_js(
        logika.ringkasan(IBADAH, TEMPAT, bronze("gmti-kecamatan"), bronze("gmti-tipologi"), bronze("gmti-capaian"))
    )
    assert hasil == harap
    assert tipe(hasil) == tipe(harap)
    # Angka `GMTI_META` yang tidak diekspor ke Bronze, hasil hitung ulang:
    m = hasil["meta"]
    assert (m["ibadah_total"], m["masjid"], m["mushalla"], m["ibadah_berkoordinat"]) == (8331, 4041, 4290, 770)
    assert (m["halal_total"], m["halal_berkoordinat"], m["kecamatan"]) == (335, 291, 44)
    assert m["kecamatan_tanpa_poligon"] == ["Kepulauan Seribu Selatan", "Kepulauan Seribu Utara"]


@pytest.mark.parametrize("pilar", ["semua", *logika.PILLARS])
def test_golden_kolam_pilar(pilar):
    g = golden(f"gmti.tempat.{pilar}")
    pool = logika.pool(pilar, IBADAH, TEMPAT)
    assert len(pool) == g["meta"]["total"]
    assert [p["id"] for p in pool] == g["data"]["ids"]
    assert [_item(p) for p in pool[:200]] == g["data"]["items_halaman_1"]
    assert logika.facets(pool) == g["data"]["facets"]


def test_kolam_pilar_ibadah_dari_simas_halal_dari_tempat():
    jumlah = {p: len(logika.pool(p, IBADAH, TEMPAT)) for p in ["semua", *logika.PILLARS]}
    assert jumlah == {"semua": 8666, "ibadah": 8331, "makan": 174, "menginap": 49, "destinasi": 69, "program": 43}
    # 770 ibadah berkoordinat di `gmti_tempat` tidak ikut kolam (tidak dobel dengan SIMAS).
    assert not any(
        p["id"].startswith("simas-") and p["dataset"] != "SIMAS Kemenag" for p in logika.pool("semua", IBADAH, TEMPAT)
    )


@pytest.mark.parametrize("n", [1, 2, 3, 4])
def test_golden_filter_server_sama_dengan_filter_klien(n):
    """Halaman 1–3 dan total untuk 4 kombinasi filter (plan 05), dari memo `filtered` GmtiView asli."""
    g = golden(f"gmti.tempat.filter-{n}")
    prm = g["params"]
    pool = logika.pool(prm.get("pilar", "semua"), IBADAH, TEMPAT)
    hasil = logika.saring(pool, prm.get("kota"), prm.get("jenis"), prm.get("q"))
    assert len(hasil) == g["meta"]["total"]
    for hal in (1, 2, 3):
        assert [_item(p) for p in hasil[(hal - 1) * 200 : hal * 200]] == g["data"][f"items_halaman_{hal}"]
    assert logika.facets(pool) == g["data"]["facets"]


def test_maps_url_tanpa_koordinat_memakai_alamat():
    p = {"name": "Masjid A", "address": None, "city": "Jakarta Barat", "lat": None, "lon": 106.8}
    assert logika.maps_url(p).endswith("query=Masjid%20A%2C%20Jakarta%20Barat%2C%20Jakarta")
