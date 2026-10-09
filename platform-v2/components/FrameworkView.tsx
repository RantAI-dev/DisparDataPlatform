import Link from "next/link";
import { BarChart } from "./BarChart";
import type { IndicatorResult } from "@/lib/gci/readiness";
import { INDICATORS } from "@/lib/gci/indicators";

const LINK = "#2563eb";
/** Nomor resmi per kode — dibaca dari katalog, bukan snapshot readiness (snapshot bisa lebih lama). */
const OFFICIAL_NO = new Map(INDICATORS.filter((i) => i.officialNo != null).map((i) => [i.code, i.officialNo as number]));
const HERO =
  "radial-gradient(900px 320px at 88% -25%, rgba(237,107,35,0.28), transparent 62%), linear-gradient(160deg, #2a2521 0%, #16130f 100%)";
const GOLD = "#f0a13a";
const STATUS: Record<string, { label: string; bg: string; fg: string }> = {
  ready: { label: "Ready", bg: "#e8f5ee", fg: "#0e7c42" },
  partial: { label: "Partial", bg: "#fff6e9", fg: "#b5651d" },
  gap: { label: "Gap", bg: "#fdecec", fg: "#b3261e" },
};

/** Header yang sama untuk tampilan siap maupun saat data masih dimuat. */
export function FrameworkHeader({ title, subtitle, children }: {
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}) {
  return (
    <section style={{ background: HERO }} className="text-white">
      <div className="mx-auto max-w-[1320px] px-6 pt-8 pb-10">
        <div className="text-[12px] font-mono uppercase tracking-widest text-white/60">
          <span style={{ color: GOLD }}>●</span> Dashboard Indikator Pariwisata
        </div>
        <h1 className="mt-3 text-[28px] md:text-[36px] font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-white/70 max-w-[80ch] text-[14px]">{subtitle}</p>
        {children}
      </div>
    </section>
  );
}

/**
 * Kerangka dashboard framework (GCI / GPCI). SUDAH JALAN: cards + tabel readiness.
 * SLOT TODO (dikerjakan agent — lihat Plan 6): chart tren per indikator,
 * highlight aksi gap, tabel dataset pengisi yang lebih kaya.
 */
