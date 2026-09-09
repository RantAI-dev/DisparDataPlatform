import Link from "next/link";

const NAVY = "#ed6b23";
const GOLD = "#f0a13a";

/**
 * ATLAS — data sekunder (pendataan lapangan GCI) di dalam platform, gaya kita.
 * 4 section 1:1 dengan Jakarta Atlas; detail di /atlas/[section].
 */
const ICONS: Record<string, React.ReactNode> = {
  gci: (
    <>
      <path d="M6 3v7a2 2 0 0 0 4 0V3M8 10v11" />
      <path d="M16 3c-1.5 0-2.5 2-2.5 5s1 4 2.5 4m0-9v18" />
    </>
  ),
  restaurants: (
    <>
      <path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.2l5.9-.9L12 3z" />
    </>
  ),
  pertunjukan: (
    <>
      <path d="M9 18V5l11-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="17" cy="16" r="3" />
    </>
  ),
  golf: (
    <>
      <path d="M12 18V4l7 3-7 3" />
      <path d="M7 21c0-1.7 2.2-3 5-3s5 1.3 5 3" />
    </>
  ),
  souvenir: (
    <>
      <path d="M3 8h18l-1.4 11.2A2 2 0 0 1 17.6 21H6.4a2 2 0 0 1-2-1.8L3 8z" />
      <path d="M8 8V6a4 4 0 0 1 8 0v2" />
    </>
  ),
  hotel: (
    <>
      <path d="M3 21h18M5 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M15 8h3a1 1 0 0 1 1 1v12" />
      <path d="M8 7h.01M11 7h.01M8 11h.01M11 11h.01M8 15h.01M11 15h.01" />
    </>
  ),
};

const SECTIONS = [
  {
    key: "gci",
    no: "01",
    title: "Restoran GCI",
    desc: "Seluruh restoran & kafe se-Jakarta (termasuk resto hotel bintang 3–4) untuk Global City Index — dengan tier, rating, harga.",
    count: "2.577",
    unit: "entri",
  },
  {
    key: "restaurants",
    no: "02",
    title: "Direktori Restoran",
    desc: "Restoran & kafe pilihan Jakarta dengan sumber sitasi publik terverifikasi.",
    count: "604",
    unit: "entri",
  },
  {
    key: "pertunjukan",
    no: "03",
    title: "Pertunjukan & Budaya",
    desc: "Konser, festival, tari, teater, seni rupa, dan film 2025–2026.",
    count: "308",
    unit: "entri",
  },
  {
    key: "golf",
    no: "04",
    title: "Lapangan Golf",
    desc: "Lapangan & driving range golf di Jakarta dan sekitarnya.",
    count: "14",
    unit: "entri",
  },
  {
    key: "souvenir",
    no: "05",
    title: "Toko Suvenir",
    desc: "Toko suvenir, oleh-oleh & kerajinan dari TripAdvisor, ditandai mana yang benar-benar toko suvenir.",
    count: "67",
    unit: "listing",
  },
  {
    key: "hotel",
    no: "06",
    title: "Hotel & Akomodasi",
    desc: "Pasokan kamar, okupansi (TPK), dan lama menginap hotel berbintang — data resmi Satu Data Jakarta / BPS.",
    count: "120",
    unit: "hotel",
  },
];

const STATS = [
  { value: "3.690", label: "Total entri lapangan" },
  { value: "6", label: "Kategori data" },
  { value: "3.018", label: "Titik ber-koordinat" },
  { value: "GCI", label: "Metodologi acuan" },
];

export default function AtlasPage() {
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
            <span style={{ color: GOLD }}>●</span> Data Sekunder · Pendataan Lapangan
          </div>
          <h1 className="mt-5 atlas-display text-white">
            Jakarta{" "}
            <span className="atlas-italic" style={{ color: GOLD }}>
              Atlas
            </span>
          </h1>
          <p className="mt-5 apple-lead max-w-[64ch] text-white/75">
            Data hasil pendataan lapangan (GCI) yang melengkapi data primer SDI —
            ditampilkan di dalam platform dengan tampilan seragam.
          </p>

          <div className="mt-9 grid grid-cols-2 md:grid-cols-4 gap-px overflow-hidden rounded-2xl border border-white/12 bg-white/5 backdrop-blur">
            {STATS.map((st) => (
              <div key={st.label} className="bg-white/[0.03] px-5 py-4">
                <div className="text-[26px] md:text-[30px] font-bold tabular tracking-tight leading-none text-white">
                  {st.value}
                </div>
                <div className="mt-1.5 apple-fine text-white/60">{st.label}</div>
              </div>
            ))}
          </div>
        </div>
        <div
          className="relative h-[3px] w-full"
          style={{
            background: `linear-gradient(90deg, transparent, ${GOLD}, transparent)`,
            opacity: 0.7,
          }}
        />
      </section>

      {/* ── SECTION CARDS ── */}
      <section className="mx-auto max-w-[1320px] px-6 py-11 pb-20">
        <div className="mb-5 flex items-baseline justify-between">
          <h2 className="atlas-mono text-ink-muted-48">Kategori data</h2>
          <span className="apple-fine text-ink-muted-48">
            {SECTIONS.length} kategori
          </span>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {SECTIONS.map((s) => (
            <Link
              key={s.key}
              href={`/atlas/${s.key}`}
              className="group utility-card press-scale flex flex-col p-6 hover:-translate-y-1"
            >
              <div className="flex items-start justify-between">
                <span className="atlas-mono text-ink-muted-48">{s.no}</span>
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
                    {ICONS[s.key]}
                  </svg>
                </span>
              </div>
              <div className="mt-5 atlas-display-md text-ink">{s.title}</div>
              <p className="mt-2 apple-caption min-h-[54px] text-ink-muted-48">
                {s.desc}
              </p>
              <div className="mt-5 flex items-center justify-between border-t border-hairline pt-4">
                <span className="apple-caption-strong" style={{ color: NAVY }}>
                  {s.count} <span className="text-ink-muted-48">{s.unit}</span>
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
