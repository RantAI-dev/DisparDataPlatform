import { pickData } from "@/lib/indicator-data";
import { groupSum, topN, total } from "@/lib/agg";
import { IndicatorShell, Block } from "./IndicatorShell";
import { MomNote } from "./MomNote";
import { KpiStat } from "@/components/charts/KpiStat";
import { BarBreakdown } from "@/components/charts/BarBreakdown";
import { RankedList } from "@/components/charts/RankedList";

/**
 * CE2 — Kuliner beragam (archetype C: breakdown wilayah).
 * Dataset: Jumlah Restoran per Kelurahan (wilayah, kecamatan, kelurahan, jumlah).
 */
export default async function Ce2View() {
  const d = await pickData("CE2", ["wilayah", "jumlah"]);
  const rows = d?.rows ?? [];
  const perWilayah = groupSum(rows, "wilayah", "jumlah").sort((a, b) => b.value - a.value);
  const perKecamatan = topN(groupSum(rows, "kecamatan", "jumlah"), 12);
  const grand = total(perWilayah);

  return (
    <IndicatorShell code="CE2" sources={d ? [{ slug: d.slug, title: d.title }] : []}>
      <MomNote>
        Kearney saat ini hanya mengakui data restoran <b>Michelin Star</b> dan{" "}
        <b>TripAdvisor</b>; data Google belum diakui. Karena belum ada restoran Michelin
        Star di Jakarta, indikator ini dihitung dari data <b>TripAdvisor</b>.
      </MomNote>
      <div className="grid sm:grid-cols-3 gap-4">
        <KpiStat label="Total restoran" value={grand} />
        <KpiStat label="Wilayah" value={perWilayah.length} />
        <KpiStat label="Kecamatan terdata" value={new Set(rows.map((r) => r.kecamatan)).size} />
      </div>
      <Block title="Sebaran per wilayah (kota)">
        <BarBreakdown data={perWilayah} />
      </Block>
      <Block title="Top kecamatan">
        <RankedList data={perKecamatan} />
      </Block>
    </IndicatorShell>
  );
}
