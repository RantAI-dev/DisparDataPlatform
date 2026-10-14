"""Test untuk Plan 05: Metadata dan log ingest SDI masuk job harian, dan Plan F2 pengaman."""

from __future__ import annotations

from pathlib import Path
from typing import Any
from unittest.mock import MagicMock, patch

import pyarrow as pa
import pytest
from pyiceberg.catalog.sql import SqlCatalog

from dispar_ingest.meta import (
    MetadataShrinkageError,
    _replace_table,
    capture_metadata,
    fill_totals,
)
from dispar_ingest.run_bronze import ingest_sdi
from dispar_ingest.sdi import Dataset, DatasetDetail


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
    """Kriteria 1 (Batch 1 Plan 05): capture_metadata dengan hasil 100 dataset terhadap tabel berisi 183
    -> tidak ada penulisan, error terangkat dengan menyebut kedua angka.
    """
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

    mock_client = MagicMock()
    mock_client.list_datasets.return_value = [
        Dataset(slug=f"new-{i}", title=f"New {i}") for i in range(100)
    ]

    with pytest.raises(MetadataShrinkageError) as exc_info:
        capture_metadata(client=mock_client, catalog=temp_catalog)

    pesan = str(exc_info.value)
    assert "100" in pesan
    assert "183" in pesan

    loaded = temp_catalog.load_table(("bronze_meta", "dataset_catalog"))
    assert loaded.scan().to_arrow().num_rows == 183
    assert not temp_catalog.table_exists(("bronze_meta", "dataset_sync"))
    assert not temp_catalog.table_exists(("bronze_meta", "dataset_column"))


def test_detail_failure_prevents_metadata_write(temp_catalog: Any):
    """Plan F2 Kriteria 1: /detail gagal untuk 170 dari 183 dataset terhadap tabel berisi 183
    -> tidak ada penulisan ke ketiga tabel, error terangkat.
    """
    # Siapkan ketiga tabel awal berisi 183 dataset
    slugs = [f"ds-{i}" for i in range(183)]
    cat_rows = {
        "slug": slugs,
        "title": [f"T {i}" for i in range(183)],
        "description": ["" for _ in range(183)],
        "tags": ["[]" for _ in range(183)],
        "views": [0 for _ in range(183)],
        "updated_at": ["" for _ in range(183)],
        "tier": ["primer" for _ in range(183)],
        "table_name": [f"ds_{i}" for i in range(183)],
    }
    _replace_table(temp_catalog, "bronze_meta", "dataset_catalog", pa.table({k: pa.array(v) for k, v in cat_rows.items()}))

    sync_rows = {
        "slug": slugs,
        "title": [f"T {i}" for i in range(183)],
        "description": ["" for _ in range(183)],
        "sumber_data": ["[]" for _ in range(183)],
        "frekuensi": ["" for _ in range(183)],
        "satuan": ["" for _ in range(183)],
        "klasifikasi": ["" for _ in range(183)],
        "kontak": ["" for _ in range(183)],
        "author": ["" for _ in range(183)],
        "total": [10 for _ in range(183)],
        "table_name": [f"ds_{i}" for i in range(183)],
        "synced_at": [pa.scalar(1000000, pa.timestamp("us", tz="UTC")) for _ in range(183)],
    }
    _replace_table(temp_catalog, "bronze_meta", "dataset_sync", pa.table({
        k: pa.array(v) if k != "synced_at" else pa.array([1000000] * 183, pa.timestamp("us", tz="UTC"))
        for k, v in sync_rows.items()
    }))

    col_rows = {
        "slug": slugs,
        "ord": [0 for _ in range(183)],
        "key_asli": ["col1" for _ in range(183)],
        "key_safe": ["col1" for _ in range(183)],
        "tipe": ["string" for _ in range(183)],
        "deskripsi": ["" for _ in range(183)],
    }
    _replace_table(temp_catalog, "bronze_meta", "dataset_column", pa.table({k: pa.array(v) for k, v in col_rows.items()}))

    # Mock client: list_datasets mengembalikan 183 dataset, tapi dataset_detail gagal untuk 170 di antaranya
    mock_client = MagicMock()
    mock_client.list_datasets.return_value = [Dataset(slug=s, title=f"Title {s}") for s in slugs]

    def mock_detail(slug: str):
        idx = int(slug.split("-")[1])
        if idx >= 13:  # 170 gagal (13 sampai 182)
            raise RuntimeError(f"SDI 500 error for {slug}")
        return DatasetDetail(
            slug=slug, title=f"Title {slug}", description="", sumber_data=[],
            frekuensi="", satuan="", klasifikasi="", kontak="", author="",
            columns=[{"key": "col1", "type": "string", "description": ""}],
        )

    mock_client.dataset_detail.side_effect = mock_detail

    with pytest.raises(MetadataShrinkageError) as exc_info:
        capture_metadata(client=mock_client, catalog=temp_catalog)

    pesan = str(exc_info.value)
    assert "dataset_sync" in pesan
    assert "13" in pesan
    assert "183" in pesan

    # Pastikan TIDAK ADA tabel yang ditimpa (tetap 183)
    assert temp_catalog.load_table(("bronze_meta", "dataset_catalog")).scan().to_arrow().num_rows == 183
    assert temp_catalog.load_table(("bronze_meta", "dataset_sync")).scan().to_arrow().num_rows == 183
    assert temp_catalog.load_table(("bronze_meta", "dataset_column")).scan().to_arrow().num_rows == 183


