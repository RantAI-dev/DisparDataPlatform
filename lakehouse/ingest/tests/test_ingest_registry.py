"""Test ingestion berbasis registri (Plan 02).

Memastikan:
1. Ingest idempotent: tidak menulis ulang berkas yang sha256-nya sama dengan
   baris 'masuk' terakhir di log. Mengubah 1 byte menulis ulang hanya berkas itu.
2. Ingest sekunder aman: jika satu berkas terdaftar hilang, error dilempar dan
   tabel meta tidak disentuh.
3. Aset Dagster bronze_sekunder masuk di refresh_job dan menjadi dep lake_db.
4. Output build_table konsisten (kolom data String + lima kolom audit).
"""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import pyarrow as pa
import pytest
from pyiceberg.catalog.sql import SqlCatalog

from dispar_ingest.lake import build_table
from dispar_ingest.meta import append_ingest_log, get_last_success_hashes
from dispar_ingest.run_bronze import ingest_files
from dispar_ingest.secondary_ingest import ingest_secondary


@pytest.fixture
def temp_catalog(tmp_path: Path):
    warehouse_dir = tmp_path / "warehouse"
    warehouse_dir.mkdir(parents=True)
    db_file = tmp_path / "catalog.db"
    return SqlCatalog(
        "test_catalog",
        uri=f"sqlite:///{db_file}",
        warehouse=f"file://{warehouse_dir}",
    )


def test_build_table_schema_and_audit():
    """Kriteria 6: build_table menghasilkan kolom data String + 5 kolom audit."""
    rows = [
        {"nama": "Monas", "skor": 95, "kategori": "wisata"},
        {"nama": "Ancol", "skor": 90, "kategori": "pantai"},
    ]
    tbl = build_table(
        rows,
        source_url="file://data/test.tsv",
        batch_id="20261008T000000Z",
        tenant="dispar-dki",
    )
    assert tbl is not None
    assert tbl.num_rows == 2

    # Kolom data harus bertipe String
    schema = tbl.schema
    for col_name in ["nama", "skor", "kategori"]:
        field = schema.field(col_name)
        assert field.type == pa.string()

    # Lima kolom audit
    audit_expected = {
        "_ingested_at": pa.timestamp("us", tz="UTC"),
        "_source_url": pa.string(),
        "_batch_id": pa.string(),
        "_row_hash": pa.string(),
        "_tenant": pa.string(),
    }
    for col_name, col_type in audit_expected.items():
        assert col_name in schema.names
        assert schema.field(col_name).type == col_type


