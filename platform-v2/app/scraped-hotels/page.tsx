"use client";

import * as React from "react";
import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { RefreshCw, AlertTriangle, Database, ExternalLink, MapPin, Star, Bed, Coffee, X, ChevronDown, ChevronUp } from "lucide-react";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

type RoomType = {
  name: string;
  beds?: string;
  sleeps?: string;
  price_min_idr: number;
  price_max_idr: number;
  price_raw_min: string;
  price_raw_max: string;
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
  country: string;
  latitude: number | null;
  longitude: number | null;
  distance_km: number | null;
  star_rating: number | null;
  review_score: number | null;
  review_label: string;
  review_count: number | null;
  price_idr: number | null;
  price_currency: string;
  price_raw: string;
  rooms_left: number | null;
  total_room_types: number | null;
  room_types: RoomType[];
  is_available: number;
  checkin: string;
  checkout: string;
  adults: number;
  scraped_at: string;
  source: string;
};

type Stats = {
  total: number;
  with_coords: number;
  with_address: number;
  with_rooms_left: number;
  with_rooms: number;
  total_room_types: number;
  avg_price: number | null;
  min_price: number | null;
  max_price: number | null;
  distinct_cities: number;
  avg_room_types_per_hotel: number;
};

const fmtIDR = (n: number | null) => (n == null ? "—" : "Rp " + n.toLocaleString("id-ID"));
const fmtN = (n: number | null) => (n == null ? "—" : n.toLocaleString("id-ID"));

export default function ScrapedHotelsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastCheckin, setLastCheckin] = useState<string | null>(null);
  const [expandedHotel, setExpandedHotel] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/hotels/scraped", { cache: "no-store" });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error ?? "Failed");
      setRows(j.rows ?? []);
      setStats(j.stats ?? null);
      setLastCheckin(j.last_checkin ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void fetchData(); }, []);

  /* ----- Charts ----- */
  const priceHistogram = React.useMemo(() => {
    const buckets = [
      { name: "<500K", min: 0, max: 500_000, count: 0 },
      { name: "500K-1M", min: 500_000, max: 1_000_000, count: 0 },
      { name: "1M-2M", min: 1_000_000, max: 2_000_000, count: 0 },
      { name: "2M-5M", min: 2_000_000, max: 5_000_000, count: 0 },
      { name: "5M+", min: 5_000_000, max: Infinity, count: 0 },
    ];
    for (const r of rows) {
      if (r.price_idr == null) continue;
      const b = buckets.find((b) => r.price_idr! >= b.min && r.price_idr! < b.max);
      if (b) b.count++;
    }
    return {
      tooltip: { trigger: "axis" },
      grid: { left: 8, right: 16, top: 18, bottom: 8, containLabel: true },
      xAxis: { type: "category", data: buckets.map((b) => b.name) },
      yAxis: { type: "value" },
      series: [{
        type: "bar",
        data: buckets.map((b) => b.count),
        itemStyle: { color: "#ed6b23", borderRadius: [4, 4, 0, 0] },
        barMaxWidth: 60,
      }],
    };
  }, [rows]);

  const scatterScorePrice = React.useMemo(() => {
    const points: [number, number, string][] = rows
      .filter((r) => r.review_score != null && r.price_idr != null)
      .map((r) => [r.review_score!, r.price_idr!, r.hotel_name]);
    return {
      tooltip: { trigger: "item", formatter: (p: unknown) => {
        const o = p as { value: [number, number, string] };
        return `${o.value[2]}<br/>Score: ${o.value[0]} · ${fmtIDR(o.value[1])}`;
      }},
      grid: { left: 8, right: 16, top: 18, bottom: 36, containLabel: true },
      xAxis: { type: "value", name: "Review score", min: 5, max: 10, nameLocation: "middle", nameGap: 24 },
      yAxis: { type: "value", name: "Price (IDR)", nameLocation: "middle", nameGap: 50,
        axisLabel: { formatter: (v: number) => v >= 1_000_000 ? `${(v/1_000_000).toFixed(1)}M` : v >= 1000 ? `${(v/1000).toFixed(0)}K` : String(v) } },
      series: [{
        type: "scatter",
        data: points,
        symbolSize: 12,
        itemStyle: { color: "#ed6b23", opacity: 0.75, borderColor: "#fff", borderWidth: 1 },
      }],
    };
  }, [rows]);

  return (
    <main className="min-h-screen bg-[color:var(--canvas,#fff)]">
      {/* Disclaimer banner */}
      <div style={{ background: "#fff7ed", borderBottom: "1px solid #fed7aa" }}>
        <div className="mx-auto max-w-[1320px] px-6 py-3 flex items-start gap-3">
          <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-[13px] text-amber-900">
            <strong>POC research data</strong> — scraped from Booking.com public search
            with strict safeguards (robots.txt, rate-limit, abort-on-block, Jakarta-only filter).
            <span className="text-amber-700"> Exit-strategy: Booking Demand API. </span>
            <a className="underline text-amber-800" href="https://github.com/anomalyco/opencode" target="_blank" rel="noopener">
              Read README in scripts/scrapers/booking-jakarta/
            </a>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1320px] px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-[26px] font-semibold tracking-tight text-gray-900 flex items-center gap-3">
              <Database className="size-6 text-orange-500" />
              Hotel Availability — Jakarta (POC)
            </h1>
            <p className="text-[13px] text-gray-500 mt-1">
              Snapshot from Booking.com public search · {lastCheckin ? `check-in ${lastCheckin}` : "—"}
            </p>
          </div>
          <button
            onClick={() => void fetchData()}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-3.5 py-2 text-[13px] font-medium hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={loading ? "size-4 animate-spin" : "size-4"} />
            Refresh
          </button>
        </div>

        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-700">
            {error}
          </div>
        )}

        {/* Stats strip */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
            <Stat label="Hotels" value={fmtN(stats.total)} tone="orange" />
            <Stat label="Room types" value={fmtN(stats.total_room_types)} subtitle={`~${stats.avg_room_types_per_hotel} per hotel`} />
            <Stat label="With rooms left" value={`${stats.with_rooms_left}/${stats.total}`} />
            <Stat label="With address" value={`${stats.with_address}/${stats.total}`} />
            <Stat label="Avg price" value={fmtIDR(stats.avg_price)} />
            <Stat label="Price range" value={`${fmtIDR(stats.min_price)} – ${fmtIDR(stats.max_price)}`} />
          </div>
        )}

        {/* Charts */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-semibold text-gray-900">Price distribution</h3>
              <span className="atlas-mono text-[10.5px] text-gray-400 uppercase">cheapest rate per hotel</span>
            </div>
            <div style={{ height: 240 }}>
              <ReactECharts option={priceHistogram} style={{ height: "100%", width: "100%" }} notMerge lazyUpdate />
            </div>
          </div>
          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-[13px] font-semibold text-gray-900">Score vs price</h3>
              <span className="atlas-mono text-[10.5px] text-gray-400 uppercase">bubble = hotel</span>
            </div>
            <div style={{ height: 240 }}>
              <ReactECharts option={scatterScorePrice} style={{ height: "100%", width: "100%" }} notMerge lazyUpdate />
            </div>
          </div>
        </div>

        {/* Hotels list */}
        <div className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <h3 className="text-[13px] font-semibold text-gray-900">
              Hotels ({rows.length})
            </h3>
            <span className="atlas-mono text-[10.5px] text-gray-400 uppercase">
              sorted by review score
            </span>
          </div>
          {loading && rows.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-400">Loading…</div>
          ) : rows.length === 0 ? (
            <div className="px-4 py-8 text-center text-gray-400 border border-gray-200 rounded-xl bg-white">
              No data yet. Run the scraper: <code className="text-orange-600">cd scripts/scrapers/booking-jakarta && bun run start</code>
            </div>
          ) : (
            rows.map((r) => (
              <HotelCard
                key={r.hotel_id}
                row={r}
                expanded={expandedHotel === r.hotel_id}
                onToggle={() => setExpandedHotel(expandedHotel === r.hotel_id ? null : r.hotel_id)}
              />
            ))
          )}
        </div>
      </div>
    </main>
  );
}

