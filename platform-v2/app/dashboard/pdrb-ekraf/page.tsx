import { PdrbEkrafStat } from "@/components/dashboard/PdrbEkrafStat";
import { SourceNote } from "@/components/dashboard/Kit";
import { PDRB_SUMBER } from "@/lib/dashboard/pdrb-ekraf";

export default function Page() {
  return (
    <>
      <div className="mb-4">
        <div className="apple-fine uppercase tracking-wider text-ink-muted-48">Kinerja Ekonomi Kreatif</div>
        <h2 className="text-[22px] font-bold tracking-tight text-ink">PDRB Ekonomi Kreatif (2017–2025)</h2>
      </div>
      <PdrbEkrafStat />
      <SourceNote>
        Sumber: {PDRB_SUMBER}. 2017–2018 dari hasil updating; 2019–Semester I 2025 dari penyusunan terbaru. Target
        kontribusi: RPJMD 2025–2029.
      </SourceNote>
    </>
  );
}
