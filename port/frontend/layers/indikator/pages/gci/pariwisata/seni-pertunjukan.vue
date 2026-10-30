<script setup lang="ts">
/**
 * /gci/pariwisata/seni-pertunjukan (app/gci/pariwisata/seni-pertunjukan/page.tsx). Angka, venue, dan
 * tabel artis dari `pariwisata/seni-pertunjukan?tahun`; sel peringkat "Artis ✓ · Negara" diurai
 * kembali menjadi markup v2 (tanda ✓ hijau, negara abu-abu).
 */
import { CHART_ARTIS, PENDUKUNG_SENI } from "../../../constants";

const route = useRoute();
const tahun = computed(() => (typeof route.query.tahun === "string" ? route.query.tahun : undefined));
const { seniPertunjukan } = useIndikator();
const { data } = await useAsyncData("pariwisata-seni", () => seniPertunjukan(tahun.value), { watch: [tahun] });

const ACCENT = "#ed6b23";
type Titik = { label: string; value: number };
const kartu = computed(() => (data.value?.kartu ?? []).map((k) => ({ ...k, titik: (k.data.data ?? []) as Titik[] })));
const tabel = computed(() => data.value?.tabel ?? []);
const tampil = computed(() => tabel.value.find((t) => t.header[0] === "Artis"));
const peringkat = computed(() => tabel.value.filter((t) => t.header[0] === "#"));
const tahunPeringkat = computed(() => peringkat.value[0]?.header.slice(1) ?? []);
const sel = uraiSelArtis;
const filter = computed(() => data.value?.komponen.TahunFilter as { years: string[]; value: string } | undefined);
const venues = computed(() => data.value?.komponen.VenueMapClient?.venues ?? []);
</script>

<template>
  <PariwisataShell v-if="data" v-bind="data.shell" :sumber-href="data.shell.sumberHref">
    <section>
      <div class="mb-4 flex justify-end">
        <IndikatorTahunFilter :years="filter?.years ?? []" :value="filter?.value ?? ''" />
      </div>
      <KpiRow>
        <Kpi v-for="k in data.kpis" :key="k.label" :label="k.label" :value="k.value" :sub="k.sub ?? undefined" />
      </KpiRow>
      <div class="mt-4">
        <ChartGrid>
          <ChartCard v-for="k in kartu" :key="k.judul" :title="k.judul" :sub="k.sub ?? undefined">
            <LineTrend v-if="k.komponen === 'LineTrend'" :data="k.titik" unit="event" y-name="Event" />
            <BarBreakdown v-else-if="k.komponen === 'BarBreakdown'" :data="k.titik" :color="PALETTE[1]" />
            <Donut v-else :data="k.titik" show-percent />
          </ChartCard>
        </ChartGrid>
      </div>
    </section>

    <PageSection title="Peta venue seni & pertunjukan">
      <VenueMap :venues="venues" />
    </PageSection>

    <PageSection title="Referensi Artis Top 10 Global Chart">
      <div v-if="!tabel.length" class="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-400">Data artis chart belum tersedia.</div>
      <div v-else class="space-y-6">
        <div v-if="tampil">
          <div class="mb-2 flex items-center gap-2">
            <span class="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white" :style="{ background: ACCENT }">
              Artis yang sudah tampil di Jakarta
            </span>
            <span class="apple-fine text-ink-muted-48">{{ tampil.rows.length }} artis · sumber: verifikasi publik dan data event Dispar</span>
          </div>
          <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div class="overflow-x-auto">
              <table class="w-full border-collapse text-[13px]">
                <thead>
                  <tr :style="{ background: ACCENT }" class="text-left text-[11px] uppercase tracking-wider text-white">
                    <th v-for="h in tampil.header" :key="h" class="px-3 py-2.5 font-semibold">{{ h }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(r, i) in tampil.rows" :key="r[0]" class="border-t border-slate-100">
                    <td class="px-3 py-2 font-medium text-ink">{{ r[0] }}</td>
                    <td class="px-3 py-2 text-slate-600">{{ r[1] }}</td>
                    <td class="px-3 py-2 tabular-nums text-slate-700">{{ r[2] }}</td>
                    <td class="px-3 py-2 text-slate-700">{{ r[3] }}</td>
                    <td class="px-3 py-2">
                      <a v-if="tampil.tautan?.[i]" :href="tampil.tautan[i]!" target="_blank" rel="noreferrer" class="font-medium hover:underline" style="color: #2563eb">{{
                        r[4]
                      }}</a>
                      <span v-else class="text-slate-400" title="Tercatat pada data event Dispar; belum diverifikasi dengan sumber publik lain">{{ r[4] }}</span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
        <div v-for="(t, ci) in peringkat" :key="ci">
          <div class="mb-2 flex items-center gap-2">
            <span class="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white" :style="{ background: ACCENT }">{{
              CHART_ARTIS[ci]
            }}</span>
            <span class="apple-fine text-ink-muted-48">peringkat 1–10 · {{ tahunPeringkat.join(", ") }}</span>
          </div>
          <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div class="overflow-x-auto">
              <table class="w-full border-collapse text-[13px]">
                <thead>
                  <tr :style="{ background: ACCENT }" class="text-left text-[11px] uppercase tracking-wider text-white">
                    <th class="w-14 px-3 py-2.5 font-semibold">#</th>
                    <th v-for="y in t.header.slice(1)" :key="y" class="px-3 py-2.5 font-semibold">{{ y }}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="r in t.rows" :key="r[0]" class="border-t border-slate-100">
                    <td class="px-3 py-2 tabular-nums font-semibold text-ink-muted-48">{{ r[0] }}</td>
                    <td v-for="(c, j) in r.slice(1)" :key="j" class="px-3 py-2 text-slate-700">
                      <span v-if="c === '—'" class="text-slate-300">—</span>
                      <span v-else :title="sel(c).negara ?? undefined">
                        {{ sel(c).artis }}<span v-if="sel(c).ceklis" class="ml-1 font-bold text-green-600" title="Pernah tampil di Jakarta (data Dispar)">✓</span
                        ><span v-if="sel(c).negara" class="ml-1 text-[11px] text-ink-muted-48">· {{ sel(c).negara }}</span>
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </PageSection>

    <PageSection title="Sumber" desc="Data pendukung Dinas Pariwisata & Ekraf — event pertunjukan & seni visual di Jakarta.">
      <RawDataDisclosure
        v-for="r in data.raw"
        :key="r.slug"
        :slug="r.slug"
        :title="r.title"
        :count="r.count"
        label="Lihat data SDI"
        :columns="['nama_event', 'nama_venue', 'lokasi_venue', 'periode_data']"
      />
      <div class="mt-5 rounded-xl border border-hairline bg-white/60 p-4">
        <div class="apple-fine uppercase tracking-wider text-ink-muted-48">Data pendukung lain (katalog SDI)</div>
        <div class="mt-2 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px]">
          <NuxtLink v-for="d in PENDUKUNG_SENI" :key="d.slug" :to="`/sdi/${d.slug}`" class="hover:underline" style="color: #2563eb">{{ d.label }} ↗</NuxtLink>
        </div>
      </div>
    </PageSection>
  </PariwisataShell>
</template>
