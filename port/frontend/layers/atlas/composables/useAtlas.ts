/**
 * Endpoint fitur atlas (KONTRAK §2.4), satu fungsi per endpoint. Data datang utuh (≤ 2.577 baris);
 * filter, cari, urut, paging, dan ekspor berjalan di klien seperti v2.
 */
export function useAtlas() {
  const api = useApi();
  const a = <T>(jalur: string, query?: Record<string, string | undefined>) => api<T>(`atlas/${jalur}`, query).then((r) => r.data);
  return {
    restoranGci: () => a<any>("restoran-gci"),
    direktoriRestoran: () => a<any>("direktori-restoran"),
    pertunjukan: (tahun?: string) => a<any>("pertunjukan", { tahun }),
    golf: () => a<any>("golf"),
    suvenir: () => a<any>("suvenir"),
    hotel: () => a<AtlasHotel>("hotel"),
  };
}

export type AtlasHotelRow = { nama: string; jenis_usaha: string; golongan: string; kamar: number; alamat: string; wilayah: string; periode: string };
export type AtlasHotel = {
  built: string;
  kpi: { hotels: number; rooms: number; occupancy_latest: number; occupancy_period: string; los_latest: number; los_period: string };
  tpk_chart: { periods: string[]; series: { name: string; data: (number | null)[] }[] };
  los_chart: { periods: string[]; series: { name: string; data: (number | null)[] }[] };
  registry: AtlasHotelRow[];
  filters: { wilayah: string[]; golongan: string[] };
};
