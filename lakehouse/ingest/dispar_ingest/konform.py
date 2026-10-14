"""Kerangka konform lapisan Silver: penerap SQL, panggung, kontrak, dan pengukur kecocokan.

Modul ini mengelola skema dan transformasi Silver terstruktur:
  - Menerapkan berkas SQL konform dengan substitusi penanda {{db}} dan {{ref:nama}}.
  - Menegakkan aturan keamanan: tidak menulis ke database terlarang (silver, serving, lake, _silver_meta),
    setiap CREATE harus menyasar {{db}} atau fungsi kf_*.
  - Menyediakan database panggung `konform_dev` untuk validasi sebelum deploy.
  - Memvalidasi kontrak dimensi dan fakta (*.toml) serta menguji integritas data.
  - Mengukur tingkat kecocokan nilai mentah terhadap dimensi kanonik per keluarga kolom.
"""

from __future__ import annotations

import argparse
import os
import re
import sys
import tomllib
from pathlib import Path
from typing import Any

from .files import read_file
from .lake import safe_name, to_text
from .refresh import _split_statements


def get_repo_root() -> Path:
    """Temukan akar repositori DisparDataPlatform."""
    cur = Path(__file__).resolve()
    for parent in [cur] + list(cur.parents):
        if (parent / "lakehouse" / "sources.toml").exists():
            return parent
    return Path(__file__).resolve().parents[3]


def get_konform_dir() -> Path:
    """Tentukan direktori kerja konform (diturunkan dari SQL_DIR bila ada)."""
    sql_env = os.environ.get("SQL_DIR")
    if sql_env:
        p = Path(os.path.dirname(sql_env)) / "konform"
        if p.exists():
            return p
    # Fallback ke path repositori lokal
    repo_konform = Path(__file__).resolve().parents[2] / "clickhouse" / "konform"
    if repo_konform.exists():
        return repo_konform
    if sql_env:
        return Path(os.path.dirname(sql_env)) / "konform"
    return Path("/app/lakehouse/clickhouse/konform")


DIR = get_konform_dir()
SQL_DIR = DIR / "sql"
KONTRAK_DIR = DIR / "kontrak"
KELUARGA_PATH = DIR / "keluarga.toml"

VALID_KELAS_REFRESH = {"snapshot", "harian", "terjadwal"}


def _ch(client: Any = None) -> Any:
    """Dapatkan klien ClickHouse (dengan fallback aman untuk workstation lokal)."""
    if client is not None:
        return client
    import clickhouse_connect

    host = os.environ.get("CH_HOST")
    port = os.environ.get("CH_PORT")
    user = os.environ.get("CH_USER")
    password = os.environ.get("CH_PASSWORD")

    if not (host and user and password):
        repo_root = get_repo_root()
        env_local = repo_root / "platform-v2" / ".env.local"
        if env_local.exists():
            for line in env_local.read_text(encoding="utf-8").splitlines():
                if line.startswith("CH_USER=") and not user:
                    user = line.split("=", 1)[1].strip()
                elif line.startswith("CH_PASSWORD=") and not password:
                    password = line.split("=", 1)[1].strip()
            if not host:
                host = "192.168.18.148"
            if not port:
                port = 18123

    return clickhouse_connect.get_client(
        host=host or "lake-clickhouse",
        port=int(port or 8123),
        username=user or "dispar",
        password=password or "disparch",
    )


def substitusi_penanda(sql: str, mode: str, db: str) -> str:
    """Ganti {{db}} dan {{ref:nama}} sesuai mode (lake atau panggung)."""
    res = sql.replace("{{db}}", db)
    if mode == "lake":
        res = re.sub(r"\{\{ref:([a-zA-Z0-9_]+)\}\}", r"lake.`bronze_file.\1`", res)
    elif mode == "panggung":
        res = re.sub(r"\{\{ref:([a-zA-Z0-9_]+)\}\}", rf"{db}.\1", res)
    else:
        raise ValueError(f"Mode '{mode}' tidak dikenal; gunakan 'lake' atau 'panggung'")
    return res


