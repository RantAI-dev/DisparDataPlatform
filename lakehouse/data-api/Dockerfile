# Data API Disparekraf: FastAPI + httpx ke ClickHouse (akun read-only dispar_app).
# Satu worker uvicorn (cache in-process hanya benar begitu). Build saja di plan 02; deploy di plan 06.
FROM python:3.12-slim

COPY --from=ghcr.io/astral-sh/uv:0.13.1 /uv /bin/uv

ENV PYTHONUNBUFFERED=1 \
    UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    PATH="/app/.venv/bin:$PATH" \
    PORT=8080

WORKDIR /app

# Dependensi dulu (lapisan cache), lalu kode.
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev --no-install-project
COPY data_api ./data_api
RUN uv sync --frozen --no-dev \
 && useradd --uid 10001 --no-create-home --shell /usr/sbin/nologin dataapi

USER dataapi
EXPOSE 8080
CMD ["data-api"]
