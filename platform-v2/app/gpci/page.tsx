import { Suspense } from "react";
import { connection } from "next/server";
import { getReadiness } from "@/lib/report";
import { FrameworkDataLinks } from "@/components/FrameworkDataLinks";
import { FrameworkHeader, FrameworkView } from "@/components/FrameworkView";

export const revalidate = 86400;

const TITLE = "Mori — Global Power City Index (GPCI)";
const SUBTITLE = "Fungsi Cultural Interaction + konektivitas (Accessibility) pariwisata. Kesiapan data Dispar untuk mengisi indikator GPCI.";

async function GpciReadiness() {
  // Isi cache dari koneksi runtime, bukan dari build tanpa lakehouse.
  await connection();
  const all = await getReadiness();
  return <FrameworkView
    title={TITLE}
    subtitle={SUBTITLE}
    rows={all.filter((r) => r.framework === "GPCI")}
    afterHeader={<FrameworkDataLinks framework="GPCI" />}
    showTrend={false}
  />;
}

export default function GpciPage() {
  return (
      <Suspense fallback={<>
        <FrameworkHeader title={TITLE} subtitle={SUBTITLE} />
        <FrameworkDataLinks framework="GPCI" />
        <p role="status" className="mx-auto max-w-[1320px] px-6 py-6">Memuat kesiapan data GPCI…</p>
      </>}>
        <GpciReadiness />
      </Suspense>
  );
}
