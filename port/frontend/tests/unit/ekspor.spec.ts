// useSpreadsheetExport: CSV ber-BOM dan buku kerja SheetJS (termasuk quirk lebar kolom v2).
import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { bukuKerja, dateStamp, toCsv, type CsvColumn } from "../../layers/shared/composables/useSpreadsheetExport";

type R = { nama: string; nilai: number | null };
const rows: R[] = [
  { nama: 'Restoran "Kita", Menteng', nilai: 12345 },
  { nama: "Warung\nbaris baru", nilai: null },
];
const cols: CsvColumn<R>[] = [
  { header: "No", value: (_r, i) => i + 1 },
  { header: "Nama", value: (r) => r.nama },
  { header: "Nilai", value: (r) => r.nilai },
];

describe("ekspor spreadsheet", () => {
  it("CSV memakai BOM, CRLF, dan meng-escape koma/kutip/baris baru", () => {
    expect(toCsv(rows, cols)).toBe('﻿No,Nama,Nilai\r\n1,"Restoran ""Kita"", Menteng",12345\r\n2,"Warung\nbaris baru",');
  });

  it("buku kerja: sel kosong untuk null, lebar kolom dari sel terpanjang (indeks kolom ke value, quirk v2)", () => {
    const wb = bukuKerja(XLSX, rows, cols, "Data");
    const ws = wb.Sheets.Data!;
    expect(XLSX.utils.sheet_to_json(ws, { header: 1, defval: null })).toEqual([
      ["No", "Nama", "Nilai"],
      [1, 'Restoran "Kita", Menteng', 12345],
      [2, "Warung\nbaris baru", ""],
    ]);
    // Kolom "No" dihitung dengan indeks kolom (0) untuk tiap baris → "1" → wch = max(2+2, 8).
    expect(ws["!cols"]).toEqual([{ wch: 8 }, { wch: 26 }, { wch: 8 }]);
  });

  it("dateStamp YYYY-MM-DD", () => {
    expect(dateStamp(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
