"""SQL milik `shared/` (katalog lake, hitungan, daftar tabel, berkas Bronze).

Teks SQL disalin dari platform-v2 `lib/ch/store.ts` agar perilakunya sama, termasuk keanehannya.
Nama tabel tidak pernah berasal dari input pengguna: hanya dari metadata server atau konstanta
kode, dan selalu lolos `IDENT` (pola `app/api/spatial/route.ts`).
"""

from __future__ import annotations

import re
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from .konteks import Konteks

IDENT = re.compile(r"^[a-zA-Z_][a-zA-Z0-9_]*$")

META = "lake.`bronze_meta.dataset_catalog`"
META_SEC = "lake.`bronze_meta_sec.dataset_catalog`"
SYNC = "lake.`bronze_meta.dataset_sync`"
SYNC_SEC = "lake.`bronze_meta_sec.dataset_sync`"

AUDIT = ("_ingested_at", "_source_url", "_batch_id", "_row_hash", "_tenant")


def ident(nama: str) -> str:
    if not IDENT.match(nama):
        raise ValueError(f"nama tabel/kolom tidak sah: {nama!r}")
    return nama


def bronze_file(tabel: str) -> str:
    return f"lake.`bronze_file.{ident(tabel)}`"


def katalog(k: Konteks) -> list[dict[str, Any]]:
    """Katalog SEMUA dataset (primer + sekunder) — `store.catalog`."""
    return k.q(
        f"""SELECT slug, title, description, tags, toString(views) AS views, updated_at, tier, table_name FROM {META}
     UNION ALL
     SELECT slug, title, description, tags, toString(views) AS views, updated_at, tier, table_name FROM {META_SEC}"""
    )


def total_sync(k: Konteks) -> list[dict[str, Any]]:
    """slug → total untuk semua dataset — `store.syncTotals`."""
    return k.q(
        f"""SELECT slug, toString(total) AS total FROM {SYNC}
     UNION ALL SELECT slug, toString(total) AS total FROM {SYNC_SEC}"""
    )


def daftar_tabel(k: Konteks, database: str) -> set[str]:
    """`SHOW TABLES FROM silver|serving` (bukan `system.tables`: ditolak profil app_readonly)."""
    assert database in ("silver", "serving")
    return {r["name"] for r in k.q(f"SHOW TABLES FROM {database}")}


def jumlah_bronze_file(k: Konteks, tabel: str) -> int:
    return int(k.q(f"SELECT toString(count()) AS c FROM {bronze_file(tabel)}")[0]["c"])


def baris_bronze_file(k: Konteks, tabel: str) -> list[dict[str, Any]]:
    """Seluruh baris berkas Bronze tanpa kolom audit (semua kolom `Nullable(String)`)."""
    return [buang_audit(r) for r in k.q(f"SELECT * FROM {bronze_file(tabel)}")]


def buang_audit(r: dict[str, Any]) -> dict[str, Any]:
    return {c: v for c, v in r.items() if c not in AUDIT}


def ping(k: Konteks) -> None:
    """Cek koneksi untuk `/v1/health` (bukan `system.*`)."""
    k.q("SELECT 1 AS ok")


COL = "lake.`bronze_meta.dataset_column`"
COL_SEC = "lake.`bronze_meta_sec.dataset_column`"


def kolom_dataset(k: Konteks, slug: str) -> list[dict[str, Any]]:
    """`store.columns`: definisi kolom satu dataset (primer lalu sekunder).

    Keanehan ditiru: `ORDER BY ord` hanya mengikat SELECT kedua dan mengurutkan `ord` sebagai teks.
    """
    return k.q(
        f"""SELECT key_asli, deskripsi, tipe, toString(ord) AS ord FROM {COL} WHERE slug={{slug:String}}
     UNION ALL
     SELECT key_asli, deskripsi, tipe, toString(ord) AS ord FROM {COL_SEC} WHERE slug={{slug:String}}
     ORDER BY ord""",
        {"slug": slug},
    )


def kunci_kolom(k: Konteks, slugs: list[str]) -> list[dict[str, Any]]:
    """`store.columnKeys`: pasangan slug–kolom untuk beberapa dataset."""
    return k.q(
        f"""SELECT slug, key_asli FROM {COL} WHERE slug IN {{slugs:Array(String)}}
     UNION ALL SELECT slug, key_asli FROM {COL_SEC} WHERE slug IN {{slugs:Array(String)}}""",
        {"slugs": slugs},
    )


def tier_dataset(k: Konteks, slugs: list[str]) -> list[dict[str, Any]]:
    """`store.tiers`: tier (primer/sekunder) beberapa dataset."""
    return k.q(
        f"""SELECT slug, tier FROM {META} WHERE slug IN {{slugs:Array(String)}}
     UNION ALL SELECT slug, tier FROM {META_SEC} WHERE slug IN {{slugs:Array(String)}}""",
        {"slugs": slugs},
    )


def tabel_untuk(k: Konteks, slug: str) -> str | None:
    """`table_name` (nama tabel Silver/Bronze) sebuah slug."""
    rows = k.q(
        f"""SELECT table_name FROM {META} WHERE slug={{slug:String}}
     UNION ALL SELECT table_name FROM {META_SEC} WHERE slug={{slug:String}} LIMIT 1""",
        {"slug": slug},
    )
    return rows[0]["table_name"] if rows else None


def baris_silver(k: Konteks, tabel: str) -> list[dict[str, Any]]:
    """`store.rowsForRaw`: seluruh baris Silver, tanpa ORDER BY (urutan simpan, sama dengan Next.js)."""
    return [buang_audit(r) for r in k.q(f"SELECT * FROM silver.`{ident(tabel)}`")]
