"use client";

import { useState } from "react";
import { ChartCard } from "@/components/pariwisata/DashboardKit";
import { GroupedBars } from "@/components/charts/GroupedBars";
import type { LosRow } from "@/lib/dashboard/data";
import { BULAN, idNum } from "./Kit";

const periodLabel = (period: string) => {
  const [year, month] = period.split("-");
  return `${BULAN[Number(month) - 1]} ${year}`;
};

export function losComparison(rows: LosRow[], period: string) {
  const [year, month] = period.split("-");
  const previous = `${Number(year) - 1}-${month}`;
  const current = rows.filter((r) => r.periode === period);
  const prior = rows.filter((r) => r.periode === previous);
  const classes = [...new Set([...current, ...prior].map((r) => r.jenisHotel))].sort();
  return {
    previous,
    rows: classes.map((hotel) => {
      const value = current.find((r) => r.jenisHotel === hotel)?.rataRata;
      const baseline = prior.find((r) => r.jenisHotel === hotel)?.rataRata;
      return { hotel, label: hotel.replace("BINTANG", "Bintang"), value, baseline,
        yoy: value !== undefined && baseline !== undefined && baseline > 0 ? ((value - baseline) / baseline) * 100 : null };
    }),
  };
}

/** Per kelas hotel: bulan pilihan dibandingkan bulan yang sama tahun sebelumnya. */
export function LosByClass({ los, guest }: { los: LosRow[]; guest: LosRow["jenisTamu"] }) {
  const rows = los.filter((r) => r.jenisTamu === guest && Number.isFinite(r.rataRata));
  const periods = [...new Set(rows.map((r) => r.periode))].sort();
  const [selected, setSelected] = useState("");
  const period = periods.includes(selected) ? selected : periods[periods.length - 1] ?? "";
  const comparison = losComparison(rows, period);
  const label = period ? periodLabel(period) : "—";
  const previousLabel = period ? periodLabel(comparison.previous) : "—";
  const hasPrior = comparison.rows.some((r) => r.baseline !== undefined);

  return (
    <ChartCard title={`Per kelas hotel · ${label}`} sub={`${guest.toLowerCase()} · hari · perbandingan YoY`}>
      {!period ? <p role="status" className="apple-fine text-ink-muted-48">Data lama menginap belum tersedia.</p> : <>
        <label className="mb-4 flex flex-wrap items-center gap-2 apple-fine text-ink-muted-80">
          Periode
          <select aria-label={`Periode Length of Stay ${guest}`} value={period} onChange={(e) => setSelected(e.target.value)} className="rounded-lg border border-hairline bg-canvas px-3 py-2 text-ink">
            {[...periods].reverse().map((p) => <option key={p} value={p}>{periodLabel(p)}</option>)}
          </select>
        </label>
        <GroupedBars
          categories={comparison.rows.map((r) => r.label)}
          series={[
            { name: label, data: comparison.rows.filter((r) => r.value !== undefined).map((r) => ({ label: r.label, value: r.value! })) },
            { name: previousLabel, data: comparison.rows.filter((r) => r.baseline !== undefined).map((r) => ({ label: r.label, value: r.baseline! })) },
          ]}
          missingValue={null}
          unit=" hari"
        />
        <p className="mt-2 apple-fine text-ink-muted-48">
          {hasPrior ? "YoY membandingkan bulan yang sama pada tahun sebelumnya." : `Data ${previousLabel} belum tersedia; YoY tidak dihitung.`}
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-[12px] tabular-nums">
            <caption className="sr-only">Length of Stay {guest} per kelas hotel dan perubahan YoY</caption>
            <thead className="text-ink-muted-48"><tr>
              <th scope="col" className="py-2 pr-3">Kelas hotel</th>
              <th scope="col" className="py-2 px-2 text-right whitespace-nowrap">{previousLabel}</th>
              <th scope="col" className="py-2 px-2 text-right whitespace-nowrap">{label}</th>
              <th scope="col" className="py-2 pl-2 text-right">YoY</th>
            </tr></thead>
            <tbody>{comparison.rows.map((r) => <tr key={r.hotel} className="border-t border-hairline">
              <th scope="row" className="py-2 pr-3 font-medium text-ink">{r.label}</th>
              <td className="py-2 px-2 text-right">{r.baseline === undefined ? "—" : idNum(r.baseline, 2)}</td>
              <td className="py-2 px-2 text-right">{r.value === undefined ? "—" : idNum(r.value, 2)}</td>
              <td className="py-2 pl-2 text-right whitespace-nowrap">{r.yoy === null ? "—" : `${r.yoy > 0 ? "+" : ""}${idNum(r.yoy, 1)}%`}</td>
            </tr>)}</tbody>
          </table>
        </div>
      </>}
    </ChartCard>
  );
}
