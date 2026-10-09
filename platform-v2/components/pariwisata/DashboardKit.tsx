import { ExpandableChartCard } from "@/components/charts/ChartExpand";
import { KpiStat } from "@/components/charts/KpiStat";
import { SdiTable } from "@/components/SdiTable";

/** Palet oranye bertingkat untuk seri chart (dipakai lintas dashboard pariwisata). */
export const PALETTE = ["#ed6b23", "#f0a13a", "#c2410c", "#f4a672", "#9a3412", "#fb923c"];

/** Strip KPI di bawah hero. */
export function KpiRow({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{children}</div>;
}

/** Satu KPI dengan opsi tren berwarna (▲ hijau / ▼ merah) via `delta`. */
export function Kpi({
  label,
  value,
  sub,
  delta,
}: {
  label: string;
  value: string | number;
  sub?: string;
  delta?: number | null;
}) {
  let subNode = sub;
  if (delta != null && Number.isFinite(delta)) {
    const up = delta >= 0;
    const pct = Math.abs(delta).toLocaleString("id-ID", { maximumFractionDigits: 1 });
    subNode = `${up ? "▲" : "▼"} ${pct}% ${sub ?? ""}`.trim();
  }
  return <KpiStat label={label} value={value} sub={subNode} />;
}

/** Kartu putih pembungkus satu grafik. */
export function ChartCard({
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
  return (
    <ExpandableChartCard title={title} sub={sub} className={className}>
      {children}
    </ExpandableChartCard>
  );
}

/** Grid penata ChartCard. */
export function ChartGrid({
  children,
  cols = 3,
}: {
  children: React.ReactNode;
  cols?: 2 | 3;
}) {
  return (
    <div
      className={`grid gap-4 ${
        cols === 2 ? "md:grid-cols-2" : "md:grid-cols-2 lg:grid-cols-3"
      }`}
    >
      {children}
    </div>
  );
}

/** Disclosure tabel data mentah (tertutup default). */
export function RawDataDisclosure({
  slug,
  title,
  count,
  columns,
  label = "Lihat data mentah",
}: {
  slug: string;
  title: string;
  count: number;
  columns?: string[];
  label?: string;
}) {
  return (
    <details className="group rounded-xl border border-hairline bg-white/60">
      <summary className="cursor-pointer list-none px-5 py-3.5 text-[13px] font-semibold text-ink-muted-48 hover:text-ink">
        <span className="mr-1 inline-block transition-transform group-open:rotate-90">▸</span>
        {label} · {title} ({count.toLocaleString("id-ID")} baris)
      </summary>
      <div className="border-t border-hairline p-5">
        <SdiTable slug={slug} columns={columns} />
      </div>
    </details>
  );
}
