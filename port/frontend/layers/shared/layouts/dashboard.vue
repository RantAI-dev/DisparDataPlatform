<script setup lang="ts">
/** Kerangka menu Dashboard (app/dashboard/layout.tsx): judul + sub-menu (Kinerja Pariwisata · Kinerja Ekraf). */
useHead({ title: "Dashboard Statistik Pariwisata & Ekonomi Kreatif — DKI Jakarta" });
</script>

<template>
  <AppNav />
  <main class="min-h-screen">
    <div class="mx-auto max-w-[1320px] px-6 py-8">
      <div class="mb-5">
        <div class="apple-fine uppercase tracking-wider text-ink-muted-48">Dashboard · Mandat RPJMD 2025–2029</div>
        <h1 class="mt-1 text-[28px] font-bold tracking-tight text-ink">
          Dashboard Statistik Pariwisata dan Ekonomi Kreatif
        </h1>
      </div>
      <DashboardSubnav />
      <div class="mt-6"><slot /></div>
    </div>
  </main>
</template>
