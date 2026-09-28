"use client";

import { ChartCard, ChartGrid } from "@/components/pariwisata/DashboardKit";
import { GroupedLines } from "@/components/charts/GroupedLines";
import { BarBreakdown } from "@/components/charts/BarBreakdown";
import type { LosRow } from "@/lib/dashboard/data";
import { BULAN } from "./Kit";

/** Lama menginap wisnus per bulan — per kelas hotel bintang + rata-rata. */
export function WisnusLos({ los }: { los: LosRow[] }) {
  const w = los.filter((r) => r.jenisTamu === "Wisnus");
  if (!w.length)
    return <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-[13px] text-red-700">Data lama menginap tidak dapat dibaca dari lakehouse.</div>;
  const kelas = [...new Set(w.map((r) => r.jenisHotel))].sort();
  const series = kelas.map((k) => ({
    name: k.replace("BINTANG", "Bintang"),
    data: w.filter((r) => r.jenisHotel === k).map((r) => ({ label: r.periode, value: r.rataRata })),
  }));
  const last = w[w.length - 1].periode;
  const [y, m] = last.split("-");
  return (
    <ChartGrid cols={2}>
      <ChartCard title="Lama menginap wisnus per bulan" sub="hari · per kelas hotel bintang">
        <GroupedLines series={series} />
      </ChartCard>
      <ChartCard title={`Per kelas hotel · ${BULAN[Number(m) - 1]} ${y}`} sub="hari">
        <BarBreakdown
          data={w.filter((r) => r.periode === last).map((r) => ({ label: r.jenisHotel.replace("BINTANG", "Bintang"), value: r.rataRata }))}
          unit=" hari"
        />
      </ChartCard>
    </ChartGrid>
  );
}
