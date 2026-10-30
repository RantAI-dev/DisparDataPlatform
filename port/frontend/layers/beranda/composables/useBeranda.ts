/** Endpoint fitur beranda (KONTRAK §2.6). */
export type RingkasanBeranda = {
  dataset_primer: number;
  dataset_sekunder: number;
  baris_sekunder: number;
  indikator: { gci: number; gpci: number; total: number };
  indeks_global: number;
};

export function useBeranda() {
  const api = useApi();
  return { ringkasan: () => api<RingkasanBeranda>("beranda/ringkasan") };
}
