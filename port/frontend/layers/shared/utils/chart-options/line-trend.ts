import { graphic } from "echarts/core";
import { fmtPeriode, idfmt, type Point } from "../format";
import { categoryZoom, ZOOM_PAD } from "./zoom";

export type LineTrendProps = { data: Point[]; unit?: string; yName?: string };

/** Tren per periode, garis berarea (LineTrend.tsx). */
export function opsiLineTrend({ data, unit = "kunjungan", yName = "Kunjungan" }: LineTrendProps, expanded: boolean) {
  return {
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
        lineStyle: { color: "#ed6b23", width: 2.5 },
        itemStyle: { color: "#ed6b23" },
        areaStyle: {
          color: new graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: "rgba(237, 107, 35,0.28)" },
            { offset: 1, color: "rgba(237, 107, 35,0.02)" },
          ]),
        },
      },
    ],
  };
}
