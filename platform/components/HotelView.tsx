"use client";

/**
 * ATLAS — Hotel & Akomodasi DKI Jakarta (data RESMI: Satu Data Jakarta / BPS).
 *
 * Menu ini SENGAJA memakai data resmi, bukan scraping OTA:
 *  - Supply: 120 hotel (Rekapitulasi Usaha & Kamar Hotel) — jumlah kamar,
 *    klasifikasi, wilayah, alamat.
 *  - Okupansi: Tingkat Penghunian Kamar (TPK) bulanan per klasifikasi bintang.
 *  - Lama Menginap (LoS): malam per bulan, Wisman vs Wisnus.
 *
 * Layout: hero + KPI → 2 grafik tren (TPK, LoS) → tabel hotel (filter wilayah/
 * golongan + cari + unduh). Sumber datamart: lib/hotel.ts (gold, build-hotel.ts).
 */
import { useMemo, useState } from "react";
import ReactECharts from "echarts-for-react";
import { fmtPeriode } from "@/lib/agg";
import { PALETTE } from "@/components/pariwisata/DashboardKit";
import { ExportButton } from "@/components/atlas/ExportButton";
import {
  HOTEL_META,
  HOTEL_REGISTRY,
  HOTEL_TPK,
  HOTEL_LOS,
  hotelWilayahList,
  hotelGolonganList,
  type HotelRow,
} from "@/lib/hotel";
import {
  type CsvColumn,
  type ExportFormat,
  dateStamp,
  downloadSpreadsheet,
} from "@/lib/export";

const BINTANG_ORDER = ["BINTANG 1", "BINTANG 2", "BINTANG 3", "BINTANG 4", "BINTANG 5"];
const idfmt = (v: number, d = 0) =>
  v.toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d });

/** Grafik garis multi-seri (ECharts) untuk tren bulanan. */
function MultiLine({
  periods,
  series,
  unit,
  yName,
}: {
  periods: string[];
  series: { name: string; data: (number | null)[] }[];
  unit: string;
  yName: string;
}) {
  if (periods.length < 2)
    return <div className="py-6 text-center text-[13px] text-slate-400">Data tren belum cukup.</div>;
  const option = {
    color: PALETTE,
    grid: { left: 6, right: 16, top: 30, bottom: 40, containLabel: true },
    legend: { top: 0, textStyle: { fontSize: 11, color: "#475569" } },
    tooltip: {
      trigger: "axis",
      valueFormatter: (v: number) => (v == null ? "—" : idfmt(v, unit === "%" ? 1 : 2) + " " + unit),
    },
    xAxis: {
      type: "category",
      data: periods.map(fmtPeriode),
      boundaryGap: false,
      axisLabel: { fontSize: 10, color: "#94a3b8", rotate: periods.length > 14 ? 45 : 0 },
    },
    yAxis: {
      type: "value",
      name: yName,
      nameTextStyle: { color: "#94a3b8", fontSize: 11 },
      axisLabel: { fontSize: 10, color: "#94a3b8" },
      splitLine: { lineStyle: { color: "#f1f5f9" } },
    },
    series: series.map((s) => ({
      name: s.name,
      type: "line",
      smooth: true,
      showSymbol: false,
      connectNulls: true,
      data: s.data,
    })),
  };
  return <ReactECharts option={option} style={{ height: 300 }} notMerge lazyUpdate />;
}

function Kpi({ value, label, sub }: { value: string; label: string; sub?: string }) {
  return (
    <div>
      <div className="text-[34px] font-bold leading-none tabular text-ink">{value}</div>
      <div className="mt-1.5 apple-caption text-ink-muted-80">{label}</div>
      {sub && <div className="apple-fine text-ink-muted-48">{sub}</div>}
    </div>
  );
}

