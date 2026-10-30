<script setup lang="ts">
/**
 * Detail dataset (app/sdi/[slug]/page.tsx v2 @ 6b858eb): hero + meta, grafik, filter, tabel dengan
 * sort per kolom dan muat bertahap saat digulir, unduhan CSV/XLSX yang membawa filter aktif.
 */
import { GOLD, KOLOM_TERSEMBUNYI, NAVY } from "../../constants";
import type { Facet, Kolom } from "../../composables/useDataset";

const route = useRoute();
const slug = computed(() => String(route.params.slug));
const { facet, urlEkspor } = useDataset();
const t = useDatasetBaris(slug);
const { meta, rows, count, error, loading, loadingMore, refreshing, q, filters, sort, filterQuery, query, filtered, hasMore } = t;

// Pilihan filter dihitung sekali per dataset (atas seluruh baris); gagal → panel filter tidak tampil.
const facets = ref<Facet[]>([]);
function muatFacet() {
  facets.value = [];
  const s = slug.value;
  facet(s)
    .then((r) => s === slug.value && (facets.value = r.data.items ?? []))
    .catch(() => {});
}
onMounted(muatFacet);
watch(slug, muatFacet);

// Hanya kolom yang ada di skema Silver (facet memuat semua kolom Silver) yang bisa diurutkan.
const sortable = computed(() => new Set(facets.value.map((f) => f.key)));
const columns = computed<Kolom[]>(() => {
  if (!meta.value) return [];
  if (t.kolom.value.length) return t.kolom.value;
  return Object.keys(rows.value[0] ?? {})
    .filter((k) => !KOLOM_TERSEMBUNYI.has(k))
    .map((k) => ({ key: k, desc: null, type: null }));
});
const facetTampil = computed(() => facets.value.filter((f) => columns.value.some((c) => c.key === f.key)));
const portalSdi = computed(() => `https://satudata.jakarta.go.id/open-data/${slug.value}`);
const fmt = (n: number) => n.toLocaleString("id-ID");
const arahSort = (key: string) => (sort.value?.col === key ? sort.value.dir : null);

const sentinel = ref<HTMLDivElement | null>(null);
watch([sentinel, hasMore, loading, refreshing], (_n, _o, onCleanup) => {
  const el = sentinel.value;
  if (!el || !hasMore.value || loading.value || refreshing.value) return;
  const io = new IntersectionObserver((entries) => entries[0]?.isIntersecting && t.muatBerikutnya(), { rootMargin: "600px" });
  io.observe(el);
  onCleanup(() => io.disconnect());
});

