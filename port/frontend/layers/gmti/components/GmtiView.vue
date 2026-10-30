<script setup lang="ts">
/**
 * GMTI — Jakarta Ramah Muslim (components/GmtiView.tsx). Hero, statistik, dan sebaran dari
 * `gmti/ringkasan`; daftar 8.666 tempat berhalaman server (`gmti/tempat`, 200 per halaman, KONTRAK
 * §2.5) menggantikan filter di browser. Opsi wilayah/jenis = `facets` pool tab. Ekspor mengambil
 * semua halaman hasil filter (v2: semua hasil filter).
 */
import type { ExportFormat } from "../../shared/composables/useSpreadsheetExport";
import type { GmtiRingkasan, GmtiTempat, Pilar } from "../composables/useGmti";

const props = defineProps<{ ringkasan: GmtiRingkasan }>();

const PAGE = 200;
type TabId = Pilar | "semua";
const { tempat } = useGmti();
const pilar = computed(() => Object.fromEntries(props.ringkasan.pillars.map((p) => [p.id, p])) as Record<Pilar, GmtiRingkasan["pillars"][number]>);
const tabs = computed<TabId[]>(() => ["semua", ...props.ringkasan.pillars.map((p) => p.id)]);
const tabLabel = (t: TabId) => (t === "semua" ? "Semua" : pilar.value[t].label);
const needsIbadah = (t: TabId) => t === "ibadah" || t === "semua";

const tab = ref<TabId>("semua");
const query = ref("");
const q = ref("");
const city = ref("All");
const kind = ref("All");
const viewMode = ref<"grid" | "table">("grid");
const items = shallowRef<GmtiTempat[]>([]);
const total = ref(0);
const facets = shallowRef<{ kota: string[]; jenis: string[] }>({ kota: [], jenis: [] });
const loading = ref(false);
const loadError = ref<string | null>(null);

let tunda: ReturnType<typeof setTimeout> | undefined;
watch(query, (v) => {
  clearTimeout(tunda);
  tunda = setTimeout(() => (q.value = v.trim()), 300);
});

const filter = (page: number, size = PAGE) => ({
  page: String(page),
  size: String(size),
  pilar: tab.value,
  kota: city.value === "All" ? undefined : city.value,
  jenis: kind.value === "All" ? undefined : kind.value,
  q: q.value || undefined,
});
let nomor = 0;
async function muat(lanjut: boolean) {
  const ini = ++nomor;
  loading.value = true;
  loadError.value = null;
  try {
    const r = await tempat(filter(lanjut ? items.value.length / PAGE + 1 : 1));
    if (ini !== nomor) return;
    items.value = lanjut ? [...items.value, ...r.items] : r.items;
    total.value = r.total;
    facets.value = r.facets;
  } catch (err) {
    if (ini === nomor) loadError.value = `Gagal memuat daftar tempat (${String(err)}). Muat ulang halaman untuk mencoba lagi.`;
  } finally {
    if (ini === nomor) loading.value = false;
  }
}
watch([tab, q, city, kind], () => muat(false));
onMounted(() => muat(false));

function pilihTab(t: TabId) {
  tab.value = t;
  city.value = "All";
  kind.value = "All";
}
const selects = computed(() => [
  { model: city, options: [{ id: "All", label: "Semua wilayah" }, ...facets.value.kota.map((c) => ({ id: c, label: c }))] },
  { model: kind, options: [{ id: "All", label: "Semua jenis" }, ...facets.value.jenis.map((k) => ({ id: k, label: k }))] },
]);
const topKecamatan = computed(() => props.ringkasan.kecamatan.slice(0, 6));
const m = computed(() => props.ringkasan.meta);
const snapshotDate = (iso: string) => {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString("id-ID", { day: "numeric", month: "long", year: "numeric" });
};
const badgeStyle = (p: Pilar) => ({ background: `${pilar.value[p].color}1a`, color: pilar.value[p].color });
const wilayah = (p: GmtiTempat) => [p.district, p.city].filter(Boolean).join(" · ") || "—";
const noCoord = (p: GmtiTempat) => p.lat == null || p.lon == null;

