import { primaryData } from "@/lib/indicator-data";
import { byPeriod, groupCount } from "@/lib/agg";
import { IndicatorShell, Block } from "./IndicatorShell";
import { MomNote } from "./MomNote";
import { KpiStat } from "@/components/charts/KpiStat";
import { RankedList } from "@/components/charts/RankedList";
import { LineTrend } from "@/components/charts/LineTrend";

/** CE3 — Seni visual & pertunjukan (archetype E: event list). */
export default async function Ce3View() {
  const d = await primaryData("CE3");
  const rows = d?.rows ?? [];
  const trend = byPeriod(rows, "periode_data");
  const topVenue = groupCount(rows, "nama_venue").sort((a, b) => b.value - a.value).slice(0, 12);
  const recent = [...rows]
    .filter((r) => r.nama_event)
    .sort((a, b) => String(b.periode_data ?? "").localeCompare(String(a.periode_data ?? "")))
    .slice(0, 20);

  return (
    <IndicatorShell code="CE3" sources={d ? [{ slug: d.slug, title: d.title }] : []}>
      <MomNote>
        Kearney hanya mengakui event seni/pertunjukan yang menghadirkan artis{" "}
        <b>Top 10 Global Chart</b> (Billboard/Spotify) selama <b>5 tahun berturut-turut</b>.
      </MomNote>
      <div className="grid sm:grid-cols-3 gap-4">
        <KpiStat label="Total event" value={rows.length} />
        <KpiStat label="Venue unik" value={new Set(rows.map((r) => r.nama_venue)).size} />
        <KpiStat label="Periode" value={trend.length} />
      </div>
      {trend.length >= 2 && (
        <Block title="Tren jumlah event per periode"><LineTrend data={trend} /></Block>
      )}
      <Block title="Top venue (jumlah event)"><RankedList data={topVenue} /></Block>
      <Block title="Event terbaru">
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 border-b border-slate-200">
                <th className="py-2 pr-3 font-semibold">Tanggal</th>
                <th className="py-2 pr-3 font-semibold">Event</th>
                <th className="py-2 pr-3 font-semibold">Venue</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((r, i) => (
                <tr key={i} className="border-b border-slate-100">
                  <td className="py-2 pr-3 tabular-nums text-slate-500 whitespace-nowrap">{String(r.periode_data ?? "—")}</td>
                  <td className="py-2 pr-3 text-slate-800">{String(r.nama_event ?? "—")}</td>
                  <td className="py-2 pr-3 text-slate-600">{String(r.nama_venue ?? "—")}</td>
                </tr>
              ))}
              {recent.length === 0 && (
                <tr><td colSpan={3} className="py-6 text-center text-slate-400">Tidak ada baris event.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </Block>
    </IndicatorShell>
  );
}
