<script setup lang="ts">
/** PDRB ekonomi kreatif (app/dashboard/pdrb-ekraf/page.tsx + PdrbEkrafStat @ 464fc15). */
definePageMeta({ layout: "dashboard" });
const api = useDashboard();
const sub = ref("2024");
const subTumbuh = ref("2024");
const [{ data: makro }, { data: sebaran }, { data: tumbuh }] = await Promise.all([
  useAsyncData("pdrb-makro", () => api.pdrbMakro()),
  useAsyncData("pdrb-sebaran", () => api.pdrbSebaran(sub.value), { watch: [sub] }),
  useAsyncData("pdrb-tumbuh", () => api.pdrbPertumbuhan(subTumbuh.value), { watch: [subTumbuh] }),
]);

const label = (p: string) => (p === "S1 2025" ? "2025 (Sem I)" : p);
const rows = computed(() => makro.value?.rows ?? []);
const full = computed(() => rows.value.find((r) => r.periode === "2024"));
const last = computed(() => rows.value[rows.value.length - 1]);
const T = computed(() => Object.fromEntries((makro.value?.target_kontribusi ?? []).map((t) => [t.tahun, t.target_pct])));
const kvt = computed(() => makro.value?.kontribusi_vs_target ?? []);
const opsiPeriode = computed(() => (sebaran.value?.periode_list ?? []).map((p) => ({ value: p, label: label(p) })));
// Warna per nama subsektor; "Lainnya" tetap abu-abu bawaan Donut.
const warnaDonut = computed(() =>
  Object.fromEntries((sebaran.value?.distribusi ?? []).filter((d) => d.nama !== "Lainnya").map((d) => [d.label, warnaSubsektor(d.nama)])),
);
</script>

<template>
  <div class="mb-4">
    <div class="apple-fine uppercase tracking-wider text-ink-muted-48">Kinerja Ekonomi Kreatif</div>
    <h2 class="text-[22px] font-bold tracking-tight text-ink">PDRB Ekonomi Kreatif (2017–2025)</h2>
  </div>
  <div v-if="full && last">
    <KpiRow>
      <Kpi label="Kontribusi 2024" :value="`${idNum(full.kontribusi_pct, 2)}%`" :sub="`terhadap PDRB DKI · Sem I 2025: ${idNum(last.kontribusi_pct, 2)}%`" />
      <Kpi label="Target RPJMD 2025" :value="`${idNum(T['2025'] ?? 0, 2)}%`" :sub="`2029: ${idNum(T['2029'] ?? 0, 2)}%`" />
      <Kpi label="Nilai PDRB Ekraf 2024" :value="`Rp ${idNum(full.adhb_ekraf / 1000, 1)} T`" sub="atas dasar harga berlaku" />
      <Kpi label="Pertumbuhan 2024" :value="`${idNum(full.tumbuh_ekraf_pct, 2)}%`" :sub="`PDRB DKI ${idNum(full.tumbuh_dki_pct, 2)}%`" />
    </KpiRow>

    <SectionHead title="Kontribusi" desc="Kontribusi Sektor Ekonomi Kreatif terhadap PDRB Provinsi DKI Jakarta (%, ADHB) — KPI utama RPJMD." />
    <ChartCard title="Capaian vs Target RPJMD 2025–2029" sub="Capaian = batang · Target RPJMD = garis">
      <ComboBarLine
        :categories="kvt.map((r) => r.label)"
        :bar="{ name: 'Capaian (%)', values: kvt.map((r) => r.capaian) }"
        :line="{ name: 'Target RPJMD (%)', values: kvt.map((r) => r.target) }"
        :dual-axis="false"
      />
      <p class="mt-2 apple-fine text-ink-muted-48">
        Data 2025 baru mencakup Semester I sehingga belum dapat dibandingkan langsung dengan target setahun penuh. Target RPJMD:
        {{ Object.entries(T).map(([y, v]) => `${y} ${idNum(v, 2)}%`).join(" · ") }}.
      </p>
    </ChartCard>

    <SectionHead title="Nilai" desc="Besaran PDRB Ekonomi Kreatif (Rp miliar)." />
    <ChartGrid :cols="2">
      <ChartCard title="PDRB Ekraf atas dasar harga berlaku (ADHB)" sub="Rp miliar">
        <VerticalBars :data="rows.map((r) => ({ label: r.label, value: r.adhb_ekraf }))" unit=" miliar" />
      </ChartCard>
      <ChartCard title="PDRB Ekraf atas dasar harga konstan (ADHK)" sub="Rp miliar · riil, tanpa efek harga">
        <VerticalBars :data="rows.map((r) => ({ label: r.label, value: r.adhk_ekraf }))" unit=" miliar" color="#0e7c42" />
      </ChartCard>
    </ChartGrid>

    <div class="mt-8 mb-3 flex flex-wrap items-center gap-2">
      <h2 class="mr-3 text-[18px] font-bold tracking-tight text-ink">Sebaran</h2>
      <ModeToggle v-model="sub" :options="opsiPeriode" />
    </div>
    <ChartGrid :cols="2">
      <ChartCard :title="`Distribusi per subsektor · ${label(sub)}`" sub="% terhadap total PDRB Ekraf (ADHB) · 5 terbesar + lainnya">
        <Donut show-percent :data="(sebaran?.distribusi ?? []).map((d) => ({ label: d.label, value: d.pct }))" :color-map="warnaDonut" />
      </ChartCard>
      <ChartCard :title="`10 subsektor dengan nilai terbesar · ${label(sub)}`" sub="Rp miliar (ADHB)">
        <BarBreakdown :data="sebaran?.nilai_top10 ?? []" unit=" miliar" :colors="(sebaran?.nilai_top10 ?? []).map((d) => warnaSubsektor(d.label))" />
      </ChartCard>
    </ChartGrid>

    <SectionHead title="Pertumbuhan" desc="Laju pertumbuhan PDRB atas dasar harga konstan (%, yoy)." />
    <div class="mb-3">
      <ModeToggle v-model="subTumbuh" :options="opsiPeriode" />
    </div>
    <ChartGrid :cols="2">
      <ChartCard title="Pertumbuhan Ekraf vs Non-Ekraf vs DKI" sub="% yoy (ADHK)">
        <GroupedLines
          :series="[
            { name: 'PDRB Ekraf', data: rows.map((r) => ({ label: r.label, value: r.tumbuh_ekraf_pct })) },
            { name: 'PDRB Non-Ekraf', data: rows.map((r) => ({ label: r.label, value: r.tumbuh_non_ekraf_pct })) },
            { name: 'PDRB DKI', data: rows.map((r) => ({ label: r.label, value: r.tumbuh_dki_pct })) },
          ]"
        />
      </ChartCard>
      <ChartCard :title="`Pertumbuhan per subsektor · ${label(subTumbuh)}`" sub="% yoy (ADHK)">
        <BarBreakdown :data="tumbuh?.items ?? []" unit="%" :colors="(tumbuh?.items ?? []).map((d) => warnaSubsektor(d.label))" />
      </ChartCard>
    </ChartGrid>
  </div>
  <SourceNote>
    Sumber: {{ makro?.sumber }}. Angka 2017–2018 berasal dari pemutakhiran (updating) PDRB; 2019–Semester I 2025 dari penyusunan terbaru. Target
    kontribusi: RPJMD 2025–2029.
  </SourceNote>
</template>
