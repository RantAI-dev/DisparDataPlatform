import { getLamaMenginap, getWisman, TARGET_WISMAN } from "@/lib/dashboard/data";
import { WismanStat } from "@/components/dashboard/WismanStat";
import { SourceNote } from "@/components/dashboard/Kit";

export const revalidate = 3600;

export default async function Page() {
  const [data, los] = await Promise.all([getWisman(), getLamaMenginap()]);
  return (
    <>
      <div className="mb-4">
        <div className="apple-fine uppercase tracking-wider text-ink-muted-48">Kinerja Pariwisata</div>
        <h2 className="text-[22px] font-bold tracking-tight text-ink">Wisatawan Mancanegara (2024–2026)</h2>
      </div>
      <WismanStat data={data} los={los} target={TARGET_WISMAN} />
      <SourceNote>
        Sumber: Satu Data Jakarta via lakehouse Disparekraf — silver.wisman_jakarta_per_bulan, wisman_jakarta_per_negara,
        jumlah_wisatawan (pintu masuk, semesteran), rata-rata lama menginap hotel bintang (BPS). Diperbarui otomatis harian.
      </SourceNote>
    </>
  );
}
