<script setup lang="ts">
/**
 * Katalog dataset (components/CatalogView.tsx v2 @ 464fc15, yang tayang) untuk /katalog dan /sdi
 * (`primaryOnly`). Baris, statistik, dan lapisan datang dari `katalog` (SSR, tanpa seed statis);
 * cari, filter tier/lapisan/sumber/tag berjalan di klien seperti v2.
 */
import { GOLD, GREEN, LINK, MEDAL, NAVY, PENJELASAN_LAPISAN, SDI_ORG_NAME, SDI_PORTAL, SUMBER_DATA, type Medallion, type SumberData } from "../constants";

const props = withDefaults(defineProps<{ primaryOnly?: boolean }>(), { primaryOnly: false });

const { katalog } = useDataset();
const { data } = await useAsyncData(`katalog-${props.primaryOnly ? "primer" : "semua"}`, () =>
  katalog(props.primaryOnly ? "primer" : "semua").then((r) => r.data),
);

const q = ref("");
const tier = ref<"all" | "primer" | "sekunder">("all");
const medalFilter = ref<"all" | Medallion>("all");
const sumber = ref<"all" | SumberData>("all");
// `tag` = filter yang berlaku (huruf kecil); `tagTeks` = isi kotak. Filter baru berlaku saat isi
// kotak sama persis dengan salah satu tag, supaya ketikan setengah jadi tidak mengosongkan tabel.
const tag = ref("");
const tagTeks = ref("");

const catalog = computed(() => data.value?.items ?? []);
const stats = computed(() => data.value?.stats ?? { total: 0, tags: 0, views: 0 });
const secondaryCount = computed(() => catalog.value.filter((r) => r.tier === "sekunder").length);

const medalCounts = computed(() => {
  const c: Record<Medallion, number> = { bronze: 0, silver: 0, gold: 0 };
  for (const r of catalog.value) if (r.medallion) c[r.medallion.level] += 1;
  return c;
});

const filtered = computed(() => {
  const term = q.value.trim().toLowerCase();
  return catalog.value.filter((r) => {
    if (tier.value !== "all" && r.tier !== tier.value) return false;
    if (medalFilter.value !== "all" && r.medallion?.level !== medalFilter.value) return false;
    if (sumber.value !== "all" && r.sumber !== sumber.value) return false;
    if (tag.value && !r.tags.some((t) => t.toLowerCase() === tag.value)) return false;
    if (!term) return true;
    return (
      r.title.toLowerCase().includes(term) ||
      r.description.toLowerCase().includes(term) ||
      r.source.toLowerCase().includes(term) ||
      r.tags.some((t) => t.toLowerCase().includes(term))
    );
  });
});

// Pilihan filter beserta jumlah dataset; tag diurutkan dari yang paling sering.
const sumberCounts = computed(() => {
  const c: Partial<Record<SumberData, number>> = {};
  for (const r of catalog.value) c[r.sumber] = (c[r.sumber] ?? 0) + 1;
  return c;
});
const tagOptions = computed(() => {
  const c = new Map<string, number>();
  for (const r of catalog.value) for (const t of new Set(r.tags.map((x) => x.toLowerCase()))) c.set(t, (c.get(t) ?? 0) + 1);
  return [...c].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "id"));
});
function ketikTag(v: string) {
  tagTeks.value = v;
  const t = v.trim().toLowerCase();
  if (!t) tag.value = "";
  else if (tagOptions.value.some(([x]) => x === t)) tag.value = t;
}
function pilihTag(t: string) {
  tag.value = t.toLowerCase();
  tagTeks.value = t.toLowerCase();
}
function hapusFilter() {
  sumber.value = "all";
  tag.value = "";
  tagTeks.value = "";
}
const SUMBER_KUNCI = Object.keys(SUMBER_DATA) as SumberData[];

const TIER_PILIHAN = [["all", "Semua"], ["primer", "Primer"], ["sekunder", "Sekunder"]] as const;
const LAPISAN_PILIHAN = [["all", "Semua lapisan"], ["bronze", "Bronze"], ["silver", "Silver"], ["gold", "Gold"]] as const;
const LEVEL = ["bronze", "silver", "gold"] as const;
const aktif = (ya: boolean) => (ya ? { background: NAVY, color: "#fff" } : { color: "#475569" });

const statTiles = computed(() => [
  { label: "DATA PRIMER (SDI)", value: String(stats.value.total), dot: GOLD },
  ...(props.primaryOnly ? [] : [{ label: "DATA SEKUNDER", value: String(secondaryCount.value), dot: GREEN }]),
  { label: "TOPIK / TAG", value: String(stats.value.tags), dot: null },
  { label: "TOTAL DILIHAT", value: stats.value.views.toLocaleString("id-ID"), dot: null },
]);
</script>

