<script setup lang="ts">
/** Isi satu kartu grafik (DatasetCharts.tsx ChartBody): diringkas di server atas baris terfilter. */
import type { GrafikCfg, TitikGrafik } from "../utils/chart-builder";

const props = defineProps<{ slug: string; cfg: GrafikCfg; query: { q?: string; f?: string[] } }>();
const { agregat } = useDataset();

const data = ref<TitikGrafik[] | "gagal" | null>(null);
watch(
  () => [props.slug, props.cfg.x, props.cfg.y, props.cfg.agg, JSON.stringify(props.query)],
  (_n, _o, onCleanup) => {
    let hidup = true;
    onCleanup(() => (hidup = false));
    data.value = null;
    agregat(props.slug, { ...props.query, x: props.cfg.x, agg: props.cfg.agg, ...(props.cfg.agg !== "count" ? { y: props.cfg.y } : {}) })
      .then((r) => hidup && (data.value = r.data.items ?? []))
      .catch(() => hidup && (data.value = "gagal"));
  },
  { immediate: true },
);
const hasil = computed(() => (Array.isArray(data.value) ? buildOption(props.cfg, data.value) : null));
</script>

<template>
  <p v-if="data === null" class="grid h-[280px] place-items-center text-[13px] text-slate-400">Memuat grafik…</p>
  <p v-else-if="data === 'gagal'" class="grid h-[280px] place-items-center text-[13px] text-red-500">Gagal memuat grafik.</p>
  <p v-else-if="hasil?.empty" class="grid h-[280px] place-items-center text-[13px] text-slate-400">Tak ada nilai untuk dirangkum.</p>
  <EChart v-else-if="hasil" :option="hasil.option" :height="300" />
</template>
