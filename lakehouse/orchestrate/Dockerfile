# Image Dagster mandiri (context = build context git archive HEAD / repo root).
# Berisi lakehouse/ dan berkas data raw dari registri sources.toml di bawah /app.
FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    DAGSTER_HOME=/opt/dagster \
    DATA_ROOT=/app \
    SQL_DIR=/app/lakehouse/clickhouse/sql \
    PYTHONPATH=/app/lakehouse/orchestrate:/app

WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

# Paket ingestion (dipakai aset Dagster) + Dagster.
COPY lakehouse/ingest/pyproject.toml ./lakehouse/ingest/
COPY lakehouse/ingest/dispar_ingest ./lakehouse/ingest/dispar_ingest
RUN pip install ./lakehouse/ingest "dagster>=1.9" "dagster-webserver>=1.9"

# Salin seluruh berkas registri dan lakehouse dari context
COPY . /app/

RUN mkdir -p /opt/dagster

EXPOSE 3030
# `dagster dev` menjalankan webserver + DAEMON (yang mengeksekusi jadwal).
CMD ["dagster", "dev", "-h", "0.0.0.0", "-p", "3030", \
     "-m", "dispar_orchestrate.definitions"]
