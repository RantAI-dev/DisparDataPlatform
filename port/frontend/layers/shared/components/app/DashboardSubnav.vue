<script setup lang="ts">
/** Sub-menu dashboard: dua kelompok (Kinerja Pariwisata, Kinerja Ekraf) × 2 halaman. */
const route = useRoute();
</script>

<template>
  <div class="grid gap-3 md:grid-cols-2">
    <div v-for="g in DASHBOARD_MENU" :key="g.group" class="rounded-xl border border-hairline bg-white p-2 shadow-sm">
      <div class="px-2 pb-1.5 pt-1 text-[11px] font-semibold uppercase tracking-wider text-ink-muted-48">
        {{ g.group }}
      </div>
      <div class="grid grid-cols-2 gap-1.5">
        <NuxtLink
          v-for="it in g.items"
          :key="it.href"
          :to="it.href"
          :class="`rounded-lg px-3 py-2 transition-colors ${navAktif(route.path, it.href) ? 'text-white' : 'hover:bg-black/[0.04]'}`"
          :style="navAktif(route.path, it.href) ? { background: '#ed6b23' } : undefined"
        >
          <div :class="`text-[13.5px] font-semibold ${navAktif(route.path, it.href) ? '' : 'text-ink'}`">{{ it.label }}</div>
          <div :class="`text-[11px] ${navAktif(route.path, it.href) ? 'text-white/85' : 'text-ink-muted-48'}`">{{ it.sub }}</div>
        </NuxtLink>
      </div>
    </div>
  </div>
</template>
