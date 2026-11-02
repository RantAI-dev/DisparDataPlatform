<script setup lang="ts">
/**
 * Panel filter per kolom halaman detail (components/DatasetFilters.tsx v2). Jenis kontrol mengikuti
 * facet: pilihan nilai (kategori), rentang angka, rentang tanggal. `v-model` = daftar filter aktif.
 */
import type { Facet } from "../composables/useDataset";
import type { Filter } from "../utils/query-filter";

const props = defineProps<{ facets: Facet[] }>();
const filters = defineModel<Filter[]>({ required: true });

const ACCENT = "#ed6b23";
const open = ref(false);
const usable = computed(() => props.facets.filter((f) => f.kind !== "none" && !(f.kind === "kategori" && (f.values?.length ?? 0) < 2)));

const ubah = (col: string, next: Filter | null) => (filters.value = denganFilter(filters.value, col, next));
const terpilih = (key: string) => {
  const cur = filters.value.find((f) => f.col === key);
  return cur?.op === "in" ? cur.values : [];
};
const rentang = (key: string) => {
  const cur = filters.value.find((f) => f.col === key);
  return cur?.op === "range" ? cur : null;
};
function centang(key: string, v: string) {
  const sel = terpilih(key);
  const values = sel.includes(v) ? sel.filter((x) => x !== v) : [...sel, v];
  ubah(key, values.length ? { col: key, op: "in", values } : null);
}
</script>

<template>
  <div v-if="usable.length" class="mb-4">
    <div class="flex flex-wrap items-center gap-2">
      <button
        type="button"
        :aria-expanded="open"
        class="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] font-medium text-slate-700 hover:border-[#ed6b23] hover:text-[#ed6b23] transition-colors"
        @click="open = !open"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
          <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
        </svg>
        Filter{{ filters.length > 0 ? ` (${filters.length})` : "" }}
        <span aria-hidden="true" class="text-slate-400">{{ open ? "▴" : "▾" }}</span>
      </button>
      <span
        v-for="f in filters"
        :key="f.col"
        class="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[12.5px]"
        :style="{ borderColor: ACCENT, color: ACCENT, background: '#fdf3ec' }"
      >
        {{ labelChip(f) }}
        <button type="button" :aria-label="`Hapus filter ${humanizeKolom(f.col)}`" class="ml-0.5 rounded-full px-1 hover:bg-white" @click="ubah(f.col, null)">×</button>
      </span>
      <button v-if="filters.length > 0" type="button" class="text-[12.5px] text-slate-500 underline hover:text-slate-700" @click="filters = []">
        Hapus semua filter
      </button>
    </div>

    <div v-if="open" class="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <fieldset v-for="fc in usable" :key="fc.key" class="min-w-0">
        <legend class="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-slate-500">{{ humanizeKolom(fc.key) }}</legend>
        <div v-if="fc.kind === 'kategori'" class="max-h-44 overflow-y-auto rounded-lg border border-slate-200 p-1.5">
          <label
            v-for="{ v, n } in fc.values"
            :key="v"
            class="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[13px] text-slate-700 hover:bg-slate-50"
          >
            <input type="checkbox" :checked="terpilih(fc.key).includes(v)" class="accent-[#ed6b23]" @change="centang(fc.key, v)" />
            <span class="min-w-0 flex-1 truncate" :title="v">{{ v }}</span>
            <span class="tabular-nums text-[11.5px] text-slate-400">{{ n.toLocaleString("id-ID") }}</span>
          </label>
        </div>
        <DatasetRangeInput
          v-else
          :kind="fc.kind as 'angka' | 'tanggal'"
          :facet="fc"
          :value="rentang(fc.key)"
          @ubah="(min, max) => ubah(fc.key, min || max ? { col: fc.key, op: 'range', min, max } : null)"
        />
      </fieldset>
    </div>
  </div>
</template>
