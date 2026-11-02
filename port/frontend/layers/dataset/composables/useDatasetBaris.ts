/**
 * Keadaan tabel halaman detail (app/sdi/[slug]/page.tsx v2): muat awal, muat ulang saat pencarian/
 * filter/sort berubah, dan muat bertahap saat digulir.
 *
 * - Muat awal tanpa q/f/sort lewat `halaman` (meta + kolom + 50 baris, satu request seperti v2).
 * - Muat ulang lewat `baris?page=1`; konten lama tetap tampil dan diredupkan (`refreshing`).
 * - Halaman berikutnya: `page = baris_dimuat / 50 + 1` (setara offset v2).
 * - Pencarian di-debounce 350 ms dan di-trim. Jawaban usang (nomor muat lama) dibuang.
 */
import type { Ref } from "vue";
import { PESAN_404, PESAN_GAGAL, UKURAN_HALAMAN } from "../constants";
import type { Baris, DatasetMeta, Kolom } from "./useDataset";
import type { Filter, Sort } from "../utils/query-filter";

export function useDatasetBaris(slug: Ref<string>) {
  const { halaman, baris: ambilBaris } = useDataset();

  const meta = ref<DatasetMeta | null>(null);
  const kolom = ref<Kolom[]>([]);
  const rows = ref<Baris[]>([]);
  const count = ref(0); // baris cocok filter aktif (Silver)
  const error = ref<string | null>(null);
  const loading = ref(true);
  const loadingMore = ref(false);
  const refreshing = ref(false);

  const q = ref("");
  const debouncedQ = ref("");
  const filters = ref<Filter[]>([]);
  const sort = ref<Sort | null>(null);

  /** Query tanpa sort (grafik) dan dengan sort (tabel, unduhan). */
  const filterQuery = computed(() => queryBaris({ search: debouncedQ.value, filters: filters.value, sort: null }));
  const query = computed(() => queryBaris({ search: debouncedQ.value, filters: filters.value, sort: sort.value }));
  const filtered = computed(() => Object.keys(filterQuery.value).length > 0);

  let tunda: ReturnType<typeof setTimeout> | undefined;
  watch(q, (v) => {
    clearTimeout(tunda);
    tunda = setTimeout(() => (debouncedQ.value = v.trim()), 350);
  });

  let nomor = 0;
  async function load(reset: boolean) {
    const ini = ++nomor;
    if (!reset) loadingMore.value = true;
    else if (meta.value) refreshing.value = true;
    else loading.value = true;
    try {
      if (reset && !meta.value) {
        const { data, meta: m } = await halaman(slug.value, UKURAN_HALAMAN);
        if (ini !== nomor) return;
        meta.value = data.dataset;
        kolom.value = data.kolom.items ?? [];
        rows.value = data.baris.items;
        count.value = m.total ?? 0;
      } else {
        const page = reset ? 1 : Math.floor(rows.value.length / UKURAN_HALAMAN) + 1;
        const { data, meta: m } = await ambilBaris(slug.value, { page, size: UKURAN_HALAMAN, ...query.value });
        if (ini !== nomor) return;
        count.value = m.total ?? 0;
        rows.value = reset ? data.items : [...rows.value, ...data.items];
      }
      error.value = null;
    } catch (e) {
      if (ini !== nomor) return;
      error.value = e instanceof ApiError && e.status === 404 ? PESAN_404 : e instanceof ApiError && e.status > 0 ? e.message.replace(/\.$/, "") : PESAN_GAGAL;
    } finally {
      if (ini === nomor) {
        loading.value = false;
        loadingMore.value = false;
        refreshing.value = false;
      }
    }
  }

  // Slug baru: kosongkan semuanya lalu muat awal. Seperti v2 (client component), data dimuat di
  // browser saja; SSR merender keadaan "Memuat data…".
  function mulai() {
    meta.value = null;
    rows.value = [];
    filters.value = [];
    sort.value = null;
    q.value = "";
    debouncedQ.value = "";
    load(true);
  }
  watch(slug, mulai);
  if (getCurrentInstance()) onMounted(mulai);
  else mulai();
  watch(() => JSON.stringify(query.value), () => load(true));

  const hasMore = computed(() => rows.value.length < count.value);
  function muatBerikutnya() {
    // Jangan muat bertahap selagi muat ulang: offset dan hasMore masih milik hasil lama.
    if (hasMore.value && !loading.value && !refreshing.value && !loadingMore.value) load(false);
  }
  /** Klik judul kolom: naik → turun → urutan asli. */
  function toggleSort(col: string) {
    const s = sort.value;
    sort.value = s?.col !== col ? { col, dir: "asc" } : s.dir === "asc" ? { col, dir: "desc" } : null;
  }

  const stop = () => clearTimeout(tunda);
  if (getCurrentInstance()) onBeforeUnmount(stop);

  return { meta, kolom, rows, count, error, loading, loadingMore, refreshing, q, debouncedQ, filters, sort, filterQuery, query, filtered, hasMore, muatBerikutnya, toggleSort };
}
