import Link from "next/link";
import { sdiStats } from "@/lib/sdi";
import { secondaryDatasets } from "@/lib/secondary";
import { INDICATORS } from "@/lib/gci/indicators";

const NAVY = "#ed6b23";
const GOLD = "#f0a13a";

// Statis — semua angka dari data in-code (INDICATORS / sdi / secondary),
// tidak menyentuh DB sama sekali. Nol egress Neon untuk beranda.

/** Ikon garis inline (stroke = currentColor) per menu. */
const ICONS: Record<string, React.ReactNode> = {
  "/katalog": (
    <>
      <rect x="3" y="4" width="18" height="4" rx="1" />
      <rect x="3" y="10" width="18" height="4" rx="1" />
      <rect x="3" y="16" width="18" height="4" rx="1" />
    </>
  ),
  "/gci": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 3.8 5.8 3.8 9s-1.3 6.5-3.8 9c-2.5-2.5-3.8-5.8-3.8-9S9.5 5.5 12 3z" />
    </>
  ),
  "/gpci": (
    <>
      <path d="M4 21V7l6-3v17M14 21V9l6 3v9" />
      <path d="M7 9v0M7 12v0M7 15v0M17 14v0M17 17v0" />
    </>
  ),
  "/spatial": (
    <>
      <path d="M9 3 4 5v16l5-2 6 2 5-2V3l-5 2-6-2z" />
      <path d="M9 3v16M15 5v16" />
    </>
  ),
};

export default function HomePage() {
  const s = sdiStats();
  const gciCount = INDICATORS.filter((i) => i.framework === "GCI").length;
  const gpciCount = INDICATORS.filter((i) => i.framework === "GPCI").length;

  const secondary = secondaryDatasets();
  const secondaryTotalRows = secondary.reduce((a, d) => a + d.rows, 0);
  const indTotal = gciCount + gpciCount;

  const MENUS = [
    {
      href: "/katalog",
      no: "01",
      title: "Katalog Data",
      desc: `Data primer Satu Data Jakarta + dataset sekunder pendataan lapangan.`,
      stat: `${s.total} + ${secondary.length} dataset`,
    },
    {
      href: "/gci",
      no: "02",
      title: "GCI",
      desc: "Kearney Global Cities Index — prioritas indikator competitiveness.",
      stat: `${gciCount} indikator`,
    },
    {
      href: "/gpci",
      no: "03",
      title: "GPCI",
      desc: "Mori Global Power City Index — kesiapan indikator pariwisata.",
      stat: `${gpciCount} indikator`,
    },
    {
      href: "/spatial",
      no: "04",
      title: "Spatial",
      desc: "Peta pariwisata Jakarta — data GCI, GPCI, dan GMTI dengan filter kategori.",
      stat: `${secondaryTotalRows.toLocaleString("id-ID")} baris`,
    },
  ];

  const STATS = [
    { value: s.total.toLocaleString("id-ID"), label: "Dataset primer SDI" },
    { value: secondaryTotalRows.toLocaleString("id-ID"), label: "Baris pendataan lapangan" },
    { value: indTotal.toLocaleString("id-ID"), label: "Indikator GCI · GPCI dipantau" },
    { value: "2", label: "Indeks global (GCI · GPCI)" },
  ];

  return (
    <main className="min-h-screen bg-paper">
      {/* ── HERO ── */}
      <section className="relative overflow-hidden text-white">
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(1100px 420px at 88% -12%, rgba(240, 161, 58,0.14), transparent 60%), radial-gradient(760px 460px at 6% 118%, rgba(237, 107, 35,0.22), transparent 62%), linear-gradient(160deg, #2a2521 0%, #16130f 100%)`,
          }}
        />
        {/* dot-grid texture */}
        <div
          className="absolute inset-0 opacity-[0.5]"
          style={{
            backgroundImage:
              "radial-gradient(rgba(255,255,255,0.09) 1px, transparent 1px)",
            backgroundSize: "22px 22px",
            maskImage:
              "linear-gradient(180deg, rgba(0,0,0,0.9), transparent 78%)",
            WebkitMaskImage:
              "linear-gradient(180deg, rgba(0,0,0,0.9), transparent 78%)",
          }}
        />
        <div className="relative mx-auto max-w-[1320px] px-6 pt-16 pb-12">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 atlas-mono text-white/75 backdrop-blur">
            <span style={{ color: GOLD }}>●</span> Dashboard Visualisasi Data Terkonsolidasi
          </div>
          <h1 className="mt-5 atlas-display max-w-[18ch] text-white">
            Data Pariwisata{" "}
            <span className="atlas-italic" style={{ color: GOLD }}>
              &amp; Ekonomi Kreatif
            </span>{" "}
            Jakarta
          </h1>
          <p className="mt-5 apple-lead max-w-[64ch] text-white/75">
            Empat pintu masuk ke data Dispar — katalog SDI, kesiapan indikator
            GCI/GPCI, dan pendataan lapangan. Pilih menu untuk membuka visualisasi.
          </p>

          {/* stats strip */}
          <div className="mt-9 grid grid-cols-2 md:grid-cols-4 gap-px overflow-hidden rounded-2xl border border-white/12 bg-white/5 backdrop-blur">
            {STATS.map((st) => (
              <div key={st.label} className="bg-white/[0.03] px-5 py-4">
                <div
                  className="text-[26px] md:text-[30px] font-bold tabular tracking-tight leading-none"
                  style={{ color: "#fff" }}
                >
                  {st.value}
                </div>
                <div className="mt-1.5 apple-fine text-white/60">{st.label}</div>
              </div>
            ))}
          </div>
        </div>
        {/* gold hairline */}
        <div
          className="relative h-[3px] w-full"
          style={{
            background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`,
            opacity: 0.7,
          }}
        />
      </section>

      {/* ── MENU CARDS ── */}
      <section className="mx-auto max-w-[1320px] px-6 py-11 pb-20">
        <div className="mb-5 flex items-baseline justify-between">
          <h2 className="atlas-mono text-ink-muted-48">Pilih menu</h2>
          <span className="apple-fine text-ink-muted-48">4 modul</span>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {MENUS.map((m) => (
            <Link
              key={m.href}
              href={m.href}
              className="group utility-card press-scale flex flex-col p-6 hover:-translate-y-1"
            >
              <div className="flex items-start justify-between">
                <span className="atlas-mono text-ink-muted-48">{m.no}</span>
                <span
                  className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary"
                  style={{ color: NAVY }}
                >
                  <svg
                    width="22"
                    height="22"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="transition-colors group-hover:[color:#fff]"
                  >
                    {ICONS[m.href]}
                  </svg>
                </span>
              </div>
              <div className="mt-5 flex items-center gap-2">
                <span className="atlas-display-md text-ink">{m.title}</span>
                {m.href === "/gci" && (
                  <span className="text-[9px] font-bold uppercase tracking-wider text-white bg-[#ed6b23] rounded px-1.5 py-0.5">
                    Prioritas
                  </span>
                )}
              </div>
              <p className="mt-2 apple-caption min-h-[42px] text-ink-muted-48">
                {m.desc}
              </p>
              <div className="mt-5 flex items-center justify-between border-t border-hairline pt-4">
                <span className="apple-caption-strong text-ink-muted-80">
                  {m.stat}
                </span>
                <span
                  className="text-lg leading-none transition-transform duration-200 group-hover:translate-x-1"
                  style={{ color: NAVY }}
                  aria-hidden
                >
                  →
                </span>
              </div>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