def test_existing_totals_preserved_in_capture_metadata(temp_catalog: Any):
    """Plan F2 Kriteria 2: Total lama terbawa: tabel lama punya total = 500 untuk dataset X
    -> sesudah capture_metadata, X tetap 500; dataset baru mulai dari 0.
    """
    # Siapkan dataset_sync lama dengan ds-x total 500
    sync_rows = {
        "slug": ["ds-x"],
        "title": ["Dataset X"],
        "description": [""],
        "sumber_data": ["[]"],
        "frekuensi": [""],
        "satuan": [""],
        "klasifikasi": [""],
        "kontak": [""],
        "author": [""],
        "total": [500],
        "table_name": ["ds_x"],
        "synced_at": pa.array([1000000], pa.timestamp("us", tz="UTC")),
    }
    _replace_table(temp_catalog, "bronze_meta", "dataset_sync", pa.table({
        k: pa.array(v) if k != "synced_at" else v for k, v in sync_rows.items()
    }))

    # Mock client: ds-x dan ds-baru
    mock_client = MagicMock()
    mock_client.list_datasets.return_value = [
        Dataset(slug="ds-x", title="Dataset X"),
        Dataset(slug="ds-baru", title="Dataset Baru"),
    ]
    mock_client.dataset_detail.side_effect = lambda s: DatasetDetail(
        slug=s, title=f"Detail {s}", description="", sumber_data=[],
        frekuensi="", satuan="", klasifikasi="", kontak="", author="",
        columns=[{"key": "c1", "type": "string"}],
    )

    capture_metadata(client=mock_client, catalog=temp_catalog)

    sync_tbl = temp_catalog.load_table(("bronze_meta", "dataset_sync"))
    arrow = sync_tbl.scan().to_arrow()
    res = dict(zip(arrow.column("slug").to_pylist(), arrow.column("total").to_pylist()))

    assert res["ds-x"] == 500  # Terbawa dari tabel lama!
    assert res["ds-baru"] == 0  # Dataset baru mulai dari 0


def test_fill_totals_clickhouse_unreachable_raises_and_no_write(temp_catalog: Any):
    """Plan F2 Kriteria 3: fill_totals dengan ClickHouse tak terjangkau -> error, dataset_sync tidak ditulis ulang."""
    sync_rows = {
        "slug": ["ds-x"],
        "title": ["Dataset X"],
        "description": [""],
        "sumber_data": ["[]"],
        "frekuensi": [""],
        "satuan": [""],
        "klasifikasi": [""],
        "kontak": [""],
        "author": [""],
        "total": [500],
        "table_name": ["ds_x"],
        "synced_at": pa.array([1000000], pa.timestamp("us", tz="UTC")),
    }
    _replace_table(temp_catalog, "bronze_meta", "dataset_sync", pa.table({
        k: pa.array(v) if k != "synced_at" else v for k, v in sync_rows.items()
    }))

    mock_ch = MagicMock()
    mock_ch.query.side_effect = ConnectionError("ClickHouse down")

    with pytest.raises(RuntimeError) as exc_info:
        fill_totals(catalog=temp_catalog, ch_client=mock_ch)
    assert "ClickHouse" in str(exc_info.value)

    # dataset_sync tidak diubah
    sync_tbl = temp_catalog.load_table(("bronze_meta", "dataset_sync"))
    assert sync_tbl.scan().to_arrow().column("total").to_pylist() == [500]

    # Uji juga jika ch_client=None dan koneksi gagal
    with patch("clickhouse_connect.get_client", side_effect=ConnectionError("Cannot connect")):
        with pytest.raises(RuntimeError):
            fill_totals(catalog=temp_catalog, ch_client=None)

    assert sync_tbl.scan().to_arrow().column("total").to_pylist() == [500]