const tombolUnduh =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] font-medium text-slate-700 hover:border-[#ed6b23] hover:text-[#ed6b23] transition-colors";
</script>

<template>
  <main class="min-h-screen bg-[#faf6f2]">
    <HeroDark pad="pt-7 pb-10">
      <NuxtLink to="/sdi" class="text-[12px] font-mono uppercase tracking-widest text-white/60 hover:text-white">← Katalog Pariwisata &amp; Ekraf</NuxtLink>
      <h1 class="mt-3 text-[26px] md:text-[32px] font-bold tracking-tight max-w-[30ch]">{{ meta?.title ?? humanizeKolom(slug) }}</h1>
      <p v-if="meta?.description" class="mt-2 text-white/75 max-w-[75ch] text-[15px]">{{ meta.description }}</p>
      <div v-if="meta" class="mt-5 flex flex-wrap gap-x-6 gap-y-2 text-[13px] text-white/80">
        <span><span class="text-white/50 uppercase text-[11px] tracking-wider">Baris data: </span><span class="font-medium" :style="{ color: GOLD }">{{ fmt(meta.total_bronze) }}</span></span>
        <span v-if="meta.periode"><span class="text-white/50 uppercase text-[11px] tracking-wider">Periode: </span><span class="font-medium" :style="{ color: GOLD }">{{ fmtRentangPeriode(meta.periode) }}</span></span>
        <span v-if="meta.satuan"><span class="text-white/50 uppercase text-[11px] tracking-wider">Satuan: </span><span class="font-medium" :style="{ color: GOLD }">{{ meta.satuan }}</span></span>
        <span v-if="meta.frekuensi"><span class="text-white/50 uppercase text-[11px] tracking-wider">Frekuensi: </span><span class="font-medium" :style="{ color: GOLD }">{{ meta.frekuensi }}</span></span>
        <span v-if="meta.sumber_data?.length"><span class="text-white/50 uppercase text-[11px] tracking-wider">Sumber: </span><span class="font-medium" :style="{ color: GOLD }">{{ meta.sumber_data.join(", ") }}</span></span>
      </div>
      <DatasetMedallionNote v-if="meta?.medallion" :info="meta.medallion" />
    </HeroDark>

    <section class="mx-auto max-w-[1320px] px-6 py-8 pb-20">
      <div v-if="error" class="bg-white rounded-xl border border-red-200 p-8 text-center text-red-600">
        {{ error }}. Coba <a :href="portalSdi" target="_blank" rel="noreferrer" class="underline">buka di portal SDI ↗</a>.
      </div>

      <div v-if="loading && !error" class="bg-white rounded-xl border border-slate-200 p-16 text-center text-slate-400">Memuat data dari Satu Data Jakarta…</div>

      <DatasetCharts
        v-if="meta && !loading && rows.length > 0"
        :slug="slug"
        :columns="columns"
        :rows="rows"
        :storage-key="slug"
        :query="filterQuery"
        :count="count"
      />

      <template v-if="meta && !loading">
        <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
          <input
            v-model="q"
            placeholder="Cari di dalam data…"
            class="w-full max-w-sm rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-[14px] outline-none focus:border-[#ed6b23] transition-colors"
          />
          <div class="flex flex-wrap items-center gap-x-3 gap-y-2">
            <div class="flex flex-wrap items-center gap-1.5">
              <a
                :href="urlEkspor(slug, 'csv', query)"
                :class="tombolUnduh"
                :title="filtered ? 'Unduh baris hasil filter sebagai CSV' : 'Unduh semua baris sebagai CSV'"
              ><DatasetIkonUnduh /> CSV{{ filtered ? " (terfilter)" : "" }}</a>
              <a
                :href="urlEkspor(slug, 'xlsx', query)"
                :class="tombolUnduh"
                :title="filtered ? 'Unduh baris hasil filter sebagai Excel (XLSX)' : 'Unduh semua baris sebagai Excel (XLSX)'"
              ><DatasetIkonUnduh /> XLSX{{ filtered ? " (terfilter)" : "" }}</a>
              <a
                v-if="filtered"
                :href="urlEkspor(slug, 'csv')"
                class="px-1 text-[12.5px] text-slate-500 underline hover:text-slate-700 whitespace-nowrap"
                title="Unduh seluruh dataset tanpa filter (CSV)"
              >unduh semua baris</a>
            </div>
            <span class="text-[13px] text-slate-500 tabular-nums whitespace-nowrap">
              {{ fmt(rows.length) }} / {{ fmt(count) }} baris{{ filtered ? ` (terfilter dari ${fmt(meta.total_bronze)})` : "" }}
            </span>
          </div>
        </div>

        <DatasetFilters v-model="filters" :facets="facetTampil" />

        <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden transition-opacity" :class="{ 'opacity-60': refreshing }" :aria-busy="refreshing">
          <div class="overflow-x-auto">
            <table class="w-full text-[14px] border-collapse">
              <thead>
                <tr :style="{ background: NAVY }" class="text-white text-left text-[12px] uppercase tracking-wider">
                  <th class="px-4 py-3 font-semibold w-12">#</th>
                  <th
                    v-for="c in columns"
                    :key="c.key"
                    class="px-4 py-3 font-semibold"
                    :title="c.desc ?? undefined"
                    :aria-sort="sortable.has(c.key) ? (arahSort(c.key) === 'asc' ? 'ascending' : arahSort(c.key) === 'desc' ? 'descending' : 'none') : undefined"
                  >
                    <button
                      v-if="sortable.has(c.key)"
                      type="button"
                      class="inline-flex items-center gap-1 uppercase tracking-wider hover:text-white/80 focus-visible:ring-2 focus-visible:ring-white/60 rounded"
                      :aria-label="`Urutkan menurut ${humanizeKolom(c.key)}`"
                      @click="t.toggleSort(c.key)"
                    >
                      {{ humanizeKolom(c.key) }}
                      <span aria-hidden="true" :class="arahSort(c.key) ? 'text-white' : 'text-white/40'">{{
                        arahSort(c.key) === "asc" ? "▲" : arahSort(c.key) === "desc" ? "▼" : "↕"
                      }}</span>
                    </button>
                    <template v-else>{{ humanizeKolom(c.key) }}</template>
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="(row, i) in rows" :key="i" class="border-t border-slate-100 hover:bg-slate-50 transition-colors">
                  <td class="px-4 py-3 text-slate-400 tabular-nums">{{ i + 1 }}</td>
                  <td v-for="c in columns" :key="c.key" class="px-4 py-3 text-slate-700 tabular-nums">
                    <a
                      v-if="labelTautan(c.key, row[c.key])"
                      :href="String(row[c.key])"
                      target="_blank"
                      rel="noreferrer"
                      style="color: #2563eb"
                      class="hover:underline whitespace-nowrap font-medium"
                    >{{ labelTautan(c.key, row[c.key]) }}</a>
                    <template v-else>{{ fmtSel(row[c.key]) }}</template>
                  </td>
                </tr>
                <tr v-if="rows.length === 0">
                  <td :colspan="columns.length + 1" class="px-4 py-12 text-center text-slate-400">Tidak ada baris data.</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div v-if="hasMore" ref="sentinel" class="py-5 text-center text-[13px] text-slate-400 border-t border-slate-100">
            {{ loadingMore ? "Memuat baris berikutnya…" : "Gulir untuk memuat lebih banyak" }}
          </div>
        </div>

        <p class="text-[12px] text-slate-400 mt-4">
          Menampilkan {{ fmt(rows.length) }} dari {{ fmt(count) }} baris{{ filtered ? ` (terfilter dari ${fmt(meta.total_bronze)})` : "" }} · Sumber:
          Satu Data Indonesia — Jakarta ·
          <a :href="portalSdi" target="_blank" rel="noreferrer" class="underline">lihat di portal ↗</a>
        </p>
      </template>
    </section>
  </main>
</template>
