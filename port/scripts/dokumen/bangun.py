#!/usr/bin/env python3
"""Bangun ulang bagian dokumen serah terima yang DIHASILKAN dari kode (plan 18, SPEC §8).

    python3 scripts/dokumen/bangun.py            # semua; keluar 1 bila pemeriksaan gagal
    python3 scripts/dokumen/bangun.py --cek      # hanya pemeriksaan, tanpa menulis berkas

Yang ditulis (jalankan dari mana saja; path relatif ke folder port/):

- docs/data-diagram.md     blok ERD (dari backend/database/oracle/portal-ddl.sql, dump migration)
                           dan kamus data (dari docs/api/data-api.openapi.yaml + laravel-openapi.json)
                           di antara penanda <!-- MULAI:x --> … <!-- SELESAI:x -->; teks lain tulisan tangan.
- docs/unit-testing.md     gabungan docs/skenario/*.md + berkas tes + status JUnit + cakupan.
- docs/data-api/skenario-tes.md  daftar tes Data API (bila lakehouse/data-api ada di sebelah port/).
- docs/data-api/openapi.yaml     salinan kontrak Data API (sama dengan docs/api/data-api.openapi.yaml).
- docs/api/openapi.json          OpenAPI Laravel beku = docs/api/laravel-openapi.json (ekspor Scramble).

Pemeriksaan (gagal = exit 1, dengan daftar yang jelas):
- setiap ID skenario punya tes (ID muncul di nama tes Pest/Vitest/Playwright);
- setiap rute API Laravel (nama rute) dan setiap rute halaman Nuxt muncul di docs/flowchart/*.md;
- tabel di portal-ddl.sql = tabel yang dibuat migration (+ MIGRATIONS milik Laravel).

Butuh Python 3.10+ dan PyYAML.
"""
from __future__ import annotations

import argparse
import json
import re
import shutil
import sys
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path

try:
    import yaml
except ImportError:  # pragma: no cover
    sys.exit("PyYAML belum terpasang: `pip install pyyaml` atau `apt install python3-yaml`.")

PORT = Path(__file__).resolve().parents[2]
REPO = PORT.parent
DOCS = PORT / "docs"
BACKEND = PORT / "backend"
FRONTEND = PORT / "frontend"
DATA_API = REPO / "lakehouse" / "data-api"

KEPALA_HASIL = "<!-- Berkas ini DIHASILKAN scripts/dokumen/bangun.py. Jangan diedit tangan. -->"

# Laporan JUnit yang dibaca (lokasi CI: .gitlab-ci.yml / scripts/ci/*.sh). Bisa ditimpa JUNIT=a.xml,b.xml.
JUNIT = {
    "Pest": BACKEND / "storage/logs/pest-junit.xml",
    "Vitest": FRONTEND / "test-results/vitest-junit.xml",
    "Playwright e2e": FRONTEND / "test-results/e2e-junit.xml",
}
# Laporan cakupan (bila ada): Pest --coverage-clover, Vitest --coverage (json-summary).
CAKUPAN = {
    "Backend (Pest, clover)": BACKEND / "storage/logs/clover.xml",
    "Frontend (Vitest, json-summary)": FRONTEND / "coverage/coverage-summary.json",
}

# Relasi logis tanpa FOREIGN KEY di skema (dicatat supaya ERD tidak menyesatkan).
RELASI_LOGIS = [
    ("USERS", "||--o{", "PERSONAL_ACCESS_TOKENS", "TOKENABLE_ID (polimorf Sanctum)"),
    ("USERS", "||--o{", "LOG_HISTORY", "KLIEN = NAME"),
    ("USERS", "||--o{", "JOB_RUNS", "KLIEN = NAME (manual)"),
]

ID_RE = re.compile(r"^\|\s*([A-Z]{2,3}-[A-Z]*\d+)\s*\|(.*)\|\s*$")


