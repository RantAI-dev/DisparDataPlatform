import { benchmarkFor, type DataStatus } from "@/lib/gci/benchmark";

const STATUS: Record<DataStatus, { label: string; bg: string; fg: string }> = {
  punya: { label: "Punya", bg: "#e8f5ee", fg: "#0e7c42" },
  proksi: { label: "Proksi", bg: "#fff6e9", fg: "#b5651d" },
  belum: { label: "Belum ada", bg: "#fdecec", fg: "#b3261e" },
};

/**
 * Konteks indeks per indikator: cara indeks mengukur + sumber resmi,
 * Jakarta vs frontier + target, dan checklist data yang perlu dikumpulkan.
 * Data-driven dari data/gci-gpci-benchmarks.json. (Plan 8)
 */
export function IndexContext({ code }: { code: string }) {
  const b = benchmarkFor(code);
  if (!b) return null;
  return (
    <div className="grid md:grid-cols-3 gap-5">
      {/* 1. Cara indeks mengukur */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
          Cara indeks mengukur
        </div>
        <div className="text-[14px] font-medium text-slate-800 mt-1">
          {b.indexMetric}
        </div>
        <div className="text-[12px] text-slate-500 mt-2">
          Sumber resmi indeks:{" "}
          <span className="text-slate-700">{b.indexSource}</span>
        </div>
        <div className="text-[12px] text-slate-400 mt-1">Satuan: {b.unit}</div>
      </div>

      {/* 2. Jakarta vs frontier + target */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
          Jakarta vs frontier
        </div>
        <div className="mt-2 text-[13px] space-y-1">
          <div className="flex justify-between gap-3">
            <span className="text-slate-500">Jakarta (data proksi)</span>
            <span className="font-semibold text-slate-800 text-right">
              {b.jakarta.value ?? "—"}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-slate-500">Frontier ({b.frontier.city})</span>
            <span className="font-semibold text-right" style={{ color: "#ed6b23" }}>
              {b.frontier.value}
            </span>
          </div>
          <div className="flex justify-between gap-3">
            <span className="text-slate-500">Target</span>
            <span className="font-medium text-right" style={{ color: "#b5651d" }}>
              {b.target}
            </span>
          </div>
        </div>
        {b.jakarta.note && (
          <div className="text-[11px] text-slate-400 mt-2">{b.jakarta.note}</div>
        )}
      </div>

      {/* 3. Data yang perlu dikumpulkan */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
        <div className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
          Data pendukung yang dibutuhkan
        </div>
        <ul className="mt-2 space-y-2">
          {b.dataNeeded.map((d, i) => {
            const s = STATUS[d.status];
            return (
              <li key={i} className="text-[13px] leading-snug">
                <span
                  className="text-[10px] font-semibold px-1.5 py-0.5 rounded mr-2 whitespace-nowrap"
                  style={{ background: s.bg, color: s.fg }}
                >
                  {s.label}
                </span>
                <span className="text-slate-700">{d.label}</span>
                <span className="text-slate-400"> · {d.owner}</span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
