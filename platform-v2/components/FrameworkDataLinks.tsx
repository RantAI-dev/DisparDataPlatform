import Link from "next/link";
import { DATA_SECTIONS, type DataSection } from "@/lib/data-sections";
import { secondaryDatasets } from "@/lib/secondary";

const CARD_DETAILS: Record<DataSection, { description: string; unit: string; icon: React.ReactNode }> = {
  gci: {
    description: "Seluruh restoran & kafe se-Jakarta (termasuk resto hotel bintang 3–4) untuk Global City Index — dengan tier, rating, harga.",
    unit: "entri",
    icon: <><path d="M6 3v7a2 2 0 0 0 4 0V3M8 10v11" /><path d="M16 3c-1.5 0-2.5 2-2.5 5s1 4 2.5 4m0-9v18" /></>,
  },
  restaurants: {
    description: "Restoran & kafe pilihan Jakarta dengan sumber sitasi publik terverifikasi.",
    unit: "entri",
    icon: <path d="m12 3 2.6 5.3 5.9.9-4.3 4.1 1 5.8-5.2-2.7-5.2 2.7 1-5.8L3.5 9.2l5.9-.9L12 3z" />,
  },
  pertunjukan: {
    description: "Konser, festival, tari, teater, seni rupa, dan film 2025–2026.",
    unit: "entri",
    icon: <><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></>,
  },
  golf: {
    description: "Lapangan & driving range golf di Jakarta dan sekitarnya.",
    unit: "entri",
    icon: <><path d="M12 18V4l7 3-7 3" /><path d="M7 21c0-1.7 2.2-3 5-3s5 1.3 5 3" /></>,
  },
  souvenir: {
    description: "Toko suvenir, oleh-oleh & kerajinan dari TripAdvisor, ditandai mana yang benar-benar toko suvenir.",
    unit: "listing",
    icon: <><path d="M3 8h18l-1.4 11.2A2 2 0 0 1 17.6 21H6.4a2 2 0 0 1-2-1.8L3 8z" /><path d="M8 8V6a4 4 0 0 1 8 0v2" /></>,
  },
  hotel: {
    description: "Pasokan kamar, okupansi (TPK), dan lama menginap hotel berbintang — data resmi Satu Data Jakarta / BPS.",
    unit: "hotel",
    icon: <><path d="M3 21h18M5 21V5a1 1 0 0 1 1-1h8a1 1 0 0 1 1 1v16M15 8h3a1 1 0 0 1 1 1v12" /><path d="M8 7h.01M11 7h.01M8 11h.01M11 11h.01M8 15h.01M11 15h.01" /></>,
  },
};

export function FrameworkDataLinks({ framework }: { framework: "GCI" | "GPCI" }) {
  const datasets = secondaryDatasets();
  const sections = (Object.entries(DATA_SECTIONS) as [DataSection, (typeof DATA_SECTIONS)[DataSection]][])
    .map(([key, section], index) => ({ key, ...section, no: String(index + 1).padStart(2, "0") }))
    .filter((section) => section.framework === framework);

  return (
    <section aria-label={`Dataset ${framework}`} className="mx-auto max-w-[1320px] px-6 py-6">
      <h2 className="atlas-display-md text-ink">Dataset {framework}</h2>
      <div className="mt-4 grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
        {sections.map((s) => {
          const details = CARD_DETAILS[s.key];
          const count = datasets.find((dataset) => dataset.href === s.href)?.rows;
          return (
            <Link key={s.href} href={s.href} className="group utility-card press-scale flex flex-col p-6 hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-[#ed6b23]/40">
              <div className="flex items-start justify-between">
                <span className="atlas-mono text-ink-muted-48">{s.no}</span>
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-primary/10 transition-colors group-hover:bg-primary" style={{ color: "#ed6b23" }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className="transition-colors group-hover:[color:#fff]" aria-hidden="true">
                    {details.icon}
                  </svg>
                </span>
              </div>
              <h3 className="mt-5 atlas-display-md text-ink">{s.title}</h3>
              <p className="mt-2 apple-caption min-h-[54px] text-ink-muted-48">{details.description}</p>
              <div className="mt-5 flex items-center justify-between border-t border-hairline pt-4">
                <span className="apple-caption-strong" style={{ color: "#ed6b23" }}>
                  {count?.toLocaleString("id-ID") ?? "—"} <span className="text-ink-muted-48">{details.unit}</span>
                </span>
                <span className="text-lg leading-none transition-transform duration-200 group-hover:translate-x-1" style={{ color: "#ed6b23" }} aria-hidden="true">→</span>
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
