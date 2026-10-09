"use client";

import ReactECharts from "echarts-for-react";
import type { Point } from "@/lib/agg";
import { categoryZoom, EXPANDED_HEIGHT, useChartExpanded, ZOOM_PAD } from "./ChartExpand";

const NAVY = "#ed6b23";
const idfmt = (v: number) => v.toLocaleString("id-ID");

/** Bar VERTIKAL (ECharts) — mis. tren bulanan / kuartal. */
export function VerticalBars({
  data,
  unit = "",
  color = NAVY,
  labelFmt,
  height = 280,
}: {
  data: Point[];
  unit?: string;
  color?: string;
  labelFmt?: (s: string) => string;
  height?: number;
}) {
  const expanded = useChartExpanded();
  if (!data.length)
    return <div className="text-[13px] text-slate-400 py-6 text-center">Tidak ada data.</div>;

  const option = {
    grid: { left: 6, right: 16, top: expanded ? 28 : 16, bottom: 24 + (expanded ? ZOOM_PAD : 0), containLabel: true },
    ...(expanded ? { dataZoom: categoryZoom(data.length) } : {}),
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      valueFormatter: (v: number) => idfmt(v) + unit,
    },
    xAxis: {
      type: "category",
      data: data.map((d) => (labelFmt ? labelFmt(d.label) : d.label)),
      axisLabel: { color: "#94a3b8", fontSize: 11, hideOverlap: true },
      axisLine: { lineStyle: { color: "#e2e8f0" } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#94a3b8", formatter: (v: number) => idfmt(v) },
      splitLine: { lineStyle: { color: "#eef2f7" } },
    },
    series: [
      {
        type: "bar",
        data: data.map((d) => d.value),
        barMaxWidth: 34,
        ...(expanded
          ? { label: { show: true, position: "top", color: "#334155", fontSize: 11, formatter: (p: { value: number }) => idfmt(p.value) + unit } }
          : {}),
        itemStyle: { color, borderRadius: [4, 4, 0, 0] },
      },
    ],
  };

  return (
    <ReactECharts option={option} style={{ height: expanded ? EXPANDED_HEIGHT : height, width: "100%" }} notMerge lazyUpdate opts={{ renderer: "canvas" }} />
  );
}