function HotelCard({
  row, expanded, onToggle,
}: {
  row: Row;
  expanded: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white overflow-hidden">
      {/* Header row */}
      <div className="grid grid-cols-12 gap-4 items-center px-4 py-3 hover:bg-gray-50">
        <button
          onClick={onToggle}
          className="col-span-12 md:col-span-5 flex items-start gap-3 text-left"
        >
          {expanded ? (
            <ChevronUp className="size-4 text-gray-400 mt-1 shrink-0" />
          ) : (
            <ChevronDown className="size-4 text-gray-400 mt-1 shrink-0" />
          )}
          <div className="min-w-0">
            <a
              href={row.hotel_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-gray-900 font-semibold hover:text-orange-600 inline-flex items-center gap-1.5 text-[14px]"
            >
              <span className="truncate">{row.hotel_name}</span>
              <ExternalLink className="size-3 text-gray-400 shrink-0" />
            </a>
            <div className="text-[11.5px] text-gray-500 mt-0.5 flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3" />
                {row.city}
              </span>
              {row.distance_km != null && (
                <span>· {row.distance_km} km from center</span>
              )}
              {row.total_room_types != null && (
                <span>· {row.total_room_types} room types</span>
              )}
              {row.rooms_left != null && (
                <span className="inline-flex items-center gap-1 text-amber-600">
                  <Bed className="size-3" /> {row.rooms_left} left
                </span>
              )}
            </div>
          </div>
        </button>

        <div className="col-span-6 md:col-span-2 flex items-center gap-1.5">
          {row.star_rating ? (
            <span className="inline-flex items-center gap-0.5 text-amber-500">
              {Array.from({ length: row.star_rating }).map((_, i) => (
                <Star key={i} className="size-3 fill-current" />
              ))}
            </span>
          ) : (
            <span className="text-gray-300 text-[12px]">—</span>
          )}
        </div>

        <div className="col-span-6 md:col-span-1">
          <div className="flex items-baseline gap-1.5">
            <span className="font-medium tabular-nums text-gray-900 text-[13px]">
              {row.review_score ?? "—"}
            </span>
            {row.review_label && (
              <span className="text-[10.5px] text-gray-500">· {row.review_label}</span>
            )}
          </div>
          <div className="text-[10px] text-gray-400">{fmtN(row.review_count)} reviews</div>
        </div>

        <div className="col-span-12 md:col-span-3 text-right">
          <div className="font-semibold tabular-nums text-gray-900 text-[14px]">
            {fmtIDR(row.price_idr)}
          </div>
          <div className="text-[10.5px] text-gray-500">cheapest rate / night</div>
        </div>

        <div className="col-span-12 md:col-span-1 text-right">
          {row.is_available ? (
            <span className="inline-block text-[10.5px] text-emerald-600 font-medium">available</span>
          ) : (
            <span className="inline-block text-[10.5px] text-red-500 font-medium">sold out</span>
          )}
        </div>
      </div>

      {/* Expanded: room types */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 px-4 py-4">
          {row.address && (
            <div className="text-[12px] text-gray-600 mb-3 flex items-start gap-1.5">
              <MapPin className="size-3.5 mt-0.5 shrink-0 text-gray-400" />
              <span>{row.address}</span>
            </div>
          )}
          {row.room_types.length === 0 ? (
            <div className="text-[12px] text-gray-400 italic">No room detail captured (page may have been rate-limited).</div>
          ) : (
            <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
              <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                <span className="text-[11px] font-semibold text-gray-700 uppercase tracking-wide">
                  {row.room_types.length} room types
                </span>
                <span className="text-[10.5px] text-gray-400">
                  price = min/max across all rates found
                </span>
              </div>
              <table className="w-full text-[12.5px]">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr className="text-left text-[10.5px] uppercase tracking-wide text-gray-500">
                    <th className="px-3 py-2 font-medium">Room type</th>
                    <th className="px-3 py-2 font-medium">Beds</th>
                    <th className="px-3 py-2 font-medium">Features</th>
                    <th className="px-3 py-2 font-medium text-right">Price / night</th>
                    <th className="px-3 py-2 font-medium text-right">Rates</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {row.room_types.map((rt, i) => (
                    <tr key={i} className="hover:bg-gray-50">
                      <td className="px-3 py-2.5 max-w-[240px]">
                        <div className="font-medium text-gray-900">{rt.name}</div>
                      </td>
                      <td className="px-3 py-2.5 text-gray-600 max-w-[200px]">
                        {rt.beds ? (
                          <span className="inline-flex items-center gap-1.5 text-[11.5px]">
                            <Bed className="size-3 text-gray-400" />
                            <span className="line-clamp-2">{rt.beds}</span>
                          </span>
                        ) : "—"}
                      </td>
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {rt.breakfast_included && (
                            <span className="inline-flex items-center gap-1 text-[10.5px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full border border-emerald-200">
                              <Coffee className="size-2.5" /> breakfast
                            </span>
                          )}
                          {rt.cancellation === "free_cancellation" && (
                            <span className="inline-flex items-center gap-1 text-[10.5px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full border border-blue-200">
                              free cancel
                            </span>
                          )}
                          {rt.cancellation === "non_refundable" && (
                            <span className="inline-flex items-center gap-1 text-[10.5px] bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                              non-refundable
                            </span>
                          )}
                          {!rt.breakfast_included && !rt.cancellation && (
                            <span className="text-[11px] text-gray-400">—</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">
                        {rt.price_min_idr === rt.price_max_idr ? (
                          <div className="font-medium text-gray-900">{fmtIDR(rt.price_min_idr)}</div>
                        ) : (
                          <>
                            <div className="font-medium text-gray-900">{fmtIDR(rt.price_min_idr)}</div>
                            <div className="text-[10.5px] text-gray-400">– {fmtIDR(rt.price_max_idr)}</div>
                          </>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-gray-600">
                        {rt.rate_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, subtitle, tone }: { label: string; value: string; subtitle?: string; tone?: "orange" }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3">
      <div className="text-[10.5px] uppercase tracking-wide text-gray-500 font-medium">
        {label}
      </div>
      <div className={`text-[18px] font-semibold tabular-nums mt-0.5 ${tone === "orange" ? "text-orange-600" : "text-gray-900"}`}>
        {value}
      </div>
      {subtitle && <div className="text-[10.5px] text-gray-400 mt-0.5">{subtitle}</div>}
    </div>
  );
}
