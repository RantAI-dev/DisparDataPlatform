import { NextResponse } from "next/server";
import * as store from "@/lib/ch/store";

/**
 * Pilihan filter per kolom untuk halaman detail dataset:
 *   kategori (≤ 50 nilai unik) → daftar nilai + jumlahnya
 *   angka / tanggal            → min–maks
 * Dihitung atas seluruh dataset di Silver.
 */
export const dynamic = "force-dynamic";

export async function GET(_req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  try {
    // Facet hanya berubah saat refresh data harian → boleh di-cache CDN seperti tabel tanpa filter.
    return NextResponse.json(
      { slug, facets: await store.facets(slug) },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=604800" } },
    );
  } catch (e) {
    return NextResponse.json({ error: "Gagal membaca dari lakehouse", detail: String(e) }, { status: 503 });
  }
}
