"""Unit tests untuk standarisasi wilayah dan pembentukan kamus dim_wilayah."""
from __future__ import annotations

import pytest
from dispar_ingest.konform import _ch


@pytest.fixture(scope="module")
def ch():
    try:
        client = _ch()
        client.query("SELECT 1")
        return client
    except Exception as e:
        pytest.skip(f"ClickHouse tidak dapat diakses untuk pengujian kf_wilayah: {e}")


def _get_target_db(ch) -> str | None:
    dbs = {r[0] for r in ch.query("SHOW DATABASES").result_rows}
    if "konform_dev" in dbs:
        return "konform_dev"
    if "konform" in dbs:
        return "konform"
    return None


class TestKfKunciWilayah:
    """Pengujian fungsi global kf_kunci_wilayah."""

    @pytest.mark.parametrize(
        ("input_val", "expected"),
        [
            ("KOTA ADM. JAKARTA SELATAN", "kota jakarta selatan"),
            ("KAB. ADM. KEP. SERIBU", "kab kepulauan seribu"),
            ("Kel. Gambir", "gambir"),
            ("Kota Administrasi Jakarta Timur", "kota jakarta timur"),
            ("KAB. TEGAL", "kab tegal"),
            ("KOTA TANGERANG SELATAN", "kota tangerang selatan"),
            ("Kec. Gambir", "gambir"),
            ("Kecamatan Gambir", "gambir"),
            ("Kelurahan Cideng", "cideng"),
            ("Jakarta Pusat", "jakarta pusat"),
            ("D.K.I. Jakarta", "d k i jakarta"),
            ("", None),
            ("?", None),
            ("   ", None),
            ("-", None),
            ("N/A", None),
        ],
    )
    def test_normalisasi_kunci(self, ch, input_val: str, expected: str | None):
        safe_val = input_val.replace("'", "''")
        res = ch.query(f"SELECT kf_kunci_wilayah('{safe_val}')").result_rows[0][0]
        assert res == expected

    def test_null_input(self, ch):
        res = ch.query("SELECT kf_kunci_wilayah(cast(NULL as Nullable(String)))").result_rows[0][0]
        assert res is None


class TestKamusWilayahAmbigu:
    """Pengujian aturan pemisahan kunci ambigu dan unik pada kamus wilayah."""

    def test_kunci_ambigu_tidak_masuk_kamus(self, ch):
        db = _get_target_db(ch)
        if not db:
            pytest.skip("Database konform atau konform_dev tidak ditemukan")

        tables = {r[0] for r in ch.query(f"SHOW TABLES FROM {db}").result_rows}
        if "dim_wilayah_kunci" not in tables or "dim_wilayah_ambigu" not in tables:
            pytest.skip(f"Tabel {db}.dim_wilayah_kunci belum disiapkan")

        # 'bekasi' tanpa awalan adalah ambigu antara Kab. Bekasi dan Kota Bekasi
        ambigu = ch.query(
            f"SELECT jml_kode, daftar_kode FROM {db}.dim_wilayah_ambigu WHERE tingkat = 'kabkota' AND kunci = 'bekasi'"
        ).result_rows
        assert len(ambigu) == 1
        assert ambigu[0][0] >= 2
        assert "32.16" in ambigu[0][1]
        assert "32.75" in ambigu[0][1]

        # 'bekasi' TIDAK boleh ada di dim_wilayah_kunci
        kunci_bekasi = ch.query(
            f"SELECT kode FROM {db}.dim_wilayah_kunci WHERE tingkat = 'kabkota' AND kunci = 'bekasi'"
        ).result_rows
        assert len(kunci_bekasi) == 0

        # Sedangkan dengan awalan ('kota bekasi' dan 'kab bekasi') harus ada di dim_wilayah_kunci
        kunci_kota = ch.query(
            f"SELECT kode FROM {db}.dim_wilayah_kunci WHERE tingkat = 'kabkota' AND kunci = 'kota bekasi'"
        ).result_rows
        assert len(kunci_kota) == 1
        assert kunci_kota[0][0] == "32.75"

        kunci_kab = ch.query(
            f"SELECT kode FROM {db}.dim_wilayah_kunci WHERE tingkat = 'kabkota' AND kunci = 'kab bekasi'"
        ).result_rows
        assert len(kunci_kab) == 1
        assert kunci_kab[0][0] == "32.16"


class TestStrukturDkiKemendagri:
    """Pengujian integritas data DKI Jakarta pada dim_wilayah."""

    def test_jumlah_entitas_dki(self, ch):
        db = _get_target_db(ch)
        if not db:
            pytest.skip("Database konform atau konform_dev tidak ditemukan")

        tables = {r[0] for r in ch.query(f"SHOW TABLES FROM {db}").result_rows}
        if "dim_wilayah" not in tables:
            pytest.skip(f"Tabel {db}.dim_wilayah belum disiapkan")

        rows = ch.query(
            f"SELECT tingkat, count() FROM {db}.dim_wilayah WHERE di_dki = 1 GROUP BY tingkat"
        ).result_rows
        counts = dict(rows)
        assert counts.get("kabkota") == 6
        assert counts.get("kecamatan") == 44
        assert counts.get("kelurahan") == 267

    def test_kelurahan_dki_punya_induk(self, ch):
        db = _get_target_db(ch)
        if not db:
            pytest.skip("Database konform atau konform_dev tidak ditemukan")

        tables = {r[0] for r in ch.query(f"SHOW TABLES FROM {db}").result_rows}
        if "dim_wilayah" not in tables:
            pytest.skip(f"Tabel {db}.dim_wilayah belum disiapkan")

        res = ch.query(
            f"SELECT count(), countIf(kode_kabkota IS NOT NULL), countIf(kode_kecamatan IS NOT NULL) "
            f"FROM {db}.dim_wilayah WHERE di_dki = 1 AND tingkat = 'kelurahan'"
        ).result_rows[0]
        assert res[0] == 267
        assert res[1] == 267
        assert res[2] == 267
