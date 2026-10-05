"use client";

import { ChartCard, ChartGrid } from "@/components/pariwisata/DashboardKit";
import { GroupedLines } from "@/components/charts/GroupedLines";
import { LosByClass } from "./LosByClass";
import type { LosRow } from "@/lib/dashboard/data";

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
  return (
    <ChartGrid cols={2}>
      <ChartCard title="Lama menginap wisnus per bulan" sub="hari · per kelas hotel bintang">
        <GroupedLines series={series} />
      </ChartCard>
      <LosByClass los={los} guest="Wisnus" />
    </ChartGrid>
  );
}
