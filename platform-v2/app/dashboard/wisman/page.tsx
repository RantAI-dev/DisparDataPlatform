import { getKunjunganDestinasi, getLamaMenginap, getPintuBulanan, getWisman, TARGET_WISMAN } from "@/lib/dashboard/data";
import { DestinasiStat } from "@/components/dashboard/DestinasiStat";
import { WismanStat } from "@/components/dashboard/WismanStat";
import { SectionHead, SourceNote } from "@/components/dashboard/Kit";

// Dinamis: saat build (image Docker) ClickHouse tak terjangkau — ISR akan membekukan halaman kosong.
export const dynamic = "force-dynamic";

export default async function Page() {
  const [data, los, pintuBulanan, destinasi] = await Promise.all([
    getWisman(),
    getLamaMenginap(),
    getPintuBulanan(),
    getKunjunganDestinasi(),
  ]);
  return (
    <>
      <div className="mb-4">
        <div className="apple-fine uppercase tracking-wider text-ink-muted-48">Kinerja Pariwisata</div>
        <h2 className="text-[22px] font-bold tracking-tight text-ink">Wisatawan Mancanegara (2024–2026)</h2>
      </div>
      <WismanStat data={data} los={los} target={TARGET_WISMAN} pintuBulanan={pintuBulanan} />
      <SectionHead
        title="Kunjungan ke Destinasi Wisata"
        desc="Jumlah kunjungan wisatawan mancanegara ke obyek wisata di DKI Jakarta, per bulan (Dinas Pariwisata dan Ekonomi Kreatif)."
      />
      <DestinasiStat rows={destinasi} jenis="Wisman" />
      <SourceNote>
        Sumber: Satu Data Jakarta (kunjungan bulanan dan kebangsaan, mulai 2024; pintu masuk semesteran), BPS Provinsi DKI
        Jakarta (pintu masuk bulanan 2024; rata-rata lama menginap hotel bintang); Dinas Pariwisata dan Ekonomi Kreatif DKI
        Jakarta (Jumlah Kunjungan Wisatawan ke Obyek Wisata Menurut Lokasi). Diperbarui otomatis setiap hari.
      </SourceNote>
    </>
  );
}
