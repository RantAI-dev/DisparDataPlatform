"""Filter, sort, dan pencarian baris dataset di Silver.

Port fungsi per fungsi dari platform-v2 `lib/ch/query-filter.ts` (inventaris E §2.3.1):

    q=<teks>                       pencarian teks di semua kolom
    f=<kolom>:in:<nilai>           filter kategori; ulangi `f` untuk nilai lain di kolom yang sama
    f=<kolom>:range:<min>..<max>   filter angka/tanggal; salah satu ujung boleh kosong
    sort=<kolom>:asc|desc          urutan satu kolom

Nama kolom hanya diterima bila ada di skema tabel (lalu dikutip backtick); semua nilai dikirim
sebagai parameter terikat ClickHouse, tidak pernah disambung ke teks SQL. Input tidak sah →
`InvalidFilter` (400). Pesan error sama dengan Next.js.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Literal

from .errors import InvalidFilter

MAX_FILTERS = 20
MAX_VALUES = 100
MAX_VALUE_LEN = 500

ColKind = Literal["angka", "tanggal", "teks", "lain"]


@dataclass
class Filter:
    col: str
    op: Literal["in", "range"]
    values: list[str] = field(default_factory=list)
    min: str = ""
    max: str = ""


@dataclass
class Sort:
    col: str
    dir: Literal["asc", "desc"]


@dataclass
class RowQuery:
    search: str = ""
    filters: list[Filter] = field(default_factory=list)
    sort: Sort | None = None


_BUNGKUS = re.compile(r"^(?:Nullable|LowCardinality)\((.*)\)$")


def kind_of(tipe: str) -> ColKind:
    """Jenis filter untuk tipe ClickHouse (Nullable/LowCardinality dilepas)."""
    t = tipe
    while True:
        u = _BUNGKUS.sub(r"\1", t)
        if u == t:
            break
        t = u
    if re.match(r"^(U?Int\d+|Float\d+|Decimal)", t):
        return "angka"
    if re.match(r"^(Date|Date32|DateTime)", t):
        return "tanggal"
    if t == "String" or t.startswith("FixedString"):
        return "teks"
    return "lain"


def parse_row_query(q: str | None, f: list[str], sort: str | None) -> RowQuery:
    """Parse parameter URL tanpa menyentuh skema (validasi kolom ada di `build_clauses`)."""
    search = (q or "").strip()[:MAX_VALUE_LEN]

    by_col: dict[str, Filter] = {}
    for raw in f:
        i = raw.find(":")
        j = raw.find(":", i + 1)
        if i <= 0 or j < 0:
            raise InvalidFilter(f"Format filter tidak valid: {raw}")
        col, op, value = raw[:i], raw[i + 1 : j], raw[j + 1 :]
        if len(value) > MAX_VALUE_LEN:
            raise InvalidFilter("Nilai filter terlalu panjang")

        if op == "in":
            prev = by_col.get(col)
            if prev and prev.op != "in":
                raise InvalidFilter(f"Filter ganda untuk kolom {col}")
            values = prev.values if prev else []
            if value not in values:
                values.append(value)
            if len(values) > MAX_VALUES:
                raise InvalidFilter(f"Terlalu banyak nilai untuk kolom {col}")
            by_col[col] = Filter(col, "in", values)
        elif op == "range":
            if col in by_col:
                raise InvalidFilter(f"Filter ganda untuk kolom {col}")
            k = value.find("..")
            if k < 0:
                raise InvalidFilter(f"Rentang tidak valid: {value}")
            lo, hi = value[:k].strip(), value[k + 2 :].strip()
            if not lo and not hi:
                raise InvalidFilter(f"Rentang kosong untuk kolom {col}")
            by_col[col] = Filter(col, "range", min=lo, max=hi)
        else:
            raise InvalidFilter(f"Operator tidak dikenal: {op}")
    if len(by_col) > MAX_FILTERS:
        raise InvalidFilter("Terlalu banyak filter")

    urut = None
    if sort:
        k = sort.rfind(":")
        arah = sort[k + 1 :]
        if k <= 0 or arah not in ("asc", "desc"):
            raise InvalidFilter(f"Sort tidak valid: {sort}")
        urut = Sort(sort[:k], arah)  # type: ignore[arg-type]

    return RowQuery(search, list(by_col.values()), urut)


_NUM = re.compile(r"^-?(\d+\.?\d*|\.\d+)(e[-+]?\d+)?$", re.IGNORECASE)
_DATE = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def quote_col(schema: dict[str, str], col: str) -> str:
    if col not in schema or "`" in col:
        raise InvalidFilter(f"Kolom tidak dikenal: {col}")
    return f"`{col}`"


@dataclass
class Klausa:
    where: str
    order_by: str
    params: dict[str, object]


def build_clauses(rq: RowQuery, schema: dict[str, str]) -> Klausa:
    """Klausa WHERE dan ORDER BY ter-parameter untuk skema tabel (kolom → tipe, tanpa audit)."""
    clauses: list[str] = []
    params: dict[str, object] = {}

    if rq.search:
        clauses.append("positionCaseInsensitive(toString(tuple(*)), {q:String}) > 0")
        params["q"] = rq.search

    for i, f in enumerate(rq.filters):
        col = quote_col(schema, f.col)
        kind = kind_of(schema[f.col])
        if f.op == "in":
            clauses.append(f"toString({col}) IN {{f{i}:Array(String)}}")
            params[f"f{i}"] = f.values
            continue
        if kind == "angka":
            for v, cmp, key in ((f.min, ">=", "lo"), (f.max, "<=", "hi")):
                if not v:
                    continue
                if not _NUM.match(v):
                    raise InvalidFilter(f"Angka tidak valid: {v}")
                clauses.append(f"{col} {cmp} {{f{i}{key}:Float64}}")
                params[f"f{i}{key}"] = float(v)
        elif kind == "tanggal":
            for v, cmp, key in ((f.min, ">=", "lo"), (f.max, "<=", "hi")):
                if not v:
                    continue
                if not _DATE.match(v):
                    raise InvalidFilter(f"Tanggal tidak valid: {v}")
                clauses.append(f"toDate({col}) {cmp} {{f{i}{key}:Date}}")
                params[f"f{i}{key}"] = v
        else:
            raise InvalidFilter(f"Kolom {f.col} tidak mendukung filter rentang")

    where = f"WHERE {' AND '.join(clauses)}" if clauses else ""
    # Pengurut cadangan deterministik: baris dengan nilai sort sama tetap berurutan konsisten
    # antar-halaman (tidak terulang/terlewat).
    order_by = (
        f"ORDER BY {quote_col(schema, rq.sort.col)} {'ASC' if rq.sort.dir == 'asc' else 'DESC'} NULLS LAST, "
        "cityHash64(toString(tuple(*)))"
        if rq.sort
        else ""
    )
    return Klausa(where, order_by, params)


def is_filtered(rq: RowQuery) -> bool:
    return bool(rq.search) or bool(rq.filters)
