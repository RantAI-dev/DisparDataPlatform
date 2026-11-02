<script setup lang="ts">
/** /gci/pariwisata/wisatawan-internasional (app/gci/pariwisata/wisatawan-internasional/page.tsx). */
const { wisatawanInternasional } = useIndikator();
const { data } = await useAsyncData("pariwisata-wisman", () => wisatawanInternasional());
</script>

<template>
  <PariwisataShell v-if="data" v-bind="data.shell" :sumber-href="data.shell.sumberHref">
    <IndikatorWismanDashboard v-bind="data.komponen.WismanDashboard" />
    <PageSection title="Data mentah & sumber" desc="Datamart wisman Jakarta — Dinas Pariwisata & Ekraf.">
      <div class="space-y-3">
        <RawDataDisclosure v-for="r in data.raw" :key="r.slug" :slug="r.slug" :title="r.title" :count="r.count" />
      </div>
    </PageSection>
  </PariwisataShell>
</template>
