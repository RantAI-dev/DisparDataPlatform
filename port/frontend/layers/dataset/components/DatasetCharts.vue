<script setup lang="ts">
/**
 * Pembuat grafik dataset (components/DatasetCharts.tsx v2 @ 464fc15). Pengguna memilih tipe + kolom X/Y +
 * agregasi; angka diringkas di server atas SELURUH baris yang cocok dengan pencarian/filter aktif
 * (`query`), sedangkan baris termuat hanya dipakai menebak kolom angka dan kategori default.
 * Pilihan awal dan grafik tersimpan dibaca sekali saat komponen dipasang, seperti useState v2.
 */
import type { Baris, Kolom } from "../composables/useDataset";
import { AGREGASI, AWALAN_SIMPAN, JENIS_GRAFIK, URUTAN_GRAFIK, type Agregasi, type GrafikCfg, type JenisGrafik, type UrutanGrafik } from "../utils/chart-builder";

const props = defineProps<{ slug: string; columns: Kolom[]; rows: Baris[]; storageKey: string; query: { q?: string; f?: string[] }; count: number }>();

const PRIMARY = "#ed6b23";
const cols = computed(() => kolomGrafik(props.columns, props.rows));
const measures = computed(() => cols.value.filter((c) => isNumericCol(c, props.rows)));
const dimensions = computed(() => {
  const d = cols.value.filter((c) => !measures.value.includes(c));
  return d.length ? d : cols.value;
});

const defX = pickDefaultDim(dimensions.value, props.rows) || cols.value[0]?.key || "";
const defY = measures.value[0]?.key ?? "";
const kind = ref<JenisGrafik>("bar");
const x = ref(defX);
const y = ref(defY);
const agg = ref<Agregasi>(defY ? "sum" : "count");
const sort = ref<UrutanGrafik>("auto");
const charts = ref<GrafikCfg[]>([]);

// localStorage hanya ada di browser; komponen ini dirender setelah baris termuat di klien.
onMounted(() => {
  try {
    charts.value = muatGrafik(window.localStorage.getItem(AWALAN_SIMPAN + props.storageKey), new Set(cols.value.map((c) => c.key)));
  } catch {
    charts.value = [];
  }
  watch(
    charts,
    (c) => {
      try {
        const isi = simpanGrafik(c);
        if (isi) window.localStorage.setItem(AWALAN_SIMPAN + props.storageKey, isi);
        else window.localStorage.removeItem(AWALAN_SIMPAN + props.storageKey);
      } catch {
        // localStorage tidak tersedia (mode privat/diblokir): grafik tetap jalan tanpa disimpan.
      }
    },
    { deep: true },
  );
});

function tambah() {
  if (!x.value) return;
  charts.value = [{ id: idGrafik(), kind: kind.value, x: x.value, y: agg.value === "count" ? "" : y.value, agg: agg.value, sort: sort.value }, ...charts.value];
}
const urutkan = (id: string, s: UrutanGrafik) => (charts.value = charts.value.map((k) => (k.id === id ? { ...k, sort: s } : k)));
const hapus = (id: string) => (charts.value = charts.value.filter((k) => k.id !== id));

