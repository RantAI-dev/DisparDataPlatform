"use client";

import * as React from "react";
import { Sparkles, Plus, Database, BarChart3, Globe, Compass, History } from "lucide-react";
import { useAi } from "./use-ai";
import { AiMessages } from "./ai-messages";
import { AiComposer } from "./ai-composer";
import { llmConfigured } from "@/lib/ai/llm";

const SUGGESTIONS = [
  { icon: Database, label: "Dataset restoran apa saja yang tersedia?" },
  { icon: BarChart3, label: "Tampilkan 10 dataset dengan jumlah baris terbanyak" },
  { icon: Globe, label: "Berapa jumlah event konser di Jakarta tahun 2025?" },
  { icon: Compass, label: "Daftar dataset SDI tentang hotel di Jakarta" },
  { icon: History, label: "Tren kunjungan wisata Jakarta 2024–2026" },
  { icon: Sparkles, label: "Apa saja tabel di serving.mart_gci?" },
];

export function AiPage() {
  const c = useAi();
  const cfg = React.useMemo(() => llmConfigured(), []);

  return (
    <div className="ai-shell">
      <div className="ai-app">
        <div className="ai-topbar">
          <h1>Atlas AI</h1>
          <span className="crumb">
            <span className="chan-dot" />
            Dispar Lakehouse · {cfg.model}
          </span>
          <div className="ai-topbar-spacer" />
          <span className="pill">
            <span className="chan-dot" style={{ background: "var(--accent-green)" }} />
            Ask mode · read-only
          </span>
          <button className="icon-btn" onClick={c.newChat} title="Mulai percakapan baru">
            <Plus />
          </button>
        </div>

        <div className="scroll-area">
          {c.messages.length === 0 ? (
            <div className="chat-empty">
              <div className="ce-mark">
                <Sparkles className="size-6" />
              </div>
              <div>
                <h2>Halo! Saya Atlas</h2>
                <p>Asisten AI untuk data Dispar — tanya dalam bahasa Indonesia, lihat hasil SQL + chart otomatis.</p>
              </div>
              <div className="ce-grid">
                {SUGGESTIONS.map((s) => {
                  const Icon = s.icon;
                  return (
                    <button
                      key={s.label}
                      onClick={() => void c.send(s.label)}
                      disabled={c.busy}
                      className="ce-chip"
                    >
                      <Icon className="size-3.5 text-[color:var(--brand-sky)]" />
                      <span>{s.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            <AiMessages messages={c.messages} busy={c.busy} error={c.error} />
          )}
        </div>

        <AiComposer
          onSend={c.send}
          busy={c.busy}
          placeholder="Tanya Atlas tentang data Dispar…"
        />
      </div>
    </div>
  );
}