def test_sdi_meta_calls_capture_metadata_then_fill_totals():
    """Plan F2 Kriteria 4: Aset sdi_meta memanggil capture_metadata lalu fill_totals (memeriksa urutan dan penanganan error)."""
    from dagster import build_op_context
    from dispar_orchestrate.definitions import sdi_meta

    context = build_op_context()
    calls = []

    def fake_capture():
        calls.append("capture")
        return {"katalog": 183, "sync": 183, "kolom": 1000}

    def fake_fill():
        calls.append("fill")
        return 180

    with patch("dispar_ingest.meta.capture_metadata", side_effect=fake_capture), \
         patch("dispar_ingest.meta.fill_totals", side_effect=fake_fill):
        sdi_meta(context)

    assert calls == ["capture", "fill"]

    # Pastikan jika fill_totals gagal, aset sdi_meta melempar error (tidak ditelan!)
    def broken_fill():
        raise RuntimeError("CH unreachable")

    with patch("dispar_ingest.meta.capture_metadata", side_effect=fake_capture), \
         patch("dispar_ingest.meta.fill_totals", side_effect=broken_fill):
        with pytest.raises(RuntimeError) as exc_info:
            sdi_meta(context)
        assert "CH unreachable" in str(exc_info.value)


def test_ingest_sdi_writes_log_with_statuses(temp_catalog: Any):
    """Kriteria 2 (Batch 1 Plan 05): ingest_sdi atas tiga dataset tiruan (berisi, kosong, melempar error)
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

    assert temp_catalog.table_exists(("bronze_meta", "ingest_log"))
    log_tbl = temp_catalog.load_table(("bronze_meta", "ingest_log"))
    arrow = log_tbl.scan().to_arrow()
    assert arrow.num_rows == 3

    pylist = arrow.to_pylist()
    log_map = {r["tabel"]: r for r in pylist}

    assert "ds_berisi" in log_map
    r_berisi = log_map["ds_berisi"]
    assert r_berisi["sumber_id"] == "sdi"
    assert r_berisi["namespace"] == "bronze_sdi"
    assert r_berisi["status"] == "masuk"
    assert r_berisi["baris"] == 1
    assert len(r_berisi["sha256"]) == 64

    assert "ds_kosong" in log_map
    r_kosong = log_map["ds_kosong"]
    assert r_kosong["sumber_id"] == "sdi"
    assert r_kosong["namespace"] == "bronze_sdi"
    assert r_kosong["status"] == "kosong"
    assert r_kosong["baris"] == 0

    assert "ds_gagal" in log_map
    r_gagal = log_map["ds_gagal"]
    assert r_gagal["sumber_id"] == "sdi"
    assert r_gagal["namespace"] == "bronze_sdi"
    assert r_gagal["status"] == "gagal"
    assert r_gagal["baris"] == 0
    assert "SDI 500 Internal Server Error" in r_gagal["pesan"]


def test_sdi_meta_in_refresh_job_and_dependencies():
    """Kriteria 3 (Batch 1 Plan 05): sdi_meta ada di refresh_job dan berjalan setelah bronze_sdi."""
    from dispar_orchestrate.definitions import (
        bronze_sdi,
        defs,
        lake_db,
        refresh_job,
        sdi_meta,
    )

    asset_graph = defs.resolve_asset_graph()

    assert sdi_meta.key in asset_graph.get_all_asset_keys()
    sdi_meta_parents = asset_graph.get(sdi_meta.key).parent_keys
    assert bronze_sdi.key in sdi_meta_parents
    lake_db_parents = asset_graph.get(lake_db.key).parent_keys
    assert sdi_meta.key in lake_db_parents
    selected_keys = refresh_job.selection.resolve(asset_graph)
    assert sdi_meta.key in selected_keys
