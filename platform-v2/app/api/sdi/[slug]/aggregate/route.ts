import { NextResponse } from "next/server";
import * as store from "@/lib/ch/store";
import { FilterError, parseRowQuery } from "@/lib/ch/query-filter";

/**
 * Data grafik untuk halaman detail dataset, dihitung atas seluruh baris yang
 * cocok dengan pencarian/filter (bukan hanya baris yang sudah termuat).
 *   ?x=<kolom>&y=<kolom>&agg=sum|avg|count|max|min[&q=..&f=..]
 */
export const dynamic = "force-dynamic";

const AGGS = new Set<store.Agg>(["sum", "avg", "count", "max", "min"]);

export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const sp = new URL(req.url).searchParams;
  const x = sp.get("x") || "";
  const y = sp.get("y") || "";
  const agg = sp.get("agg") as store.Agg;
  try {
    if (!x || !AGGS.has(agg)) throw new FilterError("Parameter grafik tidak valid");
    const data = await store.aggregate(slug, parseRowQuery(sp), x, y, agg);
    return NextResponse.json({ slug, data });
  } catch (e) {
    if (e instanceof FilterError) return NextResponse.json({ error: e.message }, { status: 400 });
    return NextResponse.json({ error: "Gagal membaca dari lakehouse", detail: String(e) }, { status: 503 });
  }
}
