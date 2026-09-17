"use client";
import dynamic from "next/dynamic";

/**
 * GMTI — Jakarta Ramah Muslim, tampilan DAFTAR.
 *
 * Di-mount client-only (ssr:false) karena GmtiView menggunakan Leaflet dan
 * agregat yang butuh `window`. Pola sama dengan `app/atlas/[section]/page.tsx`.
 */
const loading = () => (
  <div className="min-h-screen flex items-center justify-center bg-canvas">
    <div className="apple-caption text-ink-muted-48">Memuat…</div>
  </div>
);

const GmtiView = dynamic(
  () => import("@/components/GmtiView").then((m) => m.GmtiView),
  { ssr: false, loading }
);

export default function GmtiPage() {
  return <GmtiView />;
}