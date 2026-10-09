import { pickData } from "@/lib/indicator-data";
import { groupSum, byPeriod, topN, total } from "@/lib/agg";
import { IndicatorShell, Block } from "./IndicatorShell";
import { MomNote } from "./MomNote";
import { KpiStat } from "@/components/charts/KpiStat";
import { BarBreakdown } from "@/components/charts/BarBreakdown";
import { RankedList } from "@/components/charts/RankedList";
import { LineTrend } from "@/components/charts/LineTrend";

/** CI-FV — Foreign Visitors (archetype B: tren + lokasi). */
export default async function CiFvView() {
  const d = await pickData("CI-FV", ["lokasi", "jumlah"]);
  const rows = d?.rows ?? [];
  const trend = byPeriod(rows, "periode_data", "jumlah");
  const perLokasi = groupSum(rows, "lokasi", "jumlah").sort((a, b) => b.value - a.value);
  const nd = await pickData("CI-FV", ["kebangsaan", "jumlah_kunjungan"]);
  const perNegara = topN(groupSum(nd?.rows ?? [], "kebangsaan", "jumlah_kunjungan"), 12);

  return (
    <IndicatorShell
      code="CI-FV"
      sources={[d, nd].filter(Boolean).map((x) => ({ slug: x!.slug, title: x!.title }))}
    >
      <MomNote>
        Menampilkan total wisatawan <b>per bulan</b> dan <b>per pintu masuk</b>, selain
        per kebangsaan. Klasifikasi negara pada data BPS telah distandarkan.
      </MomNote>
      <div className="grid sm:grid-cols-3 gap-4">
        <KpiStat label="Total kunjungan" value={total(trend)} />
        <KpiStat label="Lokasi TIC" value={perLokasi.length} />
        <KpiStat label="Periode terdata" value={trend.length} />
      </div>
      {trend.length >= 2 && (
        <Block title="Tren kunjungan per periode"><LineTrend data={trend} /></Block>
      )}
      <Block title="Per lokasi TIC"><BarBreakdown data={perLokasi} /></Block>
      {perNegara.length > 0 && (
        <Block title="Top negara asal"><RankedList data={perNegara} /></Block>
      )}
    </IndicatorShell>
  );
}
