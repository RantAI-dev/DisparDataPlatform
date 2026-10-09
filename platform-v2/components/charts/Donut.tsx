"use client";

import ReactECharts from "echarts-for-react";
import type { Point } from "@/lib/agg";
import { EXPANDED_HEIGHT, useChartExpanded } from "./ChartExpand";

// Palet lebih banyak & distinct agar slice tidak berulang warna.
const PALETTE = [
  "#ed6b23", "#f0a13a", "#0e7c42", "#2563eb", "#7c3aed",
  "#0891b2", "#e11d48", "#65a30d", "#db2777", "#0d9488",
];
const MUTED = "#cbd5e1"; // untuk slice "Lainnya"
const idfmt = (v: number) => v.toLocaleString("id-ID");

/**
 * Proporsi (donut ECharts) — legend scroll di bawah, pie di tengah.
 * `showPercent`: persentase tiap irisan tampil permanen (tanpa hover); irisan < ~2% disembunyikan agar tak tumpang tindih.
 * `colorMap`: peta label→warna agar warna menempel pada NAMA (bukan posisi). Label yang tak ada di peta pakai PALETTE berurutan; "Lainnya" tetap MUTED.
 */
export function Donut({
  data,
  showPercent = false,
  colorMap,
}: {
  data: Point[];
  showPercent?: boolean;
  colorMap?: Record<string, string>;
}) {
  const expanded = useChartExpanded();
  if (!data.length)
    return (
      <div className="text-[13px] text-slate-400 py-6 text-center">
        Tidak ada data.
      </div>
    );

  const option = {
    color: PALETTE,
    tooltip: {
      trigger: "item",
      formatter: (p: { name: string; value: number; percent: number }) =>
        `${p.name}: ${idfmt(p.value)} (${p.percent}%)`,
    },
    legend: {
      type: "scroll",
      orient: "horizontal",
      bottom: 0,
      left: "center",
      icon: "circle",
      itemWidth: 9,
      itemHeight: 9,
      itemGap: 12,
      textStyle: { color: "#475569", fontSize: 11 },
      pageIconSize: 9,
      pageTextStyle: { color: "#94a3b8" },
    },
    series: [
      {
        type: "pie",
        radius: showPercent ? ["44%", "64%"] : ["52%", "74%"],
        center: ["50%", "44%"],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: "#fff", borderWidth: 2 },
        label: expanded
          ? {
              show: true,
              position: "outside",
              // showPercent: nilai sudah berupa persentase, jangan ditampilkan dua kali.
              formatter: (p: { name: string; value: number; percent: number }) => {
                const pct = p.percent.toLocaleString("id-ID", { maximumFractionDigits: 1 });
                return showPercent ? `${p.name}\n${pct}%` : `${p.name}\n${idfmt(p.value)} (${pct}%)`;
              },
              color: "#33302b",
              fontSize: 12,
              fontWeight: 600,
            }
          : showPercent
          ? {
              show: true,
              position: "outside",
              formatter: (p: { percent: number }) => `${p.percent.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`,
              color: "#33302b",
              fontSize: 11,
              fontWeight: 600,
            }
          : { show: false },
        labelLine: { show: expanded || showPercent, length: 6, length2: 6 },
        minShowLabelAngle: expanded ? 0 : 7,
        data: data.map((d) => {
          const mapped = colorMap?.[d.label];
          if (mapped) return { name: d.label, value: d.value, itemStyle: { color: mapped } };
          if (/^lainnya$/i.test(d.label)) return { name: d.label, value: d.value, itemStyle: { color: MUTED } };
          return { name: d.label, value: d.value };
        }),
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: expanded ? EXPANDED_HEIGHT : 288 }} notMerge lazyUpdate />;
}
