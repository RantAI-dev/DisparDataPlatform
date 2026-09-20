#!/usr/bin/env python3
"""Export sekunder JSON ke Excel untuk deliverable Dinas.

Input  : data/sekunder/<slug>.json  (format standar repo: {slug,title,description,columns,rows})
Output : data/exports/<slug>.xlsx

Header Excel dibangun dari `columns`:
  - Setiap kolom punya `key` (nama field di rows), `label` (opsional; fallback ke key),
    dan `type` (string/number/bool/...; hanya untuk formatting).
  - Urutan baris sesuai urutan di `columns`.

Jalankan dari root repo:
    python3 scripts/export_excel.py <slug> [<slug> ...]

Skrip idempotent — export ulang menimpa file Excel lama.
Skrip tidak menyentuh lakehouse; murni lokal.
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

from openpyxl import Workbook
from openpyxl.styles import Alignment, Font, PatternFill
from openpyxl.utils import get_column_letter

REPO_ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = REPO_ROOT / "data" / "sekunder"
EXPORT_DIR = REPO_ROOT / "data" / "exports"


def _label_for(col: dict) -> str:
    return col.get("label") or col.get("key") or "?"


def _autosize(ws, max_rows_for_sample: int = 200) -> None:
    """Best-effort autosize kolom dari sampel baris (max 200)."""
    sample_rows = list(ws.iter_rows(min_row=2, max_row=1 + max_rows_for_sample, values_only=True))
    if not sample_rows:
        return
    n_cols = len(sample_rows[0])
    for col_idx in range(n_cols):
        max_len = 0
        for row in sample_rows:
            v = row[col_idx]
            if v is None:
                continue
            s = str(v)
            if len(s) > max_len:
                max_len = len(s)
        # +2 untuk padding; cap 80 supaya kolom JSON tidak melar
        ws.column_dimensions[get_column_letter(col_idx + 1)].width = min(80, max(12, max_len + 2))


def export_one(slug: str) -> dict:
    """Export satu slug. Mengembalikan dict ringkasan untuk logging.

    Jika JSON punya field `multi_sheet: true` atau field `sheets`, baris akan
    dipisah ke beberapa sheet (untuk items 4 & 5: Asosiasi/Organisasi/Badan/EO).
    """
    src = SOURCE_DIR / f"{slug}.json"
    if not src.exists():
        return {"slug": slug, "ok": False, "error": f"sumber tidak ditemukan: {src}"}

    data = json.loads(src.read_text(encoding="utf-8"))
    title = data.get("title", slug)
    description = data.get("description", "")
    columns = data.get("columns", [])
    rows = data.get("rows", [])
    sheets_def = data.get("sheets")  # opsional

    EXPORT_DIR.mkdir(parents=True, exist_ok=True)
    out = EXPORT_DIR / f"{slug}.xlsx"

    wb = Workbook()
    # Hapus sheet default, akan dibuat per sheet
    default_ws = wb.active
    wb.remove(default_ws)

    sheet_summary = []

    if sheets_def:
        # Mode multi-sheet: tiap sheet punya key kategori dan rows sendiri
        for s_idx, sheet in enumerate(sheets_def):
            sheet_name = (sheet.get("name") or sheet.get("key") or f"Sheet{s_idx+1}")[:31]
            ws = wb.create_sheet(title=sheet_name)
            sheet_rows = sheet.get("rows", [])
            sheet_columns = sheet.get("columns") or columns
            _write_sheet(ws, sheet_columns, sheet_rows, title, description, src.name)
            sheet_summary.append((sheet_name, len(sheet_rows)))
    else:
        # Mode single-sheet: satu sheet dengan seluruh baris
        ws = wb.create_sheet(title=(slug[:31] or "Sheet1"))
        _write_sheet(ws, columns, rows, title, description, src.name)
        sheet_summary.append((ws.title, len(rows)))

    wb.save(out)

    return {
        "slug": slug,
        "ok": True,
        "rows": len(rows),
        "columns": len(columns),
        "sheets": sheet_summary,
        "out": str(out.relative_to(REPO_ROOT)),
    }


def _write_sheet(ws, columns: list, rows: list, title: str, description: str, src_name: str) -> None:
    """Tulis satu sheet: header + baris data + footer metadata."""
    header_font = Font(bold=True, color="FFFFFF")
    header_fill = PatternFill("solid", fgColor="1F4E78")
    wrap = Alignment(wrap_text=True, vertical="top")

    headers = [_label_for(c) for c in columns]
    if not headers:
        first = rows[0] if rows else {}
        headers = list(first.keys()) if isinstance(first, dict) else []
        key_order = headers
    else:
        key_order = [c["key"] for c in columns]

    for col_idx, h in enumerate(headers, start=1):
        cell = ws.cell(row=1, column=col_idx, value=h)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = wrap

    for row_idx, row in enumerate(rows, start=2):
        if not isinstance(row, dict):
            continue
        for col_idx, key in enumerate(key_order, start=1):
            value = row.get(key, "")
            if isinstance(value, list):
                value = "; ".join(str(v) for v in value)
            cell = ws.cell(row=row_idx, column=col_idx, value=value)
            cell.alignment = wrap

    _autosize(ws)
    ws.freeze_panes = "A2"

    meta_row = len(rows) + 3
    ws.cell(row=meta_row, column=1, value=f"Sumber: {src_name}").font = Font(italic=True, color="555555")
    ws.cell(row=meta_row + 1, column=1, value=f"Judul: {title}").font = Font(italic=True, color="555555")
    if description:
        ws.cell(row=meta_row + 2, column=1, value=f"Deskripsi: {description}").font = Font(italic=True, color="555555")
        ws.cell(row=meta_row + 2, column=1).alignment = Alignment(wrap_text=True, vertical="top")
        ws.row_dimensions[meta_row + 2].height = 60


def main(argv: list[str]) -> int:
    if len(argv) < 2:
        print("Pemakaian: python3 scripts/export_excel.py <slug> [<slug> ...]")
        print("Contoh  : python3 scripts/export_excel.py water-attractions-jakarta wellness-jakarta")
        return 2

    slugs = argv[1:]
    failures = 0
    for slug in slugs:
        summary = export_one(slug)
        if summary["ok"]:
            sheets_info = ", ".join(f"{n}={c}" for n, c in summary.get("sheets", []))
            print(
                f"[OK]   {slug}: {summary['rows']} baris × {summary['columns']} kolom "
                f"({sheets_info}) → {summary['out']}"
            )
        else:
            print(f"[FAIL] {slug}: {summary['error']}")
            failures += 1

    return 0 if failures == 0 else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv))