def validasi_statement(stmt: str, db: str) -> None:
    """Tegakkan aturan keamanan atas satu pernyataan SQL."""
    # 1. Larangan menulis ke database terlarang
    larangan = re.search(
        r"\b(INSERT\s+INTO|ALTER\s+TABLE|DROP\s+TABLE|TRUNCATE\s+TABLE|CREATE\s+.*)\s+(`?)(silver|serving|lake|_silver_meta)\2\.",
        stmt,
        re.IGNORECASE,
    )
    if larangan:
        raise ValueError(f"Pernyataan dilarang menyasar database terlarang '{larangan.group(3)}': {stmt[:80]}")

    # 2. Tiap CREATE FUNCTION harus berawalan kf_
    fn_match = re.search(
        r"\bCREATE\s+(?:OR\s+REPLACE\s+)?FUNCTION\s+(?:IF\s+NOT\s+EXISTS\s+)?(`?)([a-zA-Z0-9_]+)\1",
        stmt,
        re.IGNORECASE,
    )
    if fn_match:
        fn_name = fn_match.group(2)
        if not fn_name.startswith("kf_"):
            raise ValueError(f"Fungsi '{fn_name}' ditolak: nama fungsi konform harus berawalan 'kf_'")
        return

    # 3. Tiap CREATE TABLE / VIEW / DATABASE / DICTIONARY harus menyasar {{db}}
    create_match = re.search(
        r"\bCREATE\s+(?:OR\s+REPLACE\s+)?(TABLE|VIEW|DICTIONARY|DATABASE)\s+(?:IF\s+NOT\s+EXISTS\s+)?(`?)([a-zA-Z0-9_]+)\2(?:\.(`?)([a-zA-Z0-9_]+)\4)?",
        stmt,
        re.IGNORECASE,
    )
    if create_match:
        kind = create_match.group(1).upper()
        target_first = create_match.group(3)
        target_second = create_match.group(5)

        if kind == "DATABASE":
            if target_first != db:
                raise ValueError(f"CREATE DATABASE menyasar '{target_first}', harus menyasar '{db}'")
        else:
            if not target_second or target_first != db:
                sasaran = f"{target_first}.{target_second}" if target_second else target_first
                raise ValueError(f"CREATE {kind} menyasar '{sasaran}', harus menyasar database '{db}'")


def buat_view_tak_cocok(ch: Any, db: str) -> None:
    """Buat view {{db}}.tak_cocok sebagai UNION ALL dari semua {{db}}.tc_*."""
    try:
        rows = ch.query(
            f"SELECT name FROM system.tables WHERE database = '{db}' AND name LIKE 'tc_%' AND engine LIKE '%View%'"
        ).result_rows
        tc_views = [r[0] for r in rows]
    except Exception:
        tc_views = []

    if tc_views:
        parts = [f"SELECT fakta, kolom, nilai_asli, baris FROM {db}.`{v}`" for v in sorted(tc_views)]
        sql = f"CREATE OR REPLACE VIEW {db}.tak_cocok AS " + " UNION ALL ".join(parts)
    else:
        sql = (
            f"CREATE OR REPLACE VIEW {db}.tak_cocok AS "
            f"SELECT cast('' as String) AS fakta, cast('' as String) AS kolom, "
            f"cast('' as String) AS nilai_asli, cast(0 as UInt64) AS baris WHERE 1 = 0"
        )
    ch.command(sql)


