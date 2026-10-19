"use client";

import { useEffect, useState } from "react";
import type { Facet, Filter } from "@/lib/ch/query-filter";

const ACCENT = "#ed6b23";
const humanize = (k: string) => k.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** Ganti (atau hapus bila `next` null) filter satu kolom. */
function withFilter(filters: Filter[], col: string, next: Filter | null): Filter[] {
  const rest = filters.filter((f) => f.col !== col);
  return next ? [...rest, next] : rest;
}

function chipLabel(f: Filter): string {
  if (f.op === "in") return `${humanize(f.col)}: ${f.values.length > 2 ? `${f.values.length} nilai` : f.values.join(", ")}`;
  const lo = f.min || "…";
  const hi = f.max || "…";
  return `${humanize(f.col)}: ${lo} – ${hi}`;
}

/**
 * Panel filter per kolom untuk halaman detail dataset. Jenis kontrol mengikuti
 * facet dari server: pilihan nilai (kategori), rentang angka, rentang tanggal.
 */
export function DatasetFilters({
  facets, filters, onChange,
}: {
  facets: Facet[];
  filters: Filter[];
  /** Menerima updater (bukan array jadi) supaya perubahan beruntun tidak saling menimpa. */
  onChange: (update: (prev: Filter[]) => Filter[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const usable = facets.filter((f) => f.kind !== "none" && !(f.kind === "kategori" && (f.values?.length ?? 0) < 2));
  if (!usable.length) return null;

  return (
    <div className="mb-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-3 py-2 text-[13px] font-medium text-slate-700 hover:border-[#ed6b23] hover:text-[#ed6b23] transition-colors"
        >
          <FilterIcon /> Filter{filters.length > 0 && ` (${filters.length})`}
          <span aria-hidden className="text-slate-400">{open ? "▴" : "▾"}</span>
        </button>
        {filters.map((f) => (
          <span
            key={f.col}
            className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[12.5px]"
            style={{ borderColor: ACCENT, color: ACCENT, background: "#fdf3ec" }}
          >
            {chipLabel(f)}
            <button
              type="button"
              onClick={() => onChange((prev) => withFilter(prev, f.col, null))}
              aria-label={`Hapus filter ${humanize(f.col)}`}
              className="ml-0.5 rounded-full px-1 hover:bg-white"
            >
              ×
            </button>
          </span>
        ))}
        {filters.length > 0 && (
          <button
            type="button"
            onClick={() => onChange(() => [])}
            className="text-[12.5px] text-slate-500 underline hover:text-slate-700"
          >
            Hapus semua filter
          </button>
        )}
      </div>

      {open && (
        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
          {usable.map((fc) => {
            const cur = filters.find((f) => f.col === fc.key) ?? null;
            return (
              <fieldset key={fc.key} className="min-w-0">
                <legend className="mb-1.5 text-[12px] font-semibold uppercase tracking-wide text-slate-500">
                  {humanize(fc.key)}
                </legend>
                {fc.kind === "kategori" ? (
                  <CategoryPicker
                    facet={fc}
                    selected={cur?.op === "in" ? cur.values : []}
                    onChange={(values) =>
                      onChange((prev) => withFilter(prev, fc.key, values.length ? { col: fc.key, op: "in", values } : null))
                    }
                  />
                ) : (
                  <RangeInput
                    kind={fc.kind as "angka" | "tanggal"}
                    facet={fc}
                    value={cur?.op === "range" ? cur : null}
                    onChange={(min, max) =>
                      onChange((prev) => withFilter(prev, fc.key, min || max ? { col: fc.key, op: "range", min, max } : null))
                    }
                  />
                )}
              </fieldset>
            );
          })}
        </div>
      )}
    </div>
  );
}

function CategoryPicker({
  facet, selected, onChange,
}: {
  facet: Facet;
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const sel = new Set(selected);
  return (
    <div className="max-h-44 overflow-y-auto rounded-lg border border-slate-200 p-1.5">
      {facet.values!.map(({ v, n }) => (
        <label key={v} className="flex cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-[13px] text-slate-700 hover:bg-slate-50">
          <input
            type="checkbox"
            checked={sel.has(v)}
            onChange={() => onChange(sel.has(v) ? selected.filter((x) => x !== v) : [...selected, v])}
            className="accent-[#ed6b23]"
          />
          <span className="min-w-0 flex-1 truncate" title={v}>{v}</span>
          <span className="tabular-nums text-[11.5px] text-slate-400">{n.toLocaleString("id-ID")}</span>
        </label>
      ))}
    </div>
  );
}

/** Rentang min–maks; diterapkan 500 ms setelah berhenti mengetik supaya tidak query per tombol. */
function RangeInput({
  kind, facet, value, onChange,
}: {
  kind: "angka" | "tanggal";
  facet: Facet;
  value: { min: string; max: string } | null;
  onChange: (min: string, max: string) => void;
}) {
  const [min, setMin] = useState(value?.min ?? "");
  const [max, setMax] = useState(value?.max ?? "");

  // Ikuti perubahan dari luar (chip dihapus / "Hapus semua").
  useEffect(() => {
    setMin(value?.min ?? "");
    setMax(value?.max ?? "");
  }, [value?.min, value?.max]);

  useEffect(() => {
    if (min === (value?.min ?? "") && max === (value?.max ?? "")) return;
    const t = setTimeout(() => onChange(min.trim(), max.trim()), 500);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [min, max]);

  const type = kind === "tanggal" ? "date" : "number";
  const lo = kind === "tanggal" ? facet.min?.slice(0, 10) : facet.min;
  const hi = kind === "tanggal" ? facet.max?.slice(0, 10) : facet.max;
  const cls = "w-full min-w-0 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-[13px] focus:border-[#ed6b23] focus-visible:ring-2 focus-visible:ring-[#ed6b23]/40";
  const idLo = `f-${facet.key}-min`;
  const idHi = `f-${facet.key}-max`;
  return (
    <div className="flex items-center gap-2">
      <label htmlFor={idLo} className="sr-only">{humanize(facet.key)} minimum</label>
      <input
        id={idLo}
        aria-label={`${humanize(facet.key)} minimum`}
        type={type} value={min} onChange={(e) => setMin(e.target.value)}
        placeholder={lo ? `min ${lo}` : "min"} min={lo} max={hi} className={cls}
      />
      <span aria-hidden className="text-slate-400">–</span>
      <label htmlFor={idHi} className="sr-only">{humanize(facet.key)} maksimum</label>
      <input
        id={idHi}
        aria-label={`${humanize(facet.key)} maksimum`}
        type={type} value={max} onChange={(e) => setMax(e.target.value)}
        placeholder={hi ? `maks ${hi}` : "maks"} min={lo} max={hi} className={cls}
      />
    </div>
  );
}

function FilterIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
    </svg>
  );
}
