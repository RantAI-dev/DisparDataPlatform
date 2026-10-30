<script setup lang="ts">
/** Galeri sementara layout `dashboard` (dihapus di plan 17), isi contoh dari golden PDRB Ekraf. */
import makro from "../../kerangka/golden/dashboard.pdrb-ekraf.makro.json";

definePageMeta({ layout: "dashboard" });
const rows = makro.data.rows;
</script>

<template>
  <SectionHead title="Layout dashboard" desc="Judul + DashboardSubnav dari layout; isi halaman lewat slot." />
  <ChartGrid :cols="2">
    <ChartCard title="PDRB Ekraf atas dasar harga berlaku (ADHB)" sub="Rp miliar">
      <VerticalBars :data="rows.map((r) => ({ label: r.label, value: r.adhb_ekraf }))" unit=" miliar" />
    </ChartCard>
    <ChartCard title="Kontribusi per periode" sub="%">
      <LineTrend :data="rows.map((r) => ({ label: r.periode, value: r.kontribusi_pct }))" unit="%" y-name="%" />
    </ChartCard>
  </ChartGrid>
  <SourceNote>{{ makro.data.sumber }}</SourceNote>
</template>