def terapkan(ch: Any = None, mode: str = "lake", sql_dir: Path | None = None) -> dict[str, Any]:
    """Terapkan semua berkas SQL konform urut nama berkas."""
    ch = _ch(ch)
    if mode not in ("lake", "panggung"):
        raise ValueError(f"Mode '{mode}' tidak valid; harus 'lake' atau 'panggung'")
    db = "konform" if mode == "lake" else "konform_dev"

    dir_sql = sql_dir or (DIR / "sql")
    berkas_list = sorted(dir_sql.glob("*.sql")) if dir_sql.exists() else []

    sukses = 0
    gagal = 0
    error_list = []

    for fpath in berkas_list:
        try:
            sql_raw = fpath.read_text(encoding="utf-8")
            sql_sub = substitusi_penanda(sql_raw, mode=mode, db=db)
            statements = _split_statements(sql_sub)
            for stmt in statements:
                stmt_strip = stmt.strip()
                if not stmt_strip:
                    continue
                validasi_statement(stmt_strip, db=db)
                ch.command(stmt_strip)
            sukses += 1
        except Exception as e:
            gagal += 1
            error_list.append({"berkas": fpath.name, "error": str(e)})
            print(f"Error menerapkan {fpath.name}: {e}", file=sys.stderr)

    # Buat view tak_cocok
    try:
        buat_view_tak_cocok(ch, db=db)
    except Exception as e:
        print(f"Peringatan: gagal membuat view {db}.tak_cocok: {e}", file=sys.stderr)

    # Hitung jumlah objek di database
    try:
        res = ch.query(f"SELECT count() FROM system.tables WHERE database = '{db}'").result_rows
        jumlah_objek = int(res[0][0]) if res else 0
    except Exception:
        jumlah_objek = 0

    return {
        "mode": mode,
        "db": db,
        "berkas_sukses": sukses,
        "berkas_error": gagal,
        "jumlah_objek": jumlah_objek,
        "error_detail": error_list,
    }


def is_numeric_type(t: str) -> bool:
    """Periksa apakah tipe ClickHouse termasuk numerik."""
    clean = t.replace("Nullable(", "").replace("LowCardinality(", "").rstrip(")")
    return any(clean.startswith(prefix) for prefix in ("Int", "UInt", "Float", "Decimal"))


def validasi_kontrak(kontrak: dict[str, Any], semua_kontrak: dict[str, dict[str, Any]]) -> None:
    """Tegakkan aturan pemuatan kontrak TOML."""
    nama = kontrak.get("nama")
    if not nama:
        raise ValueError("Kontrak tidak memiliki field 'nama'")

    # 1. kelas_refresh di luar tiga nilai
    kelas = kontrak.get("kelas_refresh")
    if kelas not in VALID_KELAS_REFRESH:
        raise ValueError(
            f"Kontrak '{nama}': kelas_refresh '{kelas}' tidak valid; harus snapshot | harian | terjadwal"
        )

    # 2. grain yang menyebut kolom tak terdaftar
    kolom_names = {c.get("nama") for c in kontrak.get("kolom", []) if "nama" in c}
    grain = kontrak.get("grain", [])
    for g in grain:
        if g not in kolom_names:
            raise ValueError(f"Kontrak '{nama}': grain '{g}' tidak terdaftar dalam kolom")

    # 3. dimensi yang menunjuk objek tanpa kontrak
    for c in kontrak.get("kolom", []):
        dim = c.get("dimensi")
        if dim:
            target_obj = dim.split(".")[0]
            if target_obj not in semua_kontrak:
                raise ValueError(
                    f"Kontrak '{nama}': dimensi '{dim}' menunjuk objek '{target_obj}' yang tidak punya kontrak"
                )

    # 4. kolom ukuran tanpa satuan
    jenis = kontrak.get("jenis", "")
    for c in kontrak.get("kolom", []):
        c_nama = c.get("nama", "")
        c_tipe = c.get("tipe", "")
        is_ukuran = (
            c.get("ukuran") is True
            or c.get("peran") == "ukuran"
            or (jenis == "fakta" and is_numeric_type(c_tipe) and c_nama not in grain and not c.get("dimensi"))
        )
        if is_ukuran:
            satuan = c.get("satuan")
            if not satuan or not str(satuan).strip():
                raise ValueError(f"Kontrak '{nama}': kolom ukuran '{c_nama}' wajib memiliki 'satuan'")


def muat_semua_kontrak(kontrak_dir: Path | None = None) -> dict[str, dict[str, Any]]:
    """Muat dan validasi semua berkas kontrak TOML."""
    dir_kontrak = kontrak_dir or (DIR / "kontrak")
    if not dir_kontrak.exists():
        return {}

    raw_contracts = {}
    for f in sorted(dir_kontrak.glob("*.toml")):
        with open(f, "rb") as fp:
            data = tomllib.load(fp)
            nama = data.get("nama", f.stem)
            raw_contracts[nama] = data

    for data in raw_contracts.values():
        validasi_kontrak(data, raw_contracts)

    return raw_contracts


