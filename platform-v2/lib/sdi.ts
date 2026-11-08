import sdiData from "./sdi-data.json";

/**
 * Katalog dataset Dinas Pariwisata & Ekonomi Kreatif (org8) dari
 * Satu Data Indonesia — Jakarta (satudata.jakarta.go.id).
 *
 * Snapshot statis di sdi-data.json dipakai sebagai data awal (fokus POC:
 * tampilkan data as tabel). Refresh langsung dari API SDI tersedia
 * on-demand lewat /api/sdi.
 */
export type SdiDataset = {
  id: number;
  title: string;
  description: string;
  slug: string;
  tags: string[];
  views: number;
  datasetCount: number;
  createdAt: string | null;
  updatedAt: string | null;
  /** Dataset terdaftar di SDI tetapi belum berisi baris di sana. */
  kosong?: boolean;
};

export const SDI_ORG_UID = "org8";
export const SDI_ORG_NAME = "Dinas Pariwisata Dan Ekonomi Kreatif";
export const SDI_PORTAL = "https://satudata.jakarta.go.id";
export const SDI_SEARCH_API =
  "https://satudata.jakarta.go.id/backend/api/v2/satudata/search";

export const SDI_DATASETS: SdiDataset[] = sdiData as SdiDataset[];

/**
 * Entri katalog SDI yang hanya bernama OPD (mis. slug `DISPAREKRAF`), bukan dataset:
 * tanpa kolom dan tanpa baris. Disembunyikan dari katalog.
 */
export function isEntriOpd(title: string): boolean {
  return title.trim().toLowerCase() === SDI_ORG_NAME.toLowerCase();
}

/** Pesan untuk dataset yang terdaftar di SDI tetapi belum diisi di sana. */
export const PESAN_KOSONG_DI_SDI = "Dataset ini belum berisi data di Satu Data Jakarta";

export function datasetUrl(slug: string): string {
  return `${SDI_PORTAL}/open-data/${slug}`;
}

export function sdiStats(rows: SdiDataset[] = SDI_DATASETS) {
  const tags = new Set<string>();
  for (const r of rows) for (const t of r.tags) tags.add(t.toLowerCase());
  return {
    total: rows.length,
    tags: tags.size,
    views: rows.reduce((s, r) => s + r.views, 0),
    lastUpdated:
      rows
        .map((r) => r.updatedAt)
        .filter(Boolean)
        .sort()
        .at(-1) ?? null,
  };
}

/**
 * Tarik daftar dataset terbaru langsung dari API SDI (on-demand refresh).
 * Dipakai server-side oleh /api/sdi.
 */
export async function fetchSdiLive(signal?: AbortSignal): Promise<SdiDataset[]> {
  const seen = new Map<number, SdiDataset>();
  for (let page = 1; page <= 25; page++) {
    const res = await fetch(SDI_SEARCH_API, {
      method: "POST",
      signal,
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        q: "",
        kategori: "all",
        topik: "all",
        organisasi: SDI_ORG_UID,
        status: "all",
        sort: "desc",
        page_no: page,
        lang: "id",
      }),
    });
    if (!res.ok) break;
    const json = (await res.json()) as { data?: Record<string, unknown>[] };
    const rows = json.data ?? [];
    if (rows.length === 0) break;
    for (const it of rows) {
      if (it.category !== "dataset") continue;
      let tags: string[] = [];
      try {
        tags = JSON.parse((it.tag as string) || "[]");
      } catch {}
      const id = Number(it.id);
      seen.set(id, {
        id,
        title: String(it.title ?? "").trim(),
        description: String(it.description ?? "").trim(),
        slug: String(it.url ?? it.page_url ?? ""),
        tags,
        views: Number(it.count_view ?? 0),
        datasetCount: Number(it.jumlah_dataset ?? 0),
        createdAt: (it.date_created as string) ?? null,
        updatedAt: (it.updated_at as string) ?? null,
      });
    }
  }
  return [...seen.values()].sort((a, b) =>
    (b.updatedAt ?? "").localeCompare(a.updatedAt ?? "")
  );
}
