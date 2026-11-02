<script setup lang="ts">
/**
 * Beranda (app/page.tsx v2). Teks, kelas, dan ikon sama; angka hero dan kartu dari
 * `beranda/ringkasan` (P4: angka hidup, bukan angka in-code Next.js).
 */
const NAVY = "#ed6b23";
const GOLD = "#f0a13a";

const { ringkasan } = useBeranda();
const { data } = await useAsyncData("beranda-ringkasan", () => ringkasan().then((r) => r.data));

const fmt = (n: number | undefined) => (n ?? 0).toLocaleString("id-ID");

const MENUS = computed(() => {
  const r = data.value;
  return [
    {
      href: "/katalog",
      no: "01",
      title: "Katalog Data",
      desc: "Data primer Satu Data Jakarta + dataset sekunder pendataan lapangan.",
      stat: `${r?.dataset_primer ?? 0} + ${r?.dataset_sekunder ?? 0} dataset`,
    },
    { href: "/gci", no: "02", title: "GCI", desc: "Kearney Global Cities Index — prioritas indikator competitiveness.", stat: `${r?.indikator.gci ?? 0} indikator` },
    { href: "/gpci", no: "03", title: "GPCI", desc: "Mori Global Power City Index — kesiapan indikator pariwisata.", stat: `${r?.indikator.gpci ?? 0} indikator` },
    {
      href: "/spatial",
      no: "04",
      title: "Spatial",
      desc: "Peta pariwisata Jakarta — data GCI, GPCI, dan GMTI dengan filter kategori.",
      stat: `${fmt(r?.baris_sekunder)} baris`,
    },
  ];
});

const STATS = computed(() => [
  { value: fmt(data.value?.dataset_primer), label: "Dataset primer SDI" },
  { value: fmt(data.value?.baris_sekunder), label: "Baris pendataan lapangan" },
  { value: fmt(data.value?.indikator.total), label: "Indikator GCI · GPCI dipantau" },
  { value: String(data.value?.indeks_global ?? 2), label: "Indeks global (GCI · GPCI)" },
]);

const HERO_BG =
  "radial-gradient(1100px 420px at 88% -12%, rgba(240, 161, 58,0.14), transparent 60%), radial-gradient(760px 460px at 6% 118%, rgba(237, 107, 35,0.22), transparent 62%), linear-gradient(160deg, #2a2521 0%, #16130f 100%)";
const DOT_GRID = {
  backgroundImage: "radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1px)",
  backgroundSize: "22px 22px",
  maskImage: "linear-gradient(180deg, rgba(0,0,0,0.9), transparent 78%)",
  WebkitMaskImage: "linear-gradient(180deg, rgba(0,0,0,0.9), transparent 78%)",
};
</script>

<template>
  <main class="min-h-screen bg-paper">
    <section class="relative overflow-hidden text-white">
      <div class="absolute inset-0" :style="{ background: HERO_BG }" />
      <div class="absolute inset-0 opacity-[0.5]" :style="DOT_GRID" />
      <div class="relative mx-auto max-w-[1320px] px-6 pt-16 pb-12">
        <div class="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 atlas-mono text-white/75 backdrop-blur">
          <span :style="{ color: GOLD }">●</span> Dashboard Visualisasi Data Terkonsolidasi
        </div>
        <h1 class="mt-5 atlas-display max-w-[18ch] text-white">
          Data Pariwisata <span class="atlas-italic" :style="{ color: GOLD }">&amp; Ekonomi Kreatif</span> Jakarta
        </h1>
        <p class="mt-5 apple-lead max-w-[64ch] text-white/75">
          Empat pintu masuk ke data Dispar — katalog SDI, kesiapan indikator GCI/GPCI, dan pendataan lapangan. Pilih menu untuk membuka
          visualisasi.
        </p>

        <div class="mt-9 grid grid-cols-2 md:grid-cols-4 gap-px overflow-hidden rounded-2xl border border-white/12 bg-white/5 backdrop-blur">
          <div v-for="st in STATS" :key="st.label" class="bg-white/[0.03] px-5 py-4">
            <div class="text-[26px] md:text-[30px] font-bold tabular tracking-tight leading-none" style="color: #fff">{{ st.value }}</div>
            <div class="mt-1.5 apple-fine text-white/60">{{ st.label }}</div>
          </div>
        </div>
      </div>
      <div class="relative h-[3px] w-full" :style="{ background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`, opacity: 0.7 }" />
    </section>

    <section class="mx-auto max-w-[1320px] px-6 py-11 pb-20">
      <div class="mb-5 flex items-baseline justify-between">
        <h2 class="atlas-mono text-ink-muted-48">Pilih menu</h2>
        <span class="apple-fine text-ink-muted-48">4 modul</span>
      </div>
      <div class="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
        <NuxtLink v-for="m in MENUS" :key="m.href" :to="m.href" class="group utility-card press-scale flex flex-col p-6 hover:-translate-y-1">
          <div class="flex items-start justify-between">
            <span class="atlas-mono text-ink-muted-48">{{ m.no }}</span>
            <span
              class="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary"
              :style="{ color: NAVY }"
            >
              <svg
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="1.7"
                stroke-linecap="round"
                stroke-linejoin="round"
                class="transition-colors group-hover:[color:#fff]"
              >
                <template v-if="m.href === '/katalog'">
                  <rect x="3" y="4" width="18" height="4" rx="1" />
                  <rect x="3" y="10" width="18" height="4" rx="1" />
                  <rect x="3" y="16" width="18" height="4" rx="1" />
                </template>
                <template v-else-if="m.href === '/gci'">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M3 12h18M12 3c2.5 2.5 3.8 5.8 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.8-3.8-9S9.5 5.5 12 3z" />
                </template>
                <template v-else-if="m.href === '/gpci'">
                  <path d="M4 21V7l6-3v17M14 21V9l6 3v9" />
                  <path d="M7 9v0M7 12v0M7 15v0M17 14v0M17 17v0" />
                </template>
                <template v-else>
                  <path d="M9 3 4 5v16l5-2 6 2 5-2V3l-5 2-6-2z" />
                  <path d="M9 3v16M15 5v16" />
                </template>
              </svg>
            </span>
          </div>
          <div class="mt-5 flex items-center gap-2">
            <span class="atlas-display-md text-ink">{{ m.title }}</span>
            <span v-if="m.href === '/gci'" class="text-[9px] font-bold uppercase tracking-wider text-white bg-[#ed6b23] rounded px-1.5 py-0.5">Prioritas</span>
          </div>
          <p class="mt-2 apple-caption min-h-[42px] text-ink-muted-48">{{ m.desc }}</p>
          <div class="mt-5 flex items-center justify-between border-t border-hairline pt-4">
            <span class="apple-caption-strong text-ink-muted-80">{{ m.stat }}</span>
            <span class="text-lg leading-none transition-transform duration-200 group-hover:translate-x-1" :style="{ color: NAVY }" aria-hidden="true">→</span>
          </div>
        </NuxtLink>
      </div>
    </section>
  </main>
</template>
