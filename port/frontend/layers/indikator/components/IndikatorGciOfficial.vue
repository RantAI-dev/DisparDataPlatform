<script setup lang="ts">
/** GCI utama Jakarta — peringkat Kearney + 4 kartu indikator pariwisata (components/GciOfficial.tsx); isi dari `gci/resmi`. */
import type { GciResmi } from "../composables/useIndikator";

const props = defineProps<{ data: GciResmi }>();
const ACCENT = "#ed6b23";
const LINK = "#8ab4ff";
function tren(y2024: number, y2025: number) {
  const d = y2024 - y2025;
  if (d > 0) return { arrow: "▲", label: `naik ${d}`, fg: "#7ee2a8" };
  if (d < 0) return { arrow: "▼", label: `turun ${-d}`, fg: "#f7a6a1" };
  return { arrow: "▬", label: "tetap", fg: "#cfc8bf" };
}
const peringkat = computed(() => [
  { judul: "Peringkat Pengalaman Budaya", ...props.data.ranking.cultural, t: tren(props.data.ranking.cultural.y2024, props.data.ranking.cultural.y2025) },
  { judul: "GCI keseluruhan", ...props.data.ranking.overall, t: tren(props.data.ranking.overall.y2024, props.data.ranking.overall.y2025) },
]);
</script>

<template>
  <HeroDark pad="pt-9 pb-10">
    <div class="text-[12px] font-mono uppercase tracking-widest text-white/60">
      <span style="color: #f0a13a">●</span> Kearney · Global Cities Index — Indikator Pariwisata Jakarta
    </div>
    <h1 class="mt-3 atlas-display max-w-[20ch] text-white">GCI Jakarta · <span class="atlas-italic" style="color: #f0a13a">Pengalaman Budaya</span></h1>
    <p class="mt-3 apple-lead max-w-[66ch] text-white/75">Sub-indikator pariwisata yang mengisi dimensi Pengalaman Budaya (Cultural Experience) GCI Jakarta.</p>
    <div class="mt-6 flex flex-wrap gap-3">
      <div v-for="p in peringkat" :key="p.judul" class="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2">
        <span class="apple-fine text-white/50">{{ p.judul }}</span>
        <span class="text-[14px] font-semibold text-white/45 tabular">{{ p.y2024 }}</span>
        <span class="text-white/30">→</span>
        <span class="text-[18px] font-bold text-white tabular">{{ p.y2025 }}</span>
        <span class="text-[12px] font-semibold" :style="{ color: p.t.fg }">{{ p.t.arrow }} {{ p.t.label }}</span>
      </div>
    </div>
    <p class="mt-5 text-[12px] text-white/50">
      Sumber:
      <a :href="data.ranking.sumber.url" target="_blank" rel="noreferrer" class="hover:underline" :style="{ color: LINK }">{{ data.ranking.sumber.label }} ↗</a>
      · {{ data.ranking.catatan }}
    </p>
  </HeroDark>
  <section class="mx-auto max-w-[1320px] px-6 pt-9 pb-12">
    <div class="mb-4 flex items-baseline justify-between">
      <h2 class="atlas-display-md text-ink">Indikator Pariwisata (Pengalaman Budaya)</h2>
      <span class="apple-fine text-ink-muted-48">{{ data.kartu.length }} indikator · sumber resmi</span>
    </div>
    <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <component
        :is="it.href ? resolveComponent('NuxtLink') : 'div'"
        v-for="it in data.kartu"
        :key="it.label"
        :to="it.href ?? undefined"
        :class="
          it.href
            ? 'utility-card flex flex-col p-5 transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#ed6b23]/40'
            : 'utility-card flex flex-col p-5'
        "
      >
        <div class="inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white" :style="{ background: ACCENT }">
          {{ it.label }}
        </div>
        <div class="mt-4 flex items-baseline gap-1.5">
          <span class="text-[34px] font-bold leading-none text-ink tabular">{{ it.nilai }}</span>
          <span class="apple-caption text-ink-muted-48">{{ it.satuan }}</span>
        </div>
        <p v-if="it.catatan" class="mt-2 apple-fine text-ink-muted-48 min-h-[28px]">{{ it.catatan }}</p>
        <div v-else class="min-h-[28px]" />
        <div class="mt-3 border-t border-hairline pt-3 space-y-1">
          <div class="flex items-center justify-between apple-fine">
            <span class="text-ink-muted-48">Tahun</span>
            <span class="text-ink font-medium tabular">{{ it.tahun }}</span>
          </div>
          <div class="flex items-center justify-between apple-fine">
            <span class="text-ink-muted-48">Sumber</span>
            <span class="text-ink font-medium text-right truncate ml-2" :title="it.sumber">{{ it.sumber }}</span>
          </div>
        </div>
        <div v-if="it.href" class="mt-3 flex items-center gap-1 apple-fine font-semibold" :style="{ color: ACCENT }">
          Lihat detail
          <span aria-hidden="true">→</span>
        </div>
      </component>
    </div>
    <p class="mt-3 text-[12px] text-ink-muted-48">
      Hanya indikator <b>pariwisata</b> (domain Dispar/atraksi wisata). Indikator Cultural Experience lain — Kegiatan Olahraga (Dispora) &amp; Kota
      Kembar (Biro KSD) — tidak ditampilkan di sini.
    </p>
  </section>
</template>
