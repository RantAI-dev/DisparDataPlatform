"""Definisi Dagster: pipeline lakehouse sebagai graf aset.

Graf aset inilah bukti visual arsitektur Bronze→Silver→Gold yang diminta MoM —
ketergantungan antar-aset menghasilkan lineage otomatis di UI Dagster.

    bronze_sdi ──────┐
    bronze_files ────┼──► lake_db ──► functions_dim ──► silver_auto ──► curated_gold
    bronze_sekunder ─┘
"""

from __future__ import annotations

import os

from dagster import (
    DagsterRunStatus,
    DefaultScheduleStatus,
    DefaultSensorStatus,
    Definitions,
    RunStatusSensorContext,
    ScheduleDefinition,
    asset,
    define_asset_job,
    run_status_sensor,
)

from dispar_ingest import refresh
from dispar_ingest.notify import notify
from dispar_ingest.run_bronze import ingest_files, ingest_sdi
from dispar_ingest.secondary_ingest import ingest_secondary
from dispar_ingest.silver import generate_silver


@asset(group_name="bronze", description="Tarik 183 dataset SDI ke Iceberg (all-string + audit)")
def bronze_sdi(context) -> None:
    laporan = ingest_sdi()
    context.add_output_metadata({"berhasil": laporan["berhasil"], "baris": laporan["baris_total"]})


@asset(group_name="bronze", description="Tarik berkas lokal (TSV/CSV/XLSX/JSON) dari registri ke Iceberg")
def bronze_files(context) -> None:
    laporan = ingest_files()
    context.add_output_metadata({"berhasil": laporan["berhasil"], "baris": laporan["baris_total"]})


@asset(group_name="bronze", description="Tarik dataset sekunder dari registri ke Iceberg (bronze_sec + meta)")
def bronze_sekunder(context) -> None:
    laporan = ingest_secondary()
    context.add_output_metadata({
        "dataset": laporan["dataset"],
        "diperbarui": laporan["diperbarui"],
        "dilewati": laporan["dilewati"],
    })


@asset(
    group_name="bronze",
    deps=[bronze_sdi],
    description="Tangkap metadata katalog & definisi kolom SDI ke bronze_meta, lalu isi total",
)
def sdi_meta(context) -> None:
    from dispar_ingest.meta import capture_metadata, fill_totals
    laporan = capture_metadata()
    try:
        terisi = fill_totals()
    except Exception as e:
        context.log.warning(f"fill_totals dilewati atau gagal: {e}")
        terisi = 0
    context.add_output_metadata({
        "katalog": laporan["katalog"],
        "sync": laporan["sync"],
        "kolom": laporan["kolom"],
        "total_terisi": terisi,
    })


@asset(group_name="silver", deps=[bronze_sdi, bronze_files, bronze_sekunder, sdi_meta],
       description="Sambungkan ClickHouse ke katalog Iceberg")
def lake_db(context) -> None:
    context.log.info(refresh.recreate_lake_db() or "")


@asset(group_name="silver", deps=[lake_db],
       description="Fungsi konversi Indonesia + dimensi (negara/bulan/wilayah/periode/indikator)")
def functions_dim(context) -> None:
    context.log.info(refresh.apply_functions_dim())


@asset(group_name="silver", deps=[functions_dim],
       description="Inferensi tipe otomatis → 180+ view Silver bertipe")
def silver_auto(context) -> None:
    generate_silver()


@asset(group_name="silver", deps=[silver_auto],
       description="Gate kualitas: karantina baris gagal-konversi + deteksi anomali (row drop/null)")
def quality_gate(context) -> None:
    from dispar_ingest.quality import run_quality
    r = run_quality(fail_on_error=True)
    context.add_output_metadata({
        "pass": r["pass"], "warn": r["warn"], "fail": r["fail"],
        "karantina_baris": r["karantina_baris"],
    })
    if r["fails"]:
        # Alert tapi jangan blokir Gold total — data lama tetap tersaji.
        notify("Quality gate menemukan masalah: " + "; ".join(r["fails"][:5]), "warn")


