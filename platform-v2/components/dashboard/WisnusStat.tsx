"use client";

import { useState } from "react";
import { ChartCard, ChartGrid, Kpi, KpiRow } from "@/components/pariwisata/DashboardKit";
import { VerticalBars } from "@/components/charts/VerticalBars";
import { Donut } from "@/components/charts/Donut";
import { BarBreakdown } from "@/components/charts/BarBreakdown";
import { GroupedLines } from "@/components/charts/GroupedLines";
import type { WisnusRow } from "@/lib/dashboard/data";
import { BULAN, ModeToggle, idNum } from "./Kit";

const SEMUA = "Semua kota";

/**
 * Capaian wisnus per Kota TUJUAN (BPS). Tanpa target (MoM §2). Filter utama = Kota Tujuan.
 */
export function WisnusStat({ rows }: { rows: WisnusRow[] }) {
  const kotaList = [...new Set(rows.map((r) => r.kota))].sort();
  const years = [...new Set(rows.map((r) => r.tahun))].sort();
  const [kota, setKota] = useState(SEMUA);
  const [year, setYear] = useState(years.filter((y) => rows.filter((r) => r.tahun === y).length >= 12 * kotaList.length).pop() ?? years[years.length - 1] ?? "");

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-[13px] text-red-700">
        Data wisnus per kota tujuan tidak dapat dibaca dari lakehouse (silver.wisnus_perjalanan_per_kota_tujuan).
      </div>
    );
  }

  const sel = kota === SEMUA ? rows : rows.filter((r) => r.kota === kota);
  const nBulan = (y: string) => new Set(rows.filter((r) => r.tahun === y).map((r) => r.bulan)).size;
  const partial = (y: string) => nBulan(y) < 12;
  const yLabel = (y: string) => (partial(y) ? `${y} (s/d ${BULAN[nBulan(y) - 1]})` : y);
  const total = (y: string, src = sel) => src.filter((r) => r.tahun === y).reduce((a, r) => a + r.jumlah, 0);

  const full = years.filter((y) => !partial(y));
  const lastFull = full[full.length - 1];
  const prevFull = full[full.length - 2];
  const growth = lastFull && prevFull ? ((total(lastFull) - total(prevFull)) / total(prevFull)) * 100 : null;
  const missing: string[] = [];
  for (let y = Number(years[0]); y <= Number(years[years.length - 1]); y++) if (!years.includes(String(y))) missing.push(String(y));

  // Tahun berjalan dibandingkan periode yang sama tahun penuh terakhir.
  const last = years[years.length - 1];
  const ytdMonths = partial(last) ? nBulan(last) : 12;
  const ytd = (y: string) => sel.filter((r) => r.tahun === y && r.bulan <= ytdMonths).reduce((a, r) => a + r.jumlah, 0);

  const perKota = (y: string) =>
    kotaList.map((k) => ({ label: k, value: rows.filter((r) => r.tahun === y && r.kota === k).reduce((a, r) => a + r.jumlah, 0) }))
      .sort((a, b) => b.value - a.value);
  const topKota = perKota(lastFull ?? last)[0];

  const monthlySeries = (kota === SEMUA ? kotaList : [kota]).map((k) => ({
    name: k,
    data: rows.filter((r) => r.kota === k).map((r) => ({ label: r.periode, value: r.jumlah })),
  }));

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <span className="apple-fine uppercase tracking-wider text-ink-muted-48">Kota tujuan</span>
        <select
          value={kota}
          onChange={(e) => setKota(e.target.value)}
          className="rounded-lg border border-hairline bg-white px-3 py-1.5 text-[13px] font-semibold text-ink shadow-sm"
        >
          {[SEMUA, ...kotaList].map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
        <span className="apple-fine text-ink-muted-48">
          Filter memakai Kota <b>Tujuan</b> (bukan Kota Asal) — pergerakan riil wisatawan yang masuk ke Jakarta.
        </span>
      </div>

      <KpiRow>
        <Kpi label={`Capaian ${lastFull ?? "—"}`} value={lastFull ? total(lastFull) : "—"} sub="perjalanan" />
        <Kpi label={`Pertumbuhan ${lastFull ?? ""}`} value={growth != null ? `${idNum(growth, 1)}%` : "—"} delta={growth} sub={prevFull ? `vs ${prevFull}` : undefined} />
        <Kpi
          label={`${yLabel(last)}`}
          value={total(last)}
          sub={lastFull && partial(last) ? `Jan–${BULAN[ytdMonths - 1]} ${lastFull}: ${idNum(ytd(lastFull))}` : "perjalanan"}
        />
        <Kpi label={`Tujuan terbanyak ${lastFull ?? ""}`} value={topKota?.label ?? "—"} sub={topKota ? `${idNum(topKota.value)} perjalanan` : undefined} />
      </KpiRow>

      <div className="mt-4">
        <ChartCard title={`Capaian tahunan · ${kota}`} sub="jumlah perjalanan wisnus per tahun (tanpa target)">
          <VerticalBars data={years.map((y) => ({ label: yLabel(y), value: total(y) }))} unit=" perjalanan" />
          {missing.length > 0 && (
            <p className="mt-2 apple-fine text-ink-muted-48">Tahun {missing.join(", ")} belum tersedia (tabel BPS belum diunggah).</p>
          )}
        </ChartCard>
      </div>

      <div className="mt-6 mb-3 flex flex-wrap items-center gap-2">
        <span className="apple-fine uppercase tracking-wider text-ink-muted-48">Komposisi tahun</span>
        <ModeToggle value={year} onChange={setYear} options={years.map((y) => ({ value: y, label: y }))} />
      </div>
      <ChartGrid cols={2}>
        <ChartCard title={`Persentase per kota tujuan · ${yLabel(year)}`} sub="% dari total perjalanan ke DKI Jakarta">
          <Donut data={perKota(year)} />
        </ChartCard>
        <ChartCard title={`Perjalanan per kota tujuan · ${yLabel(year)}`} sub="perjalanan">
          <BarBreakdown data={perKota(year)} unit=" perjalanan" />
        </ChartCard>
      </ChartGrid>

      <div className="mt-4">
        <ChartCard title={`Tren bulanan · ${kota}`} sub="perjalanan per bulan menurut kota tujuan">
          <GroupedLines series={monthlySeries} />
        </ChartCard>
      </div>
    </div>
  );
}
