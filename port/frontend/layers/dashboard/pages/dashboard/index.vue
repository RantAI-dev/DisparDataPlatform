<script setup lang="ts">
/** Beranda Dashboard (app/dashboard/page.tsx): KPI utama + pintu ke tiap sub-menu. */
definePageMeta({ layout: "dashboard" });
const { ringkasan } = useDashboard();
const { data } = await useAsyncData("dashboard-ringkasan", () => ringkasan());
</script>

<template>
  <div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    <KpiStat v-for="k in data?.kpi ?? []" :key="k.label" :label="k.label" :value="k.value || '—'" :sub="k.sub ?? undefined" />
  </div>
  <div class="mt-6 grid gap-4 md:grid-cols-2">
    <template v-for="g in DASHBOARD_MENU" :key="g.group">
      <NuxtLink v-for="it in g.items" :key="it.href" :to="it.href" class="utility-card block p-5 transition-shadow hover:shadow-md">
        <div class="apple-fine uppercase tracking-wider text-ink-muted-48">{{ g.group }}</div>
        <div class="mt-1 text-[17px] font-semibold text-ink">{{ it.label }} →</div>
        <div class="text-[13px] text-ink-muted-48">{{ it.sub }}</div>
      </NuxtLink>
    </template>
  </div>
</template>