@asset(group_name="gold", deps=[quality_gate],
       description="Silver kurasi (wisman/restoran/dtw/event) + mart Gold MergeTree")
def curated_gold(context) -> None:
    context.log.info(refresh.apply_curated_gold())


@asset(group_name="gold", deps=[curated_gold],
       description="Publikasi mart Gold ke Iceberg (portabilitas Oracle/Trino/Spark)")
def gold_iceberg(context) -> None:
    from dispar_ingest.publish import publish_marts
    context.log.info(str(publish_marts()))


# ── Aset operasional base lakehouse (backup, maintenance) ──────────────────
@asset(group_name="ops", description="Backup inkremental bucket Iceberg ke storage backup (S3→S3)")
def backup_lake(context) -> None:
    from dispar_ingest.backup import run_backup
    # Target backup stabil (default "latest", atau configurable via LAKE_BACKUP_TARGET).
    # Dengan target stabil, find(prefix) mendeteksi objek yang sudah tersalin
    # sehingga run harian bersifat benar-benar inkremental (hanya objek baru/berubah).
    target = os.environ.get("LAKE_BACKUP_TARGET", "latest")
    r = run_backup(target)
    context.add_output_metadata({
        "objek_disalin": r["objek_disalin"],
        "objek_dilewati_sama": r["objek_dilewati_sama"],
        "bytes_disalin": r["bytes_disalin"],
        "offsite": r["offsite"],
    })
    if not r["offsite"]:
        notify("Backup jalan tapi BELUM offsite (set BACKUP_S3_ENDPOINT untuk proteksi disk mati).", "warn")


@asset(group_name="ops", description="Expire snapshot Iceberg lama (anti-bloat metadata/storage)")
def iceberg_maintenance(context) -> None:
    from dispar_ingest.maintenance import run_maintenance
    r = run_maintenance()
    context.add_output_metadata({"snapshot_diexpire": r["snapshot_diexpire"], "tabel": r["tabel"]})


refresh_job = define_asset_job(
    "refresh_lakehouse",
    selection=[bronze_sdi, bronze_files, bronze_sekunder, sdi_meta, lake_db, functions_dim, silver_auto, quality_gate, curated_gold, gold_iceberg],
)
ops_job = define_asset_job("ops_backup_maintenance", selection=[backup_lake, iceberg_maintenance])

# Refresh harian 02:00 — penarikan SDI + rebuild lakehouse (satu-satunya yang
# menyentuh API SDI, di belakang). default_status RUNNING = aktif otomatis.
daily = ScheduleDefinition(
    job=refresh_job,
    cron_schedule="0 2 * * *",
    default_status=DefaultScheduleStatus.RUNNING,
)
# Backup + maintenance harian 04:00 (setelah refresh selesai).
ops_daily = ScheduleDefinition(
    job=ops_job,
    cron_schedule="0 4 * * *",
    default_status=DefaultScheduleStatus.RUNNING,
)


# ── Alerting: kirim webhook saat run gagal ──────────────────────────────────
@run_status_sensor(
    run_status=DagsterRunStatus.FAILURE,
    default_status=DefaultSensorStatus.RUNNING,
)
def alert_on_failure(context: RunStatusSensorContext) -> None:
    job = context.dagster_run.job_name
    notify(f"Pipeline GAGAL: job '{job}' (run {context.dagster_run.run_id[:8]}). Cek Dagster UI.", "error")


defs = Definitions(
    assets=[
        bronze_sdi, bronze_files, bronze_sekunder, sdi_meta, lake_db, functions_dim, silver_auto,
        quality_gate, curated_gold, gold_iceberg, backup_lake, iceberg_maintenance,
    ],
    jobs=[refresh_job, ops_job],
    schedules=[daily, ops_daily],
    sensors=[alert_on_failure],
)
