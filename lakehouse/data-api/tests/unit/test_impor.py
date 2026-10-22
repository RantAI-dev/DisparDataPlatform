"""Aturan pemisahan SPEC §3.2: fitur tidak mengimpor fitur lain, `shared/` tidak mengimpor fitur,
dan teks SQL hanya ada di `queries.py` (plus `shared/filters.py`, pembangun klausa)."""

import ast
import re
from pathlib import Path

AKAR = Path(__file__).resolve().parents[2] / "data_api"
SQL = re.compile(r"\b(SELECT|SHOW TABLES|DESCRIBE TABLE|UNION ALL|GROUP BY)\b")


def _impor(berkas: Path, akar: Path) -> list[str]:
    """Nama modul absolut yang diimpor sebuah berkas (impor relatif diselesaikan)."""
    paket = berkas.relative_to(akar.parent).with_suffix("").parts[:-1]
    hasil = []
    for n in ast.walk(ast.parse(berkas.read_text())):
        if isinstance(n, ast.Import):
            hasil += [a.name for a in n.names]
        elif isinstance(n, ast.ImportFrom):
            dasar = ".".join(paket[: len(paket) - n.level + 1]) if n.level else ""
            hasil.append(".".join(x for x in (dasar, n.module) if x))
    return hasil


def pelanggaran_impor(akar: Path) -> list[str]:
    salah = []
    for berkas in akar.rglob("*.py"):
        bagian = berkas.relative_to(akar).parts
        for m in _impor(berkas, akar):
            ke_fitur = m.startswith(f"{akar.name}.features.")
            if bagian[0] == "shared" and (ke_fitur or m == f"{akar.name}.main"):
                salah.append(f"{'/'.join(bagian)} → {m}")
            if bagian[0] == "features" and ((ke_fitur and m.split(".")[2] != bagian[1]) or m == f"{akar.name}.main"):
                salah.append(f"{'/'.join(bagian)} → {m}")
    return salah


def sql_di_luar_queries(akar: Path) -> list[str]:
    salah = []
    for berkas in akar.rglob("*.py"):
        if berkas.name == "queries.py" or berkas == akar / "shared" / "filters.py":
            continue
        pohon = ast.parse(berkas.read_text())
        docstring = {
            id(n.body[0].value)
            for n in ast.walk(pohon)
            if isinstance(n, (ast.Module, ast.FunctionDef, ast.ClassDef)) and ast.get_docstring(n) is not None
        }
        salah += [
            f"{berkas.relative_to(akar)}:{n.lineno}"
            for n in ast.walk(pohon)
            if isinstance(n, ast.Constant)
            and isinstance(n.value, str)
            and SQL.search(n.value)
            and id(n) not in docstring
        ]
    return salah


def test_aturan_impor():
    assert pelanggaran_impor(AKAR) == []


def test_sql_hanya_di_queries():
    assert sql_di_luar_queries(AKAR) == []


def test_pemindai_menangkap_pelanggaran(tmp_path):
    akar = tmp_path / "data_api"
    for d in ("shared", "features/a", "features/b"):
        (akar / d).mkdir(parents=True)
    (akar / "features/a/service.py").write_text("from data_api.features.b import service\nX = 'SELECT 1'\n")
    (akar / "features/b/service.py").write_text("from ..a import queries\n")
    (akar / "shared/hitungan.py").write_text("from data_api.features.a import service\n")
    (akar / "features/a/queries.py").write_text("X = 'SELECT 1'\n")
    assert sorted(pelanggaran_impor(akar)) == [
        "features/a/service.py → data_api.features.b",
        "features/b/service.py → data_api.features.a",
        "shared/hitungan.py → data_api.features.a",
    ]
    assert sql_di_luar_queries(akar) == ["features/a/service.py:2"]
