"""SQL fitur dataset — port `platform-v2/lib/ch/store.ts` @ 6b858eb (inventaris E §3).

Teks SQL disalin apa adanya supaya hasilnya sama dengan Next.js, termasuk keanehannya. Query metadata
yang juga dipakai fitur lain (`columns`, `tableFor`, `tiers`, `rowsForRaw`) ada di `shared/queries.py`.
Nama tabel/kolom berasal dari metadata server (`table_name`, `DESCRIBE`) dan lolos `ident`.
"""

from __future__ import annotations

from collections.abc import Iterator
from typing import Any

from data_api.shared.konteks import Konteks
from data_api.shared.queries import SYNC, SYNC_SEC, ident

# Urutan default deterministik (SPEC §3.3) bila tidak ada `sort`; sama dengan pengurut cadangan
# `build_clauses`, jadi halaman tanpa sort tidak melompati atau menggandakan baris.
URUT_BAWAAN = "ORDER BY cityHash64(toString(tuple(*)))"


def silver(tabel: str) -> str:
    return f"silver.`{ident(tabel)}`"


def sync(k: Konteks, slug: str) -> dict[str, Any] | None:
    rows = k.q(
        f"""SELECT slug, title, description, sumber_data, frekuensi, satuan, klasifikasi,
            kontak, author, toString(total) AS total, table_name FROM {SYNC} WHERE slug={{slug:String}}
     UNION ALL
     SELECT slug, title, description, sumber_data, frekuensi, satuan, klasifikasi,
            kontak, author, toString(total) AS total, table_name FROM {SYNC_SEC} WHERE slug={{slug:String}}
     LIMIT 1""",
        {"slug": slug},
    )
    return rows[0] if rows else None


def describe(k: Konteks, tabel: str) -> list[dict[str, Any]]:
    return k.q(f"DESCRIBE TABLE {silver(tabel)}")


def periode(k: Konteks, tabel: str) -> dict[str, Any] | None:
    rows = k.q(
        f"""SELECT toString(min(periode_data)) AS lo, toString(max(periode_data)) AS hi
     FROM {silver(tabel)} WHERE periode_data IS NOT NULL"""
    )
    return rows[0] if rows else None


def baris(k: Konteks, tabel: str, where: str, order_by: str, params: dict[str, Any], limit: int, offset: int):
    return k.q(
        f"SELECT * FROM {silver(tabel)} {where} {order_by or URUT_BAWAAN} "
        "LIMIT {limit:UInt32} OFFSET {offset:UInt32}",
        {**params, "limit": limit, "offset": offset},
    )


def hitung(k: Konteks, tabel: str, where: str, params: dict[str, Any]) -> int:
    return int(k.q(f"SELECT toString(count()) AS c FROM {silver(tabel)} {where}", params)[0]["c"])


def baris_alir(
    k: Konteks, tabel: str, where: str, order_by: str, params: dict[str, Any], per_halaman: int
) -> Iterator[dict[str, Any]]:
    """Seluruh baris hasil filter, dibaca per halaman (batas profil 100.000 baris per query)."""
    offset = 0
    while True:
        rows = baris(k, tabel, where, order_by, params, per_halaman, offset)
        yield from rows
        if len(rows) < per_halaman:
            return
        offset += per_halaman


def facet_statistik(k: Konteks, tabel: str, rentang: list[str], teks: list[str], batas: int) -> dict[str, Any]:
    """`mn{i}`/`mx{i}` untuk kolom angka/tanggal, `u{i}` = uniqUpTo(batas+1) untuk kolom teks."""
    exprs = [
        *(
            e
            for i, c in enumerate(rentang)
            for e in (f"toString(min(`{c}`)) AS mn{i}", f"toString(max(`{c}`)) AS mx{i}")
        ),
        # uniqUpTo cukup menjawab "≤ batas atau tidak" tanpa menghitung semua nilai unik.
        *(f"toString(uniqUpTo({batas + 1})(`{c}`)) AS u{i}" for i, c in enumerate(teks)),
    ]
    if not exprs:
        return {}
    rows = k.q(f"SELECT {', '.join(exprs)} FROM {silver(tabel)}")
    return rows[0] if rows else {}


def facet_nilai(k: Konteks, tabel: str, kolom_kecil: list[str]) -> list[dict[str, Any]]:
    ref = silver(tabel)
    sql = " UNION ALL ".join(
        f"""SELECT {{k{i}:String}} AS k, toString(`{c}`) AS v, toString(count()) AS n FROM {ref}
         WHERE `{c}` IS NOT NULL AND toString(`{c}`) != '' GROUP BY v"""
        for i, c in enumerate(kolom_kecil)
    )
    return k.q(sql, {f"k{i}": c for i, c in enumerate(kolom_kecil)})


AGG_MAX_GROUPS = 1000


def agregat(k: Konteks, tabel: str, x: str, y: str, agg: str, where: str, params: dict[str, Any]):
    label = f"if(trim(ifNull(toString(`{x}`), '')) = '', '—', trim(toString(`{x}`)))"
    num = f"toFloat64OrNull(replaceAll(replaceAll(toString(`{y}`), ' ', ''), ',', '.'))"
    value = "count()" if agg == "count" else f"{agg}({num})"
    having = "" if agg == "count" else f"HAVING count({num}) > 0"
    # `name` sebagai pengurut kedua: nilai seri tetap berurutan sama di setiap permintaan.
    return k.q(
        f"""SELECT {label} AS name, toString({value}) AS value FROM {silver(tabel)} {where}
     GROUP BY name {having} ORDER BY {value} DESC, name LIMIT {AGG_MAX_GROUPS}""",
        params,
    )