export function FrameworkView({
  title,
  subtitle,
  rows,
  afterHeader,
  showTrend = true,
}: {
  title: string;
  subtitle: string;
  rows: IndicatorResult[];
  afterHeader?: React.ReactNode;
  /** Tampilkan chart tren per indikator (GPCI menyembunyikannya sementara). */
  showTrend?: boolean;
}) {
  const count = (s: string) => rows.filter((r) => r.status === s).length;
  const ada = rows.filter((r) => r.dataAvailable).length;
  // Bila indikator punya nomor resmi, tampilkan kolom No. dan urutkan sesuai dokumen rujukan.
  const hasNo = rows.some((r) => OFFICIAL_NO.has(r.code));
  const tableRows = hasNo
    ? [...rows].sort((a, b) => (OFFICIAL_NO.get(a.code) ?? 999) - (OFFICIAL_NO.get(b.code) ?? 999))
    : rows;

  return (
    <main className="min-h-screen bg-[#faf6f2]">
      <FrameworkHeader title={title} subtitle={subtitle}>
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-5 gap-3 max-w-[820px]">
            <Card label="TOTAL INDIKATOR" value={String(rows.length)} />
            <Card label="DATA ADA" value={String(ada)} dot={GOLD} />
            <Card label="READY" value={String(count("ready"))} dot="#4ade80" />
            <Card label="PARTIAL" value={String(count("partial"))} dot="#fbbf24" />
            <Card label="GAP" value={String(count("gap"))} dot="#f87171" />
          </div>
      </FrameworkHeader>

      {afterHeader}

      <section className="mx-auto max-w-[1320px] px-6 py-8 pb-20 space-y-8">
        {/* ---- Matriks readiness (SUDAH JALAN) ---- */}
        <div>
          <h2 className="text-[16px] font-bold text-slate-800 mb-3">
            Kesiapan indikator
          </h2>
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-[14px]">
                <thead>
                  <tr style={{ background: "#2a2521" }} className="text-white text-left text-[12px] uppercase tracking-wider">
                    {hasNo && <th className="px-4 py-3 font-semibold w-14">No.</th>}
                    <th className="px-4 py-3 font-semibold w-16">Kode</th>
                    <th className="px-4 py-3 font-semibold">Indikator</th>
                    <th className="px-4 py-3 font-semibold w-24">Status</th>
                    <th className="px-4 py-3 font-semibold">Dataset / Pemilik</th>
                    <th className="px-4 py-3 font-semibold w-44 text-right">Nilai terbaru</th>
                  </tr>
                </thead>
                <tbody>
                  {tableRows.map((x) => {
                    const st = STATUS[x.status];
                    return (
                      <tr key={x.code} className="border-t border-slate-100 align-top">
                        {hasNo && <td className="px-4 py-3 font-semibold text-slate-700 tabular-nums">{OFFICIAL_NO.get(x.code) ?? "—"}</td>}
                        <td className="px-4 py-3 text-slate-400 tabular-nums">{x.code}</td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/${x.framework.toLowerCase()}/${x.code}`}
                            className="font-medium hover:underline"
                            style={{ color: LINK }}
                          >
                            {x.name}
                          </Link>
                          <div className="text-[12px] text-slate-400">{x.group}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full" style={{ background: st.bg, color: st.fg }}>
                            {st.label}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {x.datasets.length ? (
                            <div className="flex flex-col gap-1">
                              {x.datasets.map((d) => (
                                <Link key={d.slug} href={`/sdi/${d.slug}`} className="text-[13px] hover:underline" style={{ color: LINK }}>
                                  {d.title}
                                </Link>
                              ))}
                            </div>
                          ) : (
                            <span className="text-[13px] text-slate-500">{x.owner}</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-slate-700">
                          {x.latest ? (
                            <>
                              <div className="font-semibold">{x.latest.value.toLocaleString("id-ID")}</div>
                              <div className="text-[11px] text-slate-400">periode {x.latest.label}</div>
                            </>
                          ) : (
                            <span className="text-slate-300">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ---- Chart tren per indikator (Plan 6 Task 3) ---- */}
        {showTrend && rows.filter((x) => x.trend && x.trend.length > 1).length > 0 && (
          <div>
            <h2 className="text-[16px] font-bold text-slate-800 mb-3">
              Tren indikator
            </h2>
            <div className="grid md:grid-cols-2 gap-5">
              {rows
                .filter((x) => x.trend && x.trend.length > 1)
                .map((x) => (
                  <div
                    key={x.code}
                    className="bg-white rounded-xl border border-slate-200 shadow-sm p-5"
                  >
                    <div className="text-[13px] font-semibold text-slate-700 mb-3">
                      {x.name}
                    </div>
                    <BarChart data={x.trend} />
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* ---- Panel aksi gap (Plan 6 Task 4) ---- */}
        {rows.filter((x) => x.status !== "ready").length > 0 && (
          <div>
            <h2 className="text-[16px] font-bold text-slate-800 mb-3">
              Kelengkapan data (
              {rows.filter((x) => x.status !== "ready").length})
            </h2>
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">
              {rows
                .filter((x) => x.status !== "ready")
                .map((x) => {
                  const st = STATUS[x.status];
                  return (
                    <div
                      key={x.code}
                      className="px-5 py-3 flex items-start gap-3"
                    >
                      <span
                        className="text-[11px] font-semibold px-2 py-0.5 rounded-full mt-0.5"
                        style={{
                          background: st.bg,
                          color: st.fg,
                        }}
                      >
                        {st.label}
                      </span>
                      <div>
                        <div className="text-[14px] font-medium text-slate-800">
                          {x.name}
                        </div>
                        <div className="text-[12px] text-slate-500">
                          {x.note || "—"} ·{" "}
                          <span className="text-slate-400">{x.owner}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
        )}
      </section>
    </main>
  );
}

function Card({ label, value, dot }: { label: string; value: string; dot?: string }) {
  return (
    <div className="rounded-lg bg-white/10 border border-white/15 px-4 py-3 text-white">
      <div className="text-[11px] font-mono tracking-wider text-white/60 flex items-center gap-1.5">
        {dot && <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: dot }} />}
        {label}
      </div>
      <div className="text-[22px] font-bold tabular-nums mt-1">{value}</div>
    </div>
  );
}
