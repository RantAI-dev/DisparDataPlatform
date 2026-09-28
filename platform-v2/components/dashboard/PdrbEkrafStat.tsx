"use client";

import { useState } from "react";
import { ChartCard, ChartGrid, Kpi, KpiRow } from "@/components/pariwisata/DashboardKit";
import { ComboBarLine } from "@/components/charts/ComboBarLine";
import { VerticalBars } from "@/components/charts/VerticalBars";
import { GroupedLines } from "@/components/charts/GroupedLines";
import { BarBreakdown } from "@/components/charts/BarBreakdown";
import { Donut } from "@/components/charts/Donut";
import { PDRB_MAKRO as M, PDRB_SUBSEKTOR, PDRB_SUB_PERIODE, TARGET_KONTRIBUSI_RPJMD as T } from "@/lib/dashboard/pdrb-ekraf";
import { ModeToggle, PendingData, SectionHead, idNum } from "./Kit";

const label = (p: string) => (p === "S1 2025" ? "2025 (Sem I)" : p);

/** Nama pendek untuk legenda donut (legenda ECharts terpotong jadi berhalaman bila nama panjang). */
const PENDEK: Record<string, string> = {
  "Aplikasi dan Pengembang Permainan": "Aplikasi & Game",
  "Televisi dan Radio": "TV & Radio",
  "Film, Animasi, dan Video": "Film & Animasi",
  "Desain Komunikasi Visual": "DKV",
};

