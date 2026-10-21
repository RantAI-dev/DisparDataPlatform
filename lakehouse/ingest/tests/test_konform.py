"""Unit test untuk Plan 01: Kerangka konform, penerap SQL, kontrak, dan uji."""

from __future__ import annotations

from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest
from dispar_ingest.konform import (
    buat_view_tak_cocok,
    muat_semua_kontrak,
    substitusi_penanda,
    terapkan,
    uji,
    validasi_kontrak,
    validasi_statement,
)


# ── 1. Test Penerap SQL & Keamanan ─────────────────────────────────────────

def test_penerap_substitusi_penanda():
    """Kriteria 1: Penanda {{db}} dan {{ref:nama}} diganti dengan benar di kedua mode."""
    sql = "CREATE VIEW {{db}}.v_test AS SELECT * FROM {{ref:kode_wilayah}};"

    # Mode lake
    lake_sql = substitusi_penanda(sql, mode="lake", db="konform")
    assert lake_sql == "CREATE VIEW konform.v_test AS SELECT * FROM lake.`bronze_file.kode_wilayah`;"

    # Mode panggung
    dev_sql = substitusi_penanda(sql, mode="panggung", db="konform_dev")
    assert dev_sql == "CREATE VIEW konform_dev.v_test AS SELECT * FROM konform_dev.kode_wilayah;"


def test_penerap_menolak_target_silver_dan_db_terlarang():
    """Kriteria 1: SQL yang membuat objek atau menulis ke silver/serving/lake/_silver_meta ditolak."""
    # Menulis ke silver
    with pytest.raises(ValueError, match="database terlarang"):
        validasi_statement("CREATE VIEW silver.view_salah AS SELECT 1", db="konform")

    with pytest.raises(ValueError, match="database terlarang"):
        validasi_statement("INSERT INTO silver.tabel_salah VALUES (1)", db="konform")

    with pytest.raises(ValueError, match="database terlarang"):
        validasi_statement("DROP TABLE lake.bronze_salah", db="konform")

    # Target bukan db yang ditentukan
    with pytest.raises(ValueError, match="harus menyasar"):
        validasi_statement("CREATE TABLE db_lain.tabel_salah (id Int32) ENGINE = Log", db="konform")


def test_penerap_menolak_fungsi_tanpa_awalan_kf():
    """Kriteria 1: CREATE FUNCTION tanpa awalan kf_ ditolak; awalan kf_ diterima."""
    with pytest.raises(ValueError, match="harus berawalan 'kf_'"):
        validasi_statement("CREATE FUNCTION func_tanpa_awalan AS (x) -> x + 1", db="konform")

    with pytest.raises(ValueError, match="harus berawalan 'kf_'"):
        validasi_statement("CREATE OR REPLACE FUNCTION hitung_pajak AS (x) -> x * 0.1", db="konform")

    # Berawalan kf_ harus lulus validasi
    validasi_statement("CREATE FUNCTION kf_bersih_kode AS (x) -> trim(x)", db="konform")
    validasi_statement("CREATE OR REPLACE FUNCTION kf_normal_nama AS (s) -> lower(trim(s))", db="konform")


def test_penerap_buat_tak_cocok_dari_tc_views():
    """Kriteria 1: View {{db}}.tak_cocok dibuat dari UNION ALL semua tc_* view yang ada."""
    mock_ch = MagicMock()
    # Mock temuan dua view: tc_wisman dan tc_wisnus
    mock_ch.query.return_value.result_rows = [("tc_wisman",), ("tc_wisnus",)]

    buat_view_tak_cocok(mock_ch, db="konform")

    assert mock_ch.command.called
    cmd = mock_ch.command.call_args[0][0]
    assert "CREATE OR REPLACE VIEW konform.tak_cocok AS" in cmd
    assert "SELECT fakta, kolom, nilai_asli, baris FROM konform.`tc_wisman`" in cmd
    assert "SELECT fakta, kolom, nilai_asli, baris FROM konform.`tc_wisnus`" in cmd
    assert "UNION ALL" in cmd


