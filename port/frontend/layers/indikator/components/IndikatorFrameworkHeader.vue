<script setup lang="ts">
/** Header halaman framework (FrameworkView.tsx FrameworkHeader). */
defineProps<{ title: string; subtitle: string }>();
</script>

<template>
  <HeroDark pad="pt-8 pb-10">
    <div class="text-[12px] font-mono uppercase tracking-widest text-white/60"><span style="color: #f0a13a">●</span> Dashboard Indikator Pariwisata</div>
    <h1 class="mt-3 text-[28px] md:text-[36px] font-bold tracking-tight">{{ title }}</h1>
    <p class="mt-2 text-white/70 max-w-[80ch] text-[14px]">{{ subtitle }}</p>
    <slot />
  </HeroDark>
</template>
