"use client";

import ReactECharts from "echarts-for-react";
import { categoryZoom, EXPANDED_HEIGHT, useChartExpanded, ZOOM_PAD } from "./ChartExpand";

const BAR = "#ed6b23";
const LINE = "#0e7c42";
const idfmt = (v: number) => v.toLocaleString("id-ID");

/** Dual-axis: batang (kiri) + garis (kanan) — mis. Jumlah Tamu vs PDRB Ekraf %. */
export function ComboBarLine({
  categories,
  bar,
  line,
  dualAxis = true,
  height = 320,
}: {
  categories: string[];
  bar: { name: string; values: (number | null)[]; unit?: string };
  line: { name: string; values: (number | null)[]; unit?: string };
  /** true = dua sumbu-Y (satuan beda). false = satu sumbu (satuan sama). */
  dualAxis?: boolean;
  height?: number;
}) {
  const expanded = useChartExpanded();
  const yAxis = dualAxis
    ? [
        {
          type: "value", name: bar.name, nameTextStyle: { color: "#94a3b8", fontSize: 10 },
          axisLabel: { color: "#94a3b8", formatter: (v: number) => idfmt(v) },
          splitLine: { lineStyle: { color: "#eef2f7" } }, alignTicks: false,
        },
        {
          type: "value", name: line.name, position: "right", nameTextStyle: { color: "#94a3b8", fontSize: 10 },
          axisLabel: { color: "#94a3b8", formatter: (v: number) => `${v}${line.unit ?? ""}` },
          splitLine: { show: false }, alignTicks: false,
        },
      ]
    : [
        {
          type: "value",
          axisLabel: { color: "#94a3b8", formatter: (v: number) => idfmt(v) },
          splitLine: { lineStyle: { color: "#eef2f7" } },
        },
      ];

  const option = {
    grid: { left: 6, right: dualAxis ? 12 : 16, top: 36, bottom: 6 + (expanded ? ZOOM_PAD : 0), containLabel: true },
    ...(expanded ? { dataZoom: categoryZoom(categories.length, false, 12) } : {}),
    tooltip: { trigger: "axis", axisPointer: { type: "cross" }, valueFormatter: (v: number | null) => (v == null ? "—" : idfmt(v)) },
    legend: { top: 0, textStyle: { color: "#475569", fontSize: 11 }, icon: "circle" },
    xAxis: {
      type: "category",
      data: categories,
      axisLabel: { color: "#94a3b8", fontSize: 11 },
      axisLine: { lineStyle: { color: "#e2e8f0" } },
      axisTick: { show: false },
    },
    yAxis,
    series: [
      {
        name: bar.name,
        type: "bar",
        data: bar.values,
        barMaxWidth: 40,
        itemStyle: { color: BAR, borderRadius: [4, 4, 0, 0] },
        ...(expanded
          ? { labelLayout: { hideOverlap: true }, label: { show: true, position: dualAxis ? "top" : "insideTop", fontSize: 10, color: dualAxis ? "#334155" : "#ffffff", formatter: (p: { value: number | null }) => (p.value == null ? "" : idfmt(p.value) + (bar.unit ?? "")) } }
          : {}),
      },
      {
        name: line.name,
        type: "line",
        yAxisIndex: dualAxis ? 1 : 0,
        smooth: true,
        symbolSize: 7,
        connectNulls: true,
        lineStyle: { width: 2.5, color: LINE, type: "dashed" as const },
        itemStyle: { color: LINE },
        data: line.values,
        ...(expanded
          ? { labelLayout: { hideOverlap: true }, label: { show: true, position: "top", fontSize: 10, color: LINE, formatter: (p: { value: number | null }) => (p.value == null ? "" : idfmt(p.value) + (line.unit ?? "")) } }
          : {}),
      },
    ],
  };

  return (
    <ReactECharts option={option} style={{ height: expanded ? EXPANDED_HEIGHT : height, width: "100%" }} notMerge lazyUpdate opts={{ renderer: "canvas" }} />
  );
}