def test_penerap_buat_tak_cocok_kosong_bila_tidak_ada_tc():
    """Kriteria 1: View {{db}}.tak_cocok tetap dibuat kosong bila belum ada tc_* view."""
    mock_ch = MagicMock()
    mock_ch.query.return_value.result_rows = []

    buat_view_tak_cocok(mock_ch, db="konform")

    assert mock_ch.command.called
    cmd = mock_ch.command.call_args[0][0]
    assert "CREATE OR REPLACE VIEW konform.tak_cocok AS" in cmd
    assert "WHERE 1 = 0" in cmd


# ── 2. Test Pemuat Kontrak & Aturan Penolakan ──────────────────────────────

def test_kontrak_tolak_kelas_refresh_tidak_valid():
    """Kriteria 2: Kontrak menolak kelas_refresh di luar snapshot | harian | terjadwal."""
    kontrak_salah = {
        "nama": "dim_test",
        "jenis": "dimensi",
        "kelas_refresh": "bulanan",  # Tidak sah!
        "grain": ["id"],
        "kolom": [{"nama": "id", "tipe": "String"}],
    }
    with pytest.raises(ValueError, match="kelas_refresh 'bulanan' tidak valid"):
        validasi_kontrak(kontrak_salah, {"dim_test": kontrak_salah})


def test_kontrak_tolak_grain_kolom_tak_terdaftar():
    """Kriteria 2: Kontrak menolak grain yang menyebut nama kolom yang tidak ada."""
    kontrak_salah = {
        "nama": "dim_test",
        "jenis": "dimensi",
        "kelas_refresh": "harian",
        "grain": ["id_tidak_ada"],  # Tidak ada di kolom!
        "kolom": [{"nama": "id", "tipe": "String"}],
    }
    with pytest.raises(ValueError, match="grain 'id_tidak_ada' tidak terdaftar"):
        validasi_kontrak(kontrak_salah, {"dim_test": kontrak_salah})


def test_kontrak_tolak_dimensi_tanpa_kontrak():
    """Kriteria 2: Kontrak menolak dimensi yang menunjuk objek tanpa berkas kontrak."""
    kontrak_fakta = {
        "nama": "f_kunjungan",
        "jenis": "fakta",
        "kelas_refresh": "terjadwal",
        "grain": ["id"],
        "kolom": [
            {"nama": "id", "tipe": "String"},
            {"nama": "negara_kode", "tipe": "String", "dimensi": "dim_negara_fiktif.kode"},
        ],
    }
    # Objek dim_negara_fiktif tidak terdaftar di semua_kontrak
    semua = {"f_kunjungan": kontrak_fakta}
    with pytest.raises(ValueError, match="menunjuk objek 'dim_negara_fiktif' yang tidak punya kontrak"):
        validasi_kontrak(kontrak_fakta, semua)


def test_kontrak_tolak_kolom_ukuran_tanpa_satuan():
    """Kriteria 2: Kontrak menolak kolom ukuran yang tidak memiliki atribut satuan."""
    kontrak_fakta = {
        "nama": "f_kunjungan",
        "jenis": "fakta",
        "kelas_refresh": "terjadwal",
        "grain": ["id"],
        "kolom": [
            {"nama": "id", "tipe": "String"},
            # Kolom jumlah bertipe Float64 di tabel fakta adalah ukuran, wajib ada satuan
            {"nama": "jumlah", "tipe": "Float64", "satuan": ""},
        ],
    }
    semua = {"f_kunjungan": kontrak_fakta}
    with pytest.raises(ValueError, match="kolom ukuran 'jumlah' wajib memiliki 'satuan'"):
        validasi_kontrak(kontrak_fakta, semua)

    # Tambahkan satuan -> harus lolos
    kontrak_fakta["kolom"][1]["satuan"] = "orang"
    validasi_kontrak(kontrak_fakta, semua)


