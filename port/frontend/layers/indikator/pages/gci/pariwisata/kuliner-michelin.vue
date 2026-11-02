<script setup lang="ts">
/** /gci/pariwisata/kuliner-michelin (app/gci/pariwisata/kuliner-michelin/page.tsx); unit/warna kartu dari v2. */
const { kulinerMichelin } = useIndikator();
const { data } = await useAsyncData("pariwisata-kuliner", () => kulinerMichelin());
type Titik = { label: string; value: number };
const kartu = computed(() => (data.value?.kartu ?? []).map((k) => ({ ...k, titik: (k.data.data ?? []) as Titik[] })));
</script>

<template>
  <PariwisataShell v-if="data" v-bind="data.shell" :sumber-href="data.shell.sumberHref">
    <section>
      <KpiRow>
        <Kpi v-for="k in data.kpis" :key="k.label" :label="k.label" :value="k.value" :sub="k.sub ?? undefined" />
      </KpiRow>
      <div class="mt-4">
        <ChartGrid>
          <ChartCard v-for="(k, i) in kartu" :key="k.judul" :title="k.judul" :sub="k.sub">
            <Donut v-if="k.komponen === 'Donut'" :data="k.titik" />
            <BarBreakdown v-else :data="k.titik" unit=" resto" :color="i === 1 ? PALETTE[1] : undefined" />
          </ChartCard>
        </ChartGrid>
      </div>
    </section>
    <PageSection title="Data mentah & sumber" desc="Sumber katalog SDI — Dinas Pariwisata & Ekraf.">
      <div class="space-y-3">
        <RawDataDisclosure v-for="r in data.raw" :key="r.slug" :slug="r.slug" :title="r.title" :count="r.count" />
      </div>
    </PageSection>
  </PariwisataShell>
</template>