def test_ingest_files_skip_and_reingest(tmp_path: Path, temp_catalog: Any):
    """Kriteria 1: Ingest berkas dua kali menulis Bronze sekali; ubah 1 byte menulis ulang hanya berkas itu."""
    repo_root = tmp_path / "repo"
    (repo_root / "lakehouse").mkdir(parents=True)
    (repo_root / "data").mkdir(parents=True)

    f1 = repo_root / "data" / "f1.tsv"
    f2 = repo_root / "data" / "f2.tsv"
    f1.write_text("id\tnama\n1\tMonas\n", encoding="utf-8")
    f2.write_text("id\tnama\n2\tAncol\n", encoding="utf-8")

    toml_content = """
[[sumber]]
id = "berkas-1"
jenis = "berkas"
path = "data/f1.tsv"
namespace = "bronze_file"
tabel = "f1"
kelas_refresh = "snapshot"
tanggal_ambil = "2026-10-08"
asal = "test"
pembangun = ""

[[sumber]]
id = "berkas-2"
jenis = "berkas"
path = "data/f2.tsv"
namespace = "bronze_file"
tabel = "f2"
kelas_refresh = "snapshot"
tanggal_ambil = "2026-10-08"
asal = "test"
pembangun = ""
"""
    (repo_root / "lakehouse" / "sources.toml").write_text(toml_content, encoding="utf-8")

    # Run 1: kedua berkas baru di-ingest
    r1 = ingest_files(root=repo_root, catalog=temp_catalog)
    assert r1["berhasil"] == 2
    assert r1["dilewati"] == 0
    assert temp_catalog.table_exists(("bronze_file", "f1"))
    assert temp_catalog.table_exists(("bronze_file", "f2"))

    t_f1 = temp_catalog.load_table(("bronze_file", "f1"))
    assert t_f1.scan().to_arrow().num_rows == 1

    log_tbl = temp_catalog.load_table(("bronze_meta", "ingest_log"))
    assert log_tbl.scan().to_arrow().num_rows == 2

    # Run 2: tidak ada berkas yang berubah -> keduanya dilewati
    r2 = ingest_files(root=repo_root, catalog=temp_catalog)
    assert r2["berhasil"] == 0
    assert r2["dilewati"] == 2
    assert set(r2["daftar_dilewati"]) == {"berkas-1", "berkas-2"}
    # Log tidak bertambah
    log_tbl.refresh()
    assert log_tbl.scan().to_arrow().num_rows == 2

    # Ubah 1 byte pada f1
    with open(f1, "ab") as f:
        f.write(b" ")

    # Run 3: hanya f1 yang ditulis ulang, f2 dilewati
    r3 = ingest_files(root=repo_root, catalog=temp_catalog)
    assert r3["berhasil"] == 1
    assert r3["dilewati"] == 1
    assert r3["daftar_dilewati"] == ["berkas-2"]
    # Log bertambah 1 baris (total 3)
    log_tbl.refresh()
    assert log_tbl.scan().to_arrow().num_rows == 3


def test_ingest_secondary_skip_and_reingest(tmp_path: Path, temp_catalog: Any):
    """Kriteria 1 (sekunder): Dua run menulis Bronze sekali; ubah 1 byte menulis ulang hanya berkas itu."""
    repo_root = tmp_path / "repo"
    (repo_root / "lakehouse").mkdir(parents=True)
    (repo_root / "data" / "sekunder").mkdir(parents=True)

    sec1 = repo_root / "data" / "sekunder" / "sec1.json"
    sec2 = repo_root / "data" / "sekunder" / "sec2.json"

    data1 = {
        "slug": "sec-1",
        "title": "Sec 1",
        "description": "Deskripsi 1",
        "tags": ["s1"],
        "columns": [{"key": "col1", "type": "string", "label": "Col 1"}],
        "rows": [{"col1": "val1"}],
    }
    data2 = {
        "slug": "sec-2",
        "title": "Sec 2",
        "description": "Deskripsi 2",
        "tags": ["s2"],
        "columns": [{"key": "col2", "type": "string", "label": "Col 2"}],
        "rows": [{"col2": "val2"}],
    }
    sec1.write_text(json.dumps(data1), encoding="utf-8")
    sec2.write_text(json.dumps(data2), encoding="utf-8")

    toml_content = """
[[sumber]]
id = "sec-1"
jenis = "sekunder"
path = "data/sekunder/sec1.json"
namespace = "bronze_sec"
tabel = "sec_1"
kelas_refresh = "snapshot"
tanggal_ambil = "2026-10-08"
asal = "test"
pembangun = ""

[[sumber]]
id = "sec-2"
jenis = "sekunder"
path = "data/sekunder/sec2.json"
namespace = "bronze_sec"
tabel = "sec_2"
kelas_refresh = "snapshot"
tanggal_ambil = "2026-10-08"
asal = "test"
pembangun = ""
"""
    (repo_root / "lakehouse" / "sources.toml").write_text(toml_content, encoding="utf-8")

    # Run 1: kedua dataset di-ingest
    r1 = ingest_secondary(root=repo_root, catalog=temp_catalog)
    assert r1["diperbarui"] == 2
    assert r1["dilewati"] == 0
    assert temp_catalog.table_exists(("bronze_sec", "sec_1"))
    assert temp_catalog.table_exists(("bronze_sec", "sec_2"))
    assert temp_catalog.table_exists(("bronze_meta_sec", "dataset_catalog"))
    assert temp_catalog.table_exists(("bronze_meta_sec", "dataset_sync"))
    assert temp_catalog.table_exists(("bronze_meta_sec", "dataset_column"))

    # Run 2: tidak ada berkas yang berubah
    r2 = ingest_secondary(root=repo_root, catalog=temp_catalog)
    assert r2["diperbarui"] == 0
    assert r2["dilewati"] == 2
    # Tabel meta tetap berisi 2 entri
    cat_tbl = temp_catalog.load_table(("bronze_meta_sec", "dataset_catalog"))
    assert cat_tbl.scan().to_arrow().num_rows == 2

    # Ubah 1 byte pada sec1
    with open(sec1, "ab") as f:
        f.write(b" ")

    # Run 3: hanya sec1 yang di-ingest ulang
    r3 = ingest_secondary(root=repo_root, catalog=temp_catalog)
    assert r3["diperbarui"] == 1
    assert r3["dilewati"] == 1


