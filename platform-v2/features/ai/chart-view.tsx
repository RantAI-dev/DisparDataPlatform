"use client";

import * as React from "react";
import dynamic from "next/dynamic";

const ReactECharts = dynamic(() => import("echarts-for-react"), { ssr: false });

type Row = Record<string, unknown>;

const PALETTE = [
  "#ed6b23", "#ff8a4a", "#0ea5e9", "#10b981", "#f59e0b",
  "#8b5cf6", "#ec4899", "#14b8a6", "#f97316", "#84cc16",
];

const fmtInt = (v: number) => Math.round(v).toLocaleString("id-ID");
const fmtCompact = (v: number) => {
  const a = Math.abs(v);
  if (a >= 1_000_000) return `${(v / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} jt`;
  if (a >= 1_000) return `${(v / 1_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} rb`;
  return fmtInt(v);
};

const num = (v: unknown) => {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

const str = (v: unknown) => (v == null ? "" : String(v));

function isNumericColumn(rows: Row[], col: string): boolean {
  if (!rows.length) return false;
  let numeric = 0;
  let nonEmpty = 0;
  for (const r of rows) {
    const v = r[col];
    if (v == null || v === "") continue;
    nonEmpty++;
    if (typeof v === "number") numeric++;
    else if (typeof v === "string" && Number.isFinite(Number(v))) numeric++;
  }
  return nonEmpty > 0 && numeric / nonEmpty >= 0.8;
}

function isDateLikeColumn(rows: Row[], col: string): boolean {
  if (!rows.length) return false;
  let dateish = 0;
  let nonEmpty = 0;
  for (const r of rows) {
    const v = r[col];
    if (v == null || v === "") continue;
    nonEmpty++;
    const s = String(v);
    if (/^\d{4}-\d{2}(-\d{2})?$/.test(s)) dateish++;
    else if (!Number.isNaN(Date.parse(s)) && s.length >= 4) dateish++;
  }
  return nonEmpty > 0 && dateish / nonEmpty >= 0.7;
}

function detectKind(rows: Row[], columns: string[]): "line" | "bar" | "pie" | "table" {
  if (!rows.length || columns.length < 2) return "table";
  const first = columns[0];
  const rest = columns.slice(1);
  const allNumeric = rest.every((c) => isNumericColumn(rows, c));

  // Single label + single number → bar (or pie if small)
  if (rest.length === 1 && isNumericColumn(rows, rest[0])) {
    if (rows.length <= 6) return "pie";
    return "bar";
  }

  if (isDateLikeColumn(rows, first) && allNumeric) return "line";
  if (allNumeric && rows.length > 6) return "bar";
  if (allNumeric) return "bar";

  return "table";
}

function pickChart(columns: string[], rows: Row[]): { x: string; y: string[] } {
  const x = columns[0];
  const y = columns.slice(1).filter((c) => isNumericColumn(rows, c));
  if (y.length === 0) y.push(columns[1]);
  return { x, y };
}

function buildOption(rows: Row[], columns: string[], kind: "line" | "bar" | "pie"): unknown {
  const { x, y } = pickChart(columns, rows);
  const cat = rows.map((r) => str(r[x]));

  const base = {
    color: PALETTE,
    textStyle: { color: "#6b6459", fontFamily: "inherit", fontSize: 11 },
    tooltip: {
      trigger: kind === "pie" ? "item" : "axis",
      backgroundColor: "#ffffff",
      borderColor: "#ece6df",
      borderWidth: 1,
      textStyle: { color: "#1c1a17", fontSize: 12 },
      valueFormatter: (v: unknown) => (typeof v === "number" ? fmtInt(v) : String(v)),
    },
    legend: kind === "pie" ? { bottom: 0, textStyle: { color: "#6b6459", fontSize: 11 }, icon: "circle" } : y.length > 1 ? { bottom: 0, textStyle: { color: "#6b6459", fontSize: 11 }, icon: "circle" } : undefined,
    grid: kind === "pie" ? undefined : { left: 8, right: 16, top: 18, bottom: kind === "bar" || y.length > 1 ? 36 : 8, containLabel: true },
  };

  if (kind === "pie") {
    return {
      ...base,
      tooltip: {
        ...base.tooltip,
        formatter: (p: unknown) => {
          const o = p as { name: string; value: number; percent: number };
          return `${o.name}<br/><b>${fmtInt(o.value)}</b> (${o.percent}%)`;
        },
      },
      series: [
        {
          type: "pie",
          radius: ["45%", "72%"],
          center: ["50%", "44%"],
          avoidLabelOverlap: true,
          itemStyle: { borderColor: "#ffffff", borderWidth: 2 },
          label: { show: false },
          data: rows.map((r) => ({ name: str(r[x]), value: num(r[y[0]]) })),
        },
      ],
    };
  }

  if (kind === "line") {
    return {
      ...base,
      series: y.map((col) => ({
        type: "line",
        name: col,
        smooth: true,
        symbol: "circle",
        symbolSize: 6,
        lineStyle: { width: 2 },
        data: rows.map((r) => num(r[col])),
      })),
      xAxis: {
        type: "category",
        data: cat,
        axisLine: { lineStyle: { color: "#ece6df" } },
        axisTick: { show: false },
        axisLabel: { color: "#6b6459", fontSize: 10.5 },
      },
      yAxis: {
        type: "value",
        axisLine: { show: false },
        axisTick: { show: false },
        splitLine: { lineStyle: { color: "#ece6df", type: "dashed" } },
        axisLabel: { color: "#6b6459", fontSize: 10.5, formatter: (v: number) => fmtCompact(v) },
      },
    };
  }

  // bar (default)
  return {
    ...base,
    legend: y.length > 1 ? base.legend : undefined,
    series: y.map((col) => ({
      type: "bar",
      name: col,
      barMaxWidth: 36,
      itemStyle: { borderRadius: [4, 4, 0, 0] },
      data: rows.map((r) => num(r[col])),
    })),
    xAxis: {
      type: "category",
      data: cat,
      axisLine: { lineStyle: { color: "#ece6df" } },
      axisTick: { show: false },
      axisLabel: {
        color: "#6b6459",
        fontSize: 10.5,
        rotate: rows.length > 8 ? 30 : 0,
        formatter: (v: string) => (v.length > 14 ? v.slice(0, 12) + "…" : v),
      },
    },
    yAxis: {
      type: "value",
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: "#ece6df", type: "dashed" } },
      axisLabel: { color: "#6b6459", fontSize: 10.5, formatter: (v: number) => fmtCompact(v) },
    },
  };
}