def uji(ch: Any = None, mode: str = "lake", kontrak_dir: Path | None = None) -> dict[str, Any]:
    """Jalankan uji kontrak atas skema, grain, wajib, rujukan, cocok_min, rentang, nilai_boleh, rekonsiliasi."""
    ch = _ch(ch)
    db = "konform" if mode == "lake" else "konform_dev"
    kontrak_map = muat_semua_kontrak(kontrak_dir)

    hasil: list[dict[str, Any]] = []

    for nama, k in sorted(kontrak_map.items()):
        table_id = f"{db}.`{nama}`"

        # 1. Uji skema: objek ada; nama dan tipe kolom persis sama dengan kontrak
        try:
            db_cols_rows = ch.query(
                f"SELECT name, type FROM system.columns WHERE database = '{db}' AND table = '{nama}'"
            ).result_rows
            db_cols = {r[0]: r[1] for r in db_cols_rows}
            contract_cols = {c["nama"]: c["tipe"] for c in k.get("kolom", [])}

            if not db_cols:
                hasil.append({
                    "objek": nama, "uji": "skema", "target": nama, "status": "gagal",
                    "nilai": 0.0, "pesan": f"Tabel {table_id} tidak ditemukan di ClickHouse",
                })
            elif db_cols != contract_cols:
                hasil.append({
                    "objek": nama, "uji": "skema", "target": nama, "status": "gagal",
                    "nilai": 0.0, "pesan": f"Skema berbeda. DB: {db_cols}, Kontrak: {contract_cols}",
                })
            else:
                hasil.append({
                    "objek": nama, "uji": "skema", "target": nama, "status": "lulus",
                    "nilai": 1.0, "pesan": "Skema sesuai",
                })
        except Exception as e:
            hasil.append({
                "objek": nama, "uji": "skema", "target": nama, "status": "gagal",
                "nilai": 0.0, "pesan": str(e),
            })

        # 2. Uji grain_unik
        grain = k.get("grain", [])
        if grain:
            grain_cols = ", ".join(f"`{g}`" for g in grain)
            try:
                res = ch.query(f"SELECT count(), uniqExact({grain_cols}) FROM {table_id}").result_rows
                n_rows, n_uniq = res[0][0], res[0][1]
                if n_rows == n_uniq:
                    hasil.append({
                        "objek": nama, "uji": "grain_unik", "target": ",".join(grain), "status": "lulus",
                        "nilai": 1.0, "pesan": f"Grain unik ({n_rows} baris)",
                    })
                else:
                    hasil.append({
                        "objek": nama, "uji": "grain_unik", "target": ",".join(grain), "status": "gagal",
                        "nilai": 0.0, "pesan": f"Grain tidak unik: {n_rows} baris vs {n_uniq} nilai unik",
                    })
            except Exception as e:
                hasil.append({
                    "objek": nama, "uji": "grain_unik", "target": ",".join(grain), "status": "gagal",
                    "nilai": 0.0, "pesan": str(e),
                })

        # Uji per kolom: wajib, rujukan, cocok_min, rentang, nilai_boleh
        for col in k.get("kolom", []):
            c_nama = col["nama"]

            # 3. Uji wajib: tidak boleh NULL
            if col.get("wajib") is True:
                try:
                    res = ch.query(f"SELECT count() FROM {table_id} WHERE `{c_nama}` IS NULL").result_rows
                    n_null = res[0][0]
                    if n_null == 0:
                        hasil.append({
                            "objek": nama, "uji": "wajib", "target": c_nama, "status": "lulus",
                            "nilai": 1.0, "pesan": "Tidak ada nilai NULL",
                        })
                    else:
                        hasil.append({
                            "objek": nama, "uji": "wajib", "target": c_nama, "status": "gagal",
                            "nilai": float(n_null), "pesan": f"Terdapat {n_null} baris NULL",
                        })
                except Exception as e:
                    hasil.append({
                        "objek": nama, "uji": "wajib", "target": c_nama, "status": "gagal",
                        "nilai": 0.0, "pesan": str(e),
                    })

            # 4. Uji rujukan: tiap nilai non-NULL ada di dimensinya
            dim = col.get("dimensi")
            if dim:
                dim_tbl, dim_col = dim.split(".", 1)
                try:
                    sql_ref = (
                        f"SELECT count() FROM {table_id} "
                        f"WHERE `{c_nama}` IS NOT NULL "
                        f"AND `{c_nama}` NOT IN (SELECT `{dim_col}` FROM {db}.`{dim_tbl}`)"
                    )
                    res = ch.query(sql_ref).result_rows
                    n_orphan = res[0][0]
                    if n_orphan == 0:
                        hasil.append({
                            "objek": nama, "uji": "rujukan", "target": f"{c_nama}->{dim}", "status": "lulus",
                            "nilai": 1.0, "pesan": f"Semua nilai rujukan ada di {dim}",
                        })
                    else:
                        hasil.append({
                            "objek": nama, "uji": "rujukan", "target": f"{c_nama}->{dim}", "status": "gagal",
                            "nilai": float(n_orphan), "pesan": f"{n_orphan} nilai tidak ada di {dim}",
                        })
                except Exception as e:
                    hasil.append({
                        "objek": nama, "uji": "rujukan", "target": f"{c_nama}->{dim}", "status": "gagal",
                        "nilai": 0.0, "pesan": str(e),
                    })

            # 5. Uji cocok_min: porsi baris non-NULL >= ambang
            if col.get("cocok_min") is not None:
                ambang = float(col["cocok_min"])
                try:
                    res = ch.query(
                        f"SELECT countIf(`{c_nama}` IS NOT NULL), count() FROM {table_id}"
                    ).result_rows
                    n_cocok, n_tot = res[0][0], res[0][1]
                    rasio = (n_cocok / n_tot) if n_tot > 0 else 1.0
                    if rasio >= ambang:
                        hasil.append({
                            "objek": nama, "uji": "cocok_min", "target": c_nama, "status": "lulus",
                            "nilai": float(rasio), "pesan": f"Kecocokan {rasio:.4f} >= {ambang}",
                        })
                    else:
                        hasil.append({
                            "objek": nama, "uji": "cocok_min", "target": c_nama, "status": "gagal",
                            "nilai": float(rasio), "pesan": f"Kecocokan {rasio:.4f} < ambang {ambang}",
                        })
                except Exception as e:
                    hasil.append({
                        "objek": nama, "uji": "cocok_min", "target": c_nama, "status": "gagal",
                        "nilai": 0.0, "pesan": str(e),
                    })

            # 6. Uji rentang: min dan/atau max
            if "min" in col or "max" in col:
                conds = []
                if "min" in col:
                    conds.append(f"`{c_nama}` < {col['min']}")
                if "max" in col:
                    conds.append(f"`{c_nama}` > {col['max']}")
                where_clause = " OR ".join(conds)
                try:
                    res = ch.query(f"SELECT count() FROM {table_id} WHERE {where_clause}").result_rows
                    n_out = res[0][0]
                    if n_out == 0:
                        hasil.append({
                            "objek": nama, "uji": "rentang", "target": c_nama, "status": "lulus",
                            "nilai": 1.0, "pesan": "Semua nilai dalam rentang",
                        })
                    else:
                        hasil.append({
                            "objek": nama, "uji": "rentang", "target": c_nama, "status": "gagal",
                            "nilai": float(n_out), "pesan": f"{n_out} nilai di luar rentang",
                        })
                except Exception as e:
                    hasil.append({
                        "objek": nama, "uji": "rentang", "target": c_nama, "status": "gagal",
                        "nilai": 0.0, "pesan": str(e),
                    })

            # 7. Uji nilai_boleh: himpunan nilai yang diizinkan
            if col.get("nilai_boleh"):
                vals = col["nilai_boleh"]
                vals_in = ", ".join(repr(v) for v in vals)
                try:
                    res = ch.query(
                        f"SELECT count() FROM {table_id} WHERE `{c_nama}` IS NOT NULL AND `{c_nama}` NOT IN ({vals_in})"
                    ).result_rows
                    n_invalid = res[0][0]
                    if n_invalid == 0:
                        hasil.append({
                            "objek": nama, "uji": "nilai_boleh", "target": c_nama, "status": "lulus",
                            "nilai": 1.0, "pesan": "Semua nilai sah",
                        })
                    else:
                        hasil.append({
                            "objek": nama, "uji": "nilai_boleh", "target": c_nama, "status": "gagal",
                            "nilai": float(n_invalid), "pesan": f"{n_invalid} nilai tidak diizinkan",
                        })
                except Exception as e:
                    hasil.append({
                        "objek": nama, "uji": "nilai_boleh", "target": c_nama, "status": "gagal",
                        "nilai": 0.0, "pesan": str(e),
                    })

        # 8. Uji rekonsiliasi: dua angka sama persis
        for r in k.get("rekonsiliasi", []):
            r_nama = r.get("nama", "rekonsiliasi")
            q_fakta = substitusi_penanda(r["fakta"], mode=mode, db=db)
            q_acuan = substitusi_penanda(r["acuan"], mode=mode, db=db)
            try:
                res_f = ch.query(q_fakta).result_rows
                res_a = ch.query(q_acuan).result_rows
                val_f = res_f[0][0] if res_f else None
                val_a = res_a[0][0] if res_a else None
                if val_f == val_a:
                    hasil.append({
                        "objek": nama, "uji": "rekonsiliasi", "target": r_nama, "status": "lulus",
                        "nilai": float(val_f or 0.0), "pesan": f"Fakta ({val_f}) == Acuan ({val_a})",
                    })
                else:
                    hasil.append({
                        "objek": nama, "uji": "rekonsiliasi", "target": r_nama, "status": "gagal",
                        "nilai": float(abs((val_f or 0) - (val_a or 0))),
                        "pesan": f"Fakta ({val_f}) != Acuan ({val_a})",
                    })
            except Exception as e:
                hasil.append({
                    "objek": nama, "uji": "rekonsiliasi", "target": r_nama, "status": "gagal",
                    "nilai": 0.0, "pesan": str(e),
                })

    n_lulus = sum(1 for h in hasil if h["status"] == "lulus")
    n_gagal = sum(1 for h in hasil if h["status"] == "gagal")

    if mode == "lake":
        try:
            ch.command("CREATE DATABASE IF NOT EXISTS _silver_meta")
            ch.command("""CREATE TABLE IF NOT EXISTS _silver_meta.quality (
                tabel String, cek String, nilai Float64, verdict String,
                detail String, dibuat_pada DateTime DEFAULT now()
            ) ENGINE = MergeTree ORDER BY (tabel, cek, dibuat_pada)""")
            to_insert = [
                [
                    f"konform.{item['objek']}",
                    f"kontrak:{item['uji']}",
                    float(item.get("nilai", 0.0)),
                    "pass" if item["status"] == "lulus" else "fail",
                    item.get("pesan", ""),
                ]
                for item in hasil
            ]
            if to_insert:
                ch.insert(
                    "_silver_meta.quality",
                    to_insert,
                    column_names=["tabel", "cek", "nilai", "verdict", "detail"],
                )
        except Exception as e:
            print(f"Peringatan: gagal mencatat ke _silver_meta.quality: {e}", file=sys.stderr)
    elif mode == "panggung":
        for item in hasil:
            simbol = "✓" if item["status"] == "lulus" else "✗"
            print(f"  [{simbol}] {item['objek']} - {item['uji']} ({item['target']}): {item['pesan']}")

    return {
        "lulus": n_lulus,
        "gagal": n_gagal,
        "total": len(hasil),
        "detail": hasil,
    }


