"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/**
 * Konteks "grafik sedang diperbesar". ChartCard merender ulang `children`
 * di dalam modal dengan nilai `true`; tiap wrapper ECharts membacanya lewat
 * `useChartExpanded()` untuk menampilkan label nilai + dataZoom + tinggi besar.
 */
const ChartExpandedContext = createContext(false);

export function useChartExpanded(): boolean {
  return useContext(ChartExpandedContext);
}

/** Tinggi chart saat diperbesar (string CSS agar mengikuti tinggi layar). */
export const EXPANDED_HEIGHT = "min(68vh, 640px)";

const SLIDER_STYLE = {
  borderColor: "#e2e8f0",
  fillerColor: "rgba(237, 107, 35, 0.15)",
  handleStyle: { color: "#ed6b23", borderColor: "#ed6b23" },
  textStyle: { color: "#64748b", fontSize: 10 },
};

/**
 * dataZoom (inside + slider) untuk sumbu kategori. Bila kategori banyak,
 * jendela awal hanya menampilkan `visible` kategori pertama agar terbaca.
 * `vertical` = sumbu-Y kategori (bar horizontal).
 * Hanya panggil saat mode diperbesar (client, setelah mount): membaca
 * `window.innerWidth` saat render dan tidak reaktif terhadap rotasi layar.
 */
export function categoryZoom(count: number, vertical = false, visible = 14) {
  // Layar sempit (HP): jendela awal dipersempit agar label nilai tidak bertumpuk.
  if (!vertical && typeof window !== "undefined" && window.innerWidth < 640) visible = Math.min(visible, 6);
  const end = count > visible ? Math.max(5, (visible / count) * 100) : 100;
  const axis = vertical ? { yAxisIndex: 0 } : { xAxisIndex: 0 };
  return [
    { type: "inside", ...axis, start: 0, end, filterMode: "none" },
    {
      type: "slider",
      ...axis,
      start: 0,
      end,
      filterMode: "none",
      ...(vertical ? { orient: "vertical", width: 16, right: 4 } : { height: 20, bottom: 4 }),
      ...SLIDER_STYLE,
    },
  ];
}

/** Ruang ekstra pada grid untuk slider dataZoom. */
export const ZOOM_PAD = 36;

/** Kartu pembungkus grafik dengan tombol "Perbesar grafik" + modal layar penuh. */
export function ExpandableChartCard({
  title,
  sub,
  children,
  className = "",
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => setMounted(true), []);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    // Pastikan instance ECharts mengukur ulang setelah modal tampil.
    const t = window.setTimeout(() => window.dispatchEvent(new Event("resize")), 50);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        close();
        return;
      }
      if (e.key === "Tab" && dialogRef.current) {
        const f = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        if (!f.length) return;
        const first = f[0];
        const last = f[f.length - 1];
        const active = document.activeElement;
        // Fokus di luar dialog (mis. body setelah klik canvas): tarik kembali ke dalam.
        const outside = !dialogRef.current.contains(active);
        if (e.shiftKey && (active === first || outside)) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (active === last || outside)) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.clearTimeout(t);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open, close]);

  return (
    <div className={`utility-card relative p-5 transition-shadow hover:shadow-md ${className}`}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Perbesar grafik"
        title="Perbesar grafik"
        className="absolute right-3 top-3 z-10 flex h-7 w-7 items-center justify-center rounded-md text-ink-muted-48 transition-colors hover:bg-black/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ed6b23]"
      >
        <svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M10 2h4v4M6 14H2v-4M14 2l-5 5M2 14l5-5" />
        </svg>
      </button>
      <div className="mb-3 border-l-2 pl-2.5 pr-8" style={{ borderColor: "#ed6b23" }}>
        <div className="text-[14px] font-semibold text-ink">{title}</div>
        {sub && <div className="apple-fine text-ink-muted-48">{sub}</div>}
      </div>
      {children}

      {open &&
        mounted &&
        createPortal(
          <div
            className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/50 p-3 sm:p-6"
            onMouseDown={(e) => {
              if (e.target === e.currentTarget) close();
            }}
          >
            <div
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-label={`${title} (diperbesar)`}
              tabIndex={-1}
              className="relative flex max-h-full w-full max-w-[1400px] flex-col overflow-hidden rounded-xl bg-white shadow-2xl"
              style={{ height: "min(92vh, 860px)" }}
            >
              <div className="flex items-start justify-between gap-4 border-b border-black/10 px-5 py-4">
                <div className="border-l-2 pl-2.5" style={{ borderColor: "#ed6b23" }}>
                  <div className="text-[16px] font-semibold text-ink">{title}</div>
                  {sub && <div className="apple-fine text-ink-muted-48">{sub}</div>}
                </div>
                <button
                  ref={closeRef}
                  type="button"
                  onClick={close}
                  aria-label="Tutup"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-[18px] leading-none text-ink-muted-48 transition-colors hover:bg-black/5 hover:text-ink focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#ed6b23]"
                >
                  ✕
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-auto p-5">
                <ChartExpandedContext.Provider value={true}>{children}</ChartExpandedContext.Provider>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
