"use client";

import { useMemo, useState } from "react";
import { ChartCard, ChartGrid, Kpi, KpiRow } from "@/components/pariwisata/DashboardKit";
import { ComboBarLine } from "@/components/charts/ComboBarLine";
import { Donut } from "@/components/charts/Donut";
import { VerticalBars } from "@/components/charts/VerticalBars";
import { GroupedBars } from "@/components/charts/GroupedBars";
import { GroupedLines } from "@/components/charts/GroupedLines";
import { LosByClass } from "./LosByClass";
import type { LosRow, PintuBulananRow, Point, WismanData } from "@/lib/dashboard/data";
import { BULAN, ModeToggle, SectionHead, idNum } from "./Kit";

const labelBulan = (periode: string) => {
  const [y, m] = periode.split("-");
  return `${BULAN[Number(m) - 1] ?? m} ${y}`;
};

/** Top-N + "Lainnya" (menggabung sisa + ember "Lainnya" dari sumber). */
function topN(map: Map<string, number>, n = 8): Point[] {
  const all = [...map.entries()].map(([label, value]) => ({ label, value }));
  const real = all.filter((p) => p.label.toUpperCase() !== "LAINNYA").sort((a, b) => b.value - a.value);
  const top = real.slice(0, n);
  const rest = all.reduce((a, p) => a + p.value, 0) - top.reduce((a, p) => a + p.value, 0);
  return rest > 0 ? [...top, { label: "Lainnya", value: rest }] : top;
}

const titlePintu = (s: string) =>
  s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).replace("Soekarno Hatta", "Soekarno-Hatta");

/**
 * Warna konsisten per LABEL (bukan per posisi) supaya ganti tahun/bulan tidak menukar warna.
 * Soekarno-Hatta = pintu utama → hijau; Halim = oranye; Tanjung Priok = biru (paling kecil, warna berbeda biar kontras).
 */
const PINTU_COLORS: Record<string, string> = {
  "Soekarno-Hatta": "#0e7c42",
  "Halim Perdana Kusuma": "#ed6b23",
  "Tanjung Priok": "#2563eb",
};

/**
 * Negara dengan kunjungan stabil lintas tahun di-anchor ke warna tetap.
 * Posisi di top-8 berubah-ubah; tanpa kunci ini, negara yang sama bisa tampil beda warna antar tahun.
 */
const NEGARA_COLORS: Record<string, string> = {
  "Tiongkok": "#0e7c42",
  "Malaysia": "#ed6b23",
  "Singapura": "#f0a13a",
  "Jepang": "#2563eb",
  "Korea Selatan": "#7c3aed",
  "Amerika Serikat": "#0891b2",
  "Australia": "#e11d48",
  "India": "#65a30d",
  "Arab Saudi": "#0d9488",
};

