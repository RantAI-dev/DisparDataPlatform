import { idfmt, type Point } from "../format";

// Palet lebih banyak & berbeda agar irisan tidak berulang warna.
const PALETTE = ["#ed6b23", "#f0a13a", "#0e7c42", "#2563eb", "#7c3aed", "#0891b2", "#e11d48", "#65a30d", "#db2777", "#0d9488"];
const MUTED = "#cbd5e1"; // untuk irisan "Lainnya"

export type DonutProps = {
  data: Point[];
  /** Persentase tiap irisan tampil permanen; irisan < ~2% disembunyikan agar tak bertumpuk. */
  showPercent?: boolean;
  /** Peta label→warna agar warna menempel pada NAMA; label lain memakai palet berurutan. */
  colorMap?: Record<string, string>;
};

type Irisan = { name: string; value: number; percent: number };
const persen = (p: number) => p.toLocaleString("id-ID", { maximumFractionDigits: 1 });

/** Proporsi (donut): legenda scroll di bawah, pie di tengah (Donut.tsx). */
export function opsiDonut({ data, showPercent = false, colorMap }: DonutProps, expanded: boolean) {
  return {
    color: PALETTE,
    tooltip: {
      trigger: "item",
      formatter: (p: Irisan) => `${p.name}: ${idfmt(p.value)} (${p.percent}%)`,
    },
    legend: {
      type: "scroll",
      orient: "horizontal",
      bottom: 0,
      left: "center",
      icon: "circle",
      itemWidth: 9,
      itemHeight: 9,
      itemGap: 12,
      textStyle: { color: "#475569", fontSize: 11 },
      pageIconSize: 9,
      pageTextStyle: { color: "#94a3b8" },
    },
    series: [
      {
        type: "pie",
        radius: showPercent ? ["44%", "64%"] : ["52%", "74%"],
        center: ["50%", "44%"],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: "#fff", borderWidth: 2 },
        label: expanded
          ? {
              show: true,
              position: "outside",
              // showPercent: nilai sudah berupa persentase, jangan ditampilkan dua kali.
              formatter: (p: Irisan) => (showPercent ? `${p.name}\n${persen(p.percent)}%` : `${p.name}\n${idfmt(p.value)} (${persen(p.percent)}%)`),
              color: "#33302b",
              fontSize: 12,
              fontWeight: 600,
            }
          : showPercent
            ? {
                show: true,
                position: "outside",
                formatter: (p: { percent: number }) => `${persen(p.percent)}%`,
                color: "#33302b",
                fontSize: 11,
                fontWeight: 600,
              }
            : { show: false },
        labelLine: { show: expanded || showPercent, length: 6, length2: 6 },
        minShowLabelAngle: expanded ? 0 : 7,
        data: data.map((d) => {
          const mapped = colorMap?.[d.label];
          if (mapped) return { name: d.label, value: d.value, itemStyle: { color: mapped } };
          if (/^lainnya$/i.test(d.label)) return { name: d.label, value: d.value, itemStyle: { color: MUTED } };
          return { name: d.label, value: d.value };
        }),
      },
    ],
  };
}
