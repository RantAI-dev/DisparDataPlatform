import { idfmt, type Point } from "../format";
import { categoryZoom, ZOOM_PAD } from "./zoom";

export type VerticalBarsProps = {
  data: Point[];
  unit?: string;
  color?: string;
  labelFmt?: (s: string) => string;
};

/** Bar vertikal, mis. tren bulanan / kuartal (VerticalBars.tsx). */
export function opsiVerticalBars({ data, unit = "", color = "#ed6b23", labelFmt }: VerticalBarsProps, expanded: boolean) {
  return {
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
}
