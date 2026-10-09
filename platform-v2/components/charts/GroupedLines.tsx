"use client";

import ReactECharts from "echarts-for-react";
import type { Point } from "@/lib/agg";
import { categoryZoom, EXPANDED_HEIGHT, useChartExpanded, ZOOM_PAD } from "./ChartExpand";

const PALETTE = ["#ed6b23", "#f0a13a", "#0e7c42", "#b3261e", "#7c3aed", "#0891b2"];
const idfmt = (v: number) => v.toLocaleString("id-ID");

/** Beberapa seri per periode (ECharts multi-line) — mis. occupancy per bintang. */
export function GroupedLines({
  series,
}: {
  series: { name: string; data: Point[] }[];
}) {
  const expanded = useChartExpanded();
  if (!series.length)
    return (
      <div className="text-[13px] text-slate-400 py-6 text-center">
        Tidak ada data.
      </div>
    );

  // Union periode (x-axis) terurut.
  const labels = Array.from(
    new Set(series.flatMap((s) => s.data.map((d) => d.label)))
  ).sort((a, b) => a.localeCompare(b));

  const option = {
    color: PALETTE,
    grid: { left: 6, right: 16, top: 30, bottom: 6 + (expanded ? ZOOM_PAD : 0), containLabel: true },
    ...(expanded ? { dataZoom: categoryZoom(labels.length, false, 18) } : {}),
    tooltip: { trigger: "axis", valueFormatter: (v: number) => idfmt(v) },
    legend: { top: 0, textStyle: { color: "#475569", fontSize: 12 } },
    xAxis: {
      type: "category",
      data: labels,
      axisLabel: { color: "#94a3b8", fontSize: 11 },
      axisLine: { lineStyle: { color: "#e2e8f0" } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#94a3b8", formatter: (v: number) => idfmt(v) },
      splitLine: { lineStyle: { color: "#eef2f7" } },
    },
    series: series.map((s) => {
      const m = new Map(s.data.map((d) => [d.label, d.value]));
      return {
        name: s.name,
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 5,
        ...(expanded
          ? { labelLayout: { hideOverlap: true }, label: { show: true, position: "top", fontSize: 10, color: "#334155", formatter: (p: { value: number | null }) => (p.value == null ? "" : idfmt(p.value)) } }
          : {}),
        connectNulls: true,
        data: labels.map((l) => m.get(l) ?? null),
      };
    }),
  };

  return <ReactECharts option={option} style={{ height: expanded ? EXPANDED_HEIGHT : 300 }} notMerge lazyUpdate />;
}
