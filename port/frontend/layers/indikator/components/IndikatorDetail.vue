<script setup lang="ts">
/**
 * Halaman detail indikator (IndicatorShell.tsx + view per indikator + IndicatorFallback di
 * registry.tsx). Isi dari `indikator/{code}`: KPI + blok (indikator berdata) atau kartu "Data belum
 * tersedia" (9 indikator gap). Kode tak dikenal → 404 seperti notFound() v2.
 */
import { MOM_NOTE } from "../constants";

const props = defineProps<{ code: string }>();
const { detail } = useIndikator();
const kunci = computed(() => props.code.toUpperCase());
const { data } = await useAsyncData(`indikator-${kunci.value}`, () =>
  detail(kunci.value).catch((e) => {
    if (e instanceof ApiError && e.status === 404) return null;
    throw e;
  }),
);
if (!data.value) throw createError({ statusCode: 404, statusMessage: "Page Not Found", fatal: true });
const d = computed(() => data.value!);
const ind = computed(() => d.value.indikator);
useHead({ title: computed(() => `${ind.value.name} — ${ind.value.framework}`) });

const kelompok = computed(() => kelompokkanBlok(d.value.blocks));
const LINK = "#8ab4ff";
</script>

<template>
  <main class="min-h-screen bg-[#faf6f2]">
    <HeroDark pad="pt-7 pb-10">
      <NuxtLink :to="`/${ind.framework.toLowerCase()}`" class="text-[12px] font-mono uppercase tracking-widest text-white/60 hover:text-white">
        ← {{ ind.framework }} · {{ ind.dimension }}
      </NuxtLink>
      <h1 class="mt-3 text-[26px] md:text-[32px] font-bold tracking-tight max-w-[30ch]">{{ ind.name }}</h1>
      <p v-if="ind.definition" class="mt-2 text-white/75 max-w-[75ch] text-[14px]">{{ ind.definition }}</p>
      <div v-if="d.sources.length > 0" class="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2 text-[12px]">
        <span class="text-white/50">Sumber data{{ d.sources.length > 1 ? ` (${d.sources.length})` : "" }}:</span>
        <NuxtLink v-for="s in d.sources" :key="s.slug" :to="`/sdi/${s.slug}`" class="inline-flex items-center gap-1.5 hover:underline" :style="{ color: LINK }">
          {{ s.title }}
          <span
            class="text-[9px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
            :style="{ background: s.tier !== 'sekunder' ? 'rgba(255,255,255,0.18)' : 'rgba(240, 161, 58,0.28)', color: '#fff' }"
          >{{ s.tier !== "sekunder" ? "Primer" : "Sekunder" }}</span>
          <span aria-hidden="true" class="text-white/40">↗</span>
        </NuxtLink>
      </div>
      <p v-else-if="d.source_text" class="mt-2 text-[12px]" style="color: #f0a13a">Sumber: {{ d.source_text }}</p>
    </HeroDark>
    <section class="mx-auto max-w-[1320px] px-6 py-8 pb-20 space-y-8">
      <IndikatorIndexContext v-if="d.konteks" :b="d.konteks" />
      <div v-if="d.teks_fallback" class="rounded-xl border-2 border-dashed border-slate-300 bg-white p-8 max-w-[760px]">
        <div class="flex items-center gap-2 mb-4">
          <span class="text-[11px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-50 text-red-700">Data belum tersedia</span>
          <span class="text-[11px] font-mono uppercase tracking-wider text-slate-400">{{ ind.framework }} · {{ ind.dimension }}</span>
        </div>
        <div class="text-[18px] font-semibold text-slate-800">{{ d.code }} · {{ ind.name }}</div>
        <p class="mt-2 text-[14px] text-slate-600 max-w-[60ch]">{{ ind.definition }}</p>
        <dl class="mt-6 grid sm:grid-cols-2 gap-x-8 gap-y-3 text-[13px]">
          <div>
            <dt class="font-mono text-[11px] uppercase tracking-wider text-slate-400">Owner / OPD pemilik</dt>
            <dd class="text-slate-800 mt-0.5">{{ ind.owner }}</dd>
          </div>
          <div>
            <dt class="font-mono text-[11px] uppercase tracking-wider text-slate-400">Status readiness</dt>
            <dd class="mt-0.5">
              <span class="text-[11px] font-semibold px-2 py-0.5 rounded-full" style="background: #fdecec; color: #b3261e">gap</span>
            </dd>
          </div>
          <div class="sm:col-span-2">
            <dt class="font-mono text-[11px] uppercase tracking-wider text-slate-400">Keterangan</dt>
            <dd class="text-slate-700 mt-0.5">{{ ind.note }}</dd>
          </div>
        </dl>
      </div>
      <template v-else>
        <div v-if="MOM_NOTE[d.code]" class="rounded-xl border border-[#f4a06b] bg-[#fff4ec] p-4 flex gap-3">
          <span class="shrink-0 mt-0.5 text-[10px] font-bold uppercase tracking-wider text-white bg-[#ed6b23] rounded px-2 py-1 h-fit">Catatan kriteria</span>
          <div class="text-[13px] text-[#4a453d] leading-relaxed" v-html="MOM_NOTE[d.code]" />
        </div>
        <div class="grid sm:grid-cols-3 gap-4">
          <KpiStat v-for="k in d.kpis" :key="k.label" :label="k.label" :value="k.value" :sub="k.sub ?? undefined" />
        </div>
        <template v-for="(g, i) in kelompok" :key="i">
          <IndikatorBlok v-if="g.full" :blok="g.full" />
          <div v-else class="grid md:grid-cols-2 gap-5">
            <IndikatorBlok v-for="h in g.half" :key="h.blok.title" :blok="h.blok" :warna="h.warna" />
          </div>
        </template>
      </template>
    </section>
  </main>
</template>
