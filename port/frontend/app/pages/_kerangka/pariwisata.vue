<script setup lang="ts">
/**
 * Galeri sementara PariwisataShell + PageSection + VenueMap (dihapus di plan 17), bentuknya meniru
 * /gci/pariwisata/seni-pertunjukan v2. Venue = salinan lib/pariwisata/seni-venues.json v2.
 */
import seniVenues from "../../kerangka/golden/seni-venues.json";
import type { Venue } from "../../../layers/shared/components/map/VenueMap.vue";

useHead({ title: "Kerangka · PariwisataShell", meta: [{ name: "robots", content: "noindex" }] });
const venues = (seniVenues as (Omit<Venue, "lat" | "lon"> & { lat: number | null; lon: number | null })[]).filter(
  (v): v is Venue => typeof v.lat === "number" && typeof v.lon === "number",
);
</script>

<template>
  <PariwisataShell
    eyebrow="Pengalaman Budaya · CI-SP"
    title="Seni Pertunjukan"
    nilai="308"
    satuan="event"
    tahun="2025"
    catatan="Contoh catatan indikator — teks bebas di bawah meta."
    sumber="Satu Data Jakarta"
    sumber-href="https://satudata.jakarta.go.id/open-data/data-seni-pertunjukan-dan-visual"
  >
    <PageSection title="Peta venue" desc="Titik oranye = venue event; emas = pernah menghadirkan artis Top-10.">
      <VenueMap :venues="venues" />
    </PageSection>
    <PageSection title="Bagian dengan deskripsi bermarkup">
      <template #desc>Deskripsi dengan <b>markup</b> lewat slot.</template>
      <KpiRow>
        <Kpi label="Venue" :value="venues.length" sub="berkoordinat" />
        <Kpi label="Venue emas" :value="venues.filter((v) => v.gold).length" :delta="-12.5" sub="vs tahun lalu" />
      </KpiRow>
    </PageSection>
  </PariwisataShell>
</template>
