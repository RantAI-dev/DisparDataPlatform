"use client";

import { useState } from "react";
import { ChartCard } from "@/components/pariwisata/DashboardKit";
import { BarBreakdown } from "@/components/charts/BarBreakdown";
import { warnaSubsektor } from "@/lib/dashboard/subsektor-colors";
import { ModeToggle } from "./Kit";

/** Tenaga kerja ekraf nasional per subsektor, dengan filter tahun (default tahun terbaru). */
export function TkSubsektor({ rows }: { rows: { tahun: string; subsektor: string; jumlah: number }[] }) {
  const tahunList = [...new Set(rows.map((r) => r.tahun))].sort();
  const [tahun, setTahun] = useState<string>(tahunList[tahunList.length - 1] ?? "");
  const data = rows
    .filter((r) => r.tahun === tahun)
    .map((r) => ({ label: r.subsektor, value: r.jumlah }))
    .sort((a, b) => b.value - a.value);

  return (
    <>
      <div className="mb-3">
        <ModeToggle value={tahun} onChange={setTahun} options={tahunList.map((t) => ({ value: t, label: t }))} />
      </div>
      <ChartCard title={`Tenaga Kerja Ekonomi Kreatif per Subsektor di Tingkat Nasional - Tahun ${tahun}`}>
        <BarBreakdown data={data} unit=" orang" colors={data.map((d) => warnaSubsektor(d.label))} />
      </ChartCard>
    </>
  );
}
