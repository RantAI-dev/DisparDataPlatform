"use client";

import * as React from "react";
import { X, Plus } from "lucide-react";
import { useAi } from "./use-ai";
import { AiMessages } from "./ai-messages";
import { AiComposer } from "./ai-composer";
import { JekateAvatar } from "./jekate-avatar";

export function AiDock() {
  const [open, setOpen] = React.useState(false);
  const c = useAi();

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        aria-label="Buka Jekate"
        className="ai-dock-btn"
        title="Tanya Jekate"
      >
        <JekateAvatar size={44} />
      </button>
    );
  }

  return (
    <div className="ai-shell">
      <div className="ai-dock-panel">
        <div className="ai-dock-head">
          <div className="ai-ava mascot">
            <JekateAvatar size={32} />
          </div>
          <div>
            <div className="title">Jekate</div>
            <div className="sub">{c.mode === "bi" ? "BI mode" : "Ask mode"} · read-only</div>
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
              <div className="ce-mark mascot" style={{ width: 72, height: 72 }}>
                <JekateAvatar size={72} />
              </div>
              <div>
                <h2 style={{ fontSize: 18 }}>Halo, aye Jekate! 👋</h2>
                <p>Tanya data Dispar — aye cariin tabelnya, jalanin query, terus bikin grafiknya.</p>
              </div>
            </div>
          ) : (
            <div className="transcript" style={{ padding: "16px 14px 8px", maxWidth: "100%" }}>
              <AiMessages messages={c.messages} busy={c.busy} error={c.error} compact />
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
            onStop={c.stop}
            busy={c.busy}
            mode={c.mode}
            onModeChange={c.setMode}
            model={c.model}
            placeholder="Tanya Jekate…"
          />
        </div>
      </div>
    </div>
  );
}
