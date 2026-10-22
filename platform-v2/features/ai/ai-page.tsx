"use client";

import * as React from "react";
import { Sparkles, Plus, Plane, Hotel, CalendarDays, Utensils, TrendingUp, Map, LayoutDashboard, Database } from "lucide-react";
import { useAi, type AiMode } from "./use-ai";
import { AiMessages } from "./ai-messages";
import { AiComposer } from "./ai-composer";

const SUGGESTIONS: Record<AiMode, { icon: React.ComponentType<{ className?: string }>; label: string }[]> = {
  ask: [
    { icon: Plane, label: "Berapa total kunjungan wisman ke Jakarta tahun 2025, dan 5 negara asal terbesar?" },
    { icon: TrendingUp, label: "Tren kunjungan wisman per bulan 2024–2026 (grafik garis)" },
    { icon: Hotel, label: "Tingkat hunian kamar hotel berbintang di Jakarta dari tahun ke tahun" },
    { icon: Map, label: "Destinasi wisata (DTW) dengan pengunjung terbanyak" },
    { icon: Utensils, label: "Jumlah usaha kuliner per wilayah kota" },
    { icon: Database, label: "Data apa saja yang tersedia tentang event dan pertunjukan?" },
  ],
  bi: [
    { icon: LayoutDashboard, label: "Dashboard wisatawan mancanegara: total, tren bulanan, negara asal, pintu masuk" },
    { icon: Hotel, label: "Analisis akomodasi: jumlah hotel, kamar, dan tingkat hunian" },
    { icon: CalendarDays, label: "Analisis event pariwisata Jakarta per tahun dan kategori" },
    { icon: Map, label: "Analisis kunjungan ke 31 daya tarik wisata (wisnus vs wisman)" },
  ],
};

export function AiPage() {
  const c = useAi();

  return (
    <div className="ai-shell">
      <div className="ai-app">
        <div className="ai-topbar">
          <h1>Atlas AI</h1>
          <span className="crumb">
            <span className="chan-dot" />
            Dispar Lakehouse{c.model?.configured ? ` · ${c.model.model}` : ""}
          </span>
          <div className="ai-topbar-spacer" />
          <span className="pill">
            <span className="chan-dot" style={{ background: c.mode === "bi" ? "var(--accent-purple)" : "var(--accent-green)" }} />
            {c.mode === "bi" ? "BI mode" : "Ask mode"} · read-only
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
                <p>
                  {c.mode === "bi"
                    ? "Mode BI: sebut topiknya, saya susun dashboard — KPI, beberapa grafik, dan insight."
                    : "Tanya apa saja tentang data pariwisata & ekraf DKI — saya cari tabelnya, jalankan query, dan buat grafik."}
                </p>
                {c.model && !c.model.configured ? (
                  <p style={{ color: "var(--destructive)" }}>LLM belum dikonfigurasi di server (LLM_KEY kosong).</p>
                ) : null}
              </div>
              <div className="ce-grid">
                {SUGGESTIONS[c.mode].map((s) => {
                  const Icon = s.icon;
                  return (
                    <button key={s.label} onClick={() => void c.send(s.label)} disabled={c.busy} className="ce-chip">
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
          onStop={c.stop}
          busy={c.busy}
          mode={c.mode}
          onModeChange={c.setMode}
          model={c.model}
        />
      </div>
    </div>
  );
}