def tulis_blok(berkas: Path, nama: str, isi: str) -> None:
    teks = berkas.read_text(encoding="utf-8")
    mulai, selesai = f"<!-- MULAI:{nama} -->", f"<!-- SELESAI:{nama} -->"
    if mulai not in teks or selesai not in teks:
        raise SystemExit(f"{berkas}: penanda {mulai} / {selesai} tidak ada")
    awal, sisa = teks.split(mulai, 1)
    _, akhir = sisa.split(selesai, 1)
    berkas.write_text(f"{awal}{mulai}\n{isi.rstrip()}\n{selesai}{akhir}", encoding="utf-8")


def rel(p: Path) -> str:
    return str(p.relative_to(PORT))


# ---------------------------------------------------------------- ERD


def baca_ddl() -> tuple[dict[str, list[dict]], dict[str, list[str]]]:
    ddl = (BACKEND / "database/oracle/portal-ddl.sql").read_text(encoding="utf-8")
    tabel: dict[str, list[dict]] = {}
    for m in re.finditer(r'CREATE TABLE "(\w+)"\s*\((.*?)\n\s*\)\s*;', ddl, re.S):
        nama, isi = m.group(1), m.group(2)
        kolom = []
        pk = set(re.findall(r'PRIMARY KEY \(([^)]*)\)', isi))
        uq = set(re.findall(r'UNIQUE \(([^)]*)\)', isi))
        cek = re.findall(r'CHECK \((\w+) is json\)', isi, re.I)
        for k in re.finditer(r'^\s*"(\w+)" ([A-Z0-9_]+(?: ?\([\d, ]+\))?)(.*)$', isi, re.M):
            kol, tipe, sisa = k.group(1), k.group(2).replace(" (", "("), k.group(3)
            kunci = []
            if any(f'"{kol}"' in p for p in pk):
                kunci.append("PK")
            if any(f'"{kol}"' in u for u in uq):
                kunci.append("UK")
            kolom.append({
                "nama": kol,
                "tipe": tipe,
                "wajib": "NOT NULL" in sisa,
                "kunci": kunci,
                "json": kol.lower() in [c.lower() for c in cek],
            })
        tabel[nama] = kolom
    indeks: dict[str, list[str]] = {}
    for m in re.finditer(r'CREATE (UNIQUE )?INDEX "(\w+)" ON "(\w+)" \(([^)]*)\)', ddl):
        indeks.setdefault(m.group(3), []).append(f"{m.group(2)} ({m.group(4).replace(chr(34), '')})")
    return tabel, indeks


def tabel_migration() -> set[str]:
    nama = set()
    for f in (BACKEND / "database/migrations").glob("*.php"):
        nama |= {t.upper() for t in re.findall(r"Schema::create\('(\w+)'", f.read_text(encoding="utf-8"))}
    return nama | {"MIGRATIONS"}


def blok_erd() -> tuple[str, list[str]]:
    tabel, indeks = baca_ddl()
    masalah = []
    mig = tabel_migration()
    if set(tabel) != mig:
        masalah.append(
            "portal-ddl.sql tidak sama dengan migration (jalankan scripts/oracle-dump.sh): "
            f"hanya di DDL {sorted(set(tabel) - mig)}, hanya di migration {sorted(mig - set(tabel))}"
        )

    def tipe_mermaid(t: str) -> str:
        # Mermaid tidak menerima koma di tipe: NUMBER(19,0) → NUMBER(19).
        return re.sub(r"\((\d+),0\)", r"(\1)", t).replace(",", "_")

    out = ["```mermaid", "erDiagram"]
    for nama, kolom in tabel.items():
        out.append(f"    {nama} {{")
        for k in kolom:
            kunci = f" {','.join(k['kunci'])}" if k["kunci"] else ""
            ket = ' "JSON"' if k["json"] else ""
            out.append(f"        {tipe_mermaid(k['tipe'])} {k['nama']}{kunci}{ket}")
        out.append("    }")
    for a, rel_, b, label in RELASI_LOGIS:
        if a in tabel and b in tabel:
            out.append(f'    {a} {rel_} {b} : "{label}"')
    out.append("```")
    out.append("")
    out.append("Relasi di atas **logis**: skema tidak memakai FOREIGN KEY (log dan token tetap tersimpan")
    out.append("walau akun dihapus). Kolom `ID` diisi sequence + trigger `<TABEL>_ID_TRG` (default yajra).")
    out.append("")
    for nama, kolom in tabel.items():
        out.append(f"#### {nama}")
        out.append("")
        out.append("| Kolom | Tipe Oracle | Wajib | Kunci |")
        out.append("|---|---|---|---|")
        for k in kolom:
            kunci = ", ".join(k["kunci"] + (["CHECK IS JSON"] if k["json"] else []))
            out.append(f"| `{k['nama']}` | {k['tipe']} | {'ya' if k['wajib'] else ''} | {kunci} |")
        if nama in indeks:
            out.append("")
            out.append("Indeks: " + "; ".join(f"`{i}`" for i in indeks[nama]))
        out.append("")
    return "\n".join(out), masalah


