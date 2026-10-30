import { idfmt, type Point } from "../format";
import { categoryZoom, ZOOM_PAD } from "./zoom";

const PALETTE = ["#ed6b23", "#f0a13a", "#c2410c", "#9a3412", "#fb923c", "#7c2d12"];

export type GroupedBarsProps = {
  series: { name: string; data: Point[] }[];
  categories: string[];
  unit?: string;
  colors?: string[];
  missingValue?: 0 | null;
};

/** Bar berkelompok (multi-seri), mis. Q1–Q4 dibandingkan antar tahun (GroupedBars.tsx). */
export function opsiGroupedBars({ series, categories, unit = "", colors, missingValue = 0 }: GroupedBarsProps, expanded: boolean) {
  return {
    color: colors ?? PALETTE,
    grid: { left: 6, right: 16, top: 30, bottom: 6 + (expanded ? ZOOM_PAD : 0), containLabel: true },
    ...(expanded ? { dataZoom: categoryZoom(categories.length, false, 10) } : {}),
    tooltip: { trigger: "axis", axisPointer: { type: "shadow" }, valueFormatter: (v: number | null | undefined) => (v == null ? "—" : idfmt(v) + unit) },
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
      ...(expanded
        ? { labelLayout: { hideOverlap: true }, label: { show: true, position: "top", fontSize: 10, color: "#334155", formatter: (p: { value: number | null }) => (p.value == null ? "" : idfmt(p.value) + unit) } }
        : {}),
      data: categories.map((c) => s.data.find((d) => d.label === c)?.value ?? missingValue),
    })),
  };
}