def panggung(ch: Any = None, hapus: bool = False) -> None:
    """Kelola database panggung konform_dev untuk pengujian sebelum deploy."""
    ch = _ch(ch)
    if hapus:
        ch.command("DROP DATABASE IF EXISTS konform_dev")
        print("Database konform_dev berhasil dihapus.", flush=True)
        return

    print("Menyiapkan panggung di database konform_dev...", flush=True)
    ch.command("CREATE DATABASE IF NOT EXISTS konform_dev")

    repo_root = get_repo_root()
    sources_path = repo_root / "lakehouse" / "sources.toml"
    if sources_path.exists():
        with open(sources_path, "rb") as f:
            sources_data = tomllib.load(f)
        for s in sources_data.get("sumber", []):
            tbl = s.get("tabel", "")
            if tbl.startswith("ref_"):
                p = repo_root / s.get("path", "")
                if p.exists():
                    print(f"  Memuat {tbl} dari {p}...", flush=True)
                    rows = list(read_file(str(p)))
                    if rows:
                        sample_row = rows[0]
                        orig_keys = list(sample_row.keys())
                        cols = [safe_name(k) for k in orig_keys]
                        cols_def = ", ".join(f"`{c}` String" for c in cols)
                        ch.command(
                            f"CREATE TABLE IF NOT EXISTS konform_dev.`{tbl}` ({cols_def}) ENGINE = MergeTree ORDER BY tuple()"
                        )
                        ch.command(f"TRUNCATE TABLE konform_dev.`{tbl}`")
                        ch_rows = [[to_text(r.get(k)) or "" for k in orig_keys] for r in rows]
                        ch.insert(f"konform_dev.{tbl}", ch_rows, column_names=cols)

    print("\nMenerapkan SQL konform di mode panggung...", flush=True)
    lap_terapkan = terapkan(ch=ch, mode="panggung")
    print(
        f"  Berkas sukses: {lap_terapkan['berkas_sukses']}, error: {lap_terapkan['berkas_error']}, objek: {lap_terapkan['jumlah_objek']}"
    )

    print("\nMenjalankan uji kontrak di mode panggung...", flush=True)
    lap_uji = uji(ch=ch, mode="panggung")
    print(f"  Hasil uji: {lap_uji['lulus']} lulus, {lap_uji['gagal']} gagal (total {lap_uji['total']})")

    if lap_uji["gagal"] > 0:
        print("\nPERINGATAN: Ada uji kontrak yang gagal di panggung!", file=sys.stderr)
        sys.exit(1)