export function ChartView({
  columns,
  rows,
  title,
}: {
  columns: string[];
  rows: Row[];
  title?: string;
}) {
  const kind = detectKind(rows, columns);

  if (kind === "table") {
    return null;
  }

  const option = React.useMemo(() => buildOption(rows, columns, kind), [rows, columns, kind]);
  const head = title ?? `Chart · ${kind.toUpperCase()} · ${rows.length} rows`;

  return (
    <div className="chart-card fade-up">
      <div className="chart-head">
        <span className="cdot" />
        <span className="title">{title ?? `Visualisasi otomatis (${kind})`}</span>
        <span className="badge sky">{kind}</span>
      </div>
      <div className={`chart-body ${rows.length > 12 ? "tall" : ""}`}>
        <ReactECharts
          option={option}
          style={{ height: "100%", width: "100%" }}
          notMerge
          lazyUpdate
          opts={{ renderer: "canvas" }}
        />
      </div>
    </div>
  );
}

export function ResultTable({
  columns,
  rows,
  title,
}: {
  columns: string[];
  rows: Row[];
  title?: string;
}) {
  const shown = rows.slice(0, 10);
  return (
    <div className="chart-card fade-up">
      <div className="chart-head">
        <span className="cdot" />
        <span className="title">{title ?? "Tabel hasil"}</span>
        <span className="badge dim">{rows.length} baris</span>
      </div>
      <div className="overflow-x-auto" style={{ maxHeight: 320 }}>
        <table className="gu-table" style={{ borderRadius: 0, border: 0 }}>
          <thead>
            <tr>
              {columns.map((c) => (
                <th key={c}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {shown.map((r, i) => (
              <tr key={i}>
                {columns.map((c) => (
                  <td key={c}>{String(r[c] ?? "")}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length > shown.length ? (
        <p className="px-4 py-2 text-[10px] text-gray-400 text-right">
          +{rows.length - shown.length} baris lainnya…
        </p>
      ) : null}
    </div>
  );
}
