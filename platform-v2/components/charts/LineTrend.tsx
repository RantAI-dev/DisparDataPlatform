"use client";

import ReactECharts from "echarts-for-react";
import * as echarts from "echarts";
import { fmtPeriode, type Point } from "@/lib/agg";
import { categoryZoom, EXPANDED_HEIGHT, useChartExpanded, ZOOM_PAD } from "./ChartExpand";

const NAVY = "#ed6b23";
const idfmt = (v: number) => v.toLocaleString("id-ID");

/** Tren per periode (ECharts area line). `unit`/`yName` bisa disesuaikan. */
export function LineTrend({
  data,
  unit = "kunjungan",
  yName = "Kunjungan",
}: {
  data: Point[];
  unit?: string;
  yName?: string;
}) {
  const expanded = useChartExpanded();
  if (data.length < 2)
    return (
      <div className="text-[13px] text-slate-400 py-6 text-center">
        Data tren belum cukup.
      </div>
    );

  const option = {
    grid: { left: 6, right: 30, top: expanded ? 28 : 16, bottom: 24 + (expanded ? ZOOM_PAD : 0), containLabel: true },
    ...(expanded ? { dataZoom: categoryZoom(data.length, false, 18) } : {}),
    tooltip: {
      trigger: "axis",
      valueFormatter: (v: number) => idfmt(v) + " " + unit,
    },
    xAxis: {
      type: "category",
      name: "Periode",
      nameLocation: "middle",
      nameGap: 34,
      nameTextStyle: { color: "#94a3b8", fontSize: 11 },
      data: data.map((d) => d.label),
      boundaryGap: false,
      axisLabel: {
        color: "#94a3b8",
        fontSize: 11,
        hideOverlap: true,
        showMaxLabel: true,
        formatter: (v: string) => fmtPeriode(v),
      },
      axisLine: { lineStyle: { color: "#e2e8f0" } },
      axisTick: { show: false },
    },
    yAxis: {
      type: "value",
      name: yName,
      nameTextStyle: { color: "#94a3b8", fontSize: 11, align: "left" },
      axisLabel: { color: "#94a3b8", formatter: (v: number) => idfmt(v) },
      splitLine: { lineStyle: { color: "#eef2f7" } },
    },
    series: [
      {
        type: "line",
        data: data.map((d) => d.value),
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        ...(expanded
          ? { label: { show: true, position: "top", color: "#334155", fontSize: 11, formatter: (p: { value: number }) => idfmt(p.value) } }
          : {}),
        lineStyle: { color: NAVY, width: 2.5 },
        itemStyle: { color: NAVY },
        areaStyle: {
          color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(237, 107, 35,0.28)" },
            { offset: 1, color: "rgba(237, 107, 35,0.02)" },
          ]),
        },
      },
    ],
  };

  return <ReactECharts option={option} style={{ height: expanded ? EXPANDED_HEIGHT : 260 }} notMerge lazyUpdate />;
}
