"use client";

import Link from "next/link";
import type React from "react";
import { DATA_SECTIONS } from "@/lib/data-sections";

/**
 * Toolbar daftar tematik. Pemilik daftar mengikuti DATA_SECTIONS;
 * tampilan peta bersama ada di Spatial. Section tanpa `view` tidak merender
 * toolbar agar tidak menggandakan navigasi global.
 */
export type Section =
  | "restaurants"
  | "golf"
  | "gci"
  | "events"
  | "souvenir"
  | "gmti"
  | "home";
export type View = "list" | "map";

const MAP_PATHS: Partial<Record<Section, { list: string; map: string }>> = {
  restaurants: { list: DATA_SECTIONS.restaurants.href, map: "/spatial" },
  golf: { list: DATA_SECTIONS.golf.href, map: "/spatial" },
  souvenir: { list: DATA_SECTIONS.souvenir.href, map: "/spatial" },
};

export function AtlasNav({
  section,
  view,
  langToggle,
  rightSlot,
  t,
}: {
  section: Section;
  /** Daftar yang menyediakan tautan ke peta bersama. */
  view?: View;
  langToggle?: React.ReactNode;
  rightSlot?: React.ReactNode;
  t?: (k: string) => string;
}) {
  const paths = view ? MAP_PATHS[section] : undefined;
  if (!view || !paths) return null;
  const tr = t ?? ((k: string) => k);

  return (
    <div className="border-b border-hairline bg-canvas">
      <div className="mx-auto max-w-[1320px] px-6 h-[52px] flex items-center gap-3">
        {/* Daftar tematik dan peta bersama; Kembali sudah tersedia di Nav. */}
        <div className="inline-flex p-0.5 bg-paper border border-hairline rounded-full">
          <Link
            href={paths.list}
            className={`press-scale rounded-full px-4 py-1 apple-caption-strong transition-colors ${
              view === "list"
                ? "bg-ink text-white"
                : "text-ink-muted-80 hover:text-ink"
            }`}
          >
            {tr("nav.view_list")}
          </Link>
          <Link
            href={paths.map}
            className={`press-scale rounded-full px-4 py-1 apple-caption-strong transition-colors ${
              view === "map"
                ? "bg-ink text-white"
                : "text-ink-muted-80 hover:text-ink"
            }`}
          >
            {tr("nav.view_map")}
          </Link>
        </div>

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