const { downloadSpreadsheet, dateStamp } = useSpreadsheetExport();
async function exportGmti(format: ExportFormat) {
  const semua: GmtiTempat[] = [];
  for (let page = 1; semua.length < total.value; page++) {
    const r = await tempat(filter(page));
    if (r.items.length === 0) break;
    semua.push(...r.items);
  }
  await downloadSpreadsheet<GmtiTempat>(
    `jakarta-atlas-gmti-${tab.value}-${dateStamp()}`,
    semua,
    [
      { header: "No", value: (_p, i) => i + 1 },
      { header: "Nama", value: (p) => p.name },
      { header: "Pilar", value: (p) => pilar.value[p.pillar].label },
      { header: "Jenis/Tipologi", value: (p) => p.kind },
      { header: "Sumber Dataset", value: (p) => p.dataset },
      { header: "Alamat", value: (p) => p.address ?? "" },
      { header: "Kota Administrasi", value: (p) => p.city ?? "" },
      { header: "Kecamatan", value: (p) => p.district ?? "" },
      { header: "Lintang", value: (p) => p.lat ?? "" },
      { header: "Bujur", value: (p) => p.lon ?? "" },
      { header: "No Sertifikat Halal", value: (p) => p.cert ?? "" },
      { header: "Catatan", value: (p) => p.note ?? "" },
    ],
    format,
    "GMTI",
  );
}
const SEL =
  "appearance-none press-scale bg-canvas border border-hairline rounded-full h-9 pl-4 pr-9 apple-caption text-ink-muted-80 hover:text-ink focus:outline-none focus:border-primary-focus transition-colors cursor-pointer max-w-[240px] truncate";
</script>

