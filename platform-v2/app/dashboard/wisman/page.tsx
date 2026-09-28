import { getLamaMenginap, getPintuBulanan, getWisman, TARGET_WISMAN } from "@/lib/dashboard/data";
import { WismanStat } from "@/components/dashboard/WismanStat";
import { SourceNote } from "@/components/dashboard/Kit";

// Dinamis: saat build (image Docker) ClickHouse tak terjangkau — ISR akan membekukan halaman kosong.
export const dynamic = "force-dynamic";

export default async function Page() {
  const [data, los, pintuBulanan] = await Promise.all([getWisman(), getLamaMenginap(), getPintuBulanan()]);
  return (
    <>
      <div className="mb-4">
        <div className="apple-fine uppercase tracking-wider text-ink-muted-48">Kinerja Pariwisata</div>
        <h2 className="text-[22px] font-bold tracking-tight text-ink">Wisatawan Mancanegara (2024–2026)</h2>
      </div>
      <WismanStat data={data} los={los} target={TARGET_WISMAN} pintuBulanan={pintuBulanan} />
      <SourceNote>
        Sumber: Satu Data Jakarta via lakehouse Disparekraf — silver.wisman_jakarta_per_bulan, wisman_jakarta_per_negara,
        jumlah_wisatawan (pintu masuk, semesteran), BPS pintu masuk per bulan (2024), rata-rata lama menginap hotel bintang (BPS). Diperbarui otomatis harian.
      </SourceNote>
    </>
  );
}