# ---------------------------------------------------------------- kamus data


def muat_yaml_salinan(p: Path) -> dict:
    return yaml.safe_load(p.read_text(encoding="utf-8"))


def resolve(skema: dict, akar: dict) -> dict:
    while isinstance(skema, dict) and "$ref" in skema:
        bagian = skema["$ref"].lstrip("#/").split("/")
        node = akar
        for b in bagian:
            node = node[b]
        skema = node
    return skema or {}


def nama_tipe(s: dict) -> str:
    if "enum" in s:
        return " \\| ".join(str(v) for v in s["enum"])
    t = s.get("type")
    if isinstance(t, list):
        t = " \\| ".join(t)
    if t == "array":
        return f"array<{nama_tipe(s.get('items') or {})}>"
    if not t and ("oneOf" in s or "anyOf" in s):
        return " \\| ".join(nama_tipe(x) for x in s.get("oneOf", s.get("anyOf", [])))
    return t or "objek bebas"


def ratakan(s: dict, akar: dict, jalur: str, keluar: list, kedalaman: int = 0) -> None:
    s = resolve(s, akar)
    arti = (s.get("description") or "").replace("\n", " ").replace("|", "\\|").strip()
    keluar.append((jalur, nama_tipe(s), arti))
    if kedalaman >= 5:
        return
    if s.get("type") == "array" or (isinstance(s.get("type"), list) and "array" in s["type"]):
        item = resolve(s.get("items") or {}, akar)
        if item.get("properties"):
            for k, v in item["properties"].items():
                ratakan(v, akar, f"{jalur}[].{k}", keluar, kedalaman + 1)
    for k, v in (s.get("properties") or {}).items():
        ratakan(v, akar, f"{jalur}.{k}", keluar, kedalaman + 1)


def nilai_contoh(contoh: object, jalur: str) -> str:
    """Nilai skalar dari contoh respons kontrak (elemen pertama untuk `[]`); kosong bila tidak ada."""
    node = contoh
    for bagian in re.findall(r"[^.\[\]]+|\[\]", jalur):
        if bagian == "[]":
            node = node[0] if isinstance(node, list) and node else None
        else:
            node = node.get(bagian) if isinstance(node, dict) else None
    if isinstance(node, (dict, list)) or node is None:
        return ""
    teks = json.dumps(node, ensure_ascii=False)
    teks = teks if len(teks) <= 40 else teks[:37] + "…"
    return "`" + teks.replace("|", "\\|").replace("`", "'") + "`"