def test_ingest_secondary_berkas_hilang_raises_and_no_meta_written(
    tmp_path: Path, temp_catalog: Any
):
    """Kriteria 2: berkas sekunder terdaftar hilang -> melempar error dan tabel meta tidak disentuh."""
    repo_root = tmp_path / "repo"
    (repo_root / "lakehouse").mkdir(parents=True)
    (repo_root / "data" / "sekunder").mkdir(parents=True)

    sec1 = repo_root / "data" / "sekunder" / "sec1.json"
    sec1.write_text(json.dumps({
        "slug": "sec-1", "title": "S1", "description": "D1", "tags": [], "columns": [], "rows": [],
    }), encoding="utf-8")
    # sec2.json sengaja TIDAK dibuat

    toml_content = """
[[sumber]]
id = "sec-1"
jenis = "sekunder"
path = "data/sekunder/sec1.json"
namespace = "bronze_sec"
tabel = "sec_1"
kelas_refresh = "snapshot"
tanggal_ambil = "2026-10-08"
asal = "test"
pembangun = ""

[[sumber]]
id = "sec-2"
jenis = "sekunder"
path = "data/sekunder/sec2.json"
namespace = "bronze_sec"
tabel = "sec_2"
kelas_refresh = "snapshot"
tanggal_ambil = "2026-10-08"
asal = "test"
pembangun = ""
"""
    (repo_root / "lakehouse" / "sources.toml").write_text(toml_content, encoding="utf-8")

    with pytest.raises(Exception):  # RegistryError atau FileNotFoundError
        ingest_secondary(root=repo_root, catalog=temp_catalog)

    # Pastikan ketiga tabel meta sekunder TIDAK disentuh/dibuat
    assert not temp_catalog.table_exists(("bronze_meta_sec", "dataset_catalog"))
    assert not temp_catalog.table_exists(("bronze_meta_sec", "dataset_sync"))
    assert not temp_catalog.table_exists(("bronze_meta_sec", "dataset_column"))


def test_dagster_definitions():
    """Kriteria 3: bronze_sekunder ada di refresh_job dan lake_db bergantung padanya."""
    from dispar_orchestrate.definitions import bronze_sekunder, defs, lake_db, refresh_job

    asset_graph = defs.resolve_asset_graph()

    # Pastikan bronze_sekunder adalah aset terdaftar
    assert bronze_sekunder.key in asset_graph.get_all_asset_keys()

    # Pastikan lake_db memiliki dependensi pada bronze_sekunder
    parents = asset_graph.get(lake_db.key).parent_keys
    assert bronze_sekunder.key in parents

    # Pastikan bronze_sekunder ada dalam selection refresh_job
    selected_keys = refresh_job.selection.resolve(asset_graph)
    assert bronze_sekunder.key in selected_keys