# ── 3. Test Uji Kontrak (Lulus & Gagal per Jenis Uji) ───────────────────────

@pytest.fixture
def base_contract_map():
    return {
        "dim_wilayah": {
            "nama": "dim_wilayah",
            "jenis": "dimensi",
            "kelas_refresh": "snapshot",
            "grain": ["kode"],
            "kolom": [
                {"nama": "kode", "tipe": "String", "wajib": True},
                {"nama": "nama", "tipe": "String", "wajib": True},
            ],
        },
        "f_wisman": {
            "nama": "f_wisman",
            "jenis": "fakta",
            "kelas_refresh": "harian",
            "grain": ["periode_id", "wilayah_kode"],
            "kolom": [
                {"nama": "periode_id", "tipe": "Int64", "wajib": True, "min": 2000, "max": 2030},
                {"nama": "wilayah_kode", "tipe": "String", "dimensi": "dim_wilayah.kode", "cocok_min": 0.9},
                {"nama": "kategori", "tipe": "String", "nilai_boleh": ["reguler", "khusus"]},
                {"nama": "jumlah", "tipe": "Int64", "satuan": "orang"},
            ],
            "rekonsiliasi": [
                {
                    "nama": "total_wisman_sama",
                    "fakta": "SELECT sum(jumlah) FROM {{db}}.f_wisman",
                    "acuan": "SELECT 1000",
                }
            ],
        },
    }


def test_uji_skema(base_contract_map, tmp_path):
    # Pass: skema di ClickHouse persis sama dengan kontrak
    mock_ch = MagicMock()
    mock_ch.query.return_value.result_rows = [("kode", "String"), ("nama", "String")]

    with patch("dispar_ingest.konform.muat_semua_kontrak", return_value={"dim_wilayah": base_contract_map["dim_wilayah"]}):
        res = uji(mock_ch, mode="panggung")
        skema_test = [h for h in res["detail"] if h["uji"] == "skema"][0]
        assert skema_test["status"] == "lulus"

    # Fail: skema berbeda (kolom nama bertipe Nullable(String))
    mock_ch.query.return_value.result_rows = [("kode", "String"), ("nama", "Nullable(String)")]
    with patch("dispar_ingest.konform.muat_semua_kontrak", return_value={"dim_wilayah": base_contract_map["dim_wilayah"]}):
        res = uji(mock_ch, mode="panggung")
        skema_test = [h for h in res["detail"] if h["uji"] == "skema"][0]
        assert skema_test["status"] == "gagal"


def test_uji_grain_unik(base_contract_map):
    mock_ch = MagicMock()
    # Pass: count == uniqExact
    mock_ch.query.side_effect = [
        MagicMock(result_rows=[("kode", "String"), ("nama", "String")]),  # skema
        MagicMock(result_rows=[(10, 10)]),  # grain_unik: 10 rows, 10 unique
        MagicMock(result_rows=[(0,)]),  # wajib
        MagicMock(result_rows=[(0,)]),  # wajib
    ]

    with patch("dispar_ingest.konform.muat_semua_kontrak", return_value={"dim_wilayah": base_contract_map["dim_wilayah"]}):
        res = uji(mock_ch, mode="panggung")
        grain_test = [h for h in res["detail"] if h["uji"] == "grain_unik"][0]
        assert grain_test["status"] == "lulus"

    # Fail: count != uniqExact (ada duplikasi)
    mock_ch.query.side_effect = [
        MagicMock(result_rows=[("kode", "String"), ("nama", "String")]),
        MagicMock(result_rows=[(10, 8)]),  # 10 rows, hanya 8 unique
        MagicMock(result_rows=[(0,)]),
        MagicMock(result_rows=[(0,)]),
    ]
    with patch("dispar_ingest.konform.muat_semua_kontrak", return_value={"dim_wilayah": base_contract_map["dim_wilayah"]}):
        res = uji(mock_ch, mode="panggung")
        grain_test = [h for h in res["detail"] if h["uji"] == "grain_unik"][0]
        assert grain_test["status"] == "gagal"