def blok_kamus() -> str:
    api = muat_yaml_salinan(DOCS / "api/data-api.openapi.yaml")
    laravel = json.loads((DOCS / "api/laravel-openapi.json").read_text(encoding="utf-8"))
    jalur_laravel = set(laravel["paths"])
    out = []
    for path, ops in api["paths"].items():
        for metode, op in ops.items():
            if not isinstance(op, dict) or "responses" not in op:
                continue
            lv = path.removeprefix("/v1")
            lv_teks = f"`{metode.upper()} /api/v1{lv}`" if lv in jalur_laravel else "— (tidak dibuka lewat Laravel)"
            out.append(f"### `{metode.upper()} {path}`")
            out.append("")
            sumber = op.get("x-sumber") or []
            out.append(f"- Laravel: {lv_teks}")
            out.append(f"- Kelas: {op.get('x-kelas', '—')}")
            out.append("- Sumber lake: " + (", ".join(f"`{x}`" for x in sumber) if sumber else "—"))
            if op.get("summary"):
                out.append(f"- Ringkas: {op['summary'].strip()}")
            out.append("")
            res = (op["responses"].get("200") or {}).get("content", {})
            if "application/json" not in res:
                jenis = ", ".join(res) or "tanpa body"
                out.append(f"Respons berkas/aliran ({jenis}); tidak ada field JSON.")
                out.append("")
                continue
            skema = resolve(res["application/json"].get("schema") or {}, api)
            data = (skema.get("properties") or {}).get("data")
            if not data:
                out.append("Skema `data` tidak dirinci di kontrak.")
                out.append("")
                continue
            baris: list = []
            ratakan(data, api, "data", baris)
            contoh = res["application/json"].get("example") or {}
            out.append("| Field | Tipe | Arti | Contoh |")
            out.append("|---|---|---|---|")
            for jalur, tipe, arti in baris:
                out.append(f"| `{jalur}` | {tipe} | {arti or '—'} | {nilai_contoh(contoh, jalur)} |")
            out.append("")
    hanya = sorted(p for p in jalur_laravel if f"/v1{p}" not in api["paths"])
    out.append("### Endpoint yang hanya ada di Laravel")
    out.append("")
    out.append("Tidak punya padanan langsung di Data API (gabungan atau rute sistem):")
    out.append("")
    for p in hanya:
        for metode, op in laravel["paths"][p].items():
            ringkas = (op.get("summary") or "").replace("\n", " ")
            out.append(f"- `{metode.upper()} /api/v1{p}`{' — ' + ringkas if ringkas else ''}")
    return "\n".join(out)


# ---------------------------------------------------------------- unit testing


def berkas_tes() -> list[Path]:
    hasil = []
    for akar, pola in ((BACKEND / "tests", "*.php"), (FRONTEND / "tests", "*.ts")):
        hasil += [p for p in akar.rglob(pola) if "__snapshots__" not in p.parts]
    return sorted(hasil)


def baca_skenario() -> list[dict]:
    hasil = []
    for f in sorted((DOCS / "skenario").glob("*.md")):
        bagian = ""
        for baris in f.read_text(encoding="utf-8").splitlines():
            if baris.startswith("## "):
                bagian = baris[3:].strip()
                continue
            m = ID_RE.match(baris)
            if m:
                kolom = [c.strip() for c in m.group(2).split(" | ")]
                hasil.append({"id": m.group(1), "fitur": f.stem, "bagian": bagian, "deskripsi": " — ".join(c for c in kolom if c and c != "—")})
    return hasil


def baca_junit() -> tuple[dict[str, str], list[str]]:
    sumber = JUNIT
    if env := __import__("os").environ.get("JUNIT"):
        sumber = {Path(p).name: Path(p) for p in env.split(",")}
    status: dict[str, str] = {}
    ringkas = []
    for nama, p in sumber.items():
        if not p.exists():
            ringkas.append(f"| {nama} | `{rel(p) if p.is_relative_to(PORT) else p}` | belum ada laporan | | | | |")
            continue
        akar = ET.parse(p).getroot()
        n = {"lulus": 0, "gagal": 0, "dilewati": 0}
        for tc in akar.iter("testcase"):
            if tc.find("failure") is not None or tc.find("error") is not None:
                s = "gagal"
            elif tc.find("skipped") is not None:
                s = "dilewati"
            else:
                s = "lulus"
            n[s] += 1
            for i in re.findall(r"\b[A-Z]{2,3}-[A-Z]*\d+\b", tc.get("name", "")):
                # Satu ID bisa jalan di beberapa project (desktop/mobile): gagal menang.
                if status.get(i) != "gagal":
                    status[i] = s if status.get(i) in (None, s, "dilewati") else status[i]
        waktu = datetime.fromtimestamp(p.stat().st_mtime, timezone.utc).strftime("%Y-%m-%d %H:%M UTC")
        ringkas.append(f"| {nama} | `{rel(p)}` | {waktu} | {n['lulus']} | {n['gagal']} | {n['dilewati']} | {sum(n.values())} |")
    return status, ringkas


