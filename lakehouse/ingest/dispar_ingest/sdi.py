"""Klien API Satu Data Jakarta (SDI) untuk organisasi Dinas Pariwisata.

Endpoint hasil reverse-engineering, sama persis dengan yang dipakai
`platform/lib/sdi-fetch.ts`. Fungsi parsing dipisah dari fungsi jaringan
supaya bisa diuji tanpa memanggil SDI.
"""

from __future__ import annotations

import json
import time
from dataclasses import dataclass, field
from typing import Any, Iterator

import requests

BACKEND = "https://satudata.jakarta.go.id/backend/api/v2/satudata"
ORG_DISPAR = "org8"
PORTAL = "https://satudata.jakarta.go.id"

# SDI membatasi ~5000 baris per halaman; sebagian registry punya puluhan ribu baris.
ROWS_PER_PAGE = 5000
MAX_ROW_PAGES = 25
SEARCH_PER_PAGE = 8


@dataclass
class Dataset:
    slug: str
    title: str
    description: str = ""
    tags: list[str] = field(default_factory=list)
    views: int = 0
    updated_at: str | None = None

    @property
    def url(self) -> str:
        return f"{PORTAL}/open-data/{self.slug}"


@dataclass
class DatasetDetail:
    slug: str
    title: str
    description: str
    sumber_data: list[str]
    frekuensi: str | None
    satuan: str | None
    klasifikasi: str | None
    kontak: str | None
    author: str | None
    columns: list[dict[str, Any]]


class SdiError(RuntimeError):
    pass


# ── Parsing (murni, tanpa jaringan) ────────────────────────────────────────


def parse_search_page(payload: dict[str, Any]) -> tuple[list[Dataset], int, int]:
    """Urai satu halaman hasil /search.

    Mengembalikan (datasets, total_data, total_page).
    """
    data = payload.get("data")
    # SDI kadang menaruh daftar langsung di data, kadang membungkusnya di data.data.
    if isinstance(data, list):
        items = data
        meta: dict[str, Any] = {}
    elif isinstance(data, dict):
        items = data.get("data") if isinstance(data.get("data"), list) else []
        meta = data
    else:
        items = []
        meta = {}

    datasets: list[Dataset] = []
    for it in items:
        if not isinstance(it, dict):
            continue
        slug = it.get("url") or it.get("page_url")
        if not slug:
            continue
        datasets.append(
            Dataset(
                slug=str(slug),
                title=str(it.get("title") or slug),
                description=str(it.get("desc") or it.get("description") or ""),
                tags=_parse_tags(it.get("tag")),
                views=_as_int(it.get("count_view")),
                updated_at=it.get("updated_at"),
            )
        )

    total_data = _as_int(payload.get("total_data") or meta.get("total_data"))
    total_page = _as_int(payload.get("total_page") or meta.get("total_page"))
    return datasets, total_data, total_page


def parse_detail(payload: dict[str, Any], slug: str) -> DatasetDetail:
    """Urai respons /detail menjadi metadata + definisi kolom yang bermakna."""
    meta = payload.get("data") or {}
    komponen = meta.get("komponen_data_table")
    if not isinstance(komponen, list):
        komponen = []

    columns = [
        {
            "key": k.get("header_komponen"),
            "type": k.get("tipe_data_komponen"),
            "description": k.get("desc_komponen"),
        }
        for k in komponen
        if isinstance(k, dict) and k.get("header_komponen")
    ]

    sumber = meta.get("sumber_data")
    if isinstance(sumber, str):
        sumber = [sumber]
    elif not isinstance(sumber, list):
        sumber = []

    return DatasetDetail(
        slug=slug,
        title=str(meta.get("title") or slug),
        description=str(meta.get("desc") or ""),
        sumber_data=[str(s) for s in sumber],
        frekuensi=meta.get("frekuensi_penerbitan"),
        satuan=meta.get("satuan"),
        klasifikasi=meta.get("klasifikasi_data"),
        kontak=meta.get("kontak"),
        author=meta.get("author"),
        columns=columns,
    )


def parse_table_page(payload: dict[str, Any]) -> tuple[list[dict[str, Any]], int]:
    """Urai satu halaman /get-table-data. Mengembalikan (rows, total)."""
    rows = payload.get("data")
    if not isinstance(rows, list):
        rows = []
    return [r for r in rows if isinstance(r, dict)], _as_int(payload.get("total"))