<template>
  <main class="min-h-screen bg-[#faf6f2]">
    <HeroDark pad="pt-8 pb-12">
      <div class="flex items-center gap-2 text-[12px] font-mono uppercase tracking-widest text-white/60">
        <span :style="{ color: GOLD }">●</span> {{ primaryOnly ? "SDI · Satu Data Jakarta" : "Katalog Data Terkonsolidasi" }}
      </div>
      <h1 class="mt-3 text-[30px] md:text-[38px] font-bold tracking-tight max-w-[22ch]">
        {{ primaryOnly ? "Satu Data Jakarta" : "Katalog Data" }}
      </h1>
      <p class="mt-3 text-white/75 max-w-[72ch] text-[15px]">
        {{
          primaryOnly
            ? `Dataset primer ${SDI_ORG_NAME} dari Satu Data Jakarta.`
            : "Seluruh dataset primer dan sekunder pariwisata serta ekonomi kreatif Jakarta. Daftar tematik GCI, GPCI, dan GMTI tetap terhubung ke katalog."
        }}
      </p>

      <div class="mt-7 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-[720px]">
        <div v-for="s in statTiles" :key="s.label" class="rounded-lg bg-white/10 border border-white/15 px-4 py-3">
          <div class="text-[11px] font-mono tracking-wider text-white/60 flex items-center gap-1.5">
            <span v-if="s.dot" class="inline-block w-1.5 h-1.5 rounded-full" :style="{ background: s.dot }" />
            {{ s.label }}
          </div>
          <div class="text-[22px] font-bold tabular-nums mt-1">{{ s.value }}</div>
        </div>
      </div>
    </HeroDark>

    <div class="mx-auto max-w-[1320px] px-6 -mt-6 relative z-10">
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm p-4 flex flex-col gap-3">
      <div class="flex flex-col lg:flex-row lg:items-center gap-3">
        <input
          v-model="q"
          aria-label="Cari dataset"
          placeholder="Cari dataset, deskripsi, sumber, atau tag…"
          class="flex-1 rounded-lg border border-slate-300 bg-slate-50 px-4 py-2.5 text-[14px] outline-none focus:border-[#ed6b23] focus:bg-white transition-colors"
        />
        <div v-if="!primaryOnly" class="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          <button
            v-for="[val, label] in TIER_PILIHAN"
            :key="val"
            class="px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors"
            :style="aktif(tier === val)"
            @click="tier = val"
          >{{ label }}</button>
        </div>
        <div class="flex items-center gap-1 bg-slate-100 rounded-lg p-1">
          <button
            v-for="[val, label] in LAPISAN_PILIHAN"
            :key="val"
            class="px-3 py-1.5 rounded-md text-[13px] font-medium transition-colors whitespace-nowrap"
            :style="aktif(medalFilter === val)"
            :title="val === 'all' ? 'Semua lapisan lakehouse' : MEDAL[val].catatanKatalog"
            @click="medalFilter = val"
          >{{ label }}<span v-if="val !== 'all' && medalCounts[val] > 0" class="ml-1.5 tabular-nums opacity-70">{{ medalCounts[val] }}</span></button>
        </div>
        <div class="flex items-center gap-3">
          <span class="text-[13px] text-slate-500 tabular-nums whitespace-nowrap">{{ filtered.length }} baris</span>
          <span
            class="text-[11px] font-medium px-2 py-1 rounded-full whitespace-nowrap"
            :style="{ background: '#eef2f9', color: NAVY }"
            title="Katalog dibaca dari database lakehouse; penarikan SDI dilakukan pipeline terjadwal."
          >◆ LAKEHOUSE</span>
        </div>
      </div>
      <div class="flex flex-col sm:flex-row sm:items-center gap-3 text-[13px]">
        <label v-if="!primaryOnly" class="flex items-center gap-2">
          <span class="font-medium text-slate-600">Sumber</span>
          <select
            v-model="sumber"
            class="rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-[13px] text-slate-700 focus:border-[#ed6b23] focus:bg-white"
          >
            <option value="all">Semua sumber</option>
            <option v-for="s in SUMBER_KUNCI" :key="s" :value="s">{{ SUMBER_DATA[s] }} ({{ sumberCounts[s] ?? 0 }})</option>
          </select>
        </label>
        <label class="flex items-center gap-2">
          <span class="font-medium text-slate-600">Tag</span>
          <input
            :value="tagTeks"
            list="katalog-tag"
            placeholder="Ketik atau pilih tag…"
            class="w-56 rounded-lg border border-slate-300 bg-slate-50 px-3 py-2 text-[13px] text-slate-700 focus:border-[#ed6b23] focus:bg-white"
            @input="ketikTag(($event.target as HTMLInputElement).value)"
          />
          <datalist id="katalog-tag">
            <option v-for="[t, n] in tagOptions" :key="t" :value="t">{{ `${n} dataset` }}</option>
          </datalist>
        </label>
        <button
          v-if="tag || sumber !== 'all'"
          type="button"
          class="self-start sm:self-auto text-[13px] font-medium hover:underline"
          :style="{ color: LINK }"
          @click="hapusFilter"
        >
          Hapus filter
        </button>
      </div>
      </div>
    </div>

    <section class="mx-auto max-w-[1320px] px-6 py-6 pb-20">
      <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div class="overflow-x-auto">
          <table class="w-full text-[14px] border-collapse">
            <thead>
              <tr :style="{ background: NAVY }" class="text-white text-left text-[12px] uppercase tracking-wider">
                <th class="px-4 py-3 font-semibold w-12">#</th>
                <th class="px-4 py-3 font-semibold">Nama Dataset</th>
                <th class="px-4 py-3 font-semibold hidden md:table-cell">Tag</th>
                <th class="px-4 py-3 font-semibold w-32">Lapisan</th>
                <th class="px-4 py-3 font-semibold w-48">Sumber</th>
                <th class="px-4 py-3 font-semibold text-right w-32 hidden sm:table-cell">Ukuran</th>
                <th class="px-4 py-3 font-semibold w-28 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody>
              <tr v-for="(r, i) in filtered" :key="r.id" class="border-t border-slate-100 hover:bg-slate-50 transition-colors align-top">
                <td class="px-4 py-3 text-slate-400 tabular-nums">{{ i + 1 }}</td>
                <td class="px-4 py-3">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-medium text-slate-900">{{ r.title }}</span>
                    <DatasetTierBadge :tier="r.tier" />
                  </div>
                  <div v-if="r.description" class="text-[13px] text-slate-500 mt-0.5 max-w-[60ch] line-clamp-2">{{ r.description }}</div>
                </td>
                <td class="px-4 py-3 hidden md:table-cell">
                  <div class="flex flex-wrap gap-1 max-w-[220px]">
                    <button
                      v-for="t in r.tags.slice(0, 4)"
                      :key="t"
                      type="button"
                      :title="`Tampilkan dataset bertag &quot;${t}&quot;`"
                      class="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
                      @click="pilihTag(t)"
                    >{{ t }}</button>
                  </div>
                </td>
                <td class="px-4 py-3"><DatasetMedalBadge :info="r.medallion" /></td>
                <td class="px-4 py-3"><span class="text-[13px] text-slate-600">{{ r.source }}</span></td>
                <td class="px-4 py-3 text-right tabular-nums text-slate-600 hidden sm:table-cell">{{ r.size_label }}</td>
                <td class="px-4 py-3 text-center">
                  <a
                    v-if="r.external"
                    :href="r.href"
                    target="_blank"
                    rel="noreferrer"
                    :style="{ color: LINK }"
                    class="text-[13px] font-medium hover:underline whitespace-nowrap"
                  >Lihat data ↗</a>
                  <NuxtLink v-else :to="r.href" :style="{ color: LINK }" class="text-[13px] font-medium hover:underline whitespace-nowrap">Lihat data →</NuxtLink>
                </td>
              </tr>
              <tr v-if="filtered.length === 0">
                <td colspan="7" class="px-4 py-12 text-center text-slate-400">Tidak ada dataset yang cocok.</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <p class="text-[12px] text-slate-400 mt-4">
        <span class="inline-flex items-center gap-1.5 mr-4">
          <DatasetTierBadge tier="primer" /> = Satu Data Jakarta (
          <a :href="SDI_PORTAL" target="_blank" rel="noreferrer" class="underline" :style="{ color: LINK }">satudata.jakarta.go.id</a>
          )
        </span>
        <span class="inline-flex items-center gap-1.5"><DatasetTierBadge tier="sekunder" /> = data sekunder pariwisata dan ekonomi kreatif</span>
      </p>

      <div class="mt-6 rounded-xl border border-slate-200 bg-white p-5">
        <div class="text-[13px] font-semibold text-slate-800">Lapisan data (arsitektur medallion lakehouse)</div>
        <p class="text-[12.5px] text-slate-500 mt-1 max-w-[95ch]">
          Setiap dataset melewati tiga lapisan di lakehouse Dinas. Label pada kolom <em>Lapisan</em> menunjukkan lapisan tertinggi
          yang sudah dicapai dataset tersebut.
        </p>
        <div class="mt-4 grid gap-3 sm:grid-cols-3">
          <div v-for="lvl in LEVEL" :key="lvl" class="rounded-lg border border-slate-200 px-4 py-3">
            <div class="flex items-center gap-2">
              <DatasetMedalBadge :info="{ level: lvl }" />
              <span class="text-[12px] text-slate-400 tabular-nums">{{ medalCounts[lvl] }} dataset</span>
            </div>
            <div class="text-[12.5px] text-slate-600 mt-2 leading-relaxed">{{ PENJELASAN_LAPISAN[lvl] }}</div>
          </div>
        </div>
        <p class="text-[12px] text-slate-400 mt-3">Dataset yang belum tersalin ke lakehouse tidak diberi label lapisan.</p>
      </div>
    </section>
  </main>
</template>
