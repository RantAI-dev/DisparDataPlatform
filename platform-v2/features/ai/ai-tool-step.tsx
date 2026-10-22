"use client";

import * as React from "react";
import { ChevronRight, Database, AlertTriangle } from "lucide-react";
import { ChartView, ResultTable } from "./chart-view";

export type ToolStep = {
  sql?: string;
  explanation?: string;
  assumptions?: string[];
  columns?: string[];
  rows?: Record<string, unknown>[];
  runError?: string;
  datasets?: { id: string; title: string; tier: string; rows: number }[];
  repaired?: boolean;
  repairAttempts?: number;
  repairLog?: { attempt: number; sql: string; error: string; fixed?: boolean }[];
};

function isChartable(columns?: string[], rows?: Record<string, unknown>[]): boolean {
  if (!columns || columns.length < 2 || !rows || rows.length === 0) return false;
  // First col = label, second col numeric → chartable
  const first = columns[0];
  const numericCols = columns.slice(1).filter((c) => {
    const sample = rows.slice(0, 5).map((r) => r[c]).filter((v) => v != null && v !== "");
    return sample.length > 0 && sample.every((v) => {
      if (typeof v === "number") return true;
      if (typeof v === "string") return Number.isFinite(Number(v));
      return false;
    });
  });
  if (numericCols.length === 0) return false;
  // Avoid charts when label column is too long
  const labelLen = rows.slice(0, 3).reduce((s, r) => s + String(r[first] ?? "").length, 0);
  return labelLen < 200;
}

export function SqlResult({ step }: { step: ToolStep }) {
  const [open, setOpen] = React.useState(true);
  const hasSql = !!step.sql;
  const hasError = !!step.runError;
  const hasRows = !!step.rows?.length;
  const repaired = !!step.repaired;
  const repairAttempts = step.repairAttempts ?? 0;

  if (!hasSql && !hasError && !hasRows) return null;

  return (
    <div className="activity fade-up">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`act-head ${open ? "open" : ""}`}
      >
        <ChevronRight className="chev" />
        <Database className="size-3.5 text-[color:var(--brand-sky)]" />
        <span className="act-label">SQL Query</span>
        <span className="act-sub">
          {step.runError
            ? `· error`
            : hasRows
              ? `· ${step.rows?.length} baris`
              : `· dijalankan`}
        </span>
        {repaired && (
          <span
            className="badge amber"
            title={`Self-repaired setelah ${repairAttempts} percobaan`}
          >
            <span className="bd" /> self-repaired · {repairAttempts}x
          </span>
        )}
        <span className={`badge ${step.runError ? "red" : "green"} ml-auto`}>
          <span className="bd" /> {step.runError ? "fail" : "ok"}
        </span>
      </button>
      {open && (
        <div className="act-list">
          {step.runError ? (
            <div className="px-3 py-3">
              <div className="err-banner" style={{ marginBottom: 0 }}>
                <AlertTriangle />
                <span>{step.runError}</span>
              </div>
            </div>
          ) : null}

          {/* Show the failed SQL attempts (collapsed by default) if there are any. */}
          {step.repairLog && step.repairLog.length > 0 ? (
            <div className="px-3 pt-3">
              <RepairLog log={step.repairLog} />
            </div>
          ) : null}

          {step.sql && (
            <pre className="sql-pre">{step.sql}</pre>
          )}

          {hasRows && step.columns && (
            <div className="px-3 pb-3 space-y-3">
              {isChartable(step.columns, step.rows) ? (
                <>
                  <ChartView
                    columns={step.columns}
                    rows={step.rows!}
                    title="Visualisasi otomatis"
                  />
                  <ResultTable
                    columns={step.columns}
                    rows={step.rows!}
                    title="Detail tabel"
                  />
                </>
              ) : (
                <ResultTable
                  columns={step.columns}
                  rows={step.rows!}
                  title="Hasil query"
                />
              )}
            </div>
          )}

          {step.assumptions?.length ? (
            <div className="px-3 pb-3">
              <div className="gu-callout" style={{ ["--gu-accent" as string]: "var(--accent-orange)" } as React.CSSProperties}>
                <strong style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--accent-orange)" }}>
                  Asumsi
                </strong>
                <div style={{ marginTop: 4 }}>{step.assumptions.join("; ")}</div>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}

function RepairLog({ log }: { log: { attempt: number; sql: string; error: string; fixed?: boolean }[] }) {
  const [open, setOpen] = React.useState(false);
  return (
    <div className="activity" style={{ borderRadius: "var(--radius-md)" }}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`act-head ${open ? "open" : ""}`}
        style={{ padding: "7px 10px", fontSize: 11 }}
      >
        <ChevronRight className="chev" style={{ width: 11, height: 11 }} />
        <span className="act-label" style={{ fontSize: 11 }}>
          Repair trace · {log.length} percobaan
        </span>
        <span className="badge amber" style={{ marginLeft: "auto" }}>
          <span className="bd" /> self-repair
        </span>
      </button>
      {open && (
        <div className="act-list">
          {log.map((e, i) => (
            <div key={i} style={{ padding: "8px 12px", borderBottom: i < log.length - 1 ? "1px solid var(--border)" : "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <span className={`act-status ${e.fixed ? "ok" : "err"}`}>
                  {e.fixed ? "fixed" : "err"}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--muted-foreground)" }}>
                  percobaan #{e.attempt}
                </span>
              </div>
              <pre className="sql-pre" style={{ margin: "0 0 4px", fontSize: 10.5, opacity: 0.85 }}>
                {e.sql}
              </pre>
              {!e.fixed && (
                <div style={{ fontFamily: "var(--font-mono)", fontSize: 10.5, color: "var(--destructive)" }}>
                  {e.error.length > 280 ? e.error.slice(0, 280) + "…" : e.error}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function DatasetsResult({ step }: { step: ToolStep }) {
  const [open, setOpen] = React.useState(true);
  if (!step.datasets?.length) return null;

  return (
    <div className="activity fade-up">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`act-head ${open ? "open" : ""}`}
      >
        <ChevronRight className="chev" />
        <Database className="size-3.5 text-[color:var(--brand-sky)]" />
        <span className="act-label">Catalog datasets</span>
        <span className="act-sub">· {step.datasets.length} hasil</span>
        <span className="badge sky ml-auto">
          <span className="bd" /> Search
        </span>
      </button>
      {open && (
        <div className="ds-list" style={{ borderRadius: 0, border: 0 }}>
          {step.datasets.map((d) => (
            <div className="ds-item" key={d.id}>
              <span className="cdot" />
              <span className="ds-name">{d.title}</span>
              <span className="ds-tier">{d.tier}</span>
              <span className="ds-rows">{d.rows.toLocaleString("id-ID")} rows</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
