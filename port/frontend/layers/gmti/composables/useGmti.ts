/** Endpoint KONTRAK §2.5, satu fungsi per endpoint. */
export type Pilar = "ibadah" | "makan" | "menginap" | "destinasi" | "program";
export type GmtiTempat = {
  id: string;
  name: string;
  pillar: Pilar;
  kind: string;
  dataset: string;
  address: string | null;
  city: string | null;
  district: string | null;
  lat: number | null;
  lon: number | null;
  cert: string | null;
  note: string | null;
  maps_url: string;
};
export type GmtiRingkasan = {
  meta: {
    source: string;
    source_url: string;
    fetched_at: string;
    ibadah_total: number;
    masjid: number;
    mushalla: number;
    ibadah_non_signature: number;
    ibadah_berkoordinat: number;
    halal_total: number;
    kecamatan: number;
    kecamatan_tanpa_poligon: string[];
  };
  pillars: { id: Pilar; label: string; desc: string; color: string }[];
  kecamatan: { kecamatan: string; kota: string; total: number }[];
  tipologi: { tipologi: string; count: number }[];
  award: { nama: string; pemberi: string | null } | null;
};
export type GmtiQuery = { page?: string; size?: string; pilar?: string; kota?: string; jenis?: string; q?: string };

export function useGmti() {
  const api = useApi();
  return {
    ringkasan: () => api<GmtiRingkasan>("gmti/ringkasan").then((r) => r.data),
    tempat: (q: GmtiQuery) =>
      api<{ items: GmtiTempat[]; facets: { kota: string[]; jenis: string[] } }>("gmti/tempat", q).then((r) => ({
        ...r.data,
        total: (r.meta as { total: number }).total,
      })),
    spasial: () => api<any>("spasial").then((r) => r.data),
    titik: (id: string) => api<any>(`spasial/titik/${encodeURIComponent(id)}`).then((r) => r.data),
    hotelScraped: () => api<any>("hotel-scraped").then((r) => r.data),
  };
}