def ukur(keluarga_nama: str, panggung: bool = False, ch: Any = None) -> dict[str, Any]:
    """Ukur kecocokan nilai mentah per keluarga kolom terhadap dimensi acuan."""
    ch = _ch(ch)
    db = "konform_dev" if panggung else "silver"
    keluarga_file = KELUARGA_PATH if KELUARGA_PATH.exists() else (DIR / "keluarga.toml")
    if not keluarga_file.exists():
        raise FileNotFoundError(f"Berkas keluarga.toml tidak ditemukan di {keluarga_file}")

    with open(keluarga_file, "rb") as f:
        keluarga_config = tomllib.load(f)

    if keluarga_nama not in keluarga_config:
        raise KeyError(f"Keluarga '{keluarga_nama}' tidak ditemukan di {keluarga_file}")

    cfg = keluarga_config[keluarga_nama]
    kolom_list = cfg.get("kolom", [])
    kunci_tmpl = cfg.get("kunci", "kunci_cocok(v)")
    cocok_subquery = cfg.get("cocok", "")

    kolom_in = ", ".join(f"'{c}'" for c in kolom_list)
    sql_find = f"""
    SELECT table, name
    FROM system.columns
    WHERE database = '{db}'
      AND name IN ({kolom_in})
      AND (type LIKE '%String%')
      AND table IN (
          SELECT name FROM system.tables WHERE database = '{db}' AND engine LIKE '%View%'
      )
    ORDER BY table, name
    """
    targets = ch.query(sql_find).result_rows

    total_baris_keseluruhan = 0
    total_cocok_keseluruhan = 0
    daftar_tak_cocok: dict[str, int] = {}
    laporan_per_kolom = []

    print(f"Mengukur kecocokan keluarga '{keluarga_nama}' atas database '{db}' ({len(targets)} view ditemukan):")
    print("-" * 80)
    print(f"{'Tabel':<50} {'Kolom':<12} {'Baris':<8} {'Cocok':<8} {'% Cocok':<8}")
    print("-" * 80)

    for tbl, col in targets:
        kunci_expr = re.sub(r"\bv\b", f"`{col}`", kunci_tmpl)
        sql_count = f"""
        SELECT
            countIf(`{col}` IS NOT NULL AND trim(`{col}`) != ''),
            countIf(`{col}` IS NOT NULL AND trim(`{col}`) != '' AND {kunci_expr} IN ({cocok_subquery}))
        FROM {db}.`{tbl}`
        """
        try:
            res = ch.query(sql_count).result_rows
            n_tot, n_mat = res[0][0], res[0][1]
        except Exception as e:
            print(f"Error membaca {tbl}.{col}: {e}", file=sys.stderr)
            continue

        pct = (n_mat / n_tot * 100.0) if n_tot > 0 else 100.0
        print(f"{tbl[:48]:<50} {col:<12} {n_tot:<8} {n_mat:<8} {pct:6.2f}%")
        laporan_per_kolom.append({
            "tabel": tbl, "kolom": col, "baris": n_tot, "cocok": n_mat, "persen": pct,
        })

        total_baris_keseluruhan += n_tot
        total_cocok_keseluruhan += n_mat

        # Ambil sampel nilai tak cocok
        sql_unmatched = f"""
        SELECT `{col}` AS v, count() AS c
        FROM {db}.`{tbl}`
        WHERE `{col}` IS NOT NULL AND trim(`{col}`) != '' AND {kunci_expr} NOT IN ({cocok_subquery})
        GROUP BY v
        """
        try:
            unmatched_rows = ch.query(sql_unmatched).result_rows
            for v, c in unmatched_rows:
                v_str = str(v)
                daftar_tak_cocok[v_str] = daftar_tak_cocok.get(v_str, 0) + int(c)
        except Exception:
            pass

    pct_total = (
        (total_cocok_keseluruhan / total_baris_keseluruhan * 100.0) if total_baris_keseluruhan > 0 else 100.0
    )
    print("-" * 80)
    print(f"{'TOTAL KESELURUHAN':<63} {total_baris_keseluruhan:<8} {total_cocok_keseluruhan:<8} {pct_total:6.2f}%\n")

    top25 = sorted(daftar_tak_cocok.items(), key=lambda x: x[1], reverse=True)[:25]
    print("25 Nilai Tak Cocok Terbanyak:")
    if not top25:
        print("  (Semua nilai cocok / tidak ada data tak cocok)")
    else:
        for idx, (val, cnt) in enumerate(top25, 1):
            print(f"  {idx:2d}. {val!r:<30} ({cnt} baris)")

    return {
        "keluarga": keluarga_nama,
        "database": db,
        "baris_total": total_baris_keseluruhan,
        "cocok_total": total_cocok_keseluruhan,
        "persen_total": pct_total,
        "top_tak_cocok": top25,
        "detail": laporan_per_kolom,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description="Peralatan konform lapisan Silver Dispar")
    subparsers = parser.add_subparsers(dest="command")

    p_terapkan = subparsers.add_parser("terapkan", help="Terapkan berkas SQL konform")
    p_terapkan.add_argument("--mode", choices=["lake", "panggung"], default="lake")

    p_uji = subparsers.add_parser("uji", help="Jalankan uji kontrak konform")
    p_uji.add_argument("--mode", choices=["lake", "panggung"], default="lake")

    p_panggung = subparsers.add_parser("panggung", help="Kelola database panggung konform_dev")
    p_panggung.add_argument("--hapus", action="store_true", help="Hapus database konform_dev")

    p_ukur = subparsers.add_parser("ukur", help="Ukur kecocokan keluarga kolom")
    p_ukur.add_argument("keluarga", help="Nama keluarga kolom (misal: bulan)")
    p_ukur.add_argument("--panggung", action="store_true", help="Ukur pada database konform_dev")

    args = parser.parse_args()

    if args.command == "terapkan":
        res = terapkan(mode=args.mode)
        print(f"Terapkan selesai: {res['berkas_sukses']} berhasil, {res['berkas_error']} gagal.")
        if res["berkas_error"] > 0:
            sys.exit(1)
    elif args.command == "uji":
        res = uji(mode=args.mode)
        print(f"Uji selesai: {res['lulus']} lulus, {res['gagal']} gagal.")
        if res["gagal"] > 0:
            sys.exit(1)
    elif args.command == "panggung":
        panggung(hapus=args.hapus)
    elif args.command == "ukur":
        ukur(keluarga_nama=args.keluarga, panggung=args.panggung)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
