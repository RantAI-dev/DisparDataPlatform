"use client";

import * as React from "react";
import dynamic from "next/dynamic";
import { Code2, Download } from "lucide-react";
import type { ChartSpec } from "@/lib/ai/agent";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

type Row = Record<string, unknown>;

const PALETTE = [
  "#ed6b23", "#0ea5e9", "#10b981", "#8b5cf6", "#f59e0b",
  "#ec4899", "#14b8a6", "#64748b", "#84cc16", "#ef4444",
];
const AXIS = "#6b6459";
const GRID = "#ece6df";

const num = (v: unknown): number | null => {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
};
const str = (v: unknown) => (v == null ? "—" : String(v));

function formatter(fmt: ChartSpec["format"], compact = false) {
  return (v: unknown): string => {
    const n = num(v);
    if (n == null) return str(v);
    if (fmt === "percent") return `${n.toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`;
    const a = Math.abs(n);
    let s: string;
    if (compact && a >= 1e12) s = `${(n / 1e12).toLocaleString("id-ID", { maximumFractionDigits: 1 })} T`;
    else if (compact && a >= 1e9) s = `${(n / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 1 })} M`;
    else if (compact && a >= 1e6) s = `${(n / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
    else if (compact && a >= 1e3) s = `${(n / 1e3).toLocaleString("id-ID", { maximumFractionDigits: 1 })} rb`;
    else s = n.toLocaleString("id-ID", { maximumFractionDigits: 2 });
    return fmt === "rupiah" ? `Rp ${s}` : s;
  };
}

const pretty = (c: string) => c.replace(/_/g, " ");

/** Long format (x, series, y) → kategori + satu deret per nilai series. */
function pivot(rows: Row[], x: string, y: string, series?: string) {
  const cats: string[] = [];
  const catIdx = new Map<string, number>();
  for (const r of rows) {
    const k = str(r[x]);
    if (!catIdx.has(k)) {
      catIdx.set(k, cats.length);
      cats.push(k);
    }
  }
  if (!series) return { cats, groups: [] as { name: string; data: (number | null)[] }[] };
  const groups = new Map<string, (number | null)[]>();
  for (const r of rows) {
    const g = str(r[series]);
    if (!groups.has(g)) groups.set(g, new Array(cats.length).fill(null));
    groups.get(g)![catIdx.get(str(r[x]))!] = num(r[y]);
  }
  return { cats, groups: [...groups.entries()].map(([name, data]) => ({ name, data })) };
}

function buildOption(spec: ChartSpec): Record<string, unknown> {
  const { kind, rows, y, series } = spec;
  const x = spec.x ?? spec.columns[0];
  const fmt = formatter(spec.format);
  const fmtC = formatter(spec.format, true);
  const base = {
    color: PALETTE,
    textStyle: { color: AXIS, fontFamily: "inherit", fontSize: 11 },
    tooltip: {
      trigger: kind === "pie" || kind === "treemap" || kind === "scatter" ? "item" : "axis",
      confine: true,
      backgroundColor: "#fff",
      borderColor: GRID,
      textStyle: { color: "#1c1a17", fontSize: 12 },
      valueFormatter: fmt,
    },
  };
  const legendOn = (n: number) => (n > 1 ? { bottom: 0, type: "scroll", icon: "circle", textStyle: { color: AXIS, fontSize: 11 } } : undefined);
  const valueAxis = {
    type: "value",
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: { lineStyle: { color: GRID, type: "dashed" } },
    axisLabel: { color: AXIS, fontSize: 10.5, formatter: fmtC, hideOverlap: true },
    splitNumber: 4,
  };

  if (kind === "pie") {
    return {
      ...base,
      legend: { bottom: 0, type: "scroll", icon: "circle", textStyle: { color: AXIS, fontSize: 11 } },
      series: [{
        type: "pie", radius: ["42%", "70%"], center: ["50%", "45%"],
        itemStyle: { borderColor: "#fff", borderWidth: 2 },
        label: { formatter: "{d}%", fontSize: 10.5 },
        data: rows.map((r) => ({ name: str(r[x]), value: num(r[y[0]]) })),
      }],
    };
  }
  if (kind === "treemap") {
    return {
      ...base,
      series: [{
        type: "treemap", roam: false, nodeClick: false, breadcrumb: { show: false },
        label: { fontSize: 11, formatter: (p: { name: string; value: number }) => `${p.name}\n${fmtC(p.value)}` },
        data: rows.map((r, i) => ({ name: str(r[x]), value: num(r[y[0]]), itemStyle: { color: PALETTE[i % PALETTE.length] } })),
      }],
    };
  }
  if (kind === "scatter") {
    return {
      ...base,
      grid: { left: 8, right: 16, top: 24, bottom: 28, containLabel: true },
      xAxis: { ...valueAxis, name: pretty(x), nameLocation: "middle", nameGap: 26 },
      yAxis: { ...valueAxis, name: pretty(y[0]) },
      series: [{
        type: "scatter", symbolSize: 10,
        data: rows.map((r) => [num(r[x]), num(r[y[0]]), series ? str(r[series]) : ""]),
      }],
    };
  }

  // Seri berbasis kategori: bar, hbar, stacked, line, area.
  const horizontal = kind === "hbar";
  const { cats, groups } = pivot(rows, x, y[0], series);
  const isLine = kind === "line" || kind === "area";
  const stack = kind === "stacked" ? "total" : kind === "area" && (groups.length > 1 || y.length > 1) ? "total" : undefined;
  const seriesData = groups.length
    ? groups.map((g) => ({ name: g.name, data: g.data }))
    : y.map((col) => ({ name: pretty(col), data: rows.map((r) => num(r[col])) }));
  const catAxis = {
    type: "category",
    data: cats,
    inverse: horizontal,
    axisLine: { lineStyle: { color: GRID } },
    axisTick: { show: false },
    axisLabel: {
      color: AXIS, fontSize: 10.5,
      rotate: !horizontal && cats.length > 8 && cats.some((c) => c.length > 6) ? 30 : 0,
      formatter: (v: string) => (v.length > 22 ? v.slice(0, 20) + "…" : v),
    },
  };
  return {
    ...base,
    legend: legendOn(seriesData.length),
    grid: { left: 8, right: 18, top: 18, bottom: seriesData.length > 1 ? 36 : 8, containLabel: true },
    xAxis: horizontal ? valueAxis : catAxis,
    yAxis: horizontal ? catAxis : valueAxis,
    series: seriesData.map((s) => ({
      ...s,
      type: isLine ? "line" : "bar",
      stack,
      smooth: isLine ? 0.25 : undefined,
      symbol: isLine ? "circle" : undefined,
      symbolSize: isLine ? 5 : undefined,
      showSymbol: isLine ? cats.length <= 40 : undefined,
      areaStyle: kind === "area" ? { opacity: 0.18 } : undefined,
      barMaxWidth: 34,
      itemStyle: isLine ? undefined : { borderRadius: horizontal ? [0, 4, 4, 0] : stack ? 0 : [4, 4, 0, 0] },
    })),
  };
}

function toCsv(spec: ChartSpec): string {
  const esc = (v: unknown) => {
    const s = v == null ? "" : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return [spec.columns.join(","), ...spec.rows.map((r) => spec.columns.map((c) => esc(r[c])).join(","))].join("\n");
}

function downloadCsv(spec: ChartSpec) {
  const blob = new Blob(["﻿" + toCsv(spec)], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${spec.title.replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "data"}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

function KpiCard({ spec }: { spec: ChartSpec }) {
  const r = spec.rows[0] ?? {};
  const fmt = formatter(spec.format);
  const main = r[spec.y[0]];
  const cmp = spec.y[1] ? r[spec.y[1]] : undefined;
  return (
    <div className="kpi-card fade-up">
      <div className="kpi-label">{spec.title}</div>
      <div className="kpi-value">{fmt(main)}</div>
      {cmp !== undefined ? (
        <div className="kpi-sub">
          {pretty(spec.y[1])}: <b>{formatter(spec.y[1].includes("persen") || spec.y[1].includes("pct") ? "percent" : spec.format)(cmp)}</b>
        </div>
      ) : spec.subtitle ? (
        <div className="kpi-sub">{spec.subtitle}</div>
      ) : null}
    </div>
  );
}

function SpecTable({ spec }: { spec: ChartSpec }) {
  const fmt = formatter(spec.format);
  return (
    <div className="overflow-auto" style={{ maxHeight: 340 }}>
      <table className="gu-table" style={{ borderRadius: 0, border: 0 }}>
        <thead>
          <tr>{spec.columns.map((c) => <th key={c}>{pretty(c)}</th>)}</tr>
        </thead>
        <tbody>
          {spec.rows.slice(0, 200).map((r, i) => (
            <tr key={i}>
              {spec.columns.map((c) => (
                <td key={c} style={num(r[c]) != null ? { textAlign: "right", fontVariantNumeric: "tabular-nums" } : undefined}>
                  {spec.y.includes(c) ? fmt(r[c]) : str(r[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SpecChart({ spec }: { spec: ChartSpec }) {
  const [showSql, setShowSql] = React.useState(false);
  const option = React.useMemo(() => (spec.kind === "kpi" || spec.kind === "table" ? null : buildOption(spec)), [spec]);
  if (spec.kind === "kpi") return <KpiCard spec={spec} />;
  const tall = spec.kind === "hbar" ? Math.min(560, Math.max(260, new Set(spec.rows.map((r) => str(r[spec.x ?? ""]))).size * 24 + 40)) : 300;

  return (
    <div className="chart-card fade-up">
      <div className="chart-head">
        <span className="cdot" />
        <span className="title">
          {spec.title}
          {spec.subtitle ? <span className="chart-sub"> · {spec.subtitle}</span> : null}
        </span>
        <span className="chart-tools">
          <button type="button" title="Lihat SQL" onClick={() => setShowSql((s) => !s)} className={showSql ? "on" : ""}>
            <Code2 />
          </button>
          <button type="button" title="Unduh CSV" onClick={() => downloadCsv(spec)}>
            <Download />
          </button>
        </span>
      </div>
      {showSql ? <pre className="sql-pre" style={{ margin: 0, borderRadius: 0 }}>{spec.sql}</pre> : null}
      {spec.kind === "table" ? (
        <SpecTable spec={spec} />
      ) : (
        <div style={{ height: tall, padding: "6px 8px 8px" }}>
          <ReactECharts option={option!} style={{ height: "100%", width: "100%" }} notMerge lazyUpdate opts={{ renderer: "canvas" }} />
        </div>
      )}
    </div>
  );
}

/** KPI dikumpulkan dalam satu baris, grafik lain di grid. */
export function ChartBoard({ charts, compact }: { charts: ChartSpec[]; compact?: boolean }) {
  if (!charts.length) return null;
  const kpis = charts.filter((c) => c.kind === "kpi");
  const rest = charts.filter((c) => c.kind !== "kpi");
  return (
    <div className="chart-board">
      {kpis.length ? <div className="kpi-row">{kpis.map((c) => <SpecChart key={c.id} spec={c} />)}</div> : null}
      {rest.length ? (
        <div className={`chart-grid ${!compact && rest.length > 1 ? "two" : ""}`}>
          {rest.map((c) => <SpecChart key={c.id} spec={c} />)}
        </div>
      ) : null}
    </div>
  );
}
