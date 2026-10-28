<script setup lang="ts">
/**
 * Tabel dataset yang bisa disematkan (SdiTable.tsx): cari (debounce 350 ms) + muat bertahap saat
 * digulir, header oranye. Halaman pertama tanpa pencarian lewat `dataset/{slug}/halaman` (dataset +
 * kolom + baris, satu request seperti `/api/sdi` v2); pencarian dan halaman berikutnya lewat
 * `dataset/{slug}/baris`. Dimuat di browser saja, sama dengan v2 (client component).
 */
type Kolom = { key: string; desc: string | null; type: string | null };
type Baris = Record<string, unknown>;
type Halaman = { dataset: { total_bronze?: number | null }; kolom: { items: Kolom[] }; baris: { items: Baris[] } };

const props = defineProps<{
  slug: string;
  /** Batasi & urutkan kolom yang tampil (pakai key kolom). */
  columns?: string[];
}>();

const ACCENT = "#ed6b23";
const PAGE = 50;
const HIDDEN = new Set(["id", "user_id", "uid_upload", "batch_upload", "jadwal_rilis", "tanggal_upload", "tanggal_update", "created_at", "updated_at"]);

const humanize = (key: string) => key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

function fmtCell(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  const s = String(v);
  if (/^\d{4,}$/.test(s)) {
    const n = Number(s);
    if (!isNaN(n) && s.length > 4) return n.toLocaleString("id-ID");
  }
  return s;
}

const api = useApi();
const rows = ref<Baris[]>([]);
const metaCols = ref<Kolom[]>([]);
const count = ref(0);
const total = ref(0);
const error = ref<string | null>(null);
const loading = ref(true);
const loadingMore = ref(false);
const q = ref("");
const debouncedQ = ref("");
const sentinel = ref<HTMLDivElement | null>(null);
const portalSdi = computed(() => `https://satudata.jakarta.go.id/open-data/${props.slug}`);

let tunda: ReturnType<typeof setTimeout> | undefined;
watch(q, (v) => {
  clearTimeout(tunda);
  tunda = setTimeout(() => (debouncedQ.value = v.trim()), 350);
});

// Nomor muat terakhir: jawaban dari pencarian/slug lama dibuang bila sudah ada muat yang lebih baru.
let nomor = 0;
async function load(reset: boolean) {
  const ini = ++nomor;
  const page = reset ? 1 : Math.floor(rows.value.length / PAGE) + 1;
  if (reset) loading.value = true;
  else loadingMore.value = true;
  try {
    if (reset && !debouncedQ.value) {
      const { data, meta } = await api<Halaman>(`dataset/${props.slug}/halaman`, { page, size: PAGE });
      if (ini !== nomor) return;
      metaCols.value = data.kolom.items ?? [];
      total.value = data.dataset.total_bronze ?? 0;
      count.value = meta.total ?? 0;
      rows.value = data.baris.items;
    } else {
      const { data, meta } = await api<{ items: Baris[] }>(`dataset/${props.slug}/baris`, { page, size: PAGE, q: debouncedQ.value });
      if (ini !== nomor) return;
      count.value = meta.total ?? 0;
      rows.value = reset ? data.items : [...rows.value, ...data.items];
    }
    error.value = null;
  } catch (e) {
    if (ini !== nomor) return;
    error.value = e instanceof ApiError ? e.message.replace(/\.$/, "") : "Gagal memuat data";
  } finally {
    if (ini === nomor) {
      loading.value = false;
      loadingMore.value = false;
    }
  }
}

onMounted(() => {
  watch(
    [() => props.slug, debouncedQ],
    () => {
      rows.value = [];
      load(true);
    },
    { immediate: true },
  );
});
onBeforeUnmount(() => clearTimeout(tunda));

const hasMore = computed(() => rows.value.length < count.value);

watch([sentinel, hasMore, loading], (_n, _o, onCleanup) => {
  const el = sentinel.value;
  if (!el || !hasMore.value || loading.value) return;
  const io = new IntersectionObserver(
    (entries) => {
      if (entries[0]?.isIntersecting && !loadingMore.value) load(false);
    },
    { rootMargin: "600px" },
  );
  io.observe(el);
  onCleanup(() => io.disconnect());
});

const cols = computed<Kolom[]>(() => {
  let c = metaCols.value;
  if (!c.length) {
    c = Object.keys(rows.value[0] ?? {})
      .filter((k) => !HIDDEN.has(k))
      .map((k) => ({ key: k, desc: null, type: null }));
  }
  if (props.columns?.length) {
    const byKey = new Map(c.map((x) => [x.key, x]));
    return props.columns.map((k) => byKey.get(k) ?? { key: k, desc: null, type: null });
  }
  return c;
});
</script>

<template>
  <div v-if="error" class="rounded-xl border border-red-200 bg-white p-8 text-center text-red-600">
    {{ error }}. Coba <a :href="portalSdi" target="_blank" rel="noreferrer" class="underline">buka di portal SDI ↗</a>.
  </div>

  <div v-else>
    <div class="mb-3 flex items-center justify-between gap-3">
      <input
        v-model="q"
        placeholder="Cari di dalam data…"
        class="w-full max-w-sm rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-[14px] outline-none transition-colors focus:border-[#ed6b23]"
      />
      <span class="whitespace-nowrap text-[13px] tabular-nums text-slate-500">
        {{ rows.length.toLocaleString("id-ID") }} / {{ count.toLocaleString("id-ID") }} baris{{ debouncedQ ? " (hasil pencarian)" : "" }}
      </span>
    </div>

    <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <div class="overflow-x-auto">
        <table class="w-full border-collapse text-[14px]">
          <thead>
            <tr :style="{ background: ACCENT }" class="text-left text-[12px] uppercase tracking-wider text-white">
              <th class="w-12 px-4 py-3 font-semibold">#</th>
              <th v-for="c in cols" :key="c.key" class="px-4 py-3 font-semibold" :title="c.desc ?? undefined">{{ humanize(c.key) }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-if="loading && rows.length === 0">
              <td :colspan="cols.length + 1" class="px-4 py-12 text-center text-slate-400">Memuat data…</td>
            </tr>
            <tr v-for="(row, i) in rows" :key="i" class="border-t border-slate-100 transition-colors hover:bg-slate-50">
              <td class="px-4 py-3 tabular-nums text-slate-400">{{ i + 1 }}</td>
              <td v-for="c in cols" :key="c.key" class="px-4 py-3 tabular-nums text-slate-700">{{ fmtCell(row[c.key]) }}</td>
            </tr>
            <tr v-if="!loading && rows.length === 0">
              <td :colspan="cols.length + 1" class="px-4 py-12 text-center text-slate-400">Tidak ada baris data.</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div v-if="hasMore" ref="sentinel" class="border-t border-slate-100 py-5 text-center text-[13px] text-slate-400">
        {{ loadingMore ? "Memuat baris berikutnya…" : "Gulir untuk memuat lebih banyak" }}
      </div>
    </div>

    <p class="mt-3 text-[12px] text-slate-400">
      Menampilkan {{ rows.length.toLocaleString("id-ID") }} dari {{ (total || count).toLocaleString("id-ID") }} baris · Sumber: Satu Data
      Indonesia — Jakarta ·
      <a :href="portalSdi" target="_blank" rel="noreferrer" class="underline">lihat di portal ↗</a>
    </p>
  </div>
</template>
