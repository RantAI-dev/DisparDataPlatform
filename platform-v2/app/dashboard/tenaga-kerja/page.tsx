import { getSebaranPelakuEkrafDki, getSertifikasi, getTenagaKerjaEkraf } from "@/lib/dashboard/data";
import * as store from "@/lib/ch/store";
import { ChartCard, ChartGrid, Kpi, KpiRow, RawDataDisclosure } from "@/components/pariwisata/DashboardKit";
import { BarBreakdown } from "@/components/charts/BarBreakdown";
import { TkSubsektor } from "@/components/dashboard/TkSubsektor";
import { ComboBarLine } from "@/components/charts/ComboBarLine";
import { GroupedBars } from "@/components/charts/GroupedBars";
import { SectionHead, SourceNote, idNum } from "@/components/dashboard/Kit";
import { warnaSubsektor } from "@/lib/dashboard/subsektor-colors";

// Dinamis: saat build (image Docker) ClickHouse tak terjangkau — ISR akan membekukan halaman kosong.
export const dynamic = "force-dynamic";

const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/** Dataset sumber yang ditampilkan sebagai tabel di bawah grafik. */
const DATA_SUMBER = [
  { slug: "tenaga-kerja-ekraf-per-provinsi", title: "Tenaga kerja ekraf per provinsi (Kemenekraf)" },
  { slug: "tenaga-kerja-ekraf-per-subsektor-nasional", title: "Tenaga kerja ekraf per subsektor, nasional (Kemenekraf)" },
  { slug: "sebaran-pelaku-ekraf-jakarta", title: "Pelaku ekraf DKI terdaftar di EKRAF Hub" },
  {
    slug: "jumlah-tenaga-kerja-pariwisata-dan-ekonomi-kreatif-yang-tersertifikasi-tahun-2023-dan-2024",
    title: "Tenaga kerja pariwisata & ekraf tersertifikasi 2023–2024 (SDI)",
  },
  {
    slug: "jumlah-tenaga-kerja-pariwisata-dan-ekonomi-kreatif-yang-tersertifikasi",
    title: "Tenaga kerja pariwisata & ekraf tersertifikasi (SDI)",
  },
];

export default async function Page() {
  const [tk, sert, sebaranDki, totals] = await Promise.all([
    getTenagaKerjaEkraf(),
    getSertifikasi(),
    getSebaranPelakuEkrafDki(),
    store.syncTotals().catch(() => new Map<string, number>()),
  ]);
  const sebaran = sebaranDki.map((r) => ({ label: r.subsektor, value: r.jumlah }));
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
      <div className="mt-4">
        <ChartCard
          title="Sebaran Pelaku Ekonomi Kreatif per Subsektor di DKI Jakarta"
          sub="pelaku terdaftar di EKRAF Hub (hub.ekraf.go.id) yang berdomisili di DKI Jakarta — jumlah pelaku terdaftar, bukan jumlah tenaga kerja"
        >
          {sebaran.length ? (
            <BarBreakdown data={sebaran} unit=" pelaku" colors={sebaran.map((d) => warnaSubsektor(d.label))} />
          ) : (
            <p className="py-8 text-center text-[13px] text-ink-muted-48">Data sebaran pelaku ekraf DKI belum tersedia.</p>
          )}
        </ChartCard>
      </div>

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

      <SectionHead title="Data sumber" desc="Tabel dataset yang dipakai grafik di atas, dengan kolom sumber di sisi kanan." />
      <div className="space-y-2">
        {DATA_SUMBER.map((d) => (
          <RawDataDisclosure key={d.slug} slug={d.slug} title={d.title} count={totals.get(d.slug) ?? 0} label="Lihat data" />
        ))}
      </div>

      <SourceNote>
        Sumber: Satu Data Ekraf (Kemenekraf, olahan Sakernas BPS dan Kemenekraf) — satudata.ekraf.go.id; EKRAF Hub Kementerian
        Ekonomi Kreatif — hub.ekraf.go.id (pelaku terdaftar); Satu Data Jakarta — tenaga kerja pariwisata &amp; ekraf tersertifikasi
        (2023–2025).
      </SourceNote>
    </>
  );
}