def test_uji_wajib(base_contract_map):
    mock_ch = MagicMock()
    # Pass: 0 null
    mock_ch.query.side_effect = [
        MagicMock(result_rows=[("kode", "String"), ("nama", "String")]),
        MagicMock(result_rows=[(10, 10)]),
        MagicMock(result_rows=[(0,)]),  # wajib kode -> 0 null
        MagicMock(result_rows=[(0,)]),  # wajib nama -> 0 null
    ]
    with patch("dispar_ingest.konform.muat_semua_kontrak", return_value={"dim_wilayah": base_contract_map["dim_wilayah"]}):
        res = uji(mock_ch, mode="panggung")
        wajib_tests = [h for h in res["detail"] if h["uji"] == "wajib"]
        assert all(h["status"] == "lulus" for h in wajib_tests)

    # Fail: ada 3 baris NULL pada kode
    mock_ch.query.side_effect = [
        MagicMock(result_rows=[("kode", "String"), ("nama", "String")]),
        MagicMock(result_rows=[(10, 10)]),
        MagicMock(result_rows=[(3,)]),  # 3 null
        MagicMock(result_rows=[(0,)]),
    ]
    with patch("dispar_ingest.konform.muat_semua_kontrak", return_value={"dim_wilayah": base_contract_map["dim_wilayah"]}):
        res = uji(mock_ch, mode="panggung")
        wajib_fail = [h for h in res["detail"] if h["uji"] == "wajib" and h["target"] == "kode"][0]
        assert wajib_fail["status"] == "gagal"


def test_uji_rujukan_dan_cocok_min_dan_rentang_dan_nilai_boleh_dan_rekonsiliasi(base_contract_map):
    # Kita uji f_wisman dengan mock query
    mock_ch = MagicMock()
    k_fakta = base_contract_map["f_wisman"]

    # Skenario 1: Semua uji LULUS
    mock_ch.query.side_effect = [
        # skema:
        MagicMock(result_rows=[("periode_id", "Int64"), ("wilayah_kode", "String"), ("kategori", "String"), ("jumlah", "Int64")]),
        # grain_unik:
        MagicMock(result_rows=[(100, 100)]),
        # wajib periode_id:
        MagicMock(result_rows=[(0,)]),
        # rentang periode_id:
        MagicMock(result_rows=[(0,)]),
        # rujukan wilayah_kode:
        MagicMock(result_rows=[(0,)]),
        # cocok_min wilayah_kode: 95 cocok dari 100 baris = 0.95 >= 0.9
        MagicMock(result_rows=[(95, 100)]),
        # nilai_boleh kategori:
        MagicMock(result_rows=[(0,)]),
        # rekonsiliasi: fakta=1000, acuan=1000
        MagicMock(result_rows=[(1000,)]),
        MagicMock(result_rows=[(1000,)]),
    ]

    with patch("dispar_ingest.konform.muat_semua_kontrak", return_value={"f_wisman": k_fakta}):
        res = uji(mock_ch, mode="lake")
        assert res["gagal"] == 0
        assert res["lulus"] == 8
        assert mock_ch.insert.called  # Dicatat ke _silver_meta.quality pada mode lake

    # Skenario 2: Setiap uji GAGAL
    mock_ch.query.side_effect = [
        # skema:
        MagicMock(result_rows=[("periode_id", "Int64"), ("wilayah_kode", "String"), ("kategori", "String"), ("jumlah", "Int64")]),
        # grain_unik: gagal
        MagicMock(result_rows=[(100, 90)]),
        # wajib: gagal (2 null)
        MagicMock(result_rows=[(2,)]),
        # rentang: gagal (5 nilai di luar 2000..2030)
        MagicMock(result_rows=[(5,)]),
        # rujukan: gagal (4 orphan)
        MagicMock(result_rows=[(4,)]),
        # cocok_min: gagal (80 cocok dari 100 = 0.8 < 0.9)
        MagicMock(result_rows=[(80, 100)]),
        # nilai_boleh: gagal (3 baris invalid)
        MagicMock(result_rows=[(3,)]),
        # rekonsiliasi: fakta=900 != acuan=1000
        MagicMock(result_rows=[(900,)]),
        MagicMock(result_rows=[(1000,)]),
    ]

    with patch("dispar_ingest.konform.muat_semua_kontrak", return_value={"f_wisman": k_fakta}):
        res = uji(mock_ch, mode="panggung")
        assert res["gagal"] == 7  # semua uji kolom & fakta gagal kecuali skema


