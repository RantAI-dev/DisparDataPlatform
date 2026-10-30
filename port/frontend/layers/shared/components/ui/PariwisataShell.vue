<script setup lang="ts">
/**
 * Kerangka halaman detail indikator PARIWISATA GCI (PariwisataShell.tsx): hero gelap + breadcrumb
 * "← GCI" + angka indikator resmi di kanan. `tahun` kosong = meta Tahun dan tahun di label disembunyikan.
 */
defineProps<{
  eyebrow?: string;
  title: string;
  nilai: string;
  satuan: string;
  tahun?: string;
  catatan?: string;
  sumber: string;
  sumberHref?: string;
}>();
const GOLD = "#f0a13a";
</script>

<template>
  <main class="min-h-screen bg-[#faf6f2]">
    <HeroDark pad="pt-7 pb-10">
      <NuxtLink to="/gci" class="text-[12px] font-mono uppercase tracking-widest text-white/60 hover:text-white">
        ← GCI · Pengalaman Budaya
      </NuxtLink>

      <div class="mt-4 flex flex-wrap items-start justify-between gap-6">
        <div class="max-w-[62ch]">
          <div v-if="eyebrow" class="mb-2 text-[12px] font-mono uppercase tracking-widest text-white/55">
            <span :style="{ color: GOLD }">●</span> {{ eyebrow }}
          </div>
          <h1 class="atlas-display text-white">{{ title }}</h1>
          <div class="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-white/80">
            <span v-if="tahun">
              <span class="text-[11px] uppercase tracking-wider text-white/50">Tahun: </span>
              <span class="font-medium" :style="{ color: GOLD }">{{ tahun }}</span>
            </span>
            <span>
              <span class="text-[11px] uppercase tracking-wider text-white/50">Sumber: </span>
              <a v-if="sumberHref" :href="sumberHref" target="_blank" rel="noreferrer" class="font-medium hover:underline" style="color: #8ab4ff">
                {{ sumber }} ↗
              </a>
              <span v-else class="font-medium" :style="{ color: GOLD }">{{ sumber }}</span>
            </span>
          </div>
          <p v-if="catatan" class="mt-4 inline-flex rounded-lg border border-white/12 bg-white/[0.04] px-3.5 py-2 text-[12px] text-white/70">
            {{ catatan }}
          </p>
        </div>

        <!-- Angka indikator resmi — headline besar -->
        <div class="rounded-2xl border border-white/12 bg-white/[0.05] px-6 py-5">
          <div class="apple-fine uppercase tracking-wider text-white/50">Angka indikator{{ tahun ? ` ${tahun}` : "" }}</div>
          <div class="mt-1 flex items-baseline gap-2">
            <span class="text-[46px] font-bold leading-none tabular text-white">{{ nilai }}</span>
            <span class="apple-caption text-white/60">{{ satuan }}</span>
          </div>
        </div>
      </div>
    </HeroDark>

    <section class="mx-auto max-w-[1320px] space-y-10 px-6 py-10 pb-20"><slot /></section>
  </main>
</template>
