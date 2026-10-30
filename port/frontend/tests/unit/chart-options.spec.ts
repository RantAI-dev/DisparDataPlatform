// Snapshot builder opsi chart. Snapshot pertama sudah dibandingkan sekali dengan opsi yang direkam
// harness golden plan 01 dari komponen v2 asli (28 kasus normal/diperbesar identik, lihat ADR 0001).
import { describe, expect, it } from "vitest";
import { opsiBarBreakdown, tinggiBarBreakdown } from "../../layers/shared/utils/chart-options/bar-breakdown";
import { opsiBarChart } from "../../layers/shared/utils/chart-options/bar-chart";
import { opsiComboBarLine } from "../../layers/shared/utils/chart-options/combo-bar-line";
import { opsiDonut } from "../../layers/shared/utils/chart-options/donut";
import { opsiGroupedBars } from "../../layers/shared/utils/chart-options/grouped-bars";
import { opsiGroupedLines } from "../../layers/shared/utils/chart-options/grouped-lines";
import { opsiLineTrend } from "../../layers/shared/utils/chart-options/line-trend";
import { opsiTreemap } from "../../layers/shared/utils/chart-options/treemap";
import { opsiVerticalBars } from "../../layers/shared/utils/chart-options/vertical-bars";
import { categoryZoom } from "../../layers/shared/utils/chart-options/zoom";

// Formatter dijalankan dengan contoh nilai supaya keluarannya ikut ter-snapshot.
const CONTOH: unknown[] = [1234.5, { value: 1234.5, name: "A", percent: 12.345 }, { value: null, name: "B", percent: 0.5 }, "202401", null];
function ser(x: unknown): unknown {
  if (typeof x === "function") {
    return `fn:${CONTOH.map((c) => {
      try {
        return String((x as (a: unknown) => unknown)(c));
      } catch {
        return "ERR";
      }
    }).join("|")}`;
  }
  if (Array.isArray(x)) return x.map(ser);
  if (x && typeof x === "object") {
    return Object.fromEntries(Object.keys(x).sort().map((k) => [k, ser((x as Record<string, unknown>)[k])]));
  }
  return x;
}

const pts = (n: number, base = 1000) => Array.from({ length: n }, (_, i) => ({ label: `L${String(i).padStart(2, "0")}`, value: base + i * 137.25 }));
const per = [{ label: "202401", value: 1200 }, { label: "202402", value: 1530.5 }, { label: "202403", value: 980 }];

const KASUS: [string, (expanded: boolean) => unknown][] = [
  ["BarBreakdown", (e) => opsiBarBreakdown({ data: pts(5), unit: " org" }, e)],
  ["BarBreakdown banyak baris + colors", (e) => opsiBarBreakdown({ data: pts(20), colors: ["#111", "#222"] }, e)],
  ["VerticalBars", (e) => opsiVerticalBars({ data: pts(8), unit: "%", color: "#0e7c42", labelFmt: (s) => `${s}!` }, e)],
  ["GroupedBars", (e) => opsiGroupedBars({ series: [{ name: "2023", data: pts(3) }, { name: "2024", data: pts(2) }], categories: ["L00", "L01", "L02"], unit: " k" }, e)],
  ["GroupedBars missingValue null", (e) => opsiGroupedBars({ series: [{ name: "2024", data: pts(2) }], categories: ["L00", "L01", "L02"], missingValue: null, colors: ["#000"] }, e)],
  ["GroupedLines", (e) => opsiGroupedLines({ series: [{ name: "B3", data: per }, { name: "B4", data: [{ label: "202312", value: 5 }, ...per.slice(1)] }] }, e)],
  ["LineTrend", (e) => opsiLineTrend({ data: per }, e)],
  ["LineTrend unit", (e) => opsiLineTrend({ data: pts(30), unit: "tamu", yName: "Tamu" }, e)],
  ["ComboBarLine", (e) => opsiComboBarLine({ categories: ["2022", "2023"], bar: { name: "Tamu", values: [100, null], unit: " org" }, line: { name: "PDRB", values: [1.5, 2], unit: "%" } }, e)],
  ["ComboBarLine satu sumbu", (e) => opsiComboBarLine({ categories: ["2022", "2023"], dualAxis: false, bar: { name: "A", values: [1, 2] }, line: { name: "B", values: [null, 3] } }, e)],
  ["Donut", (e) => opsiDonut({ data: [...pts(4), { label: "Lainnya", value: 50 }] }, e)],
  ["Donut showPercent + colorMap", (e) => opsiDonut({ data: pts(4), showPercent: true, colorMap: { L01: "#123456" } }, e)],
  ["Treemap", (e) => opsiTreemap({ data: pts(12) }, e)],
  ["BarChart", () => opsiBarChart({ data: per })],
];

describe("builder opsi chart", () => {
  for (const [nama, buat] of KASUS) {
    it(`${nama} — normal`, () => expect(ser(buat(false))).toMatchSnapshot());
    it(`${nama} — diperbesar`, () => expect(ser(buat(true))).toMatchSnapshot());
  }

  it("categoryZoom mempersempit jendela di layar < 640 px (hanya sumbu-x)", () => {
    expect(categoryZoom(30, false, 14, 1440)[0]).toMatchObject({ end: (14 / 30) * 100, xAxisIndex: 0 });
    expect(categoryZoom(30, false, 14, 375)[0]).toMatchObject({ end: 20 });
    expect(categoryZoom(30, true, 14, 375)[0]).toMatchObject({ end: (14 / 30) * 100, yAxisIndex: 0 });
    expect(categoryZoom(5)[0]).toMatchObject({ end: 100 });
    expect(categoryZoom(1000, false, 14, 1440)[0]).toMatchObject({ end: 5 });
  });

  it("tinggi BarBreakdown mengikuti jumlah baris", () => {
    expect(tinggiBarBreakdown(2, false)).toBe(160);
    expect(tinggiBarBreakdown(10, false)).toBe(360);
    expect(tinggiBarBreakdown(20, true)).toBe("min(68vh, 640px)");
    expect(tinggiBarBreakdown(20, false)).toBe(700);
  });
});
