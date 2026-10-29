"use client";

import * as React from "react";
import { ArrowUp, MessageSquareText, LayoutDashboard, Square } from "lucide-react";
import type { AiMode } from "./use-ai";

export function AiComposer({
  onSend, onStop, busy, placeholder, mode, onModeChange, model,
}: {
  onSend: (text: string) => void;
  onStop?: () => void;
  busy: boolean;
  placeholder?: string;
  mode: AiMode;
  onModeChange: (m: AiMode) => void;
  model?: { model: string; configured: boolean } | null;
}) {
  const [text, setText] = React.useState("");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const t = text.trim();
    if (!t || busy) return;
    onSend(t);
    setText("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const onChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setText(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
  };

  const handleKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  };

  return (
    <div className="composer-wrap">
      <div className="composer-inner">
        <div className="composer">
          <textarea
            ref={textareaRef}
            value={text}
            onChange={onChange}
            onKeyDown={handleKey}
            rows={1}
            placeholder={
              placeholder ??
              (mode === "bi"
                ? "Topik apa yang ingin dianalisis? mis. “wisman 2024–2026”"
                : "Tanya data pariwisata Jakarta…")
            }
            aria-label="Pesan untuk Jekate"
          />
          <div className="composer-bar">
            <div className="mode-toggle" role="radiogroup" aria-label="Mode">
              <button
                type="button"
                role="radio"
                aria-checked={mode === "ask"}
                className={mode === "ask" ? "on" : ""}
                onClick={() => onModeChange("ask")}
                title="Ask — jawaban langsung dengan angka, grafik bila membantu"
              >
                <MessageSquareText /> Ask
              </button>
              <button
                type="button"
                role="radio"
                aria-checked={mode === "bi"}
                className={mode === "bi" ? "on" : ""}
                onClick={() => onModeChange("bi")}
                title="BI — susun mini-dashboard: KPI + beberapa grafik + insight"
              >
                <LayoutDashboard /> BI
              </button>
            </div>

            {busy && onStop ? (
              <button type="button" onClick={onStop} aria-label="Hentikan" className="send-btn stop">
                Stop <Square />
              </button>
            ) : (
              <button type="button" onClick={submit} disabled={busy || !text.trim()} aria-label="Kirim" className="send-btn">
                Kirim <ArrowUp />
              </button>
            )}
          </div>
        </div>
        <div className="composer-hint">
          <span><span className="kbd">⏎</span> kirim</span>
          <span><span className="kbd">⇧⏎</span> baris baru</span>
          <span style={{ marginLeft: "auto" }}>
            {model ? (model.configured ? model.model : "LLM belum dikonfigurasi") : "…"} ·{" "}
            {mode === "bi" ? "BI: dashboard + insight" : "Ask: jawaban + grafik"} · read-only
          </span>
        </div>
      </div>
    </div>
  );
}
