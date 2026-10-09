import type { ComponentType } from "react";
import Ce2View from "./Ce2";
import CiHrView from "./CiHr";
import Ce1View from "./Ce1";
import Ce3View from "./Ce3";
import Ce4View from "./Ce4";
import BaMiceView from "./BaMice";
import CiFvView from "./CiFv";
import CiIcView from "./CiIc";
import CiCeView from "./CiCe";
import CiCxView from "./CiCx";
import CiAmView from "./CiAm";
import CiTaView from "./CiTa";
import CiWhView from "./CiWh";
import CiThView from "./CiTh";
import CiMuView from "./CiMu";
import CiLhView from "./CiLh";
import CiShView from "./CiSh";
import CiDiView from "./CiDi";
import CiNlView from "./CiNl";
import { IndicatorShell } from "./IndicatorShell";
import { INDICATORS } from "@/lib/gci/indicators";

/**
 * Registry komponen indicator dispatch (Plan 7).
 * - Ce2 & CiHr = hand-coded reference (breakdown wilayah & registry count).
 * - 17 file sisanya = hand-coded per-indikator, masing-masing call
 *   renderXxx() helper dari `_renderers.tsx` sesuai archetype-nya.
 * - Kode tanpa entri + kode gap → IndicatorFallback (placeholder rapi).
 */
export const INDICATOR_VIEWS: Record<string, ComponentType> = {
  CE2: Ce2View,
  "CI-HR": CiHrView,
  CE1: Ce1View,
  CE3: Ce3View,
  CE4: Ce4View,
  "BA-MICE": BaMiceView,
  "CI-FV": CiFvView,
  "CI-IC": CiIcView,
  "CI-CE": CiCeView,
  "CI-CX": CiCxView,
  "CI-AM": CiAmView,
  "CI-TA": CiTaView,
  "CI-WH": CiWhView,
  "CI-TH": CiThView,
  "CI-MU": CiMuView,
  "CI-LH": CiLhView,
  "CI-SH": CiShView,
  "CI-DI": CiDiView,
  "CI-NL": CiNlView,
};

export function IndicatorFallback({ code }: { code: string }) {
  const ind = INDICATORS.find((i) => i.code === code);
  if (!ind) {
    return (
      <IndicatorShell code={code}>
        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white/50 p-8 text-center">
          <div className="text-[15px] font-semibold text-slate-600">
            Indikator tidak dikenal
          </div>
          <div className="mt-2 text-[11px] font-mono uppercase tracking-wider text-slate-400">
            Kode <code>{code}</code> tidak ada di katalog GCI/GPCI.
          </div>
        </div>
      </IndicatorShell>
    );
  }
  // 9 indikator dataAvailable:false → kartu "data belum tersedia" (Plan 7 Task 6).
  if (ind.dataAvailable === false) {
    return (
      <IndicatorShell code={code} source={ind.name}>
        <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white p-8 max-w-[760px]">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-[11px] font-mono uppercase tracking-wider px-2 py-0.5 rounded-full bg-red-50 text-red-700">
              Data belum tersedia
            </span>
            <span className="text-[11px] font-mono uppercase tracking-wider text-slate-400">
              {ind.framework} · {ind.dimension}
            </span>
          </div>
          <div className="text-[18px] font-semibold text-slate-800">
            {ind.code} · {ind.name}
          </div>
          <p className="mt-2 text-[14px] text-slate-600 max-w-[60ch]">
            {ind.definition}
          </p>
          <dl className="mt-6 grid sm:grid-cols-2 gap-x-8 gap-y-3 text-[13px]">
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-wider text-slate-400">Owner / OPD pemilik</dt>
              <dd className="text-slate-800 mt-0.5">{ind.owner}</dd>
            </div>
            <div>
              <dt className="font-mono text-[11px] uppercase tracking-wider text-slate-400">Status readiness</dt>
              <dd className="mt-0.5">
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: "#fdecec", color: "#b3261e" }}>
                  gap
                </span>
              </dd>
            </div>
            <div className="sm:col-span-2">
              <dt className="font-mono text-[11px] uppercase tracking-wider text-slate-400">Keterangan</dt>
              <dd className="text-slate-700 mt-0.5">{ind.note}</dd>
            </div>
          </dl>
        </div>
      </IndicatorShell>
    );
  }
  // Fallback generic — kode dikenal tapi bespoke view belum dibuat (17 archetype baru TBD).
  return (
    <IndicatorShell code={code}>
      <div className="rounded-xl border-2 border-dashed border-slate-300 bg-white/50 p-8 text-center">
        <div className="text-[15px] font-semibold text-slate-600">
          Visualisasi indikator ini belum tersedia
        </div>
        <div className="text-[13px] text-slate-500 mt-1 max-w-[60ch] mx-auto">
          {ind.code} · {ind.name}
        </div>
      </div>
    </IndicatorShell>
  );
}
