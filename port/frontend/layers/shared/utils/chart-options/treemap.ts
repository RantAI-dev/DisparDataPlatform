import { idfmt, type Point } from "../format";

const PALETTE = ["#ed6b23", "#f0a13a", "#c2410c", "#f4a672", "#9a3412", "#fb923c", "#b45309", "#ea580c", "#fdba74", "#7c2d12"];

export type TreemapProps = { data: Point[] };

/** Treemap komposisi untuk detail proporsi (Treemap.tsx). */
export function opsiTreemap({ data }: TreemapProps, expanded: boolean) {
  const total = data.reduce((a, p) => a + p.value, 0) || 1;
  const pct = (v: number) => ((v / total) * 100).toFixed(1);
  return {
    tooltip: {
      formatter: (p: { name: string; value: number }) => `${p.name}<br/><b>${idfmt(p.value)}</b> (${pct(p.value)}%)`,
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
              formatter: (p: { name: string; value: number }) => `${p.name}\n${idfmt(p.value)} (${pct(p.value)}%)`,
              color: "#fff",
              fontSize: 13,
            }
          : { show: true, formatter: "{b}", color: "#fff", fontSize: 11 },
        itemStyle: { borderColor: "#fff", borderWidth: 2, gapWidth: 2 },
        data: data.map((d, i) => ({ name: d.label, value: d.value, itemStyle: { color: PALETTE[i % PALETTE.length] } })),
      },
    ],
  };
}