# ── 4. Test Integrasi Dagster ──────────────────────────────────────────────

def test_dagster_konform_asset_and_failure_resilience():
    """Kriteria 4: konform ada di refresh_job, bergantung pada quality_gate, dan tidak crash jika uji gagal."""
    from dagster import build_op_context
    from dispar_orchestrate.definitions import (
        defs,
        konform,
        quality_gate,
        refresh_job,
    )

    asset_graph = defs.resolve_asset_graph()

    # 1. Pastikan konform terdaftar
    assert konform.key in asset_graph.get_all_asset_keys()

    # 2. Bergantung pada quality_gate
    parents = asset_graph.get(konform.key).parent_keys
    assert quality_gate.key in parents

    # 3. Ada di selection refresh_job
    selected_keys = refresh_job.selection.resolve(asset_graph)
    assert konform.key in selected_keys

    # 4. Tetap sukses ketika uji melaporkan kegagalan
    context = build_op_context()
    with patch("dispar_ingest.konform.terapkan", return_value={"jumlah_objek": 5, "berkas_error": 1}), \
         patch("dispar_ingest.konform.uji", return_value={"lulus": 10, "gagal": 3}):
        # Harus berjalan sampai tuntas tanpa melempar exception
        konform(context)


# ── Panggung meniru tipe Bronze ─────────────────────────────────────────────

def test_panggung_ref_bertipe_nullable_seperti_bronze(tmp_path):
    """Tabel ref_* di konform_dev wajib Nullable(String) seperti Bronze.

    Kalau panggung memakai String biasa, SQL yang lupa membuang Nullable lolos
    di panggung tetapi gagal di lake (kunci ORDER BY Nullable ditolak ClickHouse).
    """
    from dispar_ingest import konform

    (tmp_path / "lakehouse").mkdir()
    (tmp_path / "lakehouse" / "sources.toml").write_text(
        '[[sumber]]\nid = "x"\ntabel = "ref_contoh"\npath = "ref.csv"\n', encoding="utf-8"
    )
    (tmp_path / "ref.csv").write_text("kode,nama\nA,Satu\n", encoding="utf-8")

    mock_ch = MagicMock()
    lap = {"berkas_sukses": 0, "berkas_error": 0, "jumlah_objek": 0}
    with patch.object(konform, "get_repo_root", return_value=tmp_path), \
         patch.object(konform, "terapkan", return_value=lap), \
         patch.object(konform, "uji", return_value={"lulus": 0, "gagal": 0, "total": 0}):
        konform.panggung(ch=mock_ch)

    perintah = [c.args[0] for c in mock_ch.command.call_args_list]
    # Panggung mulai dari kosong: objek sisa run lama tidak boleh meloloskan uji.
    assert perintah[0] == "DROP DATABASE IF EXISTS konform_dev"
    create = [c.args[0] for c in mock_ch.command.call_args_list
              if c.args[0].startswith("CREATE TABLE IF NOT EXISTS konform_dev.`ref_contoh`")]
    assert len(create) == 1
    assert "`kode` Nullable(String)" in create[0]
    assert "`nama` Nullable(String)" in create[0]
