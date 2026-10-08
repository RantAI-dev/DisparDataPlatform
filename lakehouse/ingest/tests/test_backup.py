from __future__ import annotations

import os
from unittest.mock import MagicMock, patch

import pytest
from dagster import build_op_context
from dispar_ingest.backup import run_backup


def test_backup_incremental_skips_identical_files():
    """Backup harus inkremental: objek dengan path dan ukuran yang sama dilewati."""
    content_a = b"x" * 100
    content_b = b"y" * 200
    mock_src_files = {
        "lakehouse/a.parquet": {"name": "lakehouse/a.parquet", "size": len(content_a)},
        "lakehouse/b.parquet": {"name": "lakehouse/b.parquet", "size": len(content_b)},
    }

    mock_src_fs = MagicMock()
    mock_src_fs.find.return_value = mock_src_files
    mock_src_fs.cat_file.side_effect = lambda k: content_a if "a.parquet" in k else content_b

    dst_storage: dict[str, bytes] = {}

    def mock_dst_find(prefix, detail=True):
        res = {}
        for p, d in dst_storage.items():
            if p.startswith(prefix):
                res[p] = {"name": p, "size": len(d)}
        return res

    def mock_dst_pipe_file(path, data):
        dst_storage[path] = data

    mock_dst_fs = MagicMock()
    mock_dst_fs.exists.return_value = True
    mock_dst_fs.find.side_effect = mock_dst_find
    mock_dst_fs.pipe_file.side_effect = mock_dst_pipe_file

    with patch("dispar_ingest.backup._fs", side_effect=[mock_src_fs, mock_dst_fs]):
        # Run 1: target stabil "latest"
        r1 = run_backup("latest")
        assert r1["objek_disalin"] == 2
        assert r1["objek_dilewati_sama"] == 0
        assert len(dst_storage) == 3  # a.parquet, b.parquet, _manifest.json

    with patch("dispar_ingest.backup._fs", side_effect=[mock_src_fs, mock_dst_fs]):
        # Run 2: objek tidak berubah, semua harus dilewati
        r2 = run_backup("latest")
        assert r2["objek_disalin"] == 0
        assert r2["objek_dilewati_sama"] == 2


def test_backup_retry_on_transient_s3_error():
    """Uji retry saat menghadapi error transien S3 (SlowDownRead / 503 Service Unavailable)."""
    mock_src_files = {
        "lakehouse/a.parquet": {"name": "lakehouse/a.parquet", "size": 100},
    }

    mock_src_fs = MagicMock()
    mock_src_fs.find.return_value = mock_src_files
    mock_src_fs.cat_file.return_value = b"x" * 100

    mock_dst_fs = MagicMock()
    mock_dst_fs.exists.return_value = True
    mock_dst_fs.find.return_value = {}

    parquet_attempts = [0]

    def flaky_pipe_file(path, data):
        if "a.parquet" in path:
            parquet_attempts[0] += 1
            if parquet_attempts[0] == 1:
                raise OSError(16, "The service is unavailable. Please retry.")
            if parquet_attempts[0] == 2:
                raise OSError(5, "SlowDownRead: reduce request rate")
        return None

    mock_dst_fs.pipe_file.side_effect = flaky_pipe_file

    with patch("dispar_ingest.backup._fs", side_effect=[mock_src_fs, mock_dst_fs]), \
         patch("time.sleep", return_value=None):
        r = run_backup("latest")
        assert r["objek_disalin"] == 1
        assert parquet_attempts[0] == 3


def test_backup_lake_asset_uses_stable_target_and_metadata():
    """Aset backup_lake harus menggunakan target stabil bukan run_id unik, dan mencatat dilewati."""
    from dispar_orchestrate.definitions import backup_lake

    context = build_op_context(
        run_tags={"dagster/schedule_name": "ops_backup_maintenance_schedule"},
    )

    with patch("dispar_ingest.backup.run_backup") as mock_run_backup:
        mock_run_backup.return_value = {
            "tanggal": "latest",
            "offsite": False,
            "dst": "http://lake-rustfs:9000/lakehouse-backup/latest",
            "objek_disalin": 5,
            "objek_dilewati_sama": 50000,
            "bytes_disalin": 1024,
        }
        with patch("dispar_orchestrate.definitions.notify"):
            backup_lake(context)

            # Harus dipanggil dengan target stabil (default "latest"), BUKAN run_id unik
            mock_run_backup.assert_called_once_with("latest")
