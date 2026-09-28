import { getSertifikasi } from "@/lib/dashboard/data";
import { HUB_DIAMBIL, HUB_PER_KOTA, HUB_PER_SUBSEKTOR, HUB_SUMBER, HUB_TOTAL } from "@/lib/dashboard/ekraf-hub";
import { ChartCard, ChartGrid } from "@/components/pariwisata/DashboardKit";
import { BarBreakdown } from "@/components/charts/BarBreakdown";
import { Donut } from "@/components/charts/Donut";
import { GroupedBars } from "@/components/charts/GroupedBars";
import { KpiStat } from "@/components/charts/KpiStat";
import { PendingData, SectionHead, SourceNote } from "@/components/dashboard/Kit";

// Dinamis: saat build (image Docker) ClickHouse tak terjangkau — ISR akan membekukan halaman kosong.
export const dynamic = "force-dynamic";

const titleCase = (s: string) => s.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/** Proxy EKRAF Hub: badge peringatan supaya tidak dibaca sebagai angka tenaga kerja resmi. */
function ProxyBadge() {
  return (
    <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-semibold text-amber-800">
      proxy · akun terdaftar EKRAF Hub, bukan tenaga kerja resmi
    </span>
  );
}

export default async function Page() {
  const sert = await getSertifikasi();
  const years = [...new Set(sert.map((r) => r.tahun))].sort();
  const bidang = [...new Set(sert.map((r) => r.bidang))];
  const perTahun = years.map((y) => ({ label: y, value: sert.filter((r) => r.tahun === y).reduce((a, r) => a + r.jumlah, 0) }));
  const series = years.map((y) => ({
    name: y,
    data: bidang.map((b) => ({ label: titleCase(b), value: sert.find((r) => r.tahun === y && r.bidang === b)?.jumlah ?? 0 })),
  }));

  return (
    <>
      <div className="mb-4">
        <div className="apple-fine uppercase tracking-wider text-ink-muted-48">Kinerja Ekonomi Kreatif</div>
        <h2 className="text-[22px] font-bold tracking-tight text-ink">Tenaga Kerja Ekonomi Kreatif</h2>
      </div>

      <SectionHead title="1 · Jumlah tenaga kerja ekonomi kreatif tahun 2025" />
      <div className="grid gap-4 md:grid-cols-3">
        <div className="md:col-span-2">
          <PendingData
            title="Jumlah tenaga kerja ekraf DKI Jakarta 2025"
            need="Angka resmi tenaga kerja ekraf (Sakernas BPS via Kementerian Ekraf / Hub Ekraf) belum diterima. Tindak lanjut MoM 21 Sep: Tim Hub Ekraf & Pak Umar."
            source="hub.ekraf.go.id"
          />
        </div>
        <KpiStat label="Pelaku kreatif terdaftar EKRAF Hub (DKI)" value={HUB_TOTAL} sub={`proxy · akun terdaftar, diambil ${HUB_DIAMBIL}`} />
      </div>

      <SectionHead title="2 · Rincian berdasarkan subsektor ekonomi kreatif" />
      <ChartCard title="Pelaku kreatif terdaftar per subsektor" sub="DKI Jakarta">
        <div className="-mt-2 mb-2"><ProxyBadge /></div>
        <BarBreakdown data={HUB_PER_SUBSEKTOR} unit=" akun" />
      </ChartCard>

      <SectionHead title="3 · Sebaran per kota/kabupaten administrasi" />
      <ChartGrid cols={2}>
        <ChartCard title="Pelaku kreatif terdaftar per wilayah" sub="kota/kabupaten administrasi DKI">
          <div className="-mt-2 mb-2"><ProxyBadge /></div>
          <BarBreakdown data={HUB_PER_KOTA} unit=" akun" />
        </ChartCard>
        <ChartCard title="Komposisi per wilayah" sub="% dari akun terdaftar">
          <div className="-mt-2 mb-2"><ProxyBadge /></div>
          <Donut data={HUB_PER_KOTA} />
        </ChartCard>
      </ChartGrid>

      <SectionHead title="4 · Tren tenaga kerja ekraf 3–5 tahun terakhir" />
      <PendingData
        title="Tren tenaga kerja ekraf DKI Jakarta"
        need="EKRAF Hub tidak menyediakan deret waktu. Menunggu data tren resmi dari Hub Ekraf."
      />

      <SectionHead
        title="Tenaga kerja tersertifikasi / pendampingan Dinas"
        desc="Dipisah dari tenaga kerja umum untuk mengukur dampak program pengembangan SDM (MoM §3)."
      />
      <ChartGrid cols={2}>
        <ChartCard title="Peserta sertifikasi per tahun" sub="tenaga kerja pariwisata & ekraf tersertifikasi (orang)">
          <BarBreakdown data={perTahun} unit=" orang" color="#0e7c42" />
        </ChartCard>
        <ChartCard title="Per bidang sertifikasi" sub="orang · per tahun">
          <GroupedBars series={series} categories={bidang.map(titleCase)} unit=" orang" colors={["#f4a672", "#ed6b23", "#0e7c42"]} />
        </ChartCard>
      </ChartGrid>

      <SourceNote>
        Sumber: EKRAF Hub — {HUB_SUMBER} (akun pelaku kreatif terdaftar, bukan statistik tenaga kerja); Satu Data Jakarta
        via lakehouse — jumlah tenaga kerja pariwisata & ekraf yang tersertifikasi (2023–2025).
      </SourceNote>
    </>
  );
}
