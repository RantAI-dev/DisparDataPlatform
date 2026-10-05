import { Suspense } from "react";
import { getReadiness } from "@/lib/report";
import { FrameworkView } from "@/components/FrameworkView";
import { FrameworkDataLinks } from "@/components/FrameworkDataLinks";
import { GciOfficial } from "@/components/GciOfficial";

export const revalidate = 86400;

async function GciReadiness() {
  const all = await getReadiness();
  return <FrameworkView
    title="Kesiapan Data Indikator GCI"
    subtitle="Status kesiapan data Dispar untuk mengisi tiap indikator GCI (Kearney) — sumber dataset, tren, dan gap."
    rows={all.filter((r) => r.framework === "GCI")}
  />;
}

export default function GciPage() {
  return (
    <>
      <GciOfficial />
      <FrameworkDataLinks framework="GCI" />
      <Suspense fallback={<p role="status" className="mx-auto max-w-[1320px] px-6 py-6">Memuat kesiapan data GCI…</p>}>
        <GciReadiness />
      </Suspense>
    </>
  );
}
