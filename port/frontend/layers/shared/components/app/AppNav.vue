<script setup lang="ts">
/**
 * Navigasi global (components/Nav.tsx platform-v2): Dashboard Statistik · Katalog Data · SDI · GCI ·
 * GPCI · GMTI · Spatial · Hotel POC · API. Item "AI" dihapus (SPEC §5.4).
 * Tema: dominan putih + aksen oranye (branding enjoy.jakarta.id).
 */
const ORANGE = "#ed6b23";
const INK = "#33302b";

const ITEMS = [
  { href: "/katalog", label: "Katalog Data" },
  { href: "/sdi", label: "SDI" },
  { href: "/gci", label: "GCI" },
  { href: "/gpci", label: "GPCI" },
  { href: "/gmti", label: "GMTI" },
  { href: "/spatial", label: "Spatial" },
  { href: "/scraped-hotels", label: "Hotel POC" },
  { href: "/docs", label: "API" },
];

const route = useRoute();
const router = useRouter();
const path = computed(() => route.path || "/");
const gaya = (aktif: boolean) => (aktif ? { background: ORANGE, color: "#fff" } : { color: INK });
</script>

<template>
  <header class="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-[#ece6df]">
    <!-- Aksen oranye tipis di atas — identitas enjoy.jakarta -->
    <div :style="{ height: '3px', background: ORANGE }" />
    <div class="mx-auto max-w-[1320px] px-6 py-3 md:py-0 md:h-[74px] flex flex-col md:flex-row md:items-center justify-between gap-3 md:gap-4">
      <div class="flex items-center gap-2 min-w-0 shrink-0">
        <!-- Kembali — global, ke halaman sebelumnya. Sembunyi di beranda. -->
        <button
          v-if="path !== '/'"
          aria-label="Kembali ke halaman sebelumnya"
          class="shrink-0 inline-flex items-center gap-1.5 rounded-lg pl-1.5 pr-2.5 py-2 text-[13px] font-medium text-[#6b6459] hover:text-[#1c1a17] hover:bg-black/[0.04] transition-colors"
          @click="router.back()"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2.2"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
          <span class="hidden sm:inline">Kembali</span>
        </button>
        <NuxtLink to="/" class="flex items-center gap-3.5 min-w-0">
          <img src="/logo-jakarta.png" alt="Logo Jakarta" class="h-11 w-auto" />
          <div class="leading-tight hidden sm:block">
            <div class="font-semibold tracking-tight text-[15px] text-[#1c1a17]">Dinas Pariwisata &amp; Ekonomi Kreatif</div>
            <div class="text-[12px] text-[#9c948a]">Provinsi DKI Jakarta · Platform Data</div>
          </div>
        </NuxtLink>
      </div>
      <div class="flex w-full md:w-auto items-center gap-1 min-w-0 text-[13px] font-medium">
        <!-- Dashboard Statistik — di LUAR <nav> yang bisa di-scroll, supaya dropdown tidak terpotong overflow. -->
        <div class="relative group shrink-0">
          <NuxtLink
            to="/dashboard"
            class="px-3.5 py-2 rounded-lg transition-colors inline-flex items-center gap-1"
            :style="gaya(navAktif(path, '/dashboard'))"
          >
            Dashboard Statistik
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true">
              <path d="M6 9l6 6 6-6" />
            </svg>
          </NuxtLink>
          <div class="invisible opacity-0 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 transition-opacity absolute left-0 top-full pt-2 z-50">
            <div class="w-[300px] max-w-[calc(100vw-48px)] rounded-xl border border-[#ece6df] bg-white p-2 shadow-lg">
              <div v-for="g in DASHBOARD_MENU" :key="g.group" class="py-1">
                <div class="px-2.5 pb-1 text-[10.5px] font-semibold uppercase tracking-wider text-[#9c948a]">{{ g.group }}</div>
                <NuxtLink v-for="it in g.items" :key="it.href" :to="it.href" class="block rounded-lg px-2.5 py-1.5 hover:bg-[#ed6b23]/10">
                  <div class="text-[13px] font-semibold text-[#1c1a17]">{{ it.label }}</div>
                  <div class="text-[11px] font-normal text-[#9c948a]">{{ it.sub }}</div>
                </NuxtLink>
              </div>
            </div>
          </div>
        </div>
        <nav class="flex items-center gap-1 text-[13px] font-medium min-w-0 overflow-x-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          <NuxtLink
            v-for="it in ITEMS"
            :key="it.href"
            :to="it.href"
            class="shrink-0 px-3.5 py-2 rounded-lg transition-colors"
            :style="gaya(navAktif(path, it.href))"
          >
            {{ it.label }}
          </NuxtLink>
        </nav>
      </div>
    </div>
  </header>
</template>
