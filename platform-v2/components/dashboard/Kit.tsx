/** Potongan UI bersama halaman Dashboard Statistik. */

/** Judul seksi (mis. "1 · Tahunan"). */
export function SectionHead({ title, desc }: { title: string; desc?: string }) {
  return (
    <div className="mb-3 mt-8 first:mt-0">
      <h2 className="text-[18px] font-bold tracking-tight text-ink">{title}</h2>
      {desc && <p className="apple-fine text-ink-muted-48">{desc}</p>}
    </div>
  );
}

/** Kartu "menunggu data" — dipakai saat sumber belum masuk lakehouse. */
export function PendingData({ title, need, source }: { title: string; need: string; source?: string }) {
  return (
    <div className="rounded-xl border border-dashed border-[#f0a13a] bg-[#fff8f1] p-5">
      <div className="text-[14px] font-semibold text-ink">{title}</div>
      <p className="mt-1 text-[13px] text-ink-muted-80">{need}</p>
      {source && <p className="mt-2 apple-fine text-ink-muted-48">Sumber rencana: {source}</p>}
      <span className="mt-3 inline-block rounded-full bg-[#ed6b23]/10 px-2.5 py-0.5 text-[11px] font-semibold text-[#c2410c]">
        Menunggu data
      </span>
    </div>
  );
}

/** Catatan sumber di bawah halaman. */
export function SourceNote({ children }: { children: React.ReactNode }) {
  return <p className="mt-6 apple-fine text-ink-muted-48">{children}</p>;
}

/** Toggle Tahunan / Bulanan. */
export function ModeToggle<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <div className="inline-flex rounded-xl border border-hairline bg-white p-1 shadow-sm">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={`rounded-lg px-4 py-1.5 text-[13px] font-semibold transition-colors ${
              active ? "text-white" : "text-ink-muted-48 hover:text-ink"
            }`}
            style={active ? { background: "#ed6b23" } : undefined}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
export const idNum = (v: number, d = 0) => v.toLocaleString("id-ID", { maximumFractionDigits: d, minimumFractionDigits: d });
