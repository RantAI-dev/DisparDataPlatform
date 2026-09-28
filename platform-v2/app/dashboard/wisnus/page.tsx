import { getLamaMenginap } from "@/lib/dashboard/data";
import { WisnusLos } from "@/components/dashboard/WisnusLos";
import { PendingData, SectionHead, SourceNote } from "@/components/dashboard/Kit";

// Dinamis: saat build (image Docker) ClickHouse tak terjangkau — ISR akan membekukan halaman kosong.
export const dynamic = "force-dynamic";

export default async function Page() {
  const los = await getLamaMenginap();
  return (
    <>
      <div className="mb-4">
        <div className="apple-fine uppercase tracking-wider text-ink-muted-48">Kinerja Pariwisata</div>
        <h2 className="text-[22px] font-bold tracking-tight text-ink">Wisatawan Nusantara</h2>
        <p className="apple-fine text-ink-muted-48">Fokus realisasi capaian, tanpa target. Filter utama: Kota Tujuan (bukan Kota Asal).</p>
      </div>

      <SectionHead title="Tahunan · Capaian" desc="Wisnus per Kota Tujuan, 2019–2026." />
      <PendingData
        title="Jumlah Perjalanan Wisatawan Nusantara Menurut Kabupaten/Kota Tujuan di DKI Jakarta (Perjalanan), 2019–2026"
        need="Tabel statistik BPS Jakarta (mobile positioning data) belum masuk lakehouse — situs BPS menolak pengambilan otomatis. Opsi: kunci WebAPI BPS atau unduhan tabel manual; bila BPS terlambat, dipakai rekap internal (MoM §5)."
        source="jakarta.bps.go.id → Tabel Statistik"
      />

      <SectionHead title="Bulanan · Length of Stay" desc="Rata-rata lama menginap wisatawan nusantara di hotel bintang (hari)." />
      <WisnusLos los={los} />

      <SourceNote>Sumber: rata-rata lama menginap tamu hotel bintang (BPS) via Satu Data Jakarta & lakehouse Disparekraf.</SourceNote>
    </>
  );
}