def baca_cakupan() -> list[str]:
    out = []
    for nama, p in CAKUPAN.items():
        if not p.exists():
            out.append(f"| {nama} | belum ada laporan (`{rel(p)}`) |")
            continue
        if p.suffix == ".xml":
            m = ET.parse(p).getroot().find("project/metrics")
            st, cst = int(m.get("statements", 0)), int(m.get("coveredstatements", 0))
            out.append(f"| {nama} | {100 * cst / st:.1f}% pernyataan ({cst}/{st}) |" if st else f"| {nama} | 0 pernyataan |")
        else:
            t = json.loads(p.read_text())["total"]
            out.append(f"| {nama} | {t['statements']['pct']}% pernyataan, {t['branches']['pct']}% cabang |")
    return out


def rute_api() -> list[str]:
    nama = []
    for f in sorted((BACKEND / "app/Features").glob("*/routes.php")):
        nama += re.findall(r"->name\('([^']+)'\)", f.read_text(encoding="utf-8"))
    return nama


def rute_halaman() -> list[str]:
    hasil = []
    for f in sorted(FRONTEND.glob("layers/*/pages/**/*.vue")):
        # layers/<layer>/pages/<rute>.vue
        r = "/" + "/".join(f.relative_to(FRONTEND / "layers").parts[2:]).removesuffix(".vue")
        r = re.sub(r"/?index$", "", r) or "/"
        hasil.append(r)
    return sorted(set(hasil))


def cek_flowchart() -> list[str]:
    teks = "\n".join(p.read_text(encoding="utf-8") for p in sorted((DOCS / "flowchart").glob("*.md")))
    kurang = [f"rute API `{r}`" for r in rute_api() if f"`{r}`" not in teks]
    kurang += [f"rute halaman `{r}`" for r in rute_halaman() if f"`{r}`" not in teks]
    return kurang


def bangun_unit_testing() -> tuple[str, list[str]]:
    skenario = baca_skenario()
    tes = {p: p.read_text(encoding="utf-8") for p in berkas_tes()}
    status, ringkas_junit = baca_junit()
    tanpa_tes = []
    out = [
        KEPALA_HASIL,
        "",
        "# Unit testing portal",
        "",
        "Gabungan semua `docs/skenario/*.md`. Satu tes per ID; nama tes diawali ID-nya. Kolom *Berkas*",
        "dicari dari isi `backend/tests` dan `frontend/tests`; kolom *Status* dari laporan JUnit terakhir",
        "(CI menyimpannya sebagai artefak; salin ke lokasi di bawah, atau set `JUNIT=a.xml,b.xml`, lalu",
        "jalankan ulang `scripts/ekspor-dokumen.sh`). Paritas (`*-P*`) hanya dijalankan lokal melawan",
        "produksi (SPEC §7), jadi statusnya tidak ada di laporan CI.",
        "",
        "## Laporan JUnit",
        "",
        "| Suite | Berkas | Waktu | Lulus | Gagal | Dilewati | Total |",
        "|---|---|---|---|---|---|---|",
        *ringkas_junit,
        "",
        "## Cakupan",
        "",
        "| Bagian | Cakupan |",
        "|---|---|",
        *baca_cakupan(),
        "",
    ]
    fitur = ""
    jumlah: dict[str, int] = {}
    for s in skenario:
        jumlah[s["fitur"]] = jumlah.get(s["fitur"], 0) + 1
    out += ["## Ringkasan per fitur", "", "| Fitur (`docs/skenario/…`) | Skenario |", "|---|---|"]
    out += [f"| `{k}.md` | {v} |" for k, v in jumlah.items()]
    out += [f"| **Total** | **{sum(jumlah.values())}** |", ""]
    bagian = None
    pola = {s["id"]: re.compile(rf"\b{re.escape(s['id'])}(?!\d)") for s in skenario}
    for s in skenario:
        if s["fitur"] != fitur:
            fitur, bagian = s["fitur"], None
            out += [f"## Fitur `{fitur}`", ""]
        if s["bagian"] != bagian:
            bagian = s["bagian"]
            out += [f"### {bagian}", "", "| ID | Skenario | Berkas tes | Status |", "|---|---|---|---|"]
        cocok = [rel(p) for p, isi in tes.items() if pola[s["id"]].search(isi)]
        if not cocok:
            tanpa_tes.append(s["id"])
        berkas = "<br>".join(f"`{c}`" for c in cocok) or "**TIDAK ADA**"
        st = status.get(s["id"], "paritas, lokal" if re.search(r"-P\d", s["id"]) else "belum dijalankan")
        out.append(f"| {s['id']} | {s['deskripsi'].replace('|', '/')} | {berkas} | {st} |")
        nxt = skenario.index(s) + 1
        if nxt == len(skenario) or skenario[nxt]["bagian"] != bagian or skenario[nxt]["fitur"] != fitur:
            out.append("")
    masalah = [f"skenario tanpa tes: {', '.join(tanpa_tes)}"] if tanpa_tes else []
    return "\n".join(out) + "\n", masalah


