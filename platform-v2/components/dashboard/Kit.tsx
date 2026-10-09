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
    <div className="inline-flex max-w-full flex-wrap rounded-xl border border-hairline bg-white p-1 shadow-sm">
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            onClick={() => onChange(o.value)}
            aria-pressed={active}
            className={`whitespace-nowrap rounded-lg px-4 py-1.5 text-[13px] font-semibold transition-colors ${
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
