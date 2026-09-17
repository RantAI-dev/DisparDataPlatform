"use client";

import * as React from "react";
import { Sparkles, X, Plus } from "lucide-react";
import { useAi } from "./use-ai";
import { AiMessages } from "./ai-messages";
import { AiComposer } from "./ai-composer";

export function AiDock() {
  const [open, setOpen] = React.useState(false);
  const c = useAi();

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Buka Atlas AI"
        className="ai-dock-btn"
        title="Tanya Atlas AI"
      >
        <Sparkles className="size-6" />
      </button>
    );
  }

  return (
    <div className="ai-shell">
      <div className="ai-dock-panel">
        <div className="ai-dock-head">
          <div className="ai-ava">
            <Sparkles className="size-4" />
          </div>
          <div>
            <div className="title">Atlas AI</div>
            <div className="sub">Dispar Lakehouse · read-only</div>
          </div>
          <button
            className="close"
            onClick={() => setOpen(false)}
            aria-label="Tutup"
            title="Tutup"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="ai-dock-body">
          {c.messages.length === 0 ? (
            <div className="chat-empty" style={{ padding: "32px 18px" }}>
              <div className="ce-mark" style={{ width: 44, height: 44 }}>
                <Sparkles className="size-5" />
              </div>
              <div>
                <h2 style={{ fontSize: 18 }}>Hai! 👋</h2>
                <p>Tanya tentang data Dispar — saya akan buat SQL + chart otomatis.</p>
              </div>
            </div>
          ) : (
            <div className="transcript" style={{ padding: "16px 14px 8px", maxWidth: "100%" }}>
              <AiMessages messages={c.messages} busy={c.busy} error={c.error} />
              {c.messages.length > 0 && (
                <div style={{ display: "flex", justifyContent: "center", paddingTop: 6 }}>
                  <button
                    type="button"
                    onClick={c.newChat}
                    className="cchip active"
                    title="Mulai baru"
                  >
                    <Plus className="size-3" /> Chat baru
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="ai-dock-foot">
          <AiComposer
            onSend={c.send}
            busy={c.busy}
            placeholder="Tanya Atlas…"
          />
        </div>
      </div>
    </div>
  );
}