export function WismanStat({
  data,
  los,
  target,
  pintuBulanan = [],
}: {
  data: WismanData;
  los: LosRow[];
  target: Record<string, number>;
  /** Pintu masuk per BULAN (BPS) — dipakai bila ada untuk bulan terpilih; selain itu jatuh ke data semesteran SDI. */
  pintuBulanan?: PintuBulananRow[];
}) {
  const years = useMemo(() => [...new Set(data.bulanan.map((r) => r.tahun))].sort(), [data.bulanan]);
  const [year, setYear] = useState(years.includes("2025") ? "2025" : years[years.length - 1] ?? "");
  const periods = data.bulanan.map((r) => r.periode);
  const [month, setMonth] = useState(periods[periods.length - 1] ?? "");

  const total = (y: string) => data.bulanan.filter((r) => r.tahun === y).reduce((a, r) => a + r.jumlah, 0);
  const nMonths = (y: string) => data.bulanan.filter((r) => r.tahun === y).length;
  const partial = (y: string) => nMonths(y) < 12;

  if (!data.bulanan.length) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-[13px] text-red-700">
        Data wisatawan mancanegara belum dapat ditampilkan. Coba muat ulang halaman.
      </div>
    );
  }

  // ---------- Tahunan ----------
  const yLabel = (y: string) => (partial(y) ? `${y} (s/d ${BULAN[nMonths(y) - 1]})` : y);
  const negaraYear = new Map<string, number>();
  for (const r of data.negara) if (r.periode.startsWith(year)) negaraYear.set(r.negara, (negaraYear.get(r.negara) ?? 0) + r.jumlah);
  const pintuYear = new Map<string, number>();
  for (const r of data.pintu) if (r.tahun === year) pintuYear.set(titlePintu(r.pintu), (pintuYear.get(titlePintu(r.pintu)) ?? 0) + r.jumlah);
  const semYear = [...new Set(data.pintu.filter((r) => r.tahun === year).map((r) => r.semester))].sort();

  const last = years[years.length - 1];
  const full = years.filter((y) => !partial(y));
  const lastFull = full[full.length - 1];
  const prevFull = full[full.length - 2];
  const growth = lastFull && prevFull ? ((total(lastFull) - total(prevFull)) / total(prevFull)) * 100 : null;

  // ---------- Bulanan ----------
  const monthIdx = periods.indexOf(month);
  const mRow = data.bulanan[monthIdx];
  const prevYearSame = mRow ? data.bulanan.find((r) => r.tahun === String(Number(mRow.tahun) - 1) && r.bulan === mRow.bulan) : undefined;
  const yoyMonth = mRow && prevYearSame ? ((mRow.jumlah - prevYearSame.jumlah) / prevYearSame.jumlah) * 100 : null;
  const negaraMonth = new Map<string, number>();
  for (const r of data.negara) if (r.periode === month) negaraMonth.set(r.negara, (negaraMonth.get(r.negara) ?? 0) + r.jumlah);
  const semOfMonth = mRow ? (mRow.bulan <= 6 ? 1 : 2) : 1;
  const pintuSem = new Map<string, number>();
  for (const r of data.pintu)
    if (mRow && r.tahun === mRow.tahun && r.semester === semOfMonth) pintuSem.set(titlePintu(r.pintu), r.jumlah);
  const pintuBln = pintuBulanan
    .filter((r) => r.periode === month)
    .map((r) => ({ label: r.pintu.replace(/^(Bandara|Pelabuhan) /, ""), value: r.jumlah }));

  const yoySeries = years.map((y) => ({
    name: partial(y) ? `${y} •` : y,
    data: data.bulanan.filter((r) => r.tahun === y).map((r) => ({ label: BULAN[r.bulan - 1], value: r.jumlah })),
  }));
  const yoyPct: Point[] = data.bulanan
    .map((r) => {
      const p = data.bulanan.find((x) => x.tahun === String(Number(r.tahun) - 1) && x.bulan === r.bulan);
      return p ? { label: r.periode, value: Math.round(((r.jumlah - p.jumlah) / p.jumlah) * 1000) / 10 } : null;
    })
    .filter((p): p is Point => p !== null);

  // Lama menginap: rata-rata sederhana lintas kelas bintang per bulan.
  const losAvg = (tamu: "Wisman" | "Wisnus") => {
    const m = new Map<string, number[]>();
    for (const r of los) if (r.jenisTamu === tamu) m.set(r.periode, [...(m.get(r.periode) ?? []), r.rataRata]);
    return [...m.entries()].map(([label, v]) => ({ label, value: Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 100) / 100 }));
  };

  return (
    <div>
      <p className="mb-5 apple-fine text-ink-muted-48">
        Data tersedia {labelBulan(periods[0])} – {labelBulan(periods[periods.length - 1])}
      </p>

      <SectionHead title="1 · Tahunan" desc="Capaian vs target RPJMD dan komposisi wisman per tahun." />
      <KpiRow>
        {years.map((y) => (
          <Kpi key={y} label={`Capaian ${yLabel(y)}`} value={total(y)} sub={target[y] ? `target RPJMD ${idNum(target[y])}` : "target RPJMD belum ditetapkan"} />
        ))}
        <Kpi label={`Pertumbuhan ${lastFull ?? ""}`} value={growth != null ? `${idNum(growth, 1)}%` : "—"} delta={growth} sub={prevFull ? `vs ${prevFull}` : undefined} />
      </KpiRow>

      <div className="mt-4">
        <ChartCard title="Capaian vs Target Wisman" sub="Capaian = batang (kunjungan wisman) · Target RPJMD = garis">
          <ComboBarLine
            categories={years.map(yLabel)}
            bar={{ name: "Capaian", values: years.map(total) }}
            line={{ name: "Target RPJMD", values: years.map((y) => target[y] ?? null) }}
            dualAxis={false}
          />
          <p className="mt-2 apple-fine text-ink-muted-48">
            RPJMD 2025–2029 mencantumkan target dimulai dari tahun 2025 (Tabel III.2 indikator 2.1.c).
            {last && partial(last) ? ` ${last} masih berjalan — capaian parsial s/d ${BULAN[nMonths(last) - 1]}.` : ""}
          </p>
        </ChartCard>
      </div>

      <div className="mt-6 mb-3 flex flex-wrap items-center gap-2">
        <span className="apple-fine uppercase tracking-wider text-ink-muted-48">Filter berdasarkan Tahun</span>
        <ModeToggle value={year} onChange={setYear} options={years.map((y) => ({ value: y, label: y }))} />
      </div>
      <ChartGrid cols={2}>
        <ChartCard title={`Persentase Wisman berdasarkan Kebangsaan · ${yLabel(year)}`} sub="8 negara terbesar + lainnya">
          <Donut showPercent data={topN(negaraYear)} colorMap={NEGARA_COLORS} />
        </ChartCard>
        <ChartCard
          title={`Persentase Wisman berdasarkan Pintu Masuk · ${year}`}
          sub={`Soekarno-Hatta, Halim, Tanjung Priok · semester ${semYear.join(" & ") || "—"}`}
        >
          <Donut showPercent data={[...pintuYear.entries()].map(([label, value]) => ({ label, value }))} colorMap={PINTU_COLORS} />
        </ChartCard>
      </ChartGrid>

      <SectionHead title="2 · Tren Bulanan" desc="Tren bulanan, perbandingan year-on-year, komposisi per bulan, dan lama menginap." />
      <ChartCard title="Grafik Wisman per bulan" sub="kunjungan wisman per bulan, seluruh periode">
        <VerticalBars data={data.bulanan.map((r) => ({ label: r.periode, value: r.jumlah }))} unit=" kunjungan" labelFmt={labelBulan} />
      </ChartCard>

      <div className="mt-4">
        <ChartGrid cols={2}>
          <ChartCard title="Wisman year-on-year" sub="bulan yang sama dibandingkan lintas tahun · • = tahun berjalan">
            <GroupedBars series={yoySeries} categories={BULAN} unit=" kunjungan" colors={["#f4a672", "#ed6b23", "#0e7c42"]} />
          </ChartCard>
          <ChartCard title="Pertumbuhan YoY per bulan (%)" sub="vs bulan yang sama tahun sebelumnya">
            <VerticalBars data={yoyPct} unit="%" labelFmt={labelBulan} color="#0e7c42" />
          </ChartCard>
        </ChartGrid>
      </div>

      <div className="mt-6 mb-3 flex flex-wrap items-center gap-2">
        <span className="apple-fine uppercase tracking-wider text-ink-muted-48">Pilih bulan</span>
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="rounded-lg border border-hairline bg-white px-3 py-1.5 text-[13px] font-semibold text-ink shadow-sm"
        >
          {periods.map((p) => (
            <option key={p} value={p}>
              {labelBulan(p)}
            </option>
          ))}
        </select>
      </div>
      <KpiRow>
        <Kpi label={`Wisman ${labelBulan(month)}`} value={mRow?.jumlah ?? 0} sub="kunjungan" />
        <Kpi label="YoY bulan ini" value={yoyMonth != null ? `${idNum(yoyMonth, 1)}%` : "—"} delta={yoyMonth} sub={prevYearSame ? `vs ${labelBulan(prevYearSame.periode)}` : "tak ada pembanding"} />
        <Kpi label="Negara terbanyak" value={topN(negaraMonth, 1)[0]?.label ?? "—"} sub={topN(negaraMonth, 1)[0] ? `${idNum(topN(negaraMonth, 1)[0].value)} kunjungan` : undefined} />
        <Kpi label="Lama menginap wisman" value={losAvg("Wisman").find((p) => p.label === month)?.value.toLocaleString("id-ID") ?? "—"} sub="hari · hotel bintang (rata-rata kelas)" />
      </KpiRow>
      <div className="mt-4">
        <ChartGrid cols={2}>
          <ChartCard title={`Persentase Wisman berdasarkan Kebangsaan · ${labelBulan(month)}`} sub="8 negara terbesar + lainnya">
            <Donut showPercent data={topN(negaraMonth)} colorMap={NEGARA_COLORS} />
          </ChartCard>
          {pintuBln.length ? (
            <ChartCard title={`Persentase Wisman berdasarkan Pintu Masuk · ${labelBulan(month)}`} sub="data bulanan BPS DKI Jakarta">
              <Donut showPercent data={pintuBln} colorMap={PINTU_COLORS} />
            </ChartCard>
          ) : (
            <ChartCard
              title={`Persentase Wisman berdasarkan Pintu Masuk · Semester ${semOfMonth} ${mRow?.tahun ?? ""}`}
              sub="data bulanan BPS belum tersedia untuk bulan ini — ditampilkan data semesteran SDI"
            >
              {pintuSem.size ? (
                <Donut showPercent data={[...pintuSem.entries()].map(([label, value]) => ({ label, value }))} colorMap={PINTU_COLORS} />
              ) : (
                <div className="py-10 text-center text-[13px] text-ink-muted-48">Semester ini belum dirilis.</div>
              )}
            </ChartCard>
          )}
        </ChartGrid>
      </div>

      <SectionHead title="Length of Stay — rata-rata lama menginap" desc="Rata-rata lama menginap (hari) per bulan, wisman vs wisnus." />
      <ChartGrid cols={2}>
        <ChartCard title="RTL Bintang · tren bulanan" sub="rata-rata sederhana Bintang 1–5 (hari)">
          <GroupedLines
            series={[
              { name: "Wisman", data: losAvg("Wisman") },
              { name: "Wisnus", data: losAvg("Wisnus") },
            ]}
          />
        </ChartCard>
        <LosByClass los={los} guest="Wisman" />
      </ChartGrid>
      {/* RTL Non Bintang belum ditampilkan — menunggu data Berita Resmi Statistik BPS. */}
    </div>
  );
}
