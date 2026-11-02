/**
 * Ekspor spreadsheet (lib/export.ts v2): CSV tanpa dependensi, XLS/XLSX lewat SheetJS yang dimuat
 * malas supaya ~700 KB pustaka hanya masuk saat tombol ekspor pertama kali diklik.
 * SheetJS 0.18.5 = versi v2 (ADR 0001: 0.20.3 tidak menghasilkan berkas .xls identik).
 */
import type * as SheetJS from "xlsx";

export type CsvColumn<T> = {
  header: string;
  value: (row: T, index: number) => string | number | undefined | null;
};

export type ExportFormat = "csv" | "xls" | "xlsx";

function csvEscape(v: string | number | undefined | null): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function toCsv<T>(rows: T[], columns: CsvColumn<T>[]): string {
  const header = columns.map((c) => csvEscape(c.header)).join(",");
  const body = rows.map((row, i) => columns.map((c) => csvEscape(c.value(row, i))).join(",")).join("\r\n");
  // BOM UTF-8 supaya Excel membuka dengan encoding yang benar.
  return "﻿" + header + "\r\n" + body;
}

export function dateStamp(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Buku kerja satu lembar (dipisah dari unduhan supaya bisa diuji). */
export function bukuKerja<T>(XLSX: typeof SheetJS, rows: T[], columns: CsvColumn<T>[], sheetName = "Sheet1") {
  const aoa: (string | number)[][] = [
    columns.map((c) => c.header),
    ...rows.map((row, i) =>
      columns.map((c) => {
        const v = c.value(row, i);
        return v === undefined || v === null ? "" : v;
      }),
    ),
  ];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // Lebar kolom dari sel terpanjang. Quirk v2 ditiru (K-10): indeks yang dikirim ke `value` adalah
  // indeks KOLOM, bukan indeks baris (hanya berpengaruh pada kolom yang memakai indeks, mis. "No").
  ws["!cols"] = columns.map((c, idx) => {
    let max = c.header.length;
    for (const row of rows) {
      const v = c.value(row, idx);
      const len = v === undefined || v === null ? 0 : String(v).length;
      if (len > max) max = len;
    }
    return { wch: Math.min(Math.max(max + 2, 8), 50) };
  });
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, sheetName);
  return wb;
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function useSpreadsheetExport() {
  /** Satu pintu per format; SheetJS diimpor dinamis. */
  async function downloadSpreadsheet<T>(baseFilename: string, rows: T[], columns: CsvColumn<T>[], format: ExportFormat, sheetName = "Sheet1") {
    if (format === "csv") {
      downloadBlob(`${baseFilename}.csv`, new Blob([toCsv(rows, columns)], { type: "text/csv;charset=utf-8" }));
      return;
    }
    const XLSX = await import("xlsx");
    XLSX.writeFile(bukuKerja(XLSX, rows, columns, sheetName), `${baseFilename}.${format}`, { bookType: format });
  }
  return { downloadSpreadsheet, dateStamp };
}
