<script setup lang="ts">
/**
 * /scraped-hotels (app/scraped-hotels/page.tsx, berbahasa Inggris seperti v2). Data dari Bronze
 * `booking_hotel_2026_09_15` lewat `hotel-scraped` (SPEC P5), jadi halaman ini berisi sementara
 * produksi kosong. Klik baris membuka tipe kamar.
 */
import { AlertTriangle, Bed, ChevronDown, ChevronUp, Coffee, Database, ExternalLink, MapPin, RefreshCw, Star } from "lucide-vue-next";

type RoomType = {
  name: string;
  beds?: string;
  price_min_idr: number;
  price_max_idr: number;
  breakfast_included: boolean;
  cancellation?: string;
  rate_count: number;
};
type Row = {
  hotel_id: string;
  hotel_name: string;
  hotel_url: string;
  address: string;
  city: string;
  distance_km: number | null;
  star_rating: number | null;
  review_score: number | null;
  review_label: string;
  review_count: number | null;
  price_idr: number | null;
  rooms_left: number | null;
  total_room_types: number | null;
  room_types: RoomType[];
  is_available: number;
};
type Stats = {
  total: number;
  with_address: number;
  with_rooms_left: number;
  total_room_types: number;
  avg_price: number | null;
  min_price: number | null;
  max_price: number | null;
  avg_room_types_per_hotel: number;
};

const fmtIDR = (n: number | null) => (n == null ? "—" : "Rp " + n.toLocaleString("id-ID"));
const fmtN = (n: number | null) => (n == null ? "—" : n.toLocaleString("id-ID"));

const { hotelScraped } = useGmti();
const rows = shallowRef<Row[]>([]);
const stats = shallowRef<Stats | null>(null);
const lastCheckin = ref<string | null>(null);
const loading = ref(true);
const error = ref<string | null>(null);
const expanded = ref<string | null>(null);

async function fetchData() {
  loading.value = true;
  error.value = null;
  try {
    const j = await hotelScraped();
    rows.value = j.rows ?? [];
    stats.value = j.stats ?? null;
    lastCheckin.value = j.last_checkin ?? null;
  } catch (e) {
    error.value = e instanceof Error ? e.message : String(e);
  } finally {
    loading.value = false;
  }
}
onMounted(fetchData);

