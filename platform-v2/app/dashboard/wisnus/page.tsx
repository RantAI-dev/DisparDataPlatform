import { getLamaMenginap, getWisnusKotaTujuan } from "@/lib/dashboard/data";
import { WisnusLos } from "@/components/dashboard/WisnusLos";
import { WisnusStat } from "@/components/dashboard/WisnusStat";
import { SectionHead, SourceNote } from "@/components/dashboard/Kit";

// Dinamis: saat build (image Docker) ClickHouse tak terjangkau — ISR akan membekukan halaman kosong.
export const dynamic = "force-dynamic";

export default async function Page() {
  const [los, wisnus] = await Promise.all([getLamaMenginap(), getWisnusKotaTujuan()]);
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

      <SourceNote>
        Sumber: BPS Provinsi DKI Jakarta — Jumlah Perjalanan Wisatawan Nusantara Menurut Kabupaten/Kota Tujuan (dataset sekunder
        wisnus-perjalanan-per-kota-tujuan di lakehouse); rata-rata lama menginap tamu hotel bintang (BPS) via Satu Data Jakarta.
      </SourceNote>
    </>
  );
}
