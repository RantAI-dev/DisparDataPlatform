import { getSertifikasi, getTenagaKerjaEkraf } from "@/lib/dashboard/data";
import { ChartCard, ChartGrid, Kpi, KpiRow } from "@/components/pariwisata/DashboardKit";
import { BarBreakdown } from "@/components/charts/BarBreakdown";
import { TkSubsektor } from "@/components/dashboard/TkSubsektor";
import { ComboBarLine } from "@/components/charts/ComboBarLine";
import { GroupedBars } from "@/components/charts/GroupedBars";
import { SectionHead, SourceNote, idNum } from "@/components/dashboard/Kit";

// Dinamis: saat build (image Docker) ClickHouse tak terjangkau — ISR akan membekukan halaman kosong.
export const dynamic = "force-dynamic";

const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

export default async function Page() {
  const [tk, sert] = await Promise.all([getTenagaKerjaEkraf(), getSertifikasi()]);
  const dki = tk.dki.filter((r) => r.total > 0);
  const last = dki[dki.length - 1];
  const prev = dki[dki.length - 2];
  const growth = last && prev ? ((last.total - prev.total) / prev.total) * 100 : null;
  const share = (r: (typeof dki)[number]) => Math.round((r.total / r.nasional) * 10000) / 100;
  const years = [...new Set(sert.map((r) => r.tahun))].sort();
  const bidang = [...new Set(sert.map((r) => r.bidang))];
  const sertPerTahun = years.map((y) => ({ label: y, value: sert.filter((r) => r.tahun === y).reduce((a, r) => a + r.jumlah, 0) }));
  const sertSeries = years.map((y) => ({
    name: y,
    data: bidang.map((b) => ({ label: titleCase(b), value: sert.find((r) => r.tahun === y && r.bidang === b)?.jumlah ?? 0 })),
  }));

  return (
    <>
      <div className="mb-4">
        <div className="apple-fine uppercase tracking-wider text-ink-muted-48">Kinerja Ekonomi Kreatif</div>
        <h2 className="text-[22px] font-bold tracking-tight text-ink">Tenaga Kerja Ekonomi Kreatif</h2>
      </div>

      <SectionHead
        title="1 · Jumlah tenaga kerja ekonomi kreatif"
        desc="Statistik resmi Kemenekraf (olahan Sakernas BPS dengan Kemenekraf)"
      />
      {last ? (
        <KpiRow>
          <Kpi label={`Tenaga kerja ekraf DKI ${last.tahun}`} value={last.total} sub="orang" />
          <Kpi label={`Pertumbuhan ${last.tahun}`} value={growth != null ? `${idNum(growth, 1)}%` : "—"} delta={growth} sub={prev ? `vs ${prev.tahun}` : undefined} />
          <Kpi label={`Porsi terhadap nasional ${last.tahun}`} value={`${idNum(share(last), 2)}%`} sub={`nasional ${idNum(last.nasional)} orang`} />
          <Kpi label={`Laki-laki / Perempuan ${last.tahun}`} value={`${idNum(last.laki)} / ${idNum(last.perempuan)}`} sub="orang" />
        </KpiRow>
      ) : (
        <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-[13px] text-red-700">
          Data tenaga kerja ekonomi kreatif belum dapat ditampilkan. Coba muat ulang halaman.
        </div>
      )}

      <SectionHead title="2 · Rincian berdasarkan subsektor ekonomi kreatif" />
      <TkSubsektor rows={tk.subsektorNasional} />

      <SectionHead title="3 · Tren Tenaga Kerja Sektor Ekonomi Kreatif Provinsi DKI Jakarta" desc="5 tahun terakhir" />
      <ChartGrid cols={2}>
        <ChartCard title="Tenaga kerja ekraf DKI & porsi nasional" sub="batang = orang · garis = % terhadap nasional">
          <ComboBarLine
            categories={dki.map((r) => r.tahun)}
            bar={{ name: "Tenaga kerja (orang)", values: dki.map((r) => r.total) }}
            line={{ name: "Porsi nasional", values: dki.map(share), unit: "%" }}
          />
        </ChartCard>
        <ChartCard title="Menurut jenis kelamin" sub="orang">
          <GroupedBars
            categories={dki.map((r) => r.tahun)}
            series={[
              { name: "Laki-laki", data: dki.map((r) => ({ label: r.tahun, value: r.laki })) },
              { name: "Perempuan", data: dki.map((r) => ({ label: r.tahun, value: r.perempuan })) },
            ]}
            unit=" orang"
            colors={["#ed6b23", "#0e7c42"]}
          />
        </ChartCard>
      </ChartGrid>

      <SectionHead
        title="Tenaga kerja tersertifikasi / pendampingan Dinas"
        desc="Peserta pelatihan dan sertifikasi tenaga kerja pariwisata dan ekonomi kreatif yang didampingi Dinas, dipisahkan dari data tenaga kerja umum."
      />
      <ChartGrid cols={2}>
        <ChartCard title="Peserta sertifikasi per tahun" sub="Pelatihan dan sertifikasi tenaga kerja sektor pariwisata dan ekonomi kreatif">
          <BarBreakdown data={sertPerTahun} unit=" orang" color="#0e7c42" />
        </ChartCard>
        <ChartCard title="Per bidang sertifikasi" sub="orang · per tahun">
          <GroupedBars series={sertSeries} categories={bidang.map(titleCase)} unit=" orang" colors={["#f4a672", "#ed6b23", "#0e7c42"]} />
        </ChartCard>
      </ChartGrid>

      <SourceNote>
        Sumber: Satu Data Ekraf (Kemenekraf, olahan Sakernas BPS dan Kemenekraf) — satudata.ekraf.go.id; Satu Data Jakarta — tenaga
        kerja pariwisata &amp; ekraf tersertifikasi (2023–2025).
      </SourceNote>
    </>
  );
}