const ekstra = computed(() => measures.value.filter((m) => !dimensions.value.includes(m)));
const terfilter = computed(() => Boolean(props.query.q || props.query.f?.length));
const sel = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] outline-none focus:border-[#ed6b23] transition-colors";
</script>

<template>
  <div v-if="rows.length && cols.length" class="mb-6">
    <div class="flex items-center justify-between gap-3 mb-4">
      <h2 class="text-[16px] font-bold tracking-tight text-slate-800">Visualisasi Data</h2>
      <span class="text-[12px] text-slate-400">Grafik dari {{ count.toLocaleString("id-ID") }} baris{{ terfilter ? " (terfilter)" : "" }} · tersimpan di browser ini</span>
    </div>

    <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4 mb-5">
      <div class="flex flex-wrap items-end gap-3">
        <label class="flex flex-col gap-1">
          <span class="text-[11px] font-medium uppercase tracking-wide text-slate-500">Tipe grafik</span>
          <select v-model="kind" :class="sel">
            <option v-for="k in JENIS_GRAFIK" :key="k.v" :value="k.v">{{ k.label }}</option>
          </select>
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-[11px] font-medium uppercase tracking-wide text-slate-500">Kategori (X)</span>
          <select v-model="x" :class="sel">
            <option v-for="c in dimensions" :key="c.key" :value="c.key">{{ humanizeKolom(c.key) }}</option>
            <option v-for="c in ekstra" :key="c.key" :value="c.key">{{ humanizeKolom(c.key) }}</option>
          </select>
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-[11px] font-medium uppercase tracking-wide text-slate-500">Agregasi</span>
          <select v-model="agg" :class="sel">
            <option v-for="a in AGREGASI.filter((a) => a.v === 'count' || measures.length > 0)" :key="a.v" :value="a.v">{{ a.label }}</option>
          </select>
        </label>
        <label v-if="agg !== 'count'" class="flex flex-col gap-1">
          <span class="text-[11px] font-medium uppercase tracking-wide text-slate-500">Nilai (Y)</span>
          <select v-model="y" :class="sel" :disabled="!measures.length">
            <template v-if="measures.length">
              <option v-for="c in measures" :key="c.key" :value="c.key">{{ humanizeKolom(c.key) }}</option>
            </template>
            <option v-else value="">(tak ada kolom angka)</option>
          </select>
        </label>
        <label class="flex flex-col gap-1">
          <span class="text-[11px] font-medium uppercase tracking-wide text-slate-500">Urutkan</span>
          <select v-model="sort" :class="sel">
            <option v-for="o in URUTAN_GRAFIK" :key="o.v" :value="o.v">{{ o.label }}</option>
          </select>
        </label>
        <button class="rounded-lg px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90" :style="{ background: PRIMARY }" @click="tambah">
          + Tambah grafik
        </button>
      </div>
      <p v-if="!measures.length" class="mt-3 text-[12px] text-slate-500">
        Tak ada kolom angka terdeteksi — pakai <b>Jumlah baris (count)</b> untuk frekuensi per kategori.
      </p>
    </div>

    <div v-if="charts.length === 0" class="bg-white rounded-xl border border-dashed border-slate-300 p-10 text-center text-slate-400 text-[14px]">
      Belum ada grafik. Pilih tipe &amp; kolom di atas, lalu “Tambah grafik”.
    </div>
    <div v-else class="grid gap-4 md:grid-cols-2">
      <div v-for="cfg in charts" :key="cfg.id" class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
          <div class="min-w-0">
            <p class="truncate text-[13px] font-semibold text-slate-700">{{ judulGrafik(cfg, humanizeKolom) }}</p>
            <p class="text-[11px] text-slate-400">{{ JENIS_GRAFIK.find((k) => k.v === cfg.kind)?.label }}</p>
          </div>
          <div class="flex shrink-0 items-center gap-1">
            <select
              aria-label="Urutkan grafik"
              :value="cfg.sort"
              class="rounded-md border border-slate-200 bg-white px-2 py-1 text-[12px] text-slate-600 outline-none focus:border-[#ed6b23]"
              @change="urutkan(cfg.id, ($event.target as HTMLSelectElement).value as UrutanGrafik)"
            >
              <option v-for="o in URUTAN_GRAFIK" :key="o.v" :value="o.v">{{ o.label }}</option>
            </select>
            <button
              aria-label="Hapus grafik"
              class="shrink-0 rounded-md px-2 py-1 text-[12px] text-slate-400 hover:bg-slate-100 hover:text-red-600 transition-colors"
              @click="hapus(cfg.id)"
            >
              Hapus
            </button>
          </div>
        </div>
        <div class="p-2">
          <DatasetChartBody :slug="slug" :cfg="cfg" :query="query" />
        </div>
      </div>
    </div>
  </div>
</template>