const priceHistogram = computed(() => {
  const buckets = [
    { name: "<500K", min: 0, max: 500_000, count: 0 },
    { name: "500K-1M", min: 500_000, max: 1_000_000, count: 0 },
    { name: "1M-2M", min: 1_000_000, max: 2_000_000, count: 0 },
    { name: "2M-5M", min: 2_000_000, max: 5_000_000, count: 0 },
    { name: "5M+", min: 5_000_000, max: Infinity, count: 0 },
  ];
  for (const r of rows.value) {
    if (r.price_idr == null) continue;
    const b = buckets.find((b) => r.price_idr! >= b.min && r.price_idr! < b.max);
    if (b) b.count++;
  }
  return {
    tooltip: { trigger: "axis" },
    grid: { left: 8, right: 16, top: 18, bottom: 8, containLabel: true },
    xAxis: { type: "category", data: buckets.map((b) => b.name) },
    yAxis: { type: "value" },
    series: [{ type: "bar", data: buckets.map((b) => b.count), itemStyle: { color: "#ed6b23", borderRadius: [4, 4, 0, 0] }, barMaxWidth: 60 }],
  };
});
const scatterScorePrice = computed(() => ({
  tooltip: {
    trigger: "item",
    formatter: (p: unknown) => {
      const o = p as { value: [number, number, string] };
      return `${o.value[2]}<br/>Score: ${o.value[0]} · ${fmtIDR(o.value[1])}`;
    },
  },
  grid: { left: 8, right: 16, top: 18, bottom: 36, containLabel: true },
  xAxis: { type: "value", name: "Review score", min: 5, max: 10, nameLocation: "middle", nameGap: 24 },
  yAxis: {
    type: "value",
    name: "Price (IDR)",
    nameLocation: "middle",
    nameGap: 50,
    axisLabel: { formatter: (v: number) => (v >= 1_000_000 ? `${(v / 1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)) },
  },
  series: [
    {
      type: "scatter",
      data: rows.value.filter((r) => r.review_score != null && r.price_idr != null).map((r) => [r.review_score!, r.price_idr!, r.hotel_name]),
      symbolSize: 12,
      itemStyle: { color: "#ed6b23", opacity: 0.75, borderColor: "#fff", borderWidth: 1 },
    },
  ],
}));
const statList = computed(() => {
  const s = stats.value!;
  return [
    { label: "Hotels", value: fmtN(s.total), tone: "orange" },
    { label: "Room types", value: fmtN(s.total_room_types), subtitle: `~${s.avg_room_types_per_hotel} per hotel` },
    { label: "With rooms left", value: `${s.with_rooms_left}/${s.total}` },
    { label: "With address", value: `${s.with_address}/${s.total}` },
    { label: "Avg price", value: fmtIDR(s.avg_price) },
    { label: "Price range", value: `${fmtIDR(s.min_price)} – ${fmtIDR(s.max_price)}` },
  ];
});
const toggle = (id: string) => (expanded.value = expanded.value === id ? null : id);
</script>

<template>
  <main class="min-h-screen bg-[color:var(--canvas,#fff)]">
    <div style="background: #fff7ed; border-bottom: 1px solid #fed7aa">
      <div class="mx-auto max-w-[1320px] px-6 py-3 flex items-start gap-3">
        <AlertTriangle class="size-4 text-amber-600 shrink-0 mt-0.5" />
        <div class="text-[13px] text-amber-900">
          <strong>POC research data</strong> — scraped from Booking.com public search with strict safeguards (robots.txt, rate-limit, abort-on-block,
          Jakarta-only filter).
          <span class="text-amber-700"> Exit-strategy: Booking Demand API. </span>
          <a class="underline text-amber-800" href="https://github.com/anomalyco/opencode" target="_blank" rel="noopener">
            Read README in scripts/scrapers/booking-jakarta/
          </a>
        </div>
      </div>
    </div>
    <div class="mx-auto max-w-[1320px] px-6 py-8">
      <div class="flex items-center justify-between mb-6">
        <div>
          <h1 class="text-[26px] font-semibold tracking-tight text-gray-900 flex items-center gap-3">
            <Database class="size-6 text-orange-500" />
            Hotel Availability — Jakarta (POC)
          </h1>
          <p class="text-[13px] text-gray-500 mt-1">Snapshot from Booking.com public search · {{ lastCheckin ? `check-in ${lastCheckin}` : "—" }}</p>
        </div>
        <button
          :disabled="loading"
          class="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-[13px] font-medium hover:bg-gray-50 disabled:opacity-50"
          @click="fetchData"
        >
          <RefreshCw :class="loading ? 'size-4 animate-spin' : 'size-4'" />
          Refresh
        </button>
      </div>
      <div v-if="error" class="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">{{ error }}</div>
      <div v-if="stats" class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <div v-for="s in statList" :key="s.label" class="rounded-lg border border-gray-200 bg-white p-3">
          <div class="text-[10.5px] uppercase tracking-wide text-gray-500 font-medium">{{ s.label }}</div>
          <div :class="`text-[18px] font-semibold tabular-nums mt-0.5 ${s.tone === 'orange' ? 'text-orange-600' : 'text-gray-900'}`">{{ s.value }}</div>
          <div v-if="s.subtitle" class="text-[10.5px] text-gray-400 mt-0.5">{{ s.subtitle }}</div>
        </div>
      </div>
      <div class="grid md:grid-cols-2 gap-4 mb-6">
        <div
          v-for="c in [
            { t: 'Price distribution', k: 'cheapest rate per hotel', o: priceHistogram },
            { t: 'Score vs price', k: 'bubble = hotel', o: scatterScorePrice },
          ]"
          :key="c.t"
          class="rounded-xl border border-gray-200 bg-white p-4"
        >
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-[13px] font-semibold text-gray-900">{{ c.t }}</h3>
            <span class="atlas-mono text-[10.5px] text-gray-400 uppercase">{{ c.k }}</span>
          </div>
          <ClientOnly><EChart :option="c.o" :height="240" /></ClientOnly>
        </div>
      </div>
      <div class="space-y-3">
        <div class="flex items-center justify-between px-1">
          <h3 class="text-[13px] font-semibold text-gray-900">Hotels ({{ rows.length }})</h3>
          <span class="atlas-mono text-[10.5px] text-gray-400 uppercase">sorted by review score</span>
        </div>
        <div v-if="loading && rows.length === 0" class="px-4 py-8 text-center text-gray-400">Loading…</div>
        <div v-else-if="rows.length === 0" class="px-4 py-8 text-center text-gray-400 border border-gray-200 rounded-xl bg-white">
          No data yet. Run the scraper: <code class="text-orange-600">cd scripts/scrapers/booking-jakarta &amp;&amp; bun run start</code>
        </div>
        <div v-for="r in rows" v-else :key="r.hotel_id" class="rounded-xl border border-gray-200 bg-white overflow-hidden">
          <div class="grid grid-cols-12 gap-4 items-center px-4 py-3 hover:bg-gray-50">
            <button class="col-span-12 md:col-span-5 flex items-start gap-3 text-left" @click="toggle(r.hotel_id)">
              <ChevronUp v-if="expanded === r.hotel_id" class="size-4 text-gray-400 mt-1 shrink-0" />
              <ChevronDown v-else class="size-4 text-gray-400 mt-1 shrink-0" />
              <div class="min-w-0">
                <a
                  :href="r.hotel_url"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="text-gray-900 font-semibold hover:text-orange-600 inline-flex items-center gap-1.5 text-[14px]"
                >
                  <span class="truncate">{{ r.hotel_name }}</span>
                  <ExternalLink class="size-3 text-gray-400 shrink-0" />
                </a>
                <div class="text-[11.5px] text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
                  <span class="inline-flex items-center gap-1"><MapPin class="size-3" />{{ r.city }}</span>
                  <span v-if="r.distance_km != null">· {{ r.distance_km }} km from center</span>
                  <span v-if="r.total_room_types != null">· {{ r.total_room_types }} room types</span>
                  <span v-if="r.rooms_left != null" class="inline-flex items-center gap-1 text-amber-600"><Bed class="size-3" /> {{ r.rooms_left }} left</span>
                </div>
              </div>
            </button>
            <div class="col-span-6 md:col-span-2 flex items-center gap-1.5">
              <span v-if="r.star_rating" class="inline-flex items-center gap-0.5 text-amber-500">
                <Star v-for="i in r.star_rating" :key="i" class="size-3 fill-current" />
              </span>
              <span v-else class="text-gray-300 text-[12px]">—</span>
            </div>
            <div class="col-span-6 md:col-span-1">
              <div class="flex items-baseline gap-1.5">
                <span class="font-medium tabular-nums text-gray-900 text-[13px]">{{ r.review_score ?? "—" }}</span>
                <span v-if="r.review_label" class="text-[10.5px] text-gray-500">· {{ r.review_label }}</span>
              </div>
              <div class="text-[10px] text-gray-400">{{ fmtN(r.review_count) }} reviews</div>
            </div>
            <div class="col-span-12 md:col-span-3 text-right">
              <div class="font-semibold tabular-nums text-gray-900 text-[14px]">{{ fmtIDR(r.price_idr) }}</div>
              <div class="text-[10.5px] text-gray-500">cheapest rate / night</div>
            </div>
            <div class="col-span-12 md:col-span-1 text-right">
              <span v-if="r.is_available" class="inline-block text-[10.5px] text-emerald-600 font-medium">available</span>
              <span v-else class="inline-block text-[10.5px] text-red-500 font-medium">sold out</span>
            </div>
          </div>
          <div v-if="expanded === r.hotel_id" class="border-t border-gray-100 bg-gray-50 px-4 py-4">
            <div v-if="r.address" class="text-[12px] text-gray-600 mb-3 flex items-start gap-1.5">
              <MapPin class="size-3.5 mt-0.5 shrink-0 text-gray-400" />
              <span>{{ r.address }}</span>
            </div>
            <div v-if="r.room_types.length === 0" class="text-[12px] text-gray-400 italic">No room detail captured (page may have been rate-limited).</div>
            <div v-else class="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <div class="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                <span class="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">{{ r.room_types.length }} room types</span>
                <span class="text-[10.5px] text-gray-400">price = min/max across all rates found</span>
              </div>
              <table class="w-full text-[12.5px]">
                <thead class="bg-gray-50 border-b border-gray-200">
                  <tr class="text-left text-[10.5px] uppercase tracking-wide text-gray-500">
                    <th class="px-3 py-2 font-medium">Room type</th>
                    <th class="px-3 py-2 font-medium">Beds</th>
                    <th class="px-3 py-2 font-medium">Features</th>
                    <th class="px-3 py-2 font-medium text-right">Price / night</th>
                    <th class="px-3 py-2 font-medium text-right">Rates</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-100">
                  <tr v-for="(rt, i) in r.room_types" :key="i" class="hover:bg-gray-50">
                    <td class="px-3 py-2.5 max-w-[240px]"><div class="font-medium text-gray-900">{{ rt.name }}</div></td>
                    <td class="px-3 py-2.5 text-gray-600 max-w-[200px]">
                      <span v-if="rt.beds" class="inline-flex items-center gap-1.5 text-[11.5px]">
                        <Bed class="size-3 text-gray-400" />
                        <span class="line-clamp-2">{{ rt.beds }}</span>
                      </span>
                      <template v-else>—</template>
                    </td>
                    <td class="px-3 py-2.5">
                      <div class="flex items-center gap-1.5 flex-wrap">
                        <span
                          v-if="rt.breakfast_included"
                          class="inline-flex items-center gap-1 text-[10.5px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200"
                        >
                          <Coffee class="size-2.5" /> breakfast
                        </span>
                        <span
                          v-if="rt.cancellation === 'free_cancellation'"
                          class="inline-flex items-center gap-1 text-[10.5px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200"
                          >free cancel</span
                        >
                        <span
                          v-if="rt.cancellation === 'non_refundable'"
                          class="inline-flex items-center gap-1 text-[10.5px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200"
                          >non-refundable</span
                        >
                        <span v-if="!rt.breakfast_included && !rt.cancellation" class="text-[11px] text-gray-400">—</span>
                      </div>
                    </td>
                    <td class="px-3 py-2.5 text-right tabular-nums">
                      <div class="font-medium text-gray-900">{{ fmtIDR(rt.price_min_idr) }}</div>
                      <div v-if="rt.price_min_idr !== rt.price_max_idr" class="text-[10.5px] text-gray-400">– {{ fmtIDR(rt.price_max_idr) }}</div>
                    </td>
                    <td class="px-3 py-2.5 text-right tabular-nums text-gray-600">{{ rt.rate_count }}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  </main>
</template>
