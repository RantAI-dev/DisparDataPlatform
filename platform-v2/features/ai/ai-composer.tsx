"use client";

import * as React from "react";
import { ArrowUp, Sparkles, BarChart3, FileText } from "lucide-react";

export function AiComposer({
  onSend, busy, placeholder,
}: {
  onSend: (text: string) => void;
  busy: boolean;
  placeholder?: string;
}) {
  const [text, setText] = React.useState("");
  const [mode, setMode] = React.useState<"ask" | "catalog">("ask");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const submit = () => {
    const t = text.trim();
    if (!t || busy) return;
    const payload = mode === "catalog" ? `dataset: ${t}` : t;
    onSend(payload);
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
    if (e.key === "Enter" && !e.shiftKey) {
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
            placeholder={placeholder ?? "Tanya Atlas tentang data pariwisata Jakarta…  (⏎ kirim, ⇧⏎ baris baru)"}
            aria-label="Message Atlas"
          />
          <div className="composer-bar">
            <button
              type="button"
              className={`cchip ${mode === "ask" ? "active" : ""}`}
              onClick={() => setMode("ask")}
              title="Tanya natural language → SQL otomatis"
            >
              <Sparkles />
              Ask
            </button>
            <button
              type="button"
              className={`cchip ${mode === "catalog" ? "active" : ""}`}
              onClick={() => setMode("catalog")}
              title="Cari dataset di katalog"
            >
              <FileText />
              Catalog
            </button>
            <button
              type="button"
              className="cchip"
              onClick={() => setText((s) => (s ? s + "\n\n" : "") + "Bandingkan ")}
              title="Template bandingkan"
            >
              <BarChart3 />
              Compare
            </button>

            <button
              type="button"
              onClick={submit}
              disabled={busy || !text.trim()}
              aria-label="Send"
              className="send-btn"
            >
              Send <ArrowUp />
            </button>
          </div>
        </div>
        <div className="composer-hint">
          <span>
            <span className="kbd">⏎</span> kirim
          </span>
          <span>
            <span className="kbd">⇧⏎</span> baris baru
          </span>
          <span style={{ marginLeft: "auto" }}>
            powered by Minimax-M2.7 · {mode === "ask" ? "ask → SQL" : "catalog search"}
          </span>
        </div>
      </div>
    </div>
  );
}
