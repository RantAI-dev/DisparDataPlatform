import * as store from "@/lib/ch/store";
import * as XLSX from "xlsx";
import { FilterError, isFiltered, parseRowQuery } from "@/lib/ch/query-filter";

// Export baris satu dataset (tanpa paginasi) sebagai CSV atau XLSX.
//   /api/sdi/<slug>/export?format=csv|xlsx[&q=..&f=..&sort=..]
// Tanpa q/f/sort → seluruh baris; dengan itu → hasil terfilter & terurut,
// sama persis dengan tabel di halaman detail.
// SUMBER TUNGGAL: lakehouse. App tidak memanggil API SDI.
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params;
  const sp = new URL(req.url).searchParams;
  const format = (sp.get("format") || "csv").toLowerCase();
  let rq;
  try {
    rq = parseRowQuery(sp);
  } catch (e) {
    if (e instanceof FilterError) return Response.json({ error: e.message }, { status: 400 });
    throw e;
  }
  const filtered = isFiltered(rq) || rq.sort !== null;
  const base = filtered ? `${slug}-terfilter` : slug;

  let columns: string[] = [];
  let rows: Record<string, unknown>[] = [];

  // 1) Dari lakehouse (bronze_meta + bronze_sdi).
  try {
    const cols = await store.columns(slug);
    if (cols.length) {
      columns = cols.map((c) => c.key);
      rows = await store.rowsFiltered(slug, rq);
    }
  } catch (e) {
    if (e instanceof FilterError) return Response.json({ error: e.message }, { status: 400 });
    /* lainnya: diperlakukan sebagai belum tersedia di bawah */
  }

  // Tidak ada fallback ke API SDI — kalau lakehouse belum punya, 404.
  if (!columns.length) {
    return new Response(
      JSON.stringify({ error: "Dataset belum tersedia di lakehouse" }),
      { status: 404, headers: { "Content-Type": "application/json" } },
    );
  }

  const cell = (r: Record<string, unknown>, k: string) => {
    const v = r[k];
    return v === null || v === undefined ? "" : v;
  };
  const aoa: unknown[][] = [columns, ...rows.map((r) => columns.map((k) => cell(r, k)))];

  if (format === "xlsx") {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data");
    const buf: Buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${base}.xlsx"`,
        "Cache-Control": "no-store",
      },
    });
  }

  // CSV (default) — BOM UTF-8 agar Excel membaca aksen dengan benar.
  const esc = (v: unknown) => {
    const s = String(v ?? "");
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = "﻿" + aoa.map((row) => row.map(esc).join(",")).join("\r\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${base}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