export function PdrbEkrafStat() {
  const periode: string[] = [...M.periode];
  const iLast = periode.length - 1;
  const iFull = periode.indexOf("2024");
  const [sub, setSub] = useState<string>("2024");
  const iSub = PDRB_SUB_PERIODE.indexOf(sub as (typeof PDRB_SUB_PERIODE)[number]);

  // Kontribusi: capaian 2017–2025 S1 (batang) + target RPJMD 2025–2029 (garis).
  const cats = [...periode, "2026", "2027", "2028", "2029"];
  const capaian = cats.map((c) => {
    const i = periode.indexOf(c);
    return i >= 0 ? M.kontribusi[i] : null;
  });
  const target = cats.map((c) => T[c === "S1 2025" ? "2025" : c] ?? null);

  const totalSub = PDRB_SUBSEKTOR.reduce((a, s) => a + s.adhb[iSub], 0);
  const pct = (v: number) => Math.round((v / totalSub) * 10000) / 100;
  const urut = PDRB_SUBSEKTOR.map((s) => ({ label: s.nama, value: s.adhb[iSub] })).sort((a, b) => b.value - a.value);
  // Donut: 5 terbesar + "Lainnya" (total tetap 100%) — 16 irisan tak terbaca & legenda terpotong.
  const sisa = urut.slice(5).reduce((a, s) => a + s.value, 0);
  const sebaran = [...urut.slice(0, 5).map((s) => ({ label: PENDEK[s.label] ?? s.label, value: pct(s.value) })), { label: "Lainnya", value: pct(sisa) }];
  const nilaiSub = urut.slice(0, 10);
  const tumbuhSub = PDRB_SUBSEKTOR.map((s) => ({ label: s.nama, value: s.tumbuh[iSub] })).sort((a, b) => b.value - a.value);

  return (
    <div>
      <KpiRow>
        <Kpi label="Kontribusi 2024" value={`${idNum(M.kontribusi[iFull], 2)}%`} sub={`terhadap PDRB DKI · Sem I 2025: ${idNum(M.kontribusi[iLast], 2)}%`} />
        <Kpi label="Target RPJMD 2025" value={`${idNum(T["2025"], 2)}%`} sub={`2029: ${idNum(T["2029"], 2)}%`} />
        <Kpi label="Nilai PDRB Ekraf 2024" value={`Rp ${idNum(M.adhbEkraf[iFull] / 1000, 1)} T`} sub="atas dasar harga berlaku" />
        <Kpi label="Pertumbuhan 2024" value={`${idNum(M.tumbuhEkraf[iFull], 2)}%`} sub={`PDRB DKI ${idNum(M.tumbuhDki[iFull], 2)}%`} />
      </KpiRow>

      <SectionHead title="Kontribusi" desc="Kontribusi PDRB Ekonomi Kreatif terhadap PDRB Provinsi DKI Jakarta (%, ADHB) — KPI utama RPJMD." />
      <ChartCard title="Capaian vs Target RPJMD 2025–2029" sub="Capaian = batang · Target RPJMD = garis">
        <ComboBarLine
          categories={cats.map(label)}
          bar={{ name: "Capaian (%)", values: capaian }}
          line={{ name: "Target RPJMD (%)", values: target }}
          dualAxis={false}
        />
        <p className="mt-2 apple-fine text-ink-muted-48">
          2025 baru Semester I — belum sebanding penuh dengan target tahunan. Target RPJMD: {Object.entries(T).map(([y, v]) => `${y} ${idNum(v, 2)}%`).join(" · ")}.
        </p>
      </ChartCard>

      <SectionHead title="Nilai" desc="Besaran PDRB Ekonomi Kreatif (Rp miliar)." />
      <ChartGrid cols={2}>
        <ChartCard title="PDRB Ekraf atas dasar harga berlaku (ADHB)" sub="Rp miliar">
          <VerticalBars data={periode.map((p, i) => ({ label: label(p), value: M.adhbEkraf[i] }))} unit=" miliar" />
        </ChartCard>
        <ChartCard title="PDRB Ekraf atas dasar harga konstan (ADHK)" sub="Rp miliar · riil, tanpa efek harga">
          <VerticalBars data={periode.map((p, i) => ({ label: label(p), value: M.adhkEkraf[i] }))} unit=" miliar" color="#0e7c42" />
        </ChartCard>
      </ChartGrid>

      <div className="mt-8 mb-3 flex flex-wrap items-center gap-2">
        <h2 className="mr-3 text-[18px] font-bold tracking-tight text-ink">Sebaran</h2>
        <ModeToggle value={sub} onChange={setSub} options={PDRB_SUB_PERIODE.map((p) => ({ value: p as string, label: label(p) }))} />
      </div>
      <ChartGrid cols={2}>
        <ChartCard title={`Distribusi per subsektor · ${label(sub)}`} sub="% terhadap total PDRB Ekraf (ADHB) · 5 terbesar + lainnya">
          <Donut data={sebaran} />
        </ChartCard>
        <ChartCard title={`10 subsektor dengan nilai terbesar · ${label(sub)}`} sub="Rp miliar (ADHB)">
          <BarBreakdown data={nilaiSub} unit=" miliar" />
        </ChartCard>
      </ChartGrid>
      <div className="mt-4">
        <PendingData
          title="Sebaran per wilayah (kota/kabupaten administrasi)"
          need="Berkas PDRB Ekraf yang diterima hanya memuat rincian per subsektor. Rincian per wilayah menunggu data dari Pak Budi (tindak lanjut MoM 21 Sep)."
        />
      </div>

      <SectionHead title="Pertumbuhan" desc="Laju pertumbuhan PDRB atas dasar harga konstan (%, yoy)." />
      <ChartGrid cols={2}>
        <ChartCard title="Pertumbuhan Ekraf vs Non-Ekraf vs DKI" sub="% yoy (ADHK)">
          <GroupedLines
            series={[
              { name: "PDRB Ekraf", data: periode.map((p, i) => ({ label: label(p), value: M.tumbuhEkraf[i] })) },
              { name: "PDRB Non-Ekraf", data: periode.map((p, i) => ({ label: label(p), value: M.tumbuhNonEkraf[i] })) },
              { name: "PDRB DKI", data: periode.map((p, i) => ({ label: label(p), value: M.tumbuhDki[i] })) },
            ]}
          />
        </ChartCard>
        <ChartCard title={`Pertumbuhan per subsektor · ${label(sub)}`} sub="% yoy (ADHK)">
          <BarBreakdown data={tumbuhSub} unit="%" color="#0e7c42" />
        </ChartCard>
      </ChartGrid>
    </div>
  );
}
