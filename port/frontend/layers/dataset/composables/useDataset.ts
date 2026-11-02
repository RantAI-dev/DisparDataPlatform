/**
 * Endpoint fitur dataset (KONTRAK §2.1), satu fungsi per endpoint. Halaman dan komponen tidak
 * memanggil useApi langsung.
 */
import type { MedallionInfo, SumberData } from "../constants";

export type Tier = "primer" | "sekunder";

export type KatalogItem = {
  id: string;
  title: string;
  description: string;
  tags: string[];
  tier: Tier;
  sumber: SumberData;
  source: string;
  size_label: string;
  href: string;
  external: boolean;
  medallion: MedallionInfo | null;
};
export type Katalog = {
  items: KatalogItem[];
  stats: { total: number; tags: number; views: number; last_updated: string | null };
  layer_counts: Record<string, number>;
};

export type Kolom = { key: string; desc: string | null; type: string | null };
export type Baris = Record<string, unknown>;
export type DatasetMeta = {
  slug: string;
  title: string;
  description: string;
  sumber_data: string[];
  frekuensi: string | null;
  satuan: string | null;
  periode: { min: string; max: string } | null;
  medallion: MedallionInfo | null;
  total_bronze: number;
};
export type Halaman = { dataset: DatasetMeta; kolom: { items: Kolom[] }; baris: { items: Baris[] } };
export type Facet = {
  key: string;
  kind: "kategori" | "angka" | "tanggal" | "none";
  values?: { v: string; n: number }[];
  min?: string;
  max?: string;
};
export type Agregat = { items: { name: string; value: number }[] };

/** Parameter baris: `f` dikirim `f[]=` oleh useApi. */
export type QueryBaris = { page?: number; size?: number; q?: string; f?: string[]; sort?: string };

export function useDataset() {
  const api = useApi();
  const d = (slug: string, bagian = "") => `dataset/${encodeURIComponent(slug)}${bagian ? `/${bagian}` : ""}`;

  return {
    katalog: (tier: "semua" | Tier = "semua") => api<Katalog>("katalog", { tier }),
    halaman: (slug: string, size: number) => api<Halaman>(d(slug, "halaman"), { page: 1, size }),
    baris: (slug: string, query: QueryBaris) => api<{ items: Baris[] }>(d(slug, "baris"), query),
    facet: (slug: string) => api<{ items: Facet[] }>(d(slug, "facet")),
    agregat: (slug: string, query: { x: string; y?: string; agg: string; q?: string; f?: string[] }) => api<Agregat>(d(slug, "agregat"), query),
    /** URL unduhan lewat proxy browser `/_api` (aliran, bukan JSON). */
    urlEkspor: (slug: string, format: "csv" | "xlsx", query: { q?: string; f?: string[]; sort?: string } = {}) =>
      `/_api/${d(slug, "ekspor")}${queryLaravel({ format, ...query })}`,
  };
}
