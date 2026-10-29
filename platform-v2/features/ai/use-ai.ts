"use client";

import * as React from "react";
import type { AgentEvent, AiMode, ChartSpec } from "@/lib/ai/agent";

export type { AiMode, ChartSpec };

/** Satu langkah tool yang dijalankan agen (cari data, query, grafik). */
export type Step = {
  id: string;
  tool: string;
  label: string;
  sql?: string;
  status: "running" | "ok" | "error";
  error?: string;
  columns?: string[];
  rows?: Record<string, unknown>[];
  rowCount?: number;
  tables?: { fq: string; title?: string; rows: number }[];
};

export type Msg = {
  role: "user" | "assistant";
  content: string;
  mode?: AiMode;
  steps?: Step[];
  charts?: ChartSpec[];
  /** Teks status saat agen bekerja. */
  status?: string;
  /** Angka di jawaban yang tidak ditemukan di hasil query. */
  unverified?: string[];
  streaming?: boolean;
  failed?: boolean;
};

function newSessionId(): string {
  const r = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  return `atlas-${r}`;
}

function useAiState() {
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [mode, setMode] = React.useState<AiMode>("ask");
  const [model, setModel] = React.useState<{ model: string; configured: boolean } | null>(null);
  const abortRef = React.useRef<AbortController | null>(null);
  // Satu ID per percakapan → header x-opencode-session (prompt caching di OpenCode Go).
  const sessionRef = React.useRef<string>(newSessionId());

  React.useEffect(() => {
    fetch("/api/ai/chat")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => j && setModel(j))
      .catch(() => {});
  }, []);

  const send = React.useCallback(
    async (text: string, modeOverride?: AiMode) => {
      const q = text.trim();
      if (!q || busy) return;
      const useMode = modeOverride ?? mode;
      setError(null);

      const history: Msg[] = [...messages, { role: "user", content: q, mode: useMode }];
      const assistant: Msg = { role: "assistant", content: "", mode: useMode, steps: [], charts: [], streaming: true, status: "Manggil Jekate…" };
      setMessages([...history, assistant]);
      setBusy(true);

      // Mutasi lokal lalu commit salinan ke state per event.
      const cur: Msg = { ...assistant, steps: [], charts: [] };
      const commit = () => setMessages([...history, { ...cur, steps: [...cur.steps!], charts: [...cur.charts!] }]);

      const ac = new AbortController();
      abortRef.current = ac;
      try {
        const res = await fetch("/api/ai/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ac.signal,
          body: JSON.stringify({
            mode: useMode,
            session: sessionRef.current,
            messages: history.map((m) => ({
              role: m.role,
              content: m.content,
              queries: m.role === "assistant"
                ? [...(m.charts ?? []).map((c) => c.sql), ...(m.steps ?? []).filter((s) => s.tool === "run_sql" && s.status === "ok" && s.sql).map((s) => s.sql!)].slice(0, 4)
                : undefined,
            })),
          }),
        });
        if (!res.ok || !res.body) {
          const j = await res.json().catch(() => null);
          throw new Error(j?.error ?? `AI gagal merespons (${res.status})`);
        }

        const reader = res.body.getReader();
        const dec = new TextDecoder();
        let buf = "";
        let finished = false;
        const handle = (e: AgentEvent | { type: "error"; message: string } | { type: "ping" }) => {
          if (e.type === "ping") return;
          switch (e.type) {
            case "status":
              cur.status = e.text;
              break;
            case "step":
              cur.steps!.push({ id: e.id, tool: e.tool, label: e.label, sql: e.sql, status: "running" });
              cur.status = e.label + "…";
              break;
            case "step_done": {
              const i = cur.steps!.findIndex((s) => s.id === e.id);
              if (i >= 0)
                cur.steps![i] = {
                  ...cur.steps![i],
                  status: e.ok ? "ok" : "error",
                  error: e.error,
                  columns: e.columns,
                  rows: e.rows,
                  rowCount: e.rowCount,
                  tables: e.tables,
                };
              break;
            }
            case "chart":
              cur.charts!.push(e.chart);
              break;
            case "answer":
              cur.content = e.text;
              break;
            case "done":
              cur.unverified = e.unverified;
              cur.streaming = false;
              cur.status = undefined;
              finished = true;
              break;
            case "error":
              throw new Error(e.message);
          }
          commit();
        };

        for (;;) {
          const { value, done } = await reader.read();
          if (done) break;
          buf += dec.decode(value, { stream: true });
          let nl: number;
          while ((nl = buf.indexOf("\n")) >= 0) {
            const line = buf.slice(0, nl).trim();
            buf = buf.slice(nl + 1);
            if (line) handle(JSON.parse(line));
          }
        }
        if (buf.trim()) handle(JSON.parse(buf));
        if (!finished) throw new Error("Koneksi ke Jekate terputus sebelum jawaban selesai");
      } catch (e) {
        const msg = ac.signal.aborted ? "Dihentikan." : e instanceof Error ? e.message : String(e);
        cur.streaming = false;
        cur.status = undefined;
        cur.failed = !ac.signal.aborted;
        if (!cur.content) cur.content = ac.signal.aborted ? "_Dihentikan._" : `Maaf, terjadi kesalahan: ${msg}`;
        commit();
        if (!ac.signal.aborted) setError(msg);
      } finally {
        abortRef.current = null;
        setBusy(false);
      }
    },
    [busy, messages, mode],
  );

  const stop = React.useCallback(() => abortRef.current?.abort(), []);

  const newChat = React.useCallback(() => {
    abortRef.current?.abort();
    sessionRef.current = newSessionId();
    setMessages([]);
    setError(null);
  }, []);

  return { messages, busy, error, send, stop, newChat, mode, setMode, model };
}

type AiValue = ReturnType<typeof useAiState>;
const AiContext = React.createContext<AiValue | null>(null);

export function AiProvider({ children }: { children: React.ReactNode }) {
  const value = useAiState();
  return React.createElement(AiContext.Provider, { value }, children);
}

export function useAi(): AiValue {
  const ctx = React.useContext(AiContext);
  if (!ctx) throw new Error("useAi must be used within an AiProvider");
  return ctx;
}