# ---------------------------------------------------------------- Data API


def bangun_data_api() -> str | None:
    tests = DATA_API / "tests"
    if not tests.is_dir():
        return None
    out = [
        KEPALA_HASIL,
        "",
        "# Skenario tes Data API",
        "",
        "Dihasilkan dari `lakehouse/data-api/tests` (fungsi `test_*` dan baris pertama docstring-nya).",
        "`unit` dan `contract` jalan tanpa jaringan (`pytest -q`); `panggung` read-only melawan ClickHouse",
        "(`pytest -m panggung`).",
        "",
    ]
    for f in sorted(tests.rglob("test_*.py")):
        isi = f.read_text(encoding="utf-8")
        tes = re.findall(r'^(?:async )?def (test_\w+)\(.*?\).*?:\n(?:\s+(?:"""|\'\'\')(.*?)(?:\n|"""|\'\'\'))?', isi, re.M | re.S)
        if not tes:
            continue
        out += [f"## `{f.relative_to(DATA_API)}`", "", "| Tes | Keterangan |", "|---|---|"]
        out += [f"| `{n}` | {(d or '').strip().replace('|', '/') or '—'} |" for n, d in tes]
        out.append("")
    return "\n".join(out)


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--cek", action="store_true", help="hanya pemeriksaan, tanpa menulis berkas")
    a = ap.parse_args()

    masalah: list[str] = []
    erd, m = blok_erd()
    masalah += m
    unit, m = bangun_unit_testing()
    masalah += m
    kurang = cek_flowchart()
    if kurang:
        masalah.append("tanpa flowchart di docs/flowchart/*.md: " + ", ".join(kurang))

    if not a.cek:
        dd = DOCS / "data-diagram.md"
        tulis_blok(dd, "erd", erd)
        tulis_blok(dd, "kamus", blok_kamus())
        (DOCS / "unit-testing.md").write_text(unit, encoding="utf-8")
        if (da := bangun_data_api()) is not None:
            (DOCS / "data-api/skenario-tes.md").write_text(da, encoding="utf-8")
        shutil.copyfile(DOCS / "api/data-api.openapi.yaml", DOCS / "data-api/openapi.yaml")
        shutil.copyfile(DOCS / "api/laravel-openapi.json", DOCS / "api/openapi.json")
        print("ditulis: docs/data-diagram.md, docs/unit-testing.md, docs/data-api/{skenario-tes.md,openapi.yaml}, docs/api/openapi.json")

    for x in masalah:
        print(f"GAGAL: {x}", file=sys.stderr)
    return 1 if masalah else 0


if __name__ == "__main__":
    sys.exit(main())