<template>
  <main class="min-h-screen bg-canvas">
    <section class="bg-canvas">
      <div class="mx-auto max-w-[1280px] px-6 py-[80px] md:py-[120px] text-center">
        <p class="apple-caption-strong text-ink-muted-80">Data sekunder · Wisata ramah muslim (GMTI)</p>
        <h1 class="apple-hero apple-title-tight mt-3 text-ink">
          Jakarta ramah muslim,<br />
          <span class="text-ink-muted-48">satu direktori terpadu.</span>
        </h1>
        <p class="apple-lead mt-6 max-w-[820px] mx-auto">
          Data Pariwisata Ramah Muslim di Provinsi DKI Jakarta : Masjid &amp; Musala, Kuliner Halal, Restoran Halal, Mall &amp; Hotel dengan fasilitas
          ramah muslim, Rumah Pemotongan Hewan bersertifikasi Halal, Destinasi Sejarah Islam.
        </p>
        <p v-if="ringkasan.award" class="apple-caption text-ink-muted-80 mt-6 max-w-[720px] mx-auto">
          {{ ringkasan.award.nama }}{{ ringkasan.award.pemberi ? ` — ${ringkasan.award.pemberi}` : "" }}
        </p>
        <div class="mt-9 flex items-center justify-center gap-4">
          <a href="#directory" class="press-scale pill-primary">Lihat daftar</a>
          <a href="/spatial" class="press-scale pill-secondary">Buka Spatial</a>
        </div>
      </div>
    </section>
    <section class="bg-parchment border-y border-hairline">
      <div class="mx-auto max-w-[1280px] px-6 py-[64px] md:py-[80px] grid grid-cols-2 md:grid-cols-4 gap-y-10 gap-x-6 text-center">
        <div
          v-for="[n, l] in [
            [m.masjid, 'Masjid terdaftar'],
            [m.mushalla, 'Mushalla terdaftar'],
            [m.halal_total, 'Tempat ekosistem halal'],
            [m.kecamatan, 'Kecamatan terliput'],
          ] as const"
          :key="l"
        >
          <div class="apple-hero apple-title-tight text-ink tabular">{{ idNum(n) }}</div>
          <div class="apple-caption text-ink-muted-80 mt-1.5">{{ l }}</div>
        </div>
      </div>
    </section>
    <section class="mx-auto max-w-[1280px] px-6 pt-14">
      <div class="grid md:grid-cols-2 gap-8">
        <div>
          <h2 class="apple-tagline apple-title-tight text-ink">Kecamatan terpadat fasilitas ibadah</h2>
          <ul class="mt-4 space-y-2.5">
            <li v-for="a in topKecamatan" :key="`${a.kota}-${a.kecamatan}`" class="flex items-center gap-3">
              <span class="apple-caption text-ink w-[150px] shrink-0 truncate">{{ a.kecamatan }}</span>
              <span class="flex-1 h-2 bg-parchment rounded-full overflow-hidden">
                <span class="block h-full rounded-full" :style="{ width: `${(a.total / topKecamatan[0]!.total) * 100}%`, background: pilar.ibadah.color }" />
              </span>
              <span class="apple-caption tabular text-ink-muted-80 w-[52px] text-right">{{ idNum(a.total) }}</span>
            </li>
          </ul>
          <a href="/spatial" class="press-scale link-blue apple-caption mt-4 inline-block">Lihat sebaran seluruh {{ m.kecamatan }} kecamatan di Spatial ↗</a>
        </div>
        <div>
          <h2 class="apple-tagline apple-title-tight text-ink">Menurut tipologi</h2>
          <ul class="mt-4 grid grid-cols-2 gap-x-6 gap-y-2.5">
            <li v-for="t in ringkasan.tipologi" :key="t.tipologi" class="flex items-baseline justify-between gap-3">
              <span class="apple-caption text-ink-muted-80 truncate">{{ t.tipologi }}</span>
              <span class="apple-caption-strong tabular text-ink">{{ idNum(t.count) }}</span>
            </li>
          </ul>
        </div>
      </div>
    </section>
    <section id="filters" class="sticky top-[56px] z-10 frosted mt-12">
      <div class="mx-auto max-w-[1280px] px-6 py-3 space-y-3">
        <div class="flex items-center gap-2">
          <div class="relative flex-1 min-w-0">
            <svg viewBox="0 0 24 24" class="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-ink-muted-48" aria-hidden="true">
              <path
                fill="currentColor"
                d="M10 18a8 8 0 1 1 5.293-1.707l4.207 4.207-1.414 1.414-4.207-4.207A7.96 7.96 0 0 1 10 18zm0-2a6 6 0 1 0 0-12 6 6 0 0 0 0 12z"
              />
            </svg>
            <input
              v-model="query"
              placeholder="Cari nama, alamat, kecamatan, atau nomor sertifikat…"
              class="w-full bg-canvas border border-hairline rounded-lg pl-11 pr-20 h-10 text-[14px] placeholder:text-ink-muted-48 focus:outline-none focus:border-[color:var(--accent)] focus:ring-2 focus:ring-[color:var(--accent-ring)] transition-all"
            />
            <span class="absolute right-3 top-1/2 -translate-y-1/2 apple-caption tabular text-ink-muted-48">{{ idNum(total) }}</span>
          </div>
          <div class="inline-flex p-0.5 bg-canvas border border-hairline rounded-full">
            <button
              v-for="v in ['grid', 'table'] as const"
              :key="v"
              :class="`press-scale rounded-full px-3 py-1 apple-caption-strong ${viewMode === v ? 'bg-ink text-white' : 'text-ink-muted-80 hover:text-ink'}`"
              @click="viewMode = v"
            >
              {{ v === "grid" ? "Kartu" : "Tabel" }}
            </button>
          </div>
          <ExportButton :on-export="exportGmti" label="Unduh" />
        </div>
        <div class="flex flex-wrap items-center gap-2">
          <div class="inline-flex p-1 bg-canvas border border-hairline rounded-full flex-wrap">
            <button
              v-for="t in tabs"
              :key="t"
              :class="`press-scale rounded-full px-3 py-1 apple-caption ${tab === t ? 'bg-primary text-white' : 'text-ink-muted-80 hover:text-ink'}`"
              @click="pilihTab(t)"
            >
              {{ tabLabel(t) }}
            </button>
          </div>
          <span class="hidden md:inline-block h-5 w-px bg-hairline mx-1" />
          <div v-for="(s, i) in selects" :key="i" class="relative">
            <select v-model="s.model.value" :class="SEL">
              <option v-for="o in s.options" :key="o.id" :value="o.id">{{ o.label }}</option>
            </select>
            <svg viewBox="0 0 24 24" class="absolute right-3 top-1/2 -translate-y-1/2 h-3 w-3 text-ink-muted-48 pointer-events-none" aria-hidden="true">
              <path fill="currentColor" d="M7 10l5 5 5-5z" />
            </svg>
          </div>
        </div>
      </div>
    </section>
    <section id="directory" class="mx-auto max-w-[1280px] px-6 py-12">
      <p v-if="tab !== 'semua'" class="apple-caption text-ink-muted-80 mb-6">{{ pilar[tab].desc }}</p>
      <div v-if="loadError" class="border border-hairline rounded-apple_lg bg-parchment p-6 mb-6">
        <p class="apple-caption text-ink">{{ loadError }}</p>
      </div>
      <p v-if="loading && items.length === 0 && needsIbadah(tab)" class="apple-caption text-ink-muted-48 py-16 text-center">
        Memuat {{ idNum(m.ibadah_total) }} fasilitas ibadah…
      </p>
      <div v-if="!loading && items.length === 0" class="text-center py-24">
        <p class="apple-tagline text-ink">Tidak ada yang cocok</p>
        <p class="apple-caption text-ink-muted-48 mt-2">Coba longgarkan filter atau kosongkan kolom pencarian.</p>
      </div>
      <ul v-else-if="viewMode === 'grid'" class="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
        <li v-for="p in items" :key="p.id" class="utility-card bg-canvas border border-hairline rounded-apple_lg p-6 flex flex-col">
          <div class="flex items-center justify-between gap-2">
            <p class="apple-caption-strong text-primary tracking-[0.06em] text-[11px] uppercase truncate">{{ p.kind }}</p>
            <span class="shrink-0 apple-fine uppercase tracking-wider px-1.5 py-0.5 rounded" :style="badgeStyle(p.pillar)">{{ pilar[p.pillar].label }}</span>
          </div>
          <h3 class="apple-tagline apple-title-tight text-ink mt-1.5 leading-[1.15]">{{ p.name }}</h3>
          <p class="apple-caption text-ink-muted-48 mt-1">{{ wilayah(p) }}</p>
          <p v-if="p.address" class="apple-caption text-ink-muted-80 mt-3 line-clamp-2">{{ p.address }}</p>
          <p v-if="p.note" class="apple-caption text-ink-muted-80 mt-3 line-clamp-3">{{ p.note }}</p>
          <p v-if="p.cert" class="apple-fine text-ink-muted-48 mt-3">Sertifikat halal: <span class="tabular">{{ p.cert }}</span></p>
          <p v-if="noCoord(p)" class="apple-fine text-ink-muted-48 mt-3 italic">Titik peta belum diverifikasi — tidak ditampilkan di peta.</p>
          <div class="mt-auto pt-5 flex items-center justify-between gap-4">
            <a :href="p.maps_url" target="_blank" rel="noopener noreferrer" class="press-scale link-blue apple-caption-strong inline-flex items-center gap-1">
              {{ noCoord(p) ? "Cari di Maps" : "Buka di Maps" }} <span aria-hidden="true">↗</span>
            </a>
            <span class="apple-fine text-ink-muted-48 truncate">{{ p.dataset }}</span>
          </div>
        </li>
      </ul>
      <div v-else class="overflow-x-auto border border-hairline rounded-apple_lg bg-canvas">
        <table class="w-full text-left border-collapse min-w-[860px]">
          <thead>
            <tr class="border-b border-hairline bg-parchment">
              <th v-for="h in ['Nama', 'Jenis', 'Wilayah', 'Pilar', 'Sumber']" :key="h" class="apple-caption-strong text-ink-muted-80 px-4 py-3">{{ h }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="p in items" :key="p.id" class="border-b border-hairline last:border-0">
              <td class="px-4 py-3 apple-caption-strong text-ink">
                <a :href="p.maps_url" target="_blank" rel="noopener noreferrer" class="link-blue">{{ p.name }}</a>
              </td>
              <td class="px-4 py-3 apple-caption text-ink-muted-80">{{ p.kind }}</td>
              <td class="px-4 py-3 apple-caption text-ink-muted-80">{{ wilayah(p) }}</td>
              <td class="px-4 py-3">
                <span class="shrink-0 apple-fine uppercase tracking-wider px-1.5 py-0.5 rounded" :style="badgeStyle(p.pillar)">{{ pilar[p.pillar].label }}</span>
              </td>
              <td class="px-4 py-3 apple-caption text-ink-muted-48">{{ p.dataset }}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <div v-if="total > items.length && items.length > 0" class="mt-10 text-center">
        <button class="press-scale pill-secondary" :disabled="loading" @click="muat(true)">
          Tampilkan {{ idNum(Math.min(PAGE, total - items.length)) }} lagi
          <span class="text-ink-muted-48"> · {{ idNum(items.length) }}/{{ idNum(total) }}</span>
        </button>
      </div>
    </section>
    <section class="border-t border-hairline bg-parchment">
      <div class="mx-auto max-w-[1280px] px-6 py-12 grid md:grid-cols-2 gap-8">
        <div>
          <h2 class="apple-caption-strong text-ink">Sumber data</h2>
          <p class="apple-caption text-ink-muted-80 mt-2">
            Fasilitas ibadah:
            <a :href="m.source_url" target="_blank" rel="noopener noreferrer" class="link-blue">{{ m.source }} ↗</a>
            — seluruh tipologi masjid &amp; mushalla Provinsi DKI Jakarta, snapshot {{ snapshotDate(m.fetched_at) }}. Ekosistem halal: dataset sekunder
            Dispar yang tayang di katalog <a href="/sdi" class="link-blue">/sdi</a>.
          </p>
        </div>
        <div>
          <h2 class="apple-caption-strong text-ink">Yang perlu diketahui</h2>
          <ul class="apple-caption text-ink-muted-80 mt-2 space-y-1.5 list-disc pl-4">
            <li>SIMAS adalah data <em>registrasi</em> Kemenag, bukan sensus lapangan — fasilitas yang belum didaftarkan tidak muncul.</li>
            <li>
              SIMAS tidak menyediakan koordinat. {{ idNum(m.ibadah_berkoordinat) }} titik diperoleh melalui pencarian alamat;
              {{ idNum(m.ibadah_non_signature) }} fasilitas lingkungan (Masjid Jami &amp; Mushalla Perumahan) tidak dipetakan karena alamatnya kurang spesifik.
            </li>
            <li>Pengelompokan pilar di halaman ini merupakan penataan data Dispar — GMTI resmi menilai di tingkat negara/destinasi, bukan per fasilitas.</li>
          </ul>
        </div>
      </div>
    </section>
  </main>
</template>
