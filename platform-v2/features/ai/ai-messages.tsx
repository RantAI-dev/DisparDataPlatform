"use client";

import * as React from "react";
import { AlertTriangle, ChevronRight, Database, Search, BarChart3, TableProperties, Check, X, Loader2 } from "lucide-react";
import { GenerativeMessage } from "./generative-ui";
import { ResultTable } from "./chart-view";
import { ChartBoard } from "./spec-chart";
import type { Msg, Step } from "./use-ai";
import { JekateAvatar } from "./jekate-avatar";

const TOOL_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  search_data: Search,
  describe_table: TableProperties,
  run_sql: Database,
  make_chart: BarChart3,
};

function StepRow({ s }: { s: Step }) {
  const [open, setOpen] = React.useState(false);
  const Icon = TOOL_ICON[s.tool] ?? Database;
  const hasDetail = !!(s.sql || s.error || s.rows?.length || s.tables?.length);
  return (
    <div className="step-row">
      <button type="button" className={`step-head ${open ? "open" : ""}`} onClick={() => hasDetail && setOpen((o) => !o)}>
        {hasDetail ? <ChevronRight className="chev" /> : <span style={{ width: 12 }} />}
        <Icon className="step-ico" />
        <span className="step-label">{s.label}</span>
        <span className="step-meta">
          {s.status === "running" ? (
            <Loader2 className="spin" />
          ) : s.status === "error" ? (
            <span className="badge red"><X /> gagal</span>
          ) : s.rowCount != null ? (
            <span className="badge green"><Check /> {s.rowCount.toLocaleString("id-ID")} baris</span>
          ) : s.tables ? (
            <span className="badge sky"><Check /> {s.tables.length} tabel</span>
          ) : (
            <span className="badge green"><Check /></span>
          )}
        </span>
      </button>
      {open ? (
        <div className="step-body">
          {s.error ? (
            <div className="err-banner" style={{ margin: 0 }}>
              <AlertTriangle />
              <span>{s.error}</span>
            </div>
          ) : null}
          {s.sql ? <pre className="sql-pre">{s.sql}</pre> : null}
          {s.tables?.length ? (
            <div className="ds-list" style={{ borderRadius: 0, border: 0 }}>
              {s.tables.map((t) => (
                <div className="ds-item" key={t.fq}>
                  <span className="cdot" />
                  <span className="ds-name">{t.title ?? t.fq}</span>
                  <span className="ds-tier">{t.fq}</span>
                  <span className="ds-rows">{t.rows.toLocaleString("id-ID")} baris</span>
                </div>
              ))}
            </div>
          ) : null}
          {s.rows?.length && s.columns ? <ResultTable columns={s.columns} rows={s.rows} title="Hasil query" /> : null}
        </div>
      ) : null}
    </div>
  );
}

function Steps({ steps, live }: { steps: Step[]; live: boolean }) {
  const [open, setOpen] = React.useState(true);
  // Tutup otomatis setelah jawaban selesai supaya transkrip ringkas.
  const wasLive = React.useRef(live);
  React.useEffect(() => {
    if (wasLive.current && !live) setOpen(false);
    wasLive.current = live;
  }, [live]);
  if (!steps.length) return null;
  const failed = steps.filter((s) => s.status === "error").length;
  return (
    <div className="activity fade-up">
      <button type="button" onClick={() => setOpen((o) => !o)} className={`act-head ${open ? "open" : ""}`}>
        <ChevronRight className="chev" />
        <Database className="size-3.5 text-[color:var(--brand-sky)]" />
        <span className="act-label">Langkah kerja</span>
        <span className="act-sub">
          · {steps.length} langkah{failed ? ` · ${failed} diperbaiki` : ""}
        </span>
      </button>
      {open ? <div className="act-list">{steps.map((s) => <StepRow key={s.id} s={s} />)}</div> : null}
    </div>
  );
}

function Thinking({ text }: { text?: string }) {
  return (
    <div className="think-body">
      <span className="dots"><i /><i /><i /></span>
      <span>{text ?? "Jekate lagi ngulik datanya…"}</span>
    </div>
  );
}

function BotTurn({ m, compact }: { m: Msg; compact?: boolean }) {
  return (
    <div className="turn fade-up">
      <div className="msg-bot">
        <div className="bot-ava mascot" aria-hidden><JekateAvatar size={30} /></div>
        <div className="bot-body">
          <div className="bot-name">
            <b>Jekate</b>
            <span className="tag">{m.mode === "bi" ? "bi" : "ask"}</span>
          </div>
          <Steps steps={m.steps ?? []} live={!!m.streaming} />
          <ChartBoard charts={m.charts ?? []} compact={compact} />
          {m.streaming && !m.content ? <Thinking text={m.status} /> : null}
          {m.content ? <GenerativeMessage content={m.content} streaming={false} /> : null}
          {m.unverified?.length ? (
            <div className="unverified-note">
              <AlertTriangle />
              <span>
                Angka ini tidak ditemukan di hasil query, mohon dicek: <b>{m.unverified.join(", ")}</b>
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function UserTurn({ m }: { m: Msg }) {
  return (
    <div className="turn fade-up">
      <div className="msg-user">
        <div className="bubble">{m.content}</div>
        <div className="msg-meta">
          <span className="chan-dot" style={{ background: "var(--brand-sky)" }} />
          <span>Anda{m.mode === "bi" ? " · mode BI" : ""}</span>
        </div>
      </div>
    </div>
  );
}

export function AiMessages({
  messages, error, compact,
}: {
  messages: Msg[];
  busy?: boolean;
  error?: string | null;
  compact?: boolean;
}) {
  const endRef = React.useRef<HTMLDivElement>(null);
  const last = messages[messages.length - 1];
  const sig = `${messages.length}:${last?.steps?.length ?? 0}:${last?.charts?.length ?? 0}:${last?.content.length ?? 0}`;
  React.useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [sig]);

  return (
    <div className="transcript">
      {messages.map((m, i) => (m.role === "user" ? <UserTurn key={i} m={m} /> : <BotTurn key={i} m={m} compact={compact} />))}
      {error && !last?.failed ? (
        <div className="err-banner fade-up">
          <AlertTriangle />
          <span>{error}</span>
        </div>
      ) : null}
      <div ref={endRef} />
    </div>
  );
}
