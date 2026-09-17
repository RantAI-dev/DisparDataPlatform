"use client";

import * as React from "react";

export type Msg = {
  role: "user" | "assistant";
  content: string;
  /** SQL query text */
  sql?: string;
  /** Free-text explanation */
  explanation?: string;
  /** Assumptions made by the LLM */
  assumptions?: string[];
  /** Result column names (from SQL execution) */
  columns?: string[];
  /** Result rows */
  rows?: Record<string, unknown>[];
  /** Error from executing the SQL */
  runError?: string;
  /** Resulting datasets from a catalog query */
  datasets?: { id: string; title: string; tier: string; rows: number }[];
  /** Whether the SQL was repaired after a failure */
  repaired?: boolean;
  /** Number of repair attempts the agent went through */
  repairAttempts?: number;
  /** Log of repair attempts (each contains the SQL tried + error) */
  repairLog?: { attempt: number; sql: string; error: string; fixed?: boolean }[];
  /** True while assistant message is streaming */
  streaming?: boolean;
};

function isCatalogQuestion(q: string): boolean {
  return /\b(dataset|katalog|tabel|data apa|apa saja yang ada|list dataset|sebutkan dataset|daftar dataset)\b/i.test(q);
}

function useAiState() {
  const [messages, setMessages] = React.useState<Msg[]>([]);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const send = React.useCallback(async (text: string) => {
    const q = text.trim();
    if (!q || busy) return;
    setError(null);

    const next: Msg[] = [...messages, { role: "user", content: q }];
    setMessages(next);
    setBusy(true);

    // Add a streaming placeholder assistant message
    const placeholder: Msg = { role: "assistant", content: "", streaming: true };
    setMessages([...next, placeholder]);

    try {
      let res: Response;
      if (isCatalogQuestion(q)) {
        res = await fetch("/api/ai/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: q }),
        });
      } else {
        res = await fetch("/api/ai/text-to-sql?run=true", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ question: q, run: true }),
        });
      }

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json?.error ?? json?.detail ?? "AI gagal merespons");
      }

      // Simulate streaming by typing the explanation char-by-char.
      const explanation: string = json.explanation ?? json.answer ?? "";
      const assistant: Msg = {
        role: "assistant",
        content: explanation,
        sql: json.sql,
        explanation: json.explanation,
        assumptions: json.assumptions,
        columns: json.columns ?? (json.rows ? Object.keys(json.rows[0] ?? {}) : undefined),
        rows: json.rows,
        runError: json.runError,
        datasets: json.datasets,
        streaming: false,
      };

      if (explanation.length > 0) {
        await typeOut(setMessages, next, explanation, json);
      } else {
        // No explanation to stream — just commit the final message
        setMessages([...next, assistant]);
      }
    } catch (e) {
      setMessages([...next, {
        role: "assistant",
        content: e instanceof Error ? e.message : String(e),
        streaming: false,
      }]);
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [busy, messages]);

  const newChat = React.useCallback(() => {
    setMessages([]);
    setError(null);
  }, []);

  return { messages, busy, error, send, newChat };
}

async function typeOut(
  setMessages: React.Dispatch<React.SetStateAction<Msg[]>>,
  prev: Msg[],
  explanation: string,
  json: Record<string, unknown>,
) {
  // Stream the explanation in small chunks for a nice effect
  const chunkSize = Math.max(3, Math.ceil(explanation.length / 60));
  let rendered = "";
  while (rendered.length < explanation.length) {
    rendered += explanation.slice(rendered.length, rendered.length + chunkSize);
    const partial: Msg = {
      role: "assistant",
      content: rendered,
      sql: json.sql as string | undefined,
      explanation: json.explanation as string | undefined,
      assumptions: json.assumptions as string[] | undefined,
      columns: (json.columns as string[] | undefined) ?? (json.rows && (json.rows as Record<string, unknown>[])[0] ? Object.keys((json.rows as Record<string, unknown>[])[0]) : undefined),
      rows: json.rows as Record<string, unknown>[] | undefined,
      runError: json.runError as string | undefined,
      datasets: json.datasets as { id: string; title: string; tier: string; rows: number }[] | undefined,
      repaired: json.repaired as boolean | undefined,
      repairAttempts: json.repairAttempts as number | undefined,
      repairLog: json.repairLog as { attempt: number; sql: string; error: string; fixed?: boolean }[] | undefined,
      streaming: true,
    };
    setMessages([...prev, partial]);
    await new Promise((r) => setTimeout(r, 16));
  }
  // Final commit with streaming:false
  const final: Msg = {
    role: "assistant",
    content: explanation,
    sql: json.sql as string | undefined,
    explanation: json.explanation as string | undefined,
    assumptions: json.assumptions as string[] | undefined,
    columns: (json.columns as string[] | undefined) ?? (json.rows && (json.rows as Record<string, unknown>[])[0] ? Object.keys((json.rows as Record<string, unknown>[])[0]) : undefined),
    rows: json.rows as Record<string, unknown>[] | undefined,
    runError: json.runError as string | undefined,
    datasets: json.datasets as { id: string; title: string; tier: string; rows: number }[] | undefined,
    repaired: json.repaired as boolean | undefined,
    repairAttempts: json.repairAttempts as number | undefined,
    repairLog: json.repairLog as { attempt: number; sql: string; error: string; fixed?: boolean }[] | undefined,
    streaming: false,
  };
  setMessages([...prev, final]);
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
