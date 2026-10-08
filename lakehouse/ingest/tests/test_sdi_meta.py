"""Test untuk Plan 05: Metadata dan log ingest SDI masuk job harian."""

from __future__ import annotations

from pathlib import Path
from typing import Any
from unittest.mock import MagicMock

import pyarrow as pa
import pytest
from pyiceberg.catalog.sql import SqlCatalog

from dispar_ingest.meta import (
    MetadataShrinkageError,
    _replace_table,
    capture_metadata,
)
from dispar_ingest.run_bronze import ingest_sdi
from dispar_ingest.sdi import Dataset


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


def test_capture_metadata_shrinkage_prevents_write(temp_catalog: Any):
    """Kriteria 1: capture_metadata dengan hasil 100 dataset terhadap tabel berisi 183

    -> tidak ada penulisan, error terangkat dengan menyebut kedua angka.
    """
    # Siapkan tabel awal berisi 183 baris
    existing_rows = {
        "slug": [f"slug-{i}" for i in range(183)],
        "title": [f"Title {i}" for i in range(183)],
        "description": ["" for _ in range(183)],
        "tags": ["[]" for _ in range(183)],
        "views": [0 for _ in range(183)],
        "updated_at": ["" for _ in range(183)],
        "tier": ["primer" for _ in range(183)],
        "table_name": [f"slug_{i}" for i in range(183)],
    }
    cat_table = pa.table({k: pa.array(v) for k, v in existing_rows.items()})
    _replace_table(temp_catalog, "bronze_meta", "dataset_catalog", cat_table)

    # Mock client yang mengembalikan 100 dataset baru
    mock_client = MagicMock()
    mock_client.list_datasets.return_value = [
        Dataset(slug=f"new-{i}", title=f"New {i}") for i in range(100)
    ]

    with pytest.raises(MetadataShrinkageError) as exc_info:
        capture_metadata(client=mock_client, catalog=temp_catalog)

    # Pesan harus memuat kedua angka (100 dan 183)
    pesan = str(exc_info.value)
    assert "100" in pesan
    assert "183" in pesan

    # Pastikan tabel lama tidak tertimpa dan tabel sync/column tidak dibuat
    loaded = temp_catalog.load_table(("bronze_meta", "dataset_catalog"))
    assert loaded.scan().to_arrow().num_rows == 183
    assert not temp_catalog.table_exists(("bronze_meta", "dataset_sync"))
    assert not temp_catalog.table_exists(("bronze_meta", "dataset_column"))


def test_ingest_sdi_writes_log_with_statuses(temp_catalog: Any):
    """Kriteria 2: ingest_sdi atas tiga dataset tiruan (berisi, kosong, melempar error)

    menulis tiga baris log dengan status yang benar.
    """
    ds_berisi = Dataset(slug="ds-berisi", title="Dataset Berisi")
    ds_kosong = Dataset(slug="ds-kosong", title="Dataset Kosong")
    ds_gagal = Dataset(slug="ds-gagal", title="Dataset Gagal")

    mock_client = MagicMock()
    mock_client.list_datasets.return_value = [ds_berisi, ds_kosong, ds_gagal]

    def mock_dataset_rows(slug: str):
        if slug == "ds-berisi":
            return [{"kolom1": "nilai1", "kolom2": 123}]
        elif slug == "ds-kosong":
            return []
        elif slug == "ds-gagal":
            raise RuntimeError("SDI 500 Internal Server Error")
        return []

    mock_client.dataset_rows.side_effect = mock_dataset_rows

    laporan = ingest_sdi(client=mock_client, catalog=temp_catalog)

    assert laporan["berhasil"] == 1
    assert laporan["kosong"] == 1
    assert laporan["gagal"] == 1
    assert laporan["daftar_kosong"] == ["ds-kosong"]
    assert laporan["daftar_gagal"] == [{"slug": "ds-gagal", "error": "SDI 500 Internal Server Error"}]

    # Periksa isi bronze_meta.ingest_log
    assert temp_catalog.table_exists(("bronze_meta", "ingest_log"))
    log_tbl = temp_catalog.load_table(("bronze_meta", "ingest_log"))
    arrow = log_tbl.scan().to_arrow()
    assert arrow.num_rows == 3

    pylist = arrow.to_pylist()
    log_map = {r["tabel"]: r for r in pylist}

    # ds_berisi
    assert "ds_berisi" in log_map
    r_berisi = log_map["ds_berisi"]
    assert r_berisi["sumber_id"] == "sdi"
    assert r_berisi["namespace"] == "bronze_sdi"
    assert r_berisi["status"] == "masuk"
    assert r_berisi["baris"] == 1
    assert len(r_berisi["sha256"]) == 64  # sha256 hex string

    # ds_kosong
    assert "ds_kosong" in log_map
    r_kosong = log_map["ds_kosong"]
    assert r_kosong["sumber_id"] == "sdi"
    assert r_kosong["namespace"] == "bronze_sdi"
    assert r_kosong["status"] == "kosong"
    assert r_kosong["baris"] == 0

    # ds_gagal
    assert "ds_gagal" in log_map
    r_gagal = log_map["ds_gagal"]
    assert r_gagal["sumber_id"] == "sdi"
    assert r_gagal["namespace"] == "bronze_sdi"
    assert r_gagal["status"] == "gagal"
    assert r_gagal["baris"] == 0
    assert "SDI 500 Internal Server Error" in r_gagal["pesan"]


def test_sdi_meta_in_refresh_job_and_dependencies():
    """Kriteria 3: sdi_meta ada di refresh_job dan berjalan setelah bronze_sdi."""
    from dispar_orchestrate.definitions import (
        bronze_sdi,
        defs,
        lake_db,
        refresh_job,
        sdi_meta,
    )

    asset_graph = defs.resolve_asset_graph()

    # Pastikan sdi_meta adalah aset terdaftar
    assert sdi_meta.key in asset_graph.get_all_asset_keys()

    # Pastikan sdi_meta memiliki dependensi pada bronze_sdi
    sdi_meta_parents = asset_graph.get(sdi_meta.key).parent_keys
    assert bronze_sdi.key in sdi_meta_parents

    # Pastikan lake_db memiliki dependensi pada sdi_meta
    lake_db_parents = asset_graph.get(lake_db.key).parent_keys
    assert sdi_meta.key in lake_db_parents

    # Pastikan sdi_meta ada dalam selection refresh_job
    selected_keys = refresh_job.selection.resolve(asset_graph)
    assert sdi_meta.key in selected_keys
