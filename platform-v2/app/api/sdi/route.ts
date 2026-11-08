import { NextResponse } from "next/server";
import { isEntriOpd, type SdiDataset } from "@/lib/sdi";
import * as store from "@/lib/ch/store";

const CDN_CACHE = {
  "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800",
};

/**
 * Katalog dataset primer Dinas Pariwisata — SUMBER TUNGGAL: database lakehouse
 * (bronze_meta.dataset_catalog). App TIDAK PERNAH memanggil API SDI; penarikan
 * dari SDI dilakukan pipeline lakehouse di belakang (dlt/Dagster, terjadwal).
 */
export async function GET() {
  try {
    const rows = (await store.catalog()).filter((r) => r.tier === "primer" && !isEntriOpd(r.title));
    const totals = await store.syncTotals();
    const datasets: SdiDataset[] = rows.map((r) => ({
      id: 0,
      title: r.title,
      description: r.description ?? "",
      slug: r.slug,
      tags: r.tags ?? [],
      views: r.views,
      datasetCount: 0,
      createdAt: null,
      updatedAt: r.updated_at,
      kosong: totals.get(r.slug) === 0,
    }));
    datasets.sort((a, b) =>
      String(b.updatedAt ?? "").localeCompare(String(a.updatedAt ?? "")),
    );
    return NextResponse.json(
      { source: "lakehouse", count: datasets.length, datasets },
      { headers: CDN_CACHE },
    );
  } catch (e) {
    return NextResponse.json(
      { source: "lakehouse", count: 0, datasets: [], error: String(e) },
      { status: 503 },
    );
  }
}
