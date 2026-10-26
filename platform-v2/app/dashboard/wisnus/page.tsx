import { getKunjunganDestinasi, getLamaMenginap, getWisnusKotaTujuan } from "@/lib/dashboard/data";
import { DestinasiStat } from "@/components/dashboard/DestinasiStat";
import { WisnusLos } from "@/components/dashboard/WisnusLos";
import { WisnusStat } from "@/components/dashboard/WisnusStat";
import { SectionHead, SourceNote } from "@/components/dashboard/Kit";

// Dinamis: saat build (image Docker) ClickHouse tak terjangkau — ISR akan membekukan halaman kosong.
export const dynamic = "force-dynamic";

export default async function Page() {
  const [los, wisnus, destinasi] = await Promise.all([getLamaMenginap(), getWisnusKotaTujuan(), getKunjunganDestinasi()]);
  return (
    <>
      <div className="mb-4">
        <div className="apple-fine uppercase tracking-wider text-ink-muted-48">Kinerja Pariwisata</div>
        <h2 className="text-[22px] font-bold tracking-tight text-ink">Wisatawan Nusantara</h2>
        <p className="apple-fine text-ink-muted-48">Wisatawan Nusantara Berdasarkan Kota Tujuan</p>
      </div>

      <SectionHead title="Tahunan · Capaian" desc="Jumlah perjalanan wisatawan nusantara menurut kabupaten/kota tujuan di DKI Jakarta, 2019–2026 (Berdasarkan data BPS)." />
      <WisnusStat rows={wisnus} />

      <SectionHead title="Bulanan · Length of Stay" desc="Rata-rata lama menginap wisatawan nusantara di hotel bintang (hari)." />
      <WisnusLos los={los} />

      <SectionHead
        title="Kunjungan ke Destinasi Wisata"
        desc="Jumlah kunjungan wisatawan nusantara ke obyek wisata di DKI Jakarta, per bulan (Dinas Pariwisata dan Ekonomi Kreatif)."
      />
      <DestinasiStat rows={destinasi} jenis="Wisnus" />

      <SourceNote>
        Sumber: BPS Provinsi DKI Jakarta (Jumlah Perjalanan Wisatawan Nusantara Menurut Kabupaten/Kota Tujuan; rata-rata lama
        menginap tamu hotel bintang via Satu Data Jakarta); Dinas Pariwisata dan Ekonomi Kreatif DKI Jakarta (Jumlah Kunjungan
        Wisatawan ke Obyek Wisata Menurut Lokasi, via Satu Data Jakarta).
      </SourceNote>
    </>
  );
}
