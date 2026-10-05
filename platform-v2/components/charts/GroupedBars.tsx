"use client";

import ReactECharts from "echarts-for-react";
import type { Point } from "@/lib/agg";

const PALETTE = ["#ed6b23", "#f0a13a", "#c2410c", "#9a3412", "#fb923c", "#7c2d12"];
const idfmt = (v: number) => v.toLocaleString("id-ID");

/** Bar berkelompok (multi-seri) — mis. Q1–Q4 dibandingkan antar tahun. */
export function GroupedBars({
  series,
  categories,
  unit = "",
  colors,
  height = 300,
  missingValue = 0,
}: {
  series: { name: string; data: Point[] }[];
  categories: string[];
  unit?: string;
  colors?: string[];
  height?: number;
  missingValue?: 0 | null;
}) {
  if (!series.length)
    return <div className="text-[13px] text-slate-400 py-6 text-center">Tidak ada data.</div>;

  const option = {
    color: colors ?? PALETTE,
    grid: { left: 6, right: 16, top: 30, bottom: 6, containLabel: true },
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v: number | null | undefined) => v == null ? "—" : idfmt(v) + unit },
    legend: { top: 0, textStyle: { color: "#475569", fontSize: 11 }, icon: "circle" },
    xAxis: {
      type: "category",
      data: categories,
      axisLabel: { color: "#94a3b8", fontSize: 11 },
      axisLine: { lineStyle: { color: "#e2e8f0" } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#94a3b8", formatter: (v: number) => idfmt(v) },
      splitLine: { lineStyle: { color: "#eef2f7" } },
    },
    series: series.map((s) => ({
      name: s.name,
      type: "bar",
      barMaxWidth: 22,
      itemStyle: { borderRadius: [3, 3, 0, 0] },
      data: categories.map((c) => s.data.find((d) => d.label === c)?.value ?? missingValue),
    })),
  };

  return (
    <ReactECharts option={option} style={{ height, width: "100%" }} notMerge lazyUpdate opts={{ renderer: "canvas" }} />
  );
}