def _parse_tags(raw: Any) -> list[str]:
    """Tag datang sebagai string JSON, list, atau None."""
    if isinstance(raw, list):
        return [str(t) for t in raw]
    if isinstance(raw, str) and raw.strip():
        import json

        try:
            parsed = json.loads(raw)
            if isinstance(parsed, list):
                return [str(t) for t in parsed]
        except json.JSONDecodeError:
            return [t.strip() for t in raw.split(",") if t.strip()]
    return []


def _as_int(v: Any) -> int:
    try:
        return int(v)
    except (TypeError, ValueError):
        return 0


# ── Jaringan ───────────────────────────────────────────────────────────────


class SdiClient:
    """Klien HTTP dengan retry, backoff, dan jeda antar-permintaan.

    Jeda itu disengaja: SDI adalah layanan publik pemerintah dan pipeline ini
    menarik 182 dataset sekaligus.
    """

    def __init__(self, timeout: int = 60, retries: int = 3, delay: float = 0.3):
        self.timeout = timeout
        self.retries = retries
        self.delay = delay
        self.session = requests.Session()
        self.session.headers.update(
            {"Content-Type": "application/json", "Accept": "application/json"}
        )

    def _post(self, endpoint: str, body: dict[str, Any]) -> dict[str, Any]:
        last: Exception | None = None
        for attempt in range(self.retries):
            try:
                res = self.session.post(
                    f"{BACKEND}/{endpoint}", json=body, timeout=self.timeout
                )
                if res.status_code >= 400:
                    raise SdiError(f"{endpoint} HTTP {res.status_code}")
                try:
                    # Beberapa respons SDI berawalan BOM UTF-8.
                    return json.loads(res.text.lstrip("\ufeff"))
                except ValueError as e:
                    # SDI mengembalikan HTML saat maintenance.
                    raise SdiError(f"{endpoint} respons non-JSON (SDI maintenance?)") from e
            except (requests.RequestException, SdiError) as e:
                last = e
                time.sleep(0.8 * (attempt + 1))
        raise SdiError(f"{endpoint} gagal setelah {self.retries} percobaan: {last}")

    def list_datasets(self, org: str = ORG_DISPAR) -> list[Dataset]:
        """Ambil seluruh dataset milik satu organisasi, menelusuri semua halaman."""
        out: list[Dataset] = []
        seen: set[str] = set()
        page = 1
        while True:
            payload = self._post(
                "search",
                {
                    "q": "",
                    "kategori": "all",
                    "topik": "all",
                    "organisasi": org,
                    "status": "all",
                    "sort": "desc",
                    "page_no": page,
                    "lang": "id",
                },
            )
            items, total_data, total_page = parse_search_page(payload)
            for d in items:
                if d.slug not in seen:
                    seen.add(d.slug)
                    out.append(d)
            if not items:
                break
            if total_page and page >= total_page:
                break
            if total_data and len(out) >= total_data:
                break
            page += 1
            if page > 200:  # jaring pengaman terhadap paginasi tak berujung
                break
            time.sleep(self.delay)
        return out

    def dataset_detail(self, slug: str) -> DatasetDetail:
        payload = self._post(
            "detail",
            {
                "kategori": "dataset",
                "page_url": slug,
                "data_no": 1,
                "per_page": 10,
                "table_params": {
                    "page": 1,
                    "per_page": 10,
                    "sort_field": None,
                    "sort_order": None,
                    "filters": {},
                },
            },
        )
        return parse_detail(payload, slug)

    def dataset_rows(self, slug: str) -> Iterator[dict[str, Any]]:
        """Alirkan seluruh baris satu dataset, halaman demi halaman."""
        seen = 0
        total = 0
        for page in range(1, MAX_ROW_PAGES + 1):
            payload = self._post(
                "get-table-data",
                {
                    "page_url": slug,
                    "kategori": "dataset",
                    "page": page,
                    "per_page": ROWS_PER_PAGE,
                    "sort_field": None,
                    "sort_order": "asc",
                    "filters": {},
                },
            )
            rows, reported_total = parse_table_page(payload)
            total = reported_total or total
            yield from rows
            seen += len(rows)
            if len(rows) < ROWS_PER_PAGE or (total and seen >= total):
                break
            time.sleep(self.delay)
