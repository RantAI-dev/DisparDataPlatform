import { idfmt, type Point } from "../format";
import { categoryZoom, EXPANDED_HEIGHT, ZOOM_PAD } from "./zoom";

export type BarBreakdownProps = {
  data: Point[];
  unit?: string;
  color?: string;
  /** Warna per batang (sejajar urutan `data`); bila ada, menggantikan `color`. */
  colors?: string[];
};

/** Tinggi bar horizontal: mengikuti jumlah baris; >14 baris saat diperbesar memakai slider. */
export function tinggiBarBreakdown(n: number, expanded: boolean): string | number {
  return expanded && n > 14 ? EXPANDED_HEIGHT : Math.max(160, n * 34 + 20);
}

/** Bar horizontal untuk breakdown kategori/wilayah (BarBreakdown.tsx). */
export function opsiBarBreakdown({ data, unit = "", color = "#ed6b23", colors }: BarBreakdownProps, expanded: boolean) {
  const cats = data.map((d) => d.label);
  const vals = data.map((d) => d.value);
  const manyRows = data.length > 14;
  return {
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
}
