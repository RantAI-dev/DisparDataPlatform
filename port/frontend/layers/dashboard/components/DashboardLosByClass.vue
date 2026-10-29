<script setup lang="ts">
/**
 * Lama menginap per kelas hotel (components/dashboard/LosByClass.tsx): bulan pilihan vs bulan yang
 * sama tahun sebelumnya. Tabel dan label dari `lama-menginap/per-kelas`; deret batang dibaca dari
 * sel tabel yang sama (angka id-ID).
 */
import type { Jenis, LosPerKelas } from "../composables/useDashboard";
import { labelBulan } from "../constants";

const props = defineProps<{ guest: Jenis }>();
const NAMA = { wisman: "Wisman", wisnus: "Wisnus" } as const;
const { losPerKelas } = useDashboard();

const periode = ref<string | undefined>(undefined);
const { data } = await useAsyncData(`los-kelas-${props.guest}`, () => losPerKelas(props.guest, periode.value), { watch: [periode] });

const t = computed<LosPerKelas | null>(() => data.value ?? null);
const label = computed(() => t.value?.label ?? "—");
const prevLabel = computed(() => t.value?.tabel.header[1] ?? "—");
const angka = (s: string | undefined) => (s && s !== "—" ? Number(s.replace(/\./g, "").replace(",", ".")) : null);
const baris = computed(() => (t.value?.tabel.rows ?? []).map(([k, prev, cur]) => ({ k: k!, prev: angka(prev), cur: angka(cur) })));
const series = computed(() => [
  { name: label.value, data: baris.value.filter((r) => r.cur !== null).map((r) => ({ label: r.k, value: r.cur! })) },
  { name: prevLabel.value, data: baris.value.filter((r) => r.prev !== null).map((r) => ({ label: r.k, value: r.prev! })) },
]);
const adaPembanding = computed(() => baris.value.some((r) => r.prev !== null));
const pilihan = computed(() => (t.value?.periode_list ?? []).map((p) => ({ p, l: labelBulan(p) })));
const pilih = (e: Event) => (periode.value = (e.target as HTMLSelectElement).value);
</script>

<template>
  <ChartCard :title="`Per kelas hotel · ${label}`" :sub="`${NAMA[guest].toLowerCase()} · hari · perbandingan YoY`">
    <p v-if="!t?.periode" role="status" class="apple-fine text-ink-muted-48">Data lama menginap belum tersedia.</p>
    <template v-else>
      <label class="mb-4 flex flex-wrap items-center gap-2 apple-fine text-ink-muted-80">
        Periode
        <select
          :aria-label="`Periode Length of Stay ${NAMA[guest]}`"
          :value="t.periode"
          class="rounded-lg border border-hairline bg-canvas px-3 py-2 text-ink"
          @change="pilih"
        >
          <option v-for="o in pilihan" :key="o.p" :value="o.p">{{ o.l }}</option>
        </select>
      </label>
      <GroupedBars :categories="baris.map((r) => r.k)" :series="series" :missing-value="null" unit=" hari" />
      <p class="mt-2 apple-fine text-ink-muted-48">
        {{ adaPembanding ? "YoY membandingkan bulan yang sama pada tahun sebelumnya." : `Data ${prevLabel} belum tersedia; YoY tidak dihitung.` }}
      </p>
      <div class="mt-3 overflow-x-auto">
        <table class="w-full text-left text-[12px] tabular-nums">
          <caption class="sr-only">Length of Stay {{ NAMA[guest] }} per kelas hotel dan perubahan YoY</caption>
          <thead class="text-ink-muted-48">
            <tr>
              <th scope="col" class="py-2 pr-3">Kelas hotel</th>
              <th scope="col" class="py-2 px-2 text-right whitespace-nowrap">{{ prevLabel }}</th>
              <th scope="col" class="py-2 px-2 text-right whitespace-nowrap">{{ label }}</th>
              <th scope="col" class="py-2 pl-2 text-right">YoY</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="r in t.tabel.rows" :key="r[0]" class="border-t border-hairline">
              <th scope="row" class="py-2 pr-3 font-medium text-ink">{{ r[0] }}</th>
              <td class="py-2 px-2 text-right">{{ r[1] }}</td>
              <td class="py-2 px-2 text-right">{{ r[2] }}</td>
              <td class="py-2 pl-2 text-right whitespace-nowrap">{{ r[3] }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </template>
  </ChartCard>
</template>
