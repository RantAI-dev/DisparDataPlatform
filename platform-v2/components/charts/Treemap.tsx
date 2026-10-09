"use client";

import ReactECharts from "echarts-for-react";
import type { Point } from "@/lib/agg";
import { EXPANDED_HEIGHT, useChartExpanded } from "./ChartExpand";

const PALETTE = [
  "#ed6b23", "#f0a13a", "#c2410c", "#f4a672", "#9a3412",
  "#fb923c", "#b45309", "#ea580c", "#fdba74", "#7c2d12",
];
const idfmt = (v: number) => v.toLocaleString("id-ID");

/** Treemap komposisi (ECharts) — chart "advanced" untuk detail proporsi. */
export function Treemap({ data, height = 300 }: { data: Point[]; height?: number }) {
  const expanded = useChartExpanded();
  if (!data.length)
    return <div className="text-[13px] text-slate-400 py-6 text-center">Tidak ada data.</div>;

  const total = data.reduce((a, p) => a + p.value, 0) || 1;
  const option = {
    tooltip: {
      formatter: (p: { name: string; value: number }) =>
        `${p.name}<br/><b>${idfmt(p.value)}</b> (${((p.value / total) * 100).toFixed(1)}%)`,
    },
    series: [
      {
        type: "treemap",
        roam: false,
        nodeClick: false,
        breadcrumb: { show: false },
        width: "100%",
        height: "100%",
        top: 2, left: 2, right: 2, bottom: 2,
        label: expanded
          ? {
              show: true,
              formatter: (p: { name: string; value: number }) =>
                `${p.name}\n${idfmt(p.value)} (${((p.value / total) * 100).toFixed(1)}%)`,
              color: "#fff",
              fontSize: 13,
            }
          : { show: true, formatter: "{b}", color: "#fff", fontSize: 11 },
        itemStyle: { borderColor: "#fff", borderWidth: 2, gapWidth: 2 },
        data: data.map((d, i) => ({ name: d.label, value: d.value, itemStyle: { color: PALETTE[i % PALETTE.length] } })),
      },
    ],
  };

  return (
    <ReactECharts option={option} style={{ height: expanded ? EXPANDED_HEIGHT : height, width: "100%" }} notMerge lazyUpdate opts={{ renderer: "canvas" }} />
  );
}
