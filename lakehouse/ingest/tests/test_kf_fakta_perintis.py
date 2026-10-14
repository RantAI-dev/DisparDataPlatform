"""Unit tests untuk fakta perintis wisman, wisnus, dan dimensi pintu masuk."""
from __future__ import annotations

import csv
import re
from pathlib import Path
import pytest

REPO_ROOT = Path(__file__).resolve().parent.parent.parent.parent
KONFORM_DIR = REPO_ROOT / "lakehouse" / "clickhouse" / "konform"
CSV_PINTU = REPO_ROOT / "data" / "referensi" / "pintu-masuk.csv"

FAKTA_OBJEK = [
    "dim_pintu_masuk",
    "f_wisman_bulanan",
    "f_wisman_negara_bulanan",
    "f_wisman_pintu_bulanan",
    "f_target_wisman",
    "f_wisnus_kota_bulanan",
]


class TestKontrakFaktaPerintis:
    """Kriteria 4: Kontrak keenam objek lolos validasi pemuat kontrak."""

    def test_semua_kontrak_ada_dan_valid(self):
        from dispar_ingest.konform import muat_semua_kontrak, validasi_kontrak

        kontrak_dir = KONFORM_DIR / "kontrak"
        semua = muat_semua_kontrak(kontrak_dir)

        for nama in FAKTA_OBJEK:
            assert nama in semua, f"Kontrak untuk {nama} tidak ditemukan"
            k = semua[nama]
            validasi_kontrak(k, semua)
            assert k["pemilik"] in ("perintis", "belum diketahui")
            assert k["kelas_refresh"] in ("snapshot", "harian", "terjadwal")


class TestBerkasSqlFaktaPerintis:
    """Kriteria 4: Berkas SQL mematuhi aturan penerap konform."""

    def test_aturan_sql_penerap(self):
        from dispar_ingest.konform import _split_statements, substitusi_penanda, validasi_statement

        sql_dir = KONFORM_DIR / "sql"
        for fname in ["06-dim-pintu-masuk.sql", "07-fakta-wisman-wisnus.sql"]:
            fpath = sql_dir / fname
            assert fpath.exists(), f"{fname} tidak ditemukan"
            sql_raw = fpath.read_text(encoding="utf-8")
            sql_sub = substitusi_penanda(sql_raw, mode="panggung", db="konform_dev")
            statements = [s.strip() for s in _split_statements(sql_sub) if s.strip()]
            assert len(statements) > 0, f"{fname} tidak berisi perintah valid"
            for stmt in statements:
                validasi_statement(stmt, db="konform_dev")


class TestBerkasReferensiPintuMasuk:
    """Validasi integritas data referensi pintu-masuk.csv."""

    def test_pintu_masuk_csv(self):
        with open(CSV_PINTU, encoding="utf-8") as f:
            rows = list(csv.DictReader(f))

        assert len(rows) == 22, f"Harus ada 22 baris pintu masuk, ditemukan {len(rows)}"

        kodes = [r["kode"] for r in rows]
        assert len(kodes) == len(set(kodes)), "Kode pintu masuk harus unik"

        for r in rows:
            assert re.match(r"^[a-z0-9-]+$", r["kode"]), f"Kode '{r['kode']}' harus kebab-case"
            assert r["moda"] in ("udara", "laut", "darat", "lainnya"), f"Moda '{r['moda']}' tidak valid"
            if r["moda"] == "lainnya":
                assert r["kode_provinsi"] == "", f"Kode provinsi untuk 'lainnya' harus kosong"
            else:
                assert re.match(r"^\d{2}$", r["kode_provinsi"]), f"Kode provinsi '{r['kode_provinsi']}' tidak valid"
