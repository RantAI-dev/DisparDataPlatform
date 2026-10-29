/** Endpoint fitur indikator (KONTRAK §2.3), satu fungsi per endpoint. */
export type Framework = "GCI" | "GPCI";
export type Status = "ready" | "partial" | "gap";
export type BarisIndikator = {
  no: number | null;
  code: string;
  framework: Framework;
  dimension: string;
  group: string;
  name: string;
  status: Status;
  data_available: boolean;
  owner: string;
  note: string;
  datasets: { slug: string; title: string; total: number }[];
  latest: { label: string; value: number } | null;
};
export type DaftarIndikator = { framework: Framework; summary: { label: string; value: string }[]; rows: BarisIndikator[]; gaps: string[] };
export type Blok = { type: "bar" | "ranked" | "line" | "donut" | "map_points" | "grouped_lines" | "table_events"; title: string; layout: "full" | "half"; data: any };
export type Konteks = {
  index_metric: string;
  index_source: string;
  unit: string;
  frontier: { city: string | null; value: string | null };
  jakarta: { value: string | null; note: string | null };
  target: string | null;
  data_needed: { status: "punya" | "proksi" | "belum"; label: string; owner: string }[];
};
export type DetailIndikator = {
  code: string;
  indikator: { framework: Framework; dimension: string | null; name: string; definition: string | null; owner: string | null; note: string | null };
  konteks: Konteks | null;
  sources: { slug: string; title: string; tier: string }[];
  source_text: string | null;
  kpis: { label: string; value: string | number; sub: string | null }[];
  blocks: Blok[];
  teks_fallback: string[] | null;
};
export type KartuResmi = { label: string; nilai: string; satuan: string; tahun: string; sumber: string; catatan: string | null; href: string | null };
export type GciResmi = {
  ranking: {
    cultural: { y2024: number; y2025: number };
    overall: { y2024: number; y2025: number };
    sumber: { label: string; url: string };
    catatan: string;
  };
  kartu: KartuResmi[];
};

export function useIndikator() {
  const api = useApi();
  return {
    daftar: (framework: Framework) => api<DaftarIndikator>("indikator", { framework }).then((r) => r.data),
    detail: (code: string) => api<DetailIndikator>(`indikator/${encodeURIComponent(code)}`).then((r) => r.data),
    gciResmi: () => api<GciResmi>("gci/resmi").then((r) => r.data),
    datasetTematik: (framework: Framework) =>
      api<{ items: { no: string; title: string; href: string; total: number }[] }>("dataset-tematik", { framework }).then((r) => r.data),
    wisatawanInternasional: () => api<HalamanPariwisata>("pariwisata/wisatawan-internasional").then((r) => r.data),
    kulinerMichelin: () => api<HalamanPariwisata>("pariwisata/kuliner-michelin").then((r) => r.data),
    seniPertunjukan: (tahun?: string) => api<HalamanPariwisata>("pariwisata/seni-pertunjukan", { tahun }).then((r) => r.data),
  };
}

/** Halaman pariwisata (KONTRAK §2.3): shell, KPI, kartu chart, tautan data mentah, komponen khusus. */
export type HalamanPariwisata = {
  shell: { eyebrow: string; title: string; nilai: string; satuan: string; tahun?: string; catatan: string; sumber: string; sumberHref: string };
  kpis: { label: string; value: string | number; sub: string | null }[];
  kartu: { judul: string; sub: string; komponen: string; data: Record<string, unknown> }[];
  raw: { slug: string; title: string; count: number }[];
  komponen: Record<string, any>;
  tabel?: { header: string[]; rows: string[][]; tautan?: (string | null)[] | null }[];
};
