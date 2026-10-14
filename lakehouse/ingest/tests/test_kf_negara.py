"""Unit tests untuk dimensi negara ISO 3166-1, ember BPS, dan kamus alias."""
from __future__ import annotations

import csv
import re
from pathlib import Path
import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
FILE_10_DIM = REPO_ROOT / "lakehouse" / "clickhouse" / "sql" / "10-dim.sql"
CSV_NEGARA = REPO_ROOT / "data" / "referensi" / "negara-iso3166.csv"
CSV_ALIAS = REPO_ROOT / "data" / "referensi" / "negara-alias.csv"

TUJUH_KAWASAN = {"Asia", "Eropa", "Afrika", "Amerika", "Oseania", "Timur Tengah", "Lainnya"}
TIMUR_TENGAH_14 = {
    "SAU", "ARE", "BHR", "KWT", "QAT", "OMN", "YEM",
    "IRQ", "IRN", "JOR", "LBN", "SYR", "ISR", "PSE",
}


def _ekstrak_10_dim() -> list[tuple[list[str], str, str, str]]:
    """Mengekstrak baris VALUES dim_negara dari 10-dim.sql."""
    content = FILE_10_DIM.read_text(encoding="utf-8")
    # Cari pola (['varian1','varian2',...], 'KODE', 'Nama', 'Kawasan')
    pattern = re.compile(
        r"\(\[(.*?)\],\s*'([A-Z]{3})',\s*'(.*?)',\s*'(.*?)'\)",
        re.DOTALL,
    )
    hasil = []
    for match in pattern.finditer(content):
        raw_varian, kode, nama, kawasan = match.groups()
        varian_list = [v.strip().strip("'") for v in raw_varian.split(",")]
        hasil.append((varian_list, kode, nama, kawasan))
    return hasil


class TestKesetiaanDimensiLama:
    """Kriteria 1: Kesetiaan pada dimensi lama di 10-dim.sql."""

    def test_kesetiaan_kode_nama_kawasan(self):
        entri_lama = _ekstrak_10_dim()
        assert len(entri_lama) == 23, "Harus ada 23 entri di 10-dim.sql"

        with open(CSV_NEGARA, encoding="utf-8") as f:
            negara_rows = {r["kode"]: r for r in csv.DictReader(f)}

        for _, kode, nama, kawasan in entri_lama:
            assert kode in negara_rows, f"Kode {kode} dari 10-dim.sql tidak ada di {CSV_NEGARA.name}"
            ref = negara_rows[kode]
            assert ref["nama"] == nama, f"Nama {kode} berbeda: '{ref['nama']}' != '{nama}'"
            assert ref["kawasan"] == kawasan, f"Kawasan {kode} berbeda: '{ref['kawasan']}' != '{kawasan}'"

    def test_kesetiaan_semua_varian_di_alias(self):
        entri_lama = _ekstrak_10_dim()
        with open(CSV_ALIAS, encoding="utf-8") as f:
            alias_rows = {r["alias"].strip().lower(): r["kode"] for r in csv.DictReader(f)}

        for varian_list, kode, _, _ in entri_lama:
            for v in varian_list:
                v_clean = v.strip().lower()
                assert v_clean in alias_rows, f"Varian '{v_clean}' ({kode}) dari 10-dim.sql tidak ada di {CSV_ALIAS.name}"
                assert alias_rows[v_clean] == kode, f"Varian '{v_clean}' menunjuk {alias_rows[v_clean]}, bukan {kode}"


class TestBerkasRujukanNegara:
    """Kriteria 2: Validasi integritas berkas rujukan negara ISO 3166."""

    def test_format_kode_dan_keunikan(self):
        with open(CSV_NEGARA, encoding="utf-8") as f:
            rows = list(csv.DictReader(f))

        kodes = [r["kode"] for r in rows]
        assert len(kodes) == len(set(kodes)), "Kode negara harus unik"

        for r in rows:
            kode = r["kode"]
            assert re.match(r"^[A-Z]{3}$", kode), f"Kode {kode} harus 3 huruf kapital"

            jenis = r["jenis"]
            assert jenis in ("negara", "ember"), f"Jenis {jenis} tidak sah untuk {kode}"

            kawasan = r["kawasan"]
            assert kawasan in TUJUH_KAWASAN, f"Kawasan {kawasan} tidak sah untuk {kode}"

    def test_keunikan_kode_iso2_antara_negara(self):
        with open(CSV_NEGARA, encoding="utf-8") as f:
            rows = list(csv.DictReader(f))

        iso2_list = [r["kode_iso2"] for r in rows if r["jenis"] == "negara"]
        assert len(iso2_list) == len(set(iso2_list)), "kode_iso2 harus unik di antara baris jenis negara"
        for iso2 in iso2_list:
            assert re.match(r"^[A-Z]{2}$", iso2), f"kode_iso2 '{iso2}' harus 2 huruf kapital"

    def test_keempat_belas_kode_timur_tengah(self):
        with open(CSV_NEGARA, encoding="utf-8") as f:
            rows = {r["kode"]: r for r in csv.DictReader(f)}

        for kode in TIMUR_TENGAH_14:
            assert kode in rows, f"Kode Timur Tengah {kode} tidak ditemukan"
            assert rows[kode]["kawasan"] == "Timur Tengah", f"Kode {kode} memiliki kawasan {rows[kode]['kawasan']}, bukan Timur Tengah"


class TestPanggungDimNegara:
    """Kriteria 3: Pengujian panggung konform/konform_dev jika database aktif."""

    def test_dim_negara_ambigu_kosong(self):
        try:
            from dispar_ingest.konform import _ch
            ch = _ch()
            ch.query("SELECT 1")
        except Exception as e:
            pytest.skip(f"ClickHouse tidak dapat diakses: {e}")

        dbs = {r[0] for r in ch.query("SHOW DATABASES").result_rows}
        db = "konform_dev" if "konform_dev" in dbs else ("konform" if "konform" in dbs else None)
        if not db:
            pytest.skip("Database konform atau konform_dev tidak ditemukan")

        tables = {r[0] for r in ch.query(f"SHOW TABLES FROM {db}").result_rows}
        if "dim_negara_ambigu" not in tables:
            pytest.skip(f"Tabel {db}.dim_negara_ambigu belum disiapkan")

        res = ch.query(f"SELECT count(), groupArray(kunci) FROM {db}.dim_negara_ambigu").result_rows
        assert res[0][0] == 0, f"dim_negara_ambigu harus kosong, ditemukan {res[0][0]}: {res[0][1]}"