export function HotelView() {
  const [wilayah, setWilayah] = useState("All");
  const [golongan, setGolongan] = useState("All");
  const [query, setQuery] = useState("");

  const wilayahOptions = useMemo(() => ["All", ...hotelWilayahList()], []);
  const golonganOptions = useMemo(() => ["All", ...hotelGolonganList()], []);

  // ── Tren TPK okupansi per klasifikasi bintang ──
  const tpkChart = useMemo(() => {
    const periods = [...new Set(HOTEL_TPK.map((r) => r.periode))].sort();
    const bintangs = BINTANG_ORDER.filter((b) => HOTEL_TPK.some((r) => r.bintang === b));
    const idx = new Map(periods.map((p, i) => [p, i]));
    const series = bintangs.map((b) => {
      const data: (number | null)[] = Array(periods.length).fill(null);
      for (const r of HOTEL_TPK) if (r.bintang === b) data[idx.get(r.periode)!] = r.nilai;
      return { name: b.replace("BINTANG", "Bintang"), data };
    });
    return { periods, series };
  }, []);

  // ── Tren LoS Wisman vs Wisnus (rata-rata lintas klasifikasi) ──
  const losChart = useMemo(() => {
    const periods = [...new Set(HOTEL_LOS.map((r) => r.periode))].sort();
    const idx = new Map(periods.map((p, i) => [p, i]));
    const mk = (tamu: string) => {
      const sum = Array(periods.length).fill(0);
      const cnt = Array(periods.length).fill(0);
      for (const r of HOTEL_LOS)
        if (r.tamu === tamu) {
          const i = idx.get(r.periode)!;
          sum[i] += r.nilai;
          cnt[i] += 1;
        }
      return sum.map((s, i) => (cnt[i] ? +(s / cnt[i]).toFixed(2) : null));
    };
    return {
      periods,
      series: [
        { name: "Wisman", data: mk("WISATAWAN MANCANEGARA") },
        { name: "Wisnus", data: mk("WISATAWAN NUSANTARA") },
      ],
    };
  }, []);

  // ── KPI: okupansi & LoS terbaru ──
  const kpi = useMemo(() => {
    const lastTpkP = tpkChart.periods[tpkChart.periods.length - 1];
    const lastTpk = HOTEL_TPK.filter((r) => r.periode === lastTpkP);
    const avgOcc = lastTpk.length ? lastTpk.reduce((a, r) => a + r.nilai, 0) / lastTpk.length : 0;
    const lastLosP = losChart.periods[losChart.periods.length - 1];
    const lastLos = HOTEL_LOS.filter((r) => r.periode === lastLosP);
    const avgLos = lastLos.length ? lastLos.reduce((a, r) => a + r.nilai, 0) / lastLos.length : 0;
    return { avgOcc, occPeriod: lastTpkP, avgLos, losPeriod: lastLosP };
  }, [tpkChart, losChart]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return HOTEL_REGISTRY.filter((h) => {
      if (wilayah !== "All" && h.wilayah !== wilayah) return false;
      if (golongan !== "All" && h.golongan !== golongan) return false;
      if (!q) return true;
      return [h.nama, h.alamat, h.wilayah, h.golongan].some((v) =>
        v.toLowerCase().includes(q)
      );
    }).sort((a, b) => b.kamar - a.kamar);
  }, [wilayah, golongan, query]);

  const filteredRooms = filtered.reduce((a, h) => a + h.kamar, 0);

  async function exportHotel(format: ExportFormat) {
    const columns: CsvColumn<HotelRow>[] = [
      { header: "No", value: (_h, i) => i + 1 },
      { header: "Nama", value: (h) => h.nama },
      { header: "Jenis Usaha", value: (h) => h.jenis_usaha },
      { header: "Golongan", value: (h) => h.golongan },
      { header: "Jumlah Kamar", value: (h) => h.kamar },
      { header: "Wilayah", value: (h) => h.wilayah },
      { header: "Alamat", value: (h) => h.alamat },
    ];
    await downloadSpreadsheet(`jakarta-atlas-hotel-${dateStamp()}`, filtered, columns, format, "Hotel");
  }

  return (
    <main className="min-h-screen bg-canvas">
      {/* HERO + KPI */}
      <section className="bg-canvas">
        <div className="mx-auto max-w-[1280px] px-6 py-[64px] md:py-[88px]">
          <p className="apple-caption-strong text-ink-muted-80">
            Data resmi · GPCI CI-HR / CI-LH (kamar hotel & hotel mewah)
          </p>
          <h1 className="apple-hero apple-title-tight mt-3 text-ink">
            Hotel &amp; <span className="text-ink-muted-48">Akomodasi</span>
          </h1>
          <p className="apple-lead mt-5 max-w-[760px]">
            Pasokan kamar, okupansi (TPK), dan lama menginap hotel berbintang
            DKI Jakarta — seluruhnya dari <b>data resmi</b> Satu Data Jakarta / BPS,
            bukan scraping OTA.
          </p>
          <div className="mt-9 grid grid-cols-2 gap-y-8 md:grid-cols-4">
            <Kpi value={idfmt(HOTEL_META.totals.hotels)} label="Hotel terdata" sub="Rekapitulasi usaha & kamar" />
            <Kpi value={idfmt(HOTEL_META.totals.rooms)} label="Total kamar" />
            <Kpi
              value={idfmt(kpi.avgOcc, 1) + "%"}
              label="Okupansi rata-rata (terbaru)"
              sub={fmtPeriode(kpi.occPeriod)}
            />
            <Kpi
              value={idfmt(kpi.avgLos, 2)}
              label="Lama menginap (malam)"
              sub={fmtPeriode(kpi.losPeriod)}
            />
          </div>
        </div>
      </section>

      {/* CHARTS */}
      <section className="border-y border-hairline bg-parchment">
        <div className="mx-auto grid max-w-[1280px] gap-6 px-6 py-10 lg:grid-cols-2">
          <div className="utility-card bg-white p-5">
            <div className="mb-1 apple-caption-strong text-ink">Tingkat Penghunian Kamar (TPK)</div>
            <div className="apple-fine text-ink-muted-48">Okupansi bulanan per klasifikasi bintang · %</div>
            <MultiLine periods={tpkChart.periods} series={tpkChart.series} unit="%" yName="Okupansi %" />
          </div>
          <div className="utility-card bg-white p-5">
            <div className="mb-1 apple-caption-strong text-ink">Rata-rata Lama Menginap</div>
            <div className="apple-fine text-ink-muted-48">Malam per bulan · Wisman vs Wisnus (rata-rata lintas bintang)</div>
            <MultiLine periods={losChart.periods} series={losChart.series} unit="malam" yName="Malam" />
          </div>
        </div>
      </section>

      {/* TOOLBAR */}
      <section className="sticky top-[56px] z-10 frosted">
        <div className="mx-auto flex max-w-[1280px] flex-wrap items-center gap-2 px-6 py-3">
          <div className="relative min-w-0 flex-1">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari nama hotel, alamat…"
              className="h-10 w-full rounded-lg border border-hairline bg-canvas pl-4 pr-16 text-[14px] placeholder:text-ink-muted-48 focus:border-[color:var(--accent)] focus:outline-none focus:ring-2 focus:ring-[color:var(--accent-ring)]"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 apple-caption tabular text-ink-muted-48">
              {filtered.length}/{HOTEL_REGISTRY.length}
            </span>
          </div>
          <select
            value={wilayah}
            onChange={(e) => setWilayah(e.target.value)}
            className="h-9 appearance-none rounded-full border border-hairline bg-canvas pl-4 pr-9 apple-caption text-ink-muted-80 hover:text-ink"
          >
            {wilayahOptions.map((w) => (
              <option key={w} value={w}>{w === "All" ? "Semua wilayah" : w}</option>
            ))}
          </select>
          <select
            value={golongan}
            onChange={(e) => setGolongan(e.target.value)}
            className="h-9 appearance-none rounded-full border border-hairline bg-canvas pl-4 pr-9 apple-caption text-ink-muted-80 hover:text-ink"
          >
            {golonganOptions.map((g) => (
              <option key={g} value={g}>{g === "All" ? "Semua golongan" : g}</option>
            ))}
          </select>
          <ExportButton onExport={exportHotel} label="Unduh" />
        </div>
      </section>

      {/* TABLE */}
      <section className="mx-auto max-w-[1280px] px-6 py-8">
        <div className="mb-3 apple-fine text-ink-muted-48">
          {idfmt(filtered.length)} hotel · {idfmt(filteredRooms)} kamar (sesuai filter)
        </div>
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-white" style={{ background: "#ed6b23" }}>
                  <th className="px-3 py-2.5 font-semibold">Hotel</th>
                  <th className="px-3 py-2.5 font-semibold">Golongan</th>
                  <th className="px-3 py-2.5 font-semibold text-right">Kamar</th>
                  <th className="px-3 py-2.5 font-semibold">Wilayah</th>
                  <th className="px-3 py-2.5 font-semibold">Alamat</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((h) => (
                  <tr key={h.nama} className="border-t border-slate-100 hover:bg-slate-50">
                    <td className="px-3 py-2 font-medium text-ink">{h.nama}</td>
                    <td className="px-3 py-2 text-slate-600">{h.golongan}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-slate-700">{idfmt(h.kamar)}</td>
                    <td className="px-3 py-2 text-slate-600">{h.wilayah}</td>
                    <td className="px-3 py-2 text-slate-500">{h.alamat || "—"}</td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-12 text-center text-slate-400">
                      Tidak ada hotel yang cocok dengan filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <footer className="border-t border-hairline px-6 py-6">
        <p className="atlas-mono mx-auto max-w-[1280px] text-ink-muted-48">
          SUMBER · SATU DATA JAKARTA / BPS — REKAPITULASI USAHA &amp; KAMAR HOTEL, TPK,
          RATA-RATA LAMA MENGINAP · DATA RESMI, TANPA SCRAPING OTA · DIBANGUN {HOTEL_META.built}
        </p>
      </footer>
    </main>
  );
}
