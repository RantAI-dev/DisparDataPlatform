"use client";

import { useState } from "react";
import { ChartCard, ChartGrid, Kpi, KpiRow } from "@/components/pariwisata/DashboardKit";
import { VerticalBars } from "@/components/charts/VerticalBars";
import { Donut } from "@/components/charts/Donut";
import { BarBreakdown } from "@/components/charts/BarBreakdown";
import { GroupedLines } from "@/components/charts/GroupedLines";
import { GroupedBars } from "@/components/charts/GroupedBars";
import type { WisnusRow } from "@/lib/dashboard/data";
import { BULAN, ModeToggle, idNum } from "./Kit";

const SEMUA = "Semua kota";
const SELURUH = "Seluruh Jakarta";

/**
 * Capaian wisnus per Kota TUJUAN (BPS). Tanpa target. Filter utama = Kota Tujuan.
 */
export function WisnusStat({ rows }: { rows: WisnusRow[] }) {
  const kotaList = [...new Set(rows.map((r) => r.kota))].sort();
  const years = [...new Set(rows.map((r) => r.tahun))].sort();
  const [kota, setKota] = useState(SEMUA);
  const [yoyKota, setYoyKota] = useState(SELURUH);
  const [year, setYear] = useState(years.filter((y) => rows.filter((r) => r.tahun === y).length >= 12 * kotaList.length).pop() ?? years[years.length - 1] ?? "");

  if (!rows.length) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-[13px] text-red-700">
        Data wisatawan nusantara belum dapat ditampilkan. Coba muat ulang halaman.
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

  // YoY bulanan: jumlah perjalanan seluruh kota/kab (atau satu kota) per bulan, dibanding bulan yang sama tahun sebelumnya.
  const yoyRows = yoyKota === SELURUH ? rows : rows.filter((r) => r.kota === yoyKota);
  const yoyByPeriode = new Map<string, number>();
  const yoyKotaByPeriode = new Map<string, Set<string>>();
  for (const r of yoyRows) {
    yoyByPeriode.set(r.periode, (yoyByPeriode.get(r.periode) ?? 0) + r.jumlah);
    if (!yoyKotaByPeriode.has(r.periode)) yoyKotaByPeriode.set(r.periode, new Set());
    yoyKotaByPeriode.get(r.periode)!.add(r.kota);
  }
  const yoyBulanan = [...yoyByPeriode.entries()]
    .map(([periode, jumlah]) => ({ periode, tahun: periode.slice(0, 4), bulan: Number(periode.slice(5, 7)), jumlah }))
    .sort((a, b) => a.periode.localeCompare(b.periode));
  // Batang per tahun: 3 tahun terakhir saja (seperti Wisman) agar warna tetap terbedakan.
  const yoyYears = [...new Set(yoyBulanan.map((r) => r.tahun))].slice(-3);
  const yoySeries = yoyYears.map((y) => ({
    name: partial(y) ? `${y} •` : y,
    data: yoyBulanan.filter((r) => r.tahun === y).map((r) => ({ label: BULAN[r.bulan - 1], value: r.jumlah })),
  }));
  const yoyPct = yoyBulanan
    .map((r) => {
      const prev = `${Number(r.tahun) - 1}-${String(r.bulan).padStart(2, "0")}`;
      const p = yoyByPeriode.get(prev);
      // Hanya bandingkan bila himpunan kota yang berkontribusi sama di kedua bulan,
      // agar kota yang absen di salah satu bulan tidak mendistorsi YoY.
      const a = yoyKotaByPeriode.get(r.periode);
      const b = yoyKotaByPeriode.get(prev);
      const sama = !!a && !!b && a.size === b.size && [...a].every((k) => b.has(k));
      return p && sama ? { label: r.periode, value: Math.round(((r.jumlah / p - 1) * 100) * 10) / 10 } : null;
    })
    .filter((p): p is { label: string; value: number } => p !== null);
  const labelBulan = (periode: string) => {
    const [y, m] = periode.split("-");
    return `${BULAN[Number(m) - 1] ?? m} ${y}`;
  };

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
          Berdasarkan Kota/Kabupaten Tujuan Wisatawan Nusantara
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
        <ChartCard title={`Capaian tahunan · ${kota}`} sub="jumlah perjalanan wisnus per tahun">
          <VerticalBars data={years.map((y) => ({ label: yLabel(y), value: total(y) }))} unit=" perjalanan" />
          {missing.length > 0 && (
            <p className="mt-2 apple-fine text-ink-muted-48">Tahun {missing.join(", ")} belum tersedia.</p>
          )}
        </ChartCard>
      </div>

      <div className="mt-6 mb-3 flex flex-wrap items-center gap-2">
        <span className="apple-fine uppercase tracking-wider text-ink-muted-48">Filter berdasarkan Tahun</span>
        <ModeToggle value={year} onChange={setYear} options={years.map((y) => ({ value: y, label: y }))} />
      </div>
      <ChartGrid cols={2}>
        <ChartCard title={`Persentase per kota tujuan · ${yLabel(year)}`} sub="% dari total perjalanan ke DKI Jakarta">
          <Donut showPercent data={perKota(year)} />
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

      <div className="mt-6 mb-3 flex flex-wrap items-center gap-2">
        <span className="apple-fine uppercase tracking-wider text-ink-muted-48">Kota/kabupaten (YoY)</span>
        <select
          value={yoyKota}
          onChange={(e) => setYoyKota(e.target.value)}
          className="rounded-lg border border-hairline bg-white px-3 py-1.5 text-[13px] font-semibold text-ink shadow-sm"
        >
          {[SELURUH, ...kotaList].map((k) => (
            <option key={k} value={k}>
              {k}
            </option>
          ))}
        </select>
      </div>
      <ChartGrid cols={2}>
        <ChartCard title={`Wisnus year-on-year · ${yoyKota}`} sub="bulan yang sama dibandingkan lintas tahun · • = tahun berjalan">
          <GroupedBars series={yoySeries} categories={BULAN} unit=" perjalanan" colors={["#f4a672", "#ed6b23", "#0e7c42"].slice(-yoySeries.length)} />
        </ChartCard>
        <ChartCard title={`Pertumbuhan YoY per bulan (%) · ${yoyKota}`} sub="vs bulan yang sama tahun sebelumnya">
          <VerticalBars data={yoyPct} unit="%" labelFmt={labelBulan} color="#0e7c42" />
        </ChartCard>
      </ChartGrid>
    </div>
  );
}
