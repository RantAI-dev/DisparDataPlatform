"use client";

import ReactECharts from "echarts-for-react";
import type { Point } from "@/lib/agg";
import { categoryZoom, EXPANDED_HEIGHT, useChartExpanded, ZOOM_PAD } from "./ChartExpand";

const NAVY = "#ed6b23";
const idfmt = (v: number) => v.toLocaleString("id-ID");

/** Bar horizontal (ECharts) untuk breakdown kategori/wilayah. */
export function BarBreakdown({
  data,
  unit = "",
  color = NAVY,
  colors,
}: {
  data: Point[];
  unit?: string;
  color?: string;
  /** Warna per batang (sejajar urutan `data`); bila ada, menggantikan `color`. */
  colors?: string[];
}) {
  const expanded = useChartExpanded();
  if (!data.length)
    return (
      <div className="text-[13px] text-slate-400 py-6 text-center">
        Tidak ada data.
      </div>
    );

  const cats = data.map((d) => d.label);
  const vals = data.map((d) => d.value);
  const manyRows = data.length > 14;
  const height = expanded && manyRows ? EXPANDED_HEIGHT : Math.max(160, data.length * 34 + 20);

  const option = {
    grid: { left: 6, right: 56 + (expanded && manyRows ? ZOOM_PAD : 0), top: 6, bottom: 6, containLabel: true },
    ...(expanded && manyRows ? { dataZoom: categoryZoom(data.length, true) } : {}),
    tooltip: {
      trigger: "axis",
      axisPointer: { type: "shadow" },
      valueFormatter: (v: number) => idfmt(v) + unit,
    },
    xAxis: {
      type: "value",
      axisLabel: { color: "#94a3b8", formatter: (v: number) => idfmt(v) },
      splitLine: { lineStyle: { color: "#eef2f7" } },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    yAxis: {
      type: "category",
      inverse: true,
      data: cats,
      axisLabel: { color: "#475569", width: 150, overflow: "truncate" },
      axisLine: { show: false },
      axisTick: { show: false },
    },
    series: [
      {
        type: "bar",
        data: colors ? vals.map((v, i) => ({ value: v, itemStyle: { color: colors[i] ?? color } })) : vals,
        barMaxWidth: 22,
        itemStyle: { color, borderRadius: [0, 4, 4, 0] },
        label: {
          show: true,
          position: "right",
          color: "#334155",
          fontSize: 12,
          formatter: (p: { value: number }) => idfmt(p.value) + unit,
        },
      },
    ],
  };

  return (
    <ReactECharts option={option} style={{ height }} notMerge lazyUpdate />
  );
}
