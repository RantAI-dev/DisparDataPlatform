/**
 * GCI utama Jakarta — indikator PARIWISATA (dimensi Pengalaman Budaya / Cultural Experience).
 * 4 sub-indikator pariwisata dari jakarta.go.id/competitiveness ditampilkan sebagai kartu
 * DI ATAS tabel kesiapan data GCI. Sumber & penanggung jawab dicantumkan.
 */
import Link from "next/link";

const HERO =
  "radial-gradient(900px 320px at 88% -25%, rgba(237,107,35,0.28), transparent 62%), linear-gradient(160deg, #2a2521 0%, #16130f 100%)";
const ACCENT = "#ed6b23";
const GREEN = "#0e7c42";
const RED = "#b3261e";
const LINK = "#8ab4ff";

// Peringkat Kearney GCI (konteks) — jakarta.go.id/competitiveness.
const OVERALL = { y2024: 74, y2025: 71 };
const CULTURAL = { y2024: 52, y2025: 58 }; // dimensi Pengalaman Budaya (pariwisata)

// 4 sub-indikator PARIWISATA (Cultural Experience) — jakarta.go.id/competitiveness.
const INDIKATOR: {
  label: string; nilai: string; satuan: string; tahun: string; sumber: string; catatan?: string; href?: string;
}[] = [
  { label: "Jumlah Museum", nilai: "79", satuan: "Museum", tahun: "2025", sumber: "satudata.jakarta.go.id" },
  { label: "Seni Visual & Pertunjukan", nilai: "156", satuan: "Karya / kegiatan", tahun: "2024", sumber: "Dinas Pariwisata & Ekraf", catatan: "Belum mencakup data Dinas Kebudayaan.", href: "/gci/pariwisata/seni-pertunjukan" },
  { label: "Wisatawan Internasional", nilai: "2.767.622", satuan: "Wisatawan", tahun: "2025", sumber: "jakarta.bps.go.id", href: "/gci/pariwisata/wisatawan-internasional" },
  { label: "Penawaran Kuliner (Michelin)", nilai: "0", satuan: "Restoran Michelin", tahun: "2025", sumber: "Michelin", catatan: "Belum ada Michelin Star di Jakarta.", href: "/gci/pariwisata/kuliner-michelin" },
];

function trend(y2024: number, y2025: number) {
  const d = y2024 - y2025;
  if (d > 0) return { arrow: "▲", label: `naik ${d}`, fg: "#7ee2a8" };
  if (d < 0) return { arrow: "▼", label: `turun ${-d}`, fg: "#f7a6a1" };
  return { arrow: "▬", label: "tetap", fg: "#cfc8bf" };
}

export function GciOfficial() {
  const ct = trend(CULTURAL.y2024, CULTURAL.y2025);
  const ot = trend(OVERALL.y2024, OVERALL.y2025);
  return (
    <>
      {/* ── HERO ── */}
      <section style={{ background: HERO }} className="text-white">
        <div className="mx-auto max-w-[1320px] px-6 pt-9 pb-10">
          <div className="text-[12px] font-mono uppercase tracking-widest text-white/60">
            <span style={{ color: "#f0a13a" }}>●</span> Kearney · Global Cities Index — Indikator Pariwisata Jakarta
          </div>
          <h1 className="mt-3 atlas-display max-w-[20ch] text-white">
            GCI Jakarta ·{" "}
            <span className="atlas-italic" style={{ color: "#f0a13a" }}>Pengalaman Budaya</span>
          </h1>
          <p className="mt-3 apple-lead max-w-[66ch] text-white/75">
            Sub-indikator pariwisata yang mengisi dimensi Pengalaman Budaya (Cultural Experience) GCI Jakarta.
          </p>
          {/* konteks peringkat */}
          <div className="mt-6 flex flex-wrap gap-3">
            <div className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2">
              <span className="apple-fine text-white/50">Peringkat Pengalaman Budaya</span>
              <span className="text-[14px] font-semibold text-white/45 tabular">{CULTURAL.y2024}</span>
              <span className="text-white/30">→</span>
              <span className="text-[18px] font-bold text-white tabular">{CULTURAL.y2025}</span>
              <span className="text-[12px] font-semibold" style={{ color: ct.fg }}>{ct.arrow} {ct.label}</span>
            </div>
            <div className="inline-flex items-center gap-2 rounded-xl border border-white/12 bg-white/[0.04] px-3.5 py-2">
              <span className="apple-fine text-white/50">GCI keseluruhan</span>
              <span className="text-[14px] font-semibold text-white/45 tabular">{OVERALL.y2024}</span>
              <span className="text-white/30">→</span>
              <span className="text-[18px] font-bold text-white tabular">{OVERALL.y2025}</span>
              <span className="text-[12px] font-semibold" style={{ color: ot.fg }}>{ot.arrow} {ot.label}</span>
            </div>
          </div>
          <p className="mt-5 text-[12px] text-white/50">
            Sumber:{" "}
            <a href="https://www.jakarta.go.id/competitiveness" target="_blank" rel="noreferrer" className="hover:underline" style={{ color: LINK }}>
              jakarta.go.id/competitiveness ↗
            </a>{" "}
            · Kearney GCI 2025. Peringkat makin kecil makin baik.
          </p>
        </div>
      </section>

      {/* ── 4 KARTU INDIKATOR PARIWISATA ── */}
      <section className="mx-auto max-w-[1320px] px-6 pt-9 pb-12">
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="atlas-display-md text-ink">Indikator Pariwisata (Pengalaman Budaya)</h2>
          <span className="apple-fine text-ink-muted-48">4 indikator · sumber resmi</span>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {INDIKATOR.map((it) => {
            const inner = (
              <>
              <div
                className="inline-flex w-fit items-center rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider text-white"
                style={{ background: ACCENT }}
              >
                {it.label}
              </div>
              <div className="mt-4 flex items-baseline gap-1.5">
                <span className="text-[34px] font-bold leading-none text-ink tabular">{it.nilai}</span>
                <span className="apple-caption text-ink-muted-48">{it.satuan}</span>
              </div>
              {it.catatan && <p className="mt-2 apple-fine text-ink-muted-48 min-h-[28px]">{it.catatan}</p>}
              {!it.catatan && <div className="min-h-[28px]" />}
              <div className="mt-3 border-t border-hairline pt-3 space-y-1">
                <div className="flex items-center justify-between apple-fine">
                  <span className="text-ink-muted-48">Tahun</span>
                  <span className="text-ink font-medium tabular">{it.tahun}</span>
                </div>
                <div className="flex items-center justify-between apple-fine">
                  <span className="text-ink-muted-48">Sumber</span>
                  <span className="text-ink font-medium text-right truncate ml-2" title={it.sumber}>{it.sumber}</span>
                </div>
              </div>
              {it.href && (
                <div className="mt-3 flex items-center gap-1 apple-fine font-semibold" style={{ color: ACCENT }}>
                  Lihat detail
                  <span aria-hidden>→</span>
                </div>
              )}
              </>
            );
            return it.href ? (
              <Link
                key={it.label}
                href={it.href}
                className="utility-card flex flex-col p-5 transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-[#ed6b23]/40"
              >
                {inner}
              </Link>
            ) : (
              <div key={it.label} className="utility-card flex flex-col p-5">
                {inner}
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-[12px] text-ink-muted-48">
          Hanya indikator <b>pariwisata</b> (domain Dispar/atraksi wisata). Indikator Cultural Experience lain — Kegiatan Olahraga (Dispora) &amp; Kota Kembar (Biro KSD) — tidak ditampilkan di sini.
        </p>
      </section>
    </>
  );
}
