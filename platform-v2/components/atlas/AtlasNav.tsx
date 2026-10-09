"use client";

import type React from "react";

/**
 * Toolbar daftar tematik (kontrol verifikasi & bahasa). Toggle Daftar|Peta
 * dihapus — peta bersama diakses lewat menu Spatial. Halaman tanpa `view`
 * tidak merender toolbar agar tidak menggandakan navigasi global.
 */
export type View = "list" | "map";

export function AtlasNav({
  view,
  langToggle,
  rightSlot,
}: {
  /** Toolbar hanya dirender untuk halaman yang memberi `view`. */
  view?: View;
  langToggle?: React.ReactNode;
  rightSlot?: React.ReactNode;
}) {
  if (!view || (!rightSlot && !langToggle)) return null;

  return (
    <div className="border-b border-hairline bg-canvas">
      <div className="mx-auto max-w-[1320px] px-6 h-[52px] flex items-center gap-3">
        <div className="ml-auto flex items-center gap-2.5">
          {rightSlot}
          {langToggle}
        </div>
      </div>
    </div>
  );
}

export function LangToggle({
  lang,
  onToggle,
  t,
}: {
  lang: "id" | "en";
  onToggle: () => void;
  t: (k: string) => string;
}) {
  return (
    <button
      onClick={onToggle}
      aria-label={`Switch language to ${t("nav.switch_to")}`}
      className="press-scale inline-flex items-center gap-1 rounded-full border border-hairline bg-canvas px-2.5 py-1.5 hover:border-ink-muted-48 transition-colors"
    >
      <span className="apple-caption-strong tabular text-ink uppercase tracking-wider">
        {lang.toUpperCase()}
      </span>
      <span className="apple-fine text-ink-muted-48">/</span>
      <span className="apple-fine tabular text-ink-muted-48 uppercase tracking-wider">
        {t("nav.switch_to")}
      </span>
    </button>
  );
}
